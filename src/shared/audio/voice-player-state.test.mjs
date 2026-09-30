import test from "node:test";
import assert from "node:assert/strict";
import { nextVoicePlayback } from "./voice-player-state.mjs";

test("starts a voice and toggles the same voice off", () => {
  assert.deepEqual(nextVoicePlayback(null, "voice-a"), "voice-a");
  assert.deepEqual(nextVoicePlayback("voice-a", "voice-a"), null);
});

test("switches directly to a different voice", () => {
  assert.deepEqual(nextVoicePlayback("voice-a", "voice-b"), "voice-b");
});
