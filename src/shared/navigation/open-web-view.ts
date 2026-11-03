import { router } from "expo-router";

// App 内 WebView 打开网页（协议等），避免跳外部浏览器
export function openInAppWebView(url: string, title: string): void {
  router.push({ pathname: "/web-view", params: { url, title } });
}
