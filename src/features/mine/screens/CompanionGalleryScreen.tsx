import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/AsyncStates";
import { CachedImage } from "@/shared/ui/CachedImage";
import { Add24Regular, Dismiss12Regular } from "@fluentui/react-native-icons";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Toast from "react-native-root-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { companionManagementApi as api } from "../api/companion-management.api";
import type { ManagedImage } from "../api/companion-management.contract";
import { selectCompanionImages } from "../companion-gallery-selection";
import { newestCompanionImages } from "../companion-image-order";
import { uploadCompanionMedia } from "../companion-upload";
import { CompanionDashboardHeader } from "../components/CompanionDashboardHeader";
import { CompanionImagePreview } from "../components/CompanionImagePreview";
import { useManagedGame } from "../hooks/use-companion-management";

const MAX_IMAGES = 9;
type PendingImage = { id: number; asset: ImagePicker.ImagePickerAsset };

export default function CompanionGalleryScreen() {
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageSize = (width - 40) / 3;
  const managed = useManagedGame(gameId);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const completedDeletes = useRef(new Set<number>());
  const uploadedUrls = useRef(new Map<number, string>());
  const nextLocalId = useRef(-1);
  const [preview, setPreview] = useState<ManagedImage | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const busy = picking || saving;
  const images: ManagedImage[] = [
    ...pendingImages.map(({ id, asset }) => ({ id, imageUrl: asset.uri })),
    ...newestCompanionImages(managed.detail.data?.images ?? []).filter(
      (image) => !removedIds.has(image.id),
    ),
  ];

  const addImages = async () => {
    if (busyRef.current || !managed.enabled || !gameId) return;
    if (images.length >= MAX_IMAGES) {
      Toast.show(`最多上传${MAX_IMAGES}张截图`, {
        position: Toast.positions.CENTER,
      });
      return;
    }
    busyRef.current = true;
    setPicking(true);
    try {
      managed.assertCurrentAccount();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // Android 使用原图片来源的文件名
        legacy: true,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.85,
      });
      if (result.canceled) return;
      managed.assertCurrentAccount();
      const { accepted, warnings } = selectCompanionImages(
        result.assets.slice(0, MAX_IMAGES - images.length).map((asset) => ({
          ...asset,
          fileSize: asset.fileSize ?? new File(asset.uri).size,
        })),
      );
      if (warnings.length) {
        Toast.show(warnings.join("\n"), { position: Toast.positions.CENTER });
      }
      if (!accepted.length) return;
      setPendingImages((current) => [
        ...accepted.map((asset) => ({ id: nextLocalId.current--, asset })),
        ...current,
      ]);
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "选择图片失败，请重试",
        {
          position: Toast.positions.CENTER,
        },
      );
    } finally {
      busyRef.current = false;
      setPicking(false);
    }
  };

  const removeImage = (image: ManagedImage) => {
    if (busyRef.current) return;
    if (image.id < 0) {
      setPendingImages((current) =>
        current.filter((item) => item.id !== image.id),
      );
      uploadedUrls.current.delete(image.id);
    } else {
      setRemovedIds((current) => new Set([...current, image.id]));
    }
  };

  const save = async () => {
    if (
      busyRef.current ||
      !managed.enabled ||
      !managed.detail.data ||
      managed.detail.isError
    )
      return;
    busyRef.current = true;
    setSaving(true);
    let success = false;
    try {
      managed.assertCurrentAccount();
      // 先校验并上传新文件，再删除已有图片；保留已上传的 URL 以便重试。
      for (const item of pendingImages) {
        if (uploadedUrls.current.has(item.id)) continue;
        managed.assertCurrentAccount();
        const url = await uploadCompanionMedia(
          managed.token,
          item.asset,
          "image",
        );
        uploadedUrls.current.set(item.id, url);
      }
      for (const id of removedIds) {
        if (completedDeletes.current.has(id)) continue;
        managed.assertCurrentAccount();
        await api.deleteImage(managed.token, id);
        completedDeletes.current.add(id);
      }
      // 按从旧到新的顺序持久化，这样服务端递减的 sortNo 能保持草稿的展示顺序。
      for (const item of [...pendingImages].reverse()) {
        managed.assertCurrentAccount();
        await api.addImage(
          managed.context,
          managed.token,
          uploadedUrls.current.get(item.id)!,
        );
        // 后续失败时，不能让已成功保存的图片被重复提交。
        setPendingImages((current) =>
          current.filter((image) => image.id !== item.id),
        );
        uploadedUrls.current.delete(item.id);
      }
      success = true;
    } catch (error) {
      Alert.alert(
        "保存未完成",
        error instanceof Error ? error.message : "请重试",
      );
    } finally {
      await managed.invalidate();
      busyRef.current = false;
      setSaving(false);
    }
    if (success) {
      Toast.show("保存成功", {
        duration: Toast.durations.SHORT,
        position: Toast.positions.CENTER,
      });
      router.back();
    }
  };

  return (
    <View style={styles.screen}>
      <CompanionDashboardHeader
        title="编辑技能截图"
        onSave={() => void save()}
        saving={saving}
        saveDisabled={
          busy ||
          !managed.enabled ||
          !managed.detail.data ||
          managed.detail.isError
        }
      />
      {!managed.enabled || !gameId ? (
        <EmptyState message={managed.unavailable || "未指定游戏"} />
      ) : managed.detail.isError ? (
        <ErrorState
          message={managed.detail.error.message}
          onRetry={() => void managed.detail.refetch()}
        />
      ) : managed.detail.isPending ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加技能截图"
              accessibilityHint={`最多${MAX_IMAGES}张，每张不超过2MB`}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void addImages()}
              style={[
                styles.cell,
                styles.add,
                { width: imageSize, height: imageSize },
              ]}
            >
              <Add24Regular color="#CCC" width={24} height={24} />
            </Pressable>
            {images.map((image, index) => (
              <View
                key={image.id}
                style={[styles.cell, { width: imageSize, height: imageSize }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`预览技能截图${index + 1}`}
                  onPress={() => setPreview(image)}
                  style={styles.picture}
                >
                  <CachedImage
                    source={{ uri: image.imageUrl }}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`删除技能截图${index + 1}`}
                  disabled={busy}
                  onPress={() => removeImage(image)}
                  style={styles.remove}
                >
                  <View style={styles.removeIcon}>
                    <Dismiss12Regular color="#FFF" width={12} height={12} />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <CompanionImagePreview image={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F7" },
  content: { paddingHorizontal: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { borderRadius: 4, backgroundColor: "#F7F7F7" },
  picture: { flex: 1, borderRadius: 4, overflow: "hidden" },
  remove: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    alignItems: "flex-end",
  },
  removeIcon: {
    width: 16,
    height: 16,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  add: { justifyContent: "center", alignItems: "center" },
});
