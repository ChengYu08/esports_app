import * as WebBrowser from "expo-web-browser";

export async function openExternalLink(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    // A browser may be unavailable in a restricted device or test runtime.
  }
}
