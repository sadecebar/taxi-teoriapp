import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingSeconds } from '../src/mobile-timer.js';

test('timed exam catches up after app has been suspended', () => {
  const started = 100000;
  const deadline = started + 50 * 60 * 1000;
  assert.equal(remainingSeconds(deadline, started), 3000);
  assert.equal(remainingSeconds(deadline, started + 10 * 60 * 1000), 2400);
  assert.equal(remainingSeconds(deadline, deadline + 60000), 0);
  assert.equal(remainingSeconds(null, started), null);
});
