import * as Crypto from "expo-crypto";
import {
  ErrorCode,
  finishTransaction as finishStoreTransaction,
  type Product,
  type Purchase,
  useIAP,
} from "expo-iap";
import { requireOptionalNativeModule } from "expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  createPurchaseIntent,
  fetchIapProducts,
  submitIapTransactions,
} from "./apple-star.api";

export type StarPackage = {
  productId: string;
  stars: number;
};

export type StarIapStatus =
  | "idle"
  | "loading"
  | "ready"
  | "purchasing"
  | "pending"
  | "verifying"
  | "success"
  | "error";

type UseStarIapOptions = {
  token: string | null;
  onDelivered?: () => void;
  onPending?: (result: { message?: string }) => void;
};

type PurchaseWithOptionalIosFields = Purchase & {
  purchaseToken?: string | null;
};

type UseStarIapResult = {
  connected: boolean;
  /** 服务端下发的可售档位（为空表示尚未加载或无可用档位） */
  packages: StarPackage[];
  /** StoreKit 商品详情，按 productId 与 packages 对齐取价格 */
  products: Product[];
  status: StarIapStatus;
  errorMessage: string | null;
  purchase: (productId: string) => Promise<void>;
  clearError: () => void;
};

const FREQUENCY_LIMIT_MESSAGE = "操作过于频繁";

function getPurchaseErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: ErrorCode }).code;
    if (code === ErrorCode.UserCancelled) {
      return "已取消购买";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "购买失败，请稍后重试";
}

function getTransactionId(purchase: Purchase): string | null {
  return purchase.transactionId || purchase.id || null;
}

function getTransactionJws(purchase: Purchase): string | null {
  const jws = (purchase as PurchaseWithOptionalIosFields).purchaseToken;
  return typeof jws === "string" && jws.length > 0 ? jws : null;
}

function createUuid(): string {
  return Crypto.randomUUID();
}

function useNativeStarIap({
  token,
  onDelivered,
  onPending,
}: UseStarIapOptions): UseStarIapResult {
  const [status, setStatus] = useState<StarIapStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [packages, setPackages] = useState<StarPackage[]>([]);
  const processingTransactionsRef = useRef(new Set<string>());
  const clientRequestIdsRef = useRef(new Map<string, string>());
  const loadedSkusRef = useRef<string>("");
  const onDeliveredRef = useRef(onDelivered);
  const onPendingRef = useRef(onPending);

  useEffect(() => {
    onDeliveredRef.current = onDelivered;
    onPendingRef.current = onPending;
  }, [onDelivered, onPending]);

  const reportTransaction = useCallback(
    async (purchase: Purchase) => {
      const transactionId = getTransactionId(purchase);
      if (!transactionId) {
        throw new Error("未获取到苹果交易号");
      }

      if (processingTransactionsRef.current.has(transactionId)) {
        return;
      }

      if (!token) {
        throw new Error("请先登录后再领取充值内容");
      }

      processingTransactionsRef.current.add(transactionId);
      try {
        const jws = getTransactionJws(purchase);
        if (!jws) {
          // JWS 缺失的交易无法上报，丢弃并等待 StoreKit 重新下发。
          return;
        }

        const [result] = await submitIapTransactions([jws], token);
        if (!result) {
          return;
        }

        if (result.status === "DELIVERED") {
          await finishStoreTransaction({ purchase, isConsumable: true });
          onDeliveredRef.current?.();
          return;
        }

        if (result.status === "PENDING") {
          // 保留交易，等待启动/回前台重放；不 finish。
          onPendingRef.current?.({ message: result.message });
          return;
        }

        throw new Error(result.message || "交易凭证校验失败，请联系客服");
      } finally {
        processingTransactionsRef.current.delete(transactionId);
      }
    },
    [token],
  );

  const handlePurchaseSuccess = useCallback(
    (purchase: Purchase) => {
      if (purchase.purchaseState === "pending") {
        setStatus("pending");
        return;
      }

      if (purchase.purchaseState !== "purchased") {
        setStatus("error");
        setErrorMessage("苹果交易状态异常");
        return;
      }

      setStatus("verifying");
      reportTransaction(purchase)
        .then(() => {
          setStatus((current) => (current === "verifying" ? "success" : current));
        })
        .catch((error: unknown) => {
          setStatus("error");
          setErrorMessage(getPurchaseErrorMessage(error));
        });
    },
    [reportTransaction],
  );

  const {
    connected,
    products,
    fetchProducts,
    getAvailablePurchases,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: handlePurchaseSuccess,
    onPurchaseError: (error) => {
      setStatus("error");
      setErrorMessage(getPurchaseErrorMessage(error));
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  // 档位由服务端下发：先取档位，再按 productId 向 StoreKit 拉价格。
  useEffect(() => {
    if (Platform.OS !== "ios" || !connected || !token) {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (active) {
        setStatus("loading");
      }
    });
    fetchIapProducts(token)
      .then(async (list) => {
        if (!active) {
          return;
        }
        const nextPackages = list
          .map((item) => ({
            productId: item.productId,
            stars: Number(item.starAmount) || 0,
          }))
          .sort((a, b) => a.stars - b.stars);
        setPackages(nextPackages);

        const skus = nextPackages.map((item) => item.productId);
        const skusKey = skus.join(",");
        if (skus.length > 0 && skusKey !== loadedSkusRef.current) {
          loadedSkusRef.current = skusKey;
          await fetchProducts({ skus, type: "in-app" });
        }
        if (active) {
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setStatus("error");
        setErrorMessage(getPurchaseErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [connected, token, fetchProducts]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !connected) {
      return;
    }

    // 启动重放：未完成交易交还给监听器，由 handlePurchaseSuccess 统一上报。
    getAvailablePurchases({
      alsoPublishToEventListenerIOS: true,
      onlyIncludeActiveItemsIOS: false,
    }).catch(() => {
      // 监听器仍会收到 StoreKit 的正常重放。
    });
  }, [connected, getAvailablePurchases]);

  const purchase = useCallback(
    async (productId: string) => {
      if (Platform.OS !== "ios") {
        setStatus("error");
        setErrorMessage("当前仅支持 iOS 内购");
        return;
      }

      if (!token) {
        setStatus("error");
        setErrorMessage("请先登录后再充值");
        return;
      }

      if (!connected) {
        setStatus("error");
        setErrorMessage("苹果内购服务尚未准备好，请稍后重试");
        return;
      }

      setErrorMessage(null);
      setStatus("purchasing");

      try {
        let clientRequestId = clientRequestIdsRef.current.get(productId);
        if (!clientRequestId) {
          clientRequestId = createUuid();
          clientRequestIdsRef.current.set(productId, clientRequestId);
        }

        let intent;
        try {
          intent = await createPurchaseIntent(
            { productId, clientRequestId },
            token,
          );
        } catch (error: unknown) {
          // 并发防重命中时静默重试一次（服务端约定）。
          if (
            error instanceof Error &&
            error.message.includes(FREQUENCY_LIMIT_MESSAGE)
          ) {
            intent = await createPurchaseIntent(
              { productId, clientRequestId },
              token,
            );
          } else {
            throw error;
          }
        }

        await requestPurchase({
          type: "in-app",
          request: {
            apple: { sku: productId, appAccountToken: intent.appAccountToken },
          },
        });
      } catch (error: unknown) {
        setStatus("error");
        setErrorMessage(getPurchaseErrorMessage(error));
      }
    },
    [connected, requestPurchase, token],
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setStatus(connected ? "ready" : "idle");
  }, [connected]);

  return {
    connected,
    packages,
    products: products as Product[],
    status,
    errorMessage,
    purchase,
    clearError,
  };
}

function useUnavailableStarIap(): UseStarIapResult {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    "苹果内购需要使用 iOS Development Build，Expo Go 暂不支持。",
  );

  const purchase = useCallback(async () => {
    setErrorMessage(
      "苹果内购需要使用 iOS Development Build，Expo Go 暂不支持。",
    );
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    connected: false,
    packages: [],
    products: [],
    status: "error",
    errorMessage,
    purchase,
    clearError,
  };
}

const hasExpoIapNativeModule =
  requireOptionalNativeModule("ExpoIap") !== null;
const useStarIapImplementation = hasExpoIapNativeModule
  ? useNativeStarIap
  : useUnavailableStarIap;

export function useStarIap(options: UseStarIapOptions): UseStarIapResult {
  return useStarIapImplementation(options);
}
