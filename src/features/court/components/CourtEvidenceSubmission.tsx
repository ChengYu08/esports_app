import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CourtAvatar } from "@/features/court/components/CourtAvatar";
import { formatTime, type CourtParty, type EvidenceSubmission } from "@/features/court/court.api";
import { COURT_FONT_FAMILY } from "@/features/court/court.theme";
import { createImagePreviewParams } from "@/features/mine/image-preview.params";
import { CachedImage } from "@/shared/ui/CachedImage";

type Props = {
  submission: EvidenceSubmission;
  party?: CourtParty;
  role: "PLAINTIFF" | "DEFENDANT";
};

export function CourtEvidenceSubmission({ submission, party, role }: Props) {
  const [imageSize, setImageSize] = useState(57);
  const isPlaintiff = role === "PLAINTIFF";
  const images = submission.imageUrls?.filter(Boolean) ?? [];

  return (
    <View style={styles.row}>
      <CourtAvatar uri={party?.avatar} size={32} />
      <View style={styles.content}>
        <View style={styles.authorAndText}>
          <View style={styles.author}>
            <Text numberOfLines={1} style={styles.name}>{party?.nickname?.trim() || "未知用户"}</Text>
            <View style={[styles.badge, !isPlaintiff && styles.defendantBadge]}>
              <Text style={[styles.badgeText, !isPlaintiff && styles.defendantText]}>{isPlaintiff ? "原告" : "被告"}</Text>
            </View>
          </View>
          {!!submission.content && <Text style={styles.body}>{submission.content}</Text>}
        </View>
        {images.length > 0 && (
          <View style={styles.images} onLayout={(event) => setImageSize(Math.min(57, Math.max(1, (event.nativeEvent.layout.width - 16) / 5)))}>
            {images.slice(0, 9).map((uri, index) => (
              <Pressable key={`${uri}-${index}`} accessibilityRole="button" accessibilityLabel={`查看${isPlaintiff ? "原告" : "被告"}举证图片 ${index + 1}`} onPress={() => router.push({ pathname: "/image-preview", params: createImagePreviewParams(images, index) })}>
                <CachedImage source={{ uri }} contentFit="cover" style={[styles.image, { width: imageSize, height: imageSize }]} />
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.time}>{formatTime(submission.submittedAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  content: { flex: 1, minWidth: 0, gap: 6 },
  authorAndText: { gap: 4 },
  author: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1, color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  badge: { backgroundColor: "#E8F4FF", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  badgeText: { color: "#3DA5FF", fontFamily: COURT_FONT_FAMILY, fontSize: 10, fontWeight: "600", lineHeight: 14 },
  defendantBadge: { backgroundColor: "#FFE5EB" },
  defendantText: { color: "#FE4267" },
  body: { color: "#0D0D0F", fontFamily: COURT_FONT_FAMILY, fontSize: 14, lineHeight: 22 },
  images: { flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: 301 },
  image: { borderRadius: 6, backgroundColor: "#F5F6F7" },
  time: { color: "#979799", fontFamily: COURT_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
});
