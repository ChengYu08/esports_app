import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DOUYIN_SANS } from "@/shared/theme/typography";
import { APP_LINKS } from "@/core/config/links";
import { openExternalLink } from "@/shared/navigation/open-external-link";

const backIcon = require("../../../../assets/home/club-detail/icon-back.svg");

const documents = {
  user: {
    title: "用户协议",
    url: APP_LINKS.userAgreement,
    sections: [
      ["一、协议范围", "欢迎使用盼之电竞。注册、登录或使用平台服务，即表示你已阅读并同意本协议。"],
      ["二、账号使用", "请使用真实有效的信息注册账号，并妥善保管账号和密码。账号下的操作视为本人行为。"],
      ["三、平台服务", "平台提供游戏陪玩、订单撮合、消息沟通等服务，具体服务内容以页面实际展示为准。"],
      ["四、行为规范", "使用平台时请遵守法律法规和平台规则，不发布违法违规内容，不进行线下私下交易。"],
    ],
  },
  privacy: {
    title: "隐私协议",
    url: APP_LINKS.privacyPolicy,
    sections: [
      ["一、信息收集", "为完成注册、身份验证、订单履约和客服沟通，我们会收集必要的手机号、昵称、头像和订单信息。"],
      ["二、信息使用", "我们仅在提供产品服务、保障交易安全和履行法律义务所需范围内使用你的个人信息。"],
      ["三、信息保护", "我们会通过访问控制、加密传输等措施保护个人信息，并限制无关人员访问。"],
      ["四、你的权利", "你可以在设置中修改个人资料、管理账号，并按照页面指引申请注销账号。"],
    ],
  },
} as const;

export default function ProtocolScreen() {
  const insets = useSafeAreaInsets();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const document = kind === "privacy" ? documents.privacy : documents.user;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { height: 44 + insets.top, paddingTop: insets.top }]}>
        <Pressable accessibilityLabel="返回" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Image source={backIcon} style={styles.backIcon} />
        </Pressable>
        <Text style={styles.headerTitle}>{document.title}</Text>
        <View style={styles.headerSpace} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {document.sections.map(([heading, body]) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        <Pressable
          accessibilityRole="link"
          onPress={() => void openExternalLink(document.url)}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>查看完整{document.title}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF" },
  header: { backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EBEBEB" },
  backButton: { width: 28, height: 28, justifyContent: "center" },
  backIcon: { width: 24, height: 24, tintColor: "#0A0A0A" },
  headerSpace: { width: 28 },
  headerTitle: { color: "#0A0A0A", fontFamily: DOUYIN_SANS, fontSize: 17, lineHeight: 24, fontWeight: "600" },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  heading: { color: "#111", fontFamily: DOUYIN_SANS, fontSize: 16, lineHeight: 24, fontWeight: "600", marginBottom: 8 },
  body: { color: "#555", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 24 },
  linkButton: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 8 },
  linkText: { color: "#FF1F4C", fontFamily: DOUYIN_SANS, fontSize: 14, lineHeight: 22 },
});
