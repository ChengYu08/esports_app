import { storage } from "@/core/storage/storage";

const PRIVACY_CONSENT_KEY = "esports.privacy.consent.v1";

export async function readPrivacyConsent(): Promise<boolean> {
  try {
    return (await storage.get(PRIVACY_CONSENT_KEY)) === "accepted";
  } catch {
    // A storage failure must fail closed: the user should still see the notice.
    return false;
  }
}

export async function savePrivacyConsent(): Promise<void> {
  await storage.set(PRIVACY_CONSENT_KEY, "accepted");
}
