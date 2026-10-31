import { complaintStyles } from "@/features/court/complaint.styles";
import { preparePickedEvidenceImage } from "@/features/court/court-evidence-image";
import { beginMediaPick } from "@/shared/media-picker/media-picker-session";
import { CachedImage } from "@/shared/ui/CachedImage";
import { useAuthStore } from "@esports/auth";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { showToast, toastDurations } from "@/shared/ui/app-toast";

export type UploadItem = {
  uri: string;
  name: string;
  mimeType?: string | null;
  key?: string;
  retained?: boolean;
};

const MAX_IMAGES = 9;

export function useEvidenceImages(
  accessToken: string | null,
  onAccountChanged: () => void,
) {
  const [images, setImages] = useState<UploadItem[]>([]);
  const [pickingImages, setPickingImages] = useState(false);
  const pickingImagesRef = useRef(false);
  const mountedRef = useRef(true);

  const checkAccount = useCallback(() => {
    if (!mountedRef.current) {
      throw new Error("表单已关闭");
    }
    if (!accessToken || useAuthStore.getState().accessToken !== accessToken) {
      throw new Error("登录状态已变化，请重新登录后提交");
    }
  }, [accessToken]);

  const checkAccountRef = useRef(checkAccount);
  useEffect(() => {
    checkAccountRef.current = checkAccount;
  }, [checkAccount]);

  const pickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES || pickingImagesRef.current) {
      return;
    }
    pickingImagesRef.current = true;
    setPickingImages(true);
    try {
      // 相册选择页内部处理权限，选图结果经会话桥接回传
      const pickPending = beginMediaPick();
      router.push({
        pathname: "/media-picker",
        params: { max: String(MAX_IMAGES - images.length) },
      });
      const pickedUris = await pickPending;
      if (!pickedUris?.length) {
        return;
      }
      const picked: UploadItem[] = [];
      let failed = 0;
      for (const imageUri of pickedUris) {
        try {
          picked.push(await preparePickedEvidenceImage(imageUri));
        } catch {
          failed += 1;
        }
      }
      checkAccountRef.current();
      setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES));
      if (failed > 0) {
        showToast(`${failed}张图片无法读取或转换，请重新选择或截图后上传`, {
          duration: toastDurations.LONG,
        });
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "图片选择失败，请重试",
      );
    } finally {
      pickingImagesRef.current = false;
      setPickingImages(false);
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((current) => current.filter((_, i) => i !== index));
  }, []);

  function markUploaded(uri: string, key: string) {
    setImages((current) =>
      current.map((row) => (row.uri === uri ? { ...row, key } : row)),
    );
  }

  const uploadAll = useCallback(
    async (uploadOne: (image: UploadItem) => Promise<string>) => {
      const uploaded: UploadItem[] = [];
      for (const image of images) {
        onAccountChanged();
        if (image.key) {
          uploaded.push(image);
          continue;
        }
        const key = await uploadOne(image);
        uploaded.push({ ...image, key });
        markUploaded(image.uri, key);
      }
      return uploaded
        .map((image) => image.key)
        .filter((key): key is string => Boolean(key));
    },
    // images 变化时重建，提交时读取最新值
    [images, onAccountChanged],
  );

  return {
    images,
    setImages,
    pickingImages,
    pickImages,
    removeImage,
    uploadAll,
    checkAccount,
  };
}

export function CourtEvidencePicker({
  images,
  picking,
  disabled,
  showCount,
  onPick,
  onRemove,
}: {
  images: UploadItem[];
  picking: boolean;
  disabled: boolean;
  showCount: boolean;
  onPick: () => void;
  onRemove: (index: number) => void;
}) {
  const styles = complaintStyles;
  return (
    <View style={styles.uploadSection}>
      <Text style={styles.requiredLabel}>
        {showCount ? `证据截图(${images.length}/${MAX_IMAGES})` : "证据截图"}
      </Text>
      <View style={styles.images}>
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`预览第${index + 1}张证据截图`}
              disabled={disabled}
              onPress={() =>
                router.push({
                  pathname: "/image-preview",
                  params: {
                    images: JSON.stringify(images.map((item) => item.uri)),
                    index: String(index),
                  },
                })
              }
            >
              <Image source={{ uri: image.uri }} style={styles.image} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="删除图片"
              disabled={disabled}
              onPress={() => onRemove(index)}
              style={styles.removeImage}
            >
              <CachedImage
                source={require("../../../../assets/voice-room/close.svg")}
                tintColor="#FFFFFF"
                style={styles.removeIcon}
              />
            </Pressable>
            {image.key && (
              <View style={styles.uploaded}>
                <CachedImage
                  source={require("../../../../assets/order/order-step-check.svg")}
                  style={styles.uploadedIcon}
                />
              </View>
            )}
          </View>
        ))}
        {images.length < MAX_IMAGES && (
          <Pressable
            accessibilityLabel="添加证据图片"
            accessibilityRole="button"
            disabled={disabled}
            onPress={onPick}
            style={styles.addImage}
          >
            {picking ? (
              <ActivityIndicator color="#979799" />
            ) : (
              <CachedImage
                source={require("../../../../assets/court/ticket-add.svg")}
                style={styles.addIcon}
              />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
