import { getSystemConversationTitle } from "./system-conversations";

/** Returns the title shown to the user while keeping the server nickname intact. */
export function getConversationDisplayTitle(
  id: string,
  title: string,
  note?: string,
): string {
  return note?.trim() || getSystemConversationTitle(id, title);
}
