import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import type { OrderReview } from "../order.api";

export function OrderReviewSheet({ visible, readonly, detail, onClose, onSubmit }: { visible: boolean; readonly: boolean; detail?: OrderReview | null; onClose: () => void; onSubmit: (rating: number, content: string) => Promise<void> }) {
  const [rating, setRating] = useState(5); const [content, setContent] = useState("");
  // The sheet is remounted by its parent when switching between editable and read-only reviews.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (detail) { setRating(detail.rating); setContent(detail.content || ""); } else if (visible && !readonly) { setRating(5); setContent(""); } }, [detail, readonly, visible]);
  return <BottomSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}><View style={styles.header}><Text style={styles.title}>{readonly ? "评价详情" : "评价"}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><View style={styles.stars}>{[1,2,3,4,5].map((item) => <Pressable key={item} disabled={readonly} onPress={() => setRating(item)}><Text style={[styles.star, item <= rating && styles.starOn]}>★</Text></Pressable>)}</View>{readonly ? <Text style={styles.readonly}>{content || "暂未填写评价内容"}</Text> : <TextInput multiline maxLength={500} value={content} onChangeText={setContent} placeholder="请输入评价内容（选填）" style={styles.input} />}{!readonly && <Pressable style={styles.submit} onPress={() => void onSubmit(rating, content)}><Text style={styles.submitText}>提交评价</Text></Pressable>}</BottomSheet>;
}
const styles = StyleSheet.create({ sheet: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { fontSize: 18, fontWeight: "700" }, close: { fontSize: 28, color: "#777" }, stars: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 22 }, star: { fontSize: 32, color: "#DDD" }, starOn: { color: "#FFB21C" }, input: { minHeight: 110, borderRadius: 8, backgroundColor: "#F7F7F7", padding: 12, textAlignVertical: "top" }, readonly: { minHeight: 80, color: "#333", lineHeight: 22 }, submit: { marginTop: 16, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FE1F4C" }, submitText: { color: "#FFF", fontWeight: "600" } });
