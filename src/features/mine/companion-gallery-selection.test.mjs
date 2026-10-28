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
  const result = selectCompanionImages([{ fileName: null, fileSize: limit + 1 }, { fileName: '', fileSize: limit + 2 }]);
  assert.deepEqual(result.accepted, []);
  assert.deepEqual(result.warnings, ['图片超过2MB，已跳过', '图片超过2MB，已跳过']);
});
