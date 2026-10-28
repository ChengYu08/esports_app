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

test("explicit non-audio types show a format error even with an audio extension", () => {
  for (const mimeType of ["image/png", "video/mp4", "application/pdf", "text/plain"]) {
    assert.throws(() => companionVoiceMimeType({ name: "intro.mp3", mimeType }), {
      message: "格式错误，只支持上传音频格式文件",
    });
  }
  assert.throws(() => companionVoiceMimeType({ name: "document.pdf" }), {
    message: "格式错误，只支持上传音频格式文件",
  });
});

test("audio extensions remain usable when system metadata is missing or generic", () => {
  for (const mimeType of [undefined, "", "application/octet-stream", "binary/octet-stream"]) {
    assert.equal(companionVoiceMimeType({ name: "intro.mp3", mimeType }), "audio/mpeg");
  }
  assert.equal(companionVoiceMimeType({ name: "intro.ogg", mimeType: "application/ogg" }), "audio/ogg");
  assert.equal(companionVoiceMimeType({ name: "intro.wav", mimeType: "Audio/WAV; codecs=1" }), "audio/wav");
});

test("duration accepts audio up to and including 15 seconds", () => {
  assert.equal(companionVoiceDuration(0.4), 1);
  assert.equal(companionVoiceDuration(12.6), 13);
  assert.equal(companionVoiceDuration(14.9), 15);
  assert.equal(companionVoiceDuration(15), 15);
});

test("duration rejects audio over 15 seconds before rounding", () => {
  for (const seconds of [15.001, 15.1, 15.49, 15.5, 16, 60, 61]) {
    assert.throws(() => companionVoiceDuration(seconds), { message: "语音时长不能超过15秒" });
  }
});

test("duration rejects unreadable media", () => {
  for (const seconds of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => companionVoiceDuration(seconds), /无法读取/);
  }
});
