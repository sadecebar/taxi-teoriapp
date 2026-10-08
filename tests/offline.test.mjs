import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BUNDLED_IMAGES } from '../src/bundled-images.js';

test('every bundled question image is available on disk without a server', () => {
  assert.equal(Object.keys(BUNDLED_IMAGES).length, 150);
  for (const [url, file] of Object.entries(BUNDLED_IMAGES)) {
    assert.match(url, /^https:\/\/(www\.)?teori-taxi\.com\/images\//);
    assert.match(file, /^question-images\/[a-z0-9]+\.(png|webp)$/);
    assert.ok(existsSync(new URL('../public/' + file, import.meta.url)), `Missing ${file}`);
  }
});
