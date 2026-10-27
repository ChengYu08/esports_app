import test from 'node:test';
import assert from 'node:assert/strict';
import { newestCompanionImages } from './companion-image-order.ts';

test('newly appended server images display first without changing cached data', () => {
  const images = [
    { id: 11, imageUrl: 'old.jpg', sortNo: 0 },
    { id: 12, imageUrl: 'second-selected.jpg', sortNo: 1 },
    { id: 13, imageUrl: 'first-selected.jpg', sortNo: 2 },
  ];
  assert.deepEqual(newestCompanionImages(images).map(image => image.imageUrl), [
    'first-selected.jpg', 'second-selected.jpg', 'old.jpg',
  ]);
  assert.deepEqual(images.map(image => image.id), [11, 12, 13]);
});

test('equal or missing sort numbers use descending record IDs consistently', () => {
  const images = [
    { id: 11, imageUrl: 'old.jpg' },
    { id: 14, imageUrl: 'new.jpg', sortNo: 0 },
    { id: 12, imageUrl: 'middle.jpg' },
  ];
  assert.deepEqual(newestCompanionImages(images).map(image => image.id), [14, 12, 11]);
  assert.deepEqual(newestCompanionImages([]), []);
});
