import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCompanionImages } from './companion-gallery-selection.ts';

const limit = 2 * 1024 * 1024;
test('mixed selection skips oversized images and retains valid images in order', () => {
  const first = { fileName: '第一张.jpg', fileSize: 1024 };
  const exact = { fileName: '边界.png', fileSize: limit };
  const originalName = 'c0042827f42806483f424355a1491450.png';
  const result = selectCompanionImages([first, { fileName: originalName, fileSize: limit + 1 }, exact]);
  assert.deepEqual(result.accepted, [first, exact]);
  assert.deepEqual(result.warnings, [`${originalName}超过2MB，已跳过`]);
});
test('all oversized images are skipped, using the Web fallback for missing names', () => {
  const result = selectCompanionImages([
    { fileName: null, mimeType: 'image/jpeg', fileSize: limit + 1 },
    { fileName: '', mimeType: 'image/jpeg', fileSize: limit + 2 },
  ]);
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(result.warnings, ['图片超过2MB，已跳过', '图片超过2MB，已跳过']);
});
test('unsupported formats are rejected by mime type before the size check', () => {
  const result = selectCompanionImages([
    { fileName: '动图.gif', mimeType: 'image/gif', fileSize: limit + 1 },
    { fileName: '伪装成图片.jpg', mimeType: 'image/gif', fileSize: 1024 },
    { fileName: '截图.webp', mimeType: 'image/webp', fileSize: 1024 },
  ]);
  assert.deepEqual(result.accepted.map((file) => file.fileName), ['截图.webp']);
  assert.deepEqual(result.warnings, [
    '动图.gif格式不支持，仅支持 JPG/PNG/WebP',
    '伪装成图片.jpg格式不支持，仅支持 JPG/PNG/WebP',
  ]);
});
test('files without mime type fall back to the filename extension', () => {
  const result = selectCompanionImages([
    { fileName: '相册图片.jpeg', fileSize: 1024 },
    { fileName: '动图.GIF', fileSize: 1024 },
    { fileName: '无后缀文件', fileSize: 1024 },
  ]);
  assert.deepEqual(result.accepted.map((file) => file.fileName), ['相册图片.jpeg']);
  assert.deepEqual(result.warnings, [
    '动图.GIF格式不支持，仅支持 JPG/PNG/WebP',
    '无后缀文件格式不支持，仅支持 JPG/PNG/WebP',
  ]);
});
