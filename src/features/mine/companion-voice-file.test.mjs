import test from "node:test";
import assert from "node:assert/strict";
import { companionVoiceDuration, companionVoiceMimeType } from "./companion-voice-file.ts";

test("audio uploads retain their MIME type and accept Web-supported extensions", () => {
  assert.equal(companionVoiceMimeType({ name: "intro.MP3", mimeType: "application/octet-stream" }), "audio/mpeg");
  for (const [extension, mimeType] of [["wav", "audio/wav"], ["m4a", "audio/mp4"], ["aac", "audio/aac"], ["ogg", "audio/ogg"]]) {
    assert.equal(companionVoiceMimeType({ name: `intro.${extension}` }), mimeType);
  }
  assert.equal(companionVoiceMimeType({ name: "intro.flac", mimeType: "audio/flac" }), "audio/flac");
  assert.throws(() => companionVoiceMimeType({ name: "image.png", mimeType: "image/png" }), { message: "格式错误，只支持上传音频格式文件" });
  assert.throws(() => companionVoiceMimeType({ name: "intro.mp3", size: 0 }), /为空/);
});

test("duration follows Web rounding and 60-second maximum, rejects unreadable media", () => {
  assert.equal(companionVoiceDuration(0.4), 1);
  assert.equal(companionVoiceDuration(12.6), 13);
  assert.equal(companionVoiceDuration(60), 60);
  assert.throws(() => companionVoiceDuration(61), /不能超过60秒/);
  for (const seconds of [0, -1, NaN, Infinity]) {
    assert.throws(() => companionVoiceDuration(seconds), /无法读取/);
  }
});
