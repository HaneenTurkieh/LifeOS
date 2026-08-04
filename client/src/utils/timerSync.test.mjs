import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFromServer } from './timerSync.mjs';

test('paused timer returns the exact stored remaining time, unchanged', () => {
  const result = computeFromServer({ running: false, remaining_seconds: 300, duration_seconds: 1500, started_at: null });
  assert.equal(result.timeLeft, 300);
  assert.equal(result.isRunning, false);
  assert.equal(result.startedAt, null);
});

test('running timer subtracts real elapsed time since started_at', () => {
  const startedAt = new Date(Date.now() - 30000).toISOString();
  const result = computeFromServer({ running: true, remaining_seconds: 300, duration_seconds: 1500, started_at: startedAt });
  assert.ok(result.timeLeft <= 271 && result.timeLeft >= 268, `expected ~270s left, got ${result.timeLeft}`);
  assert.equal(result.isRunning, true);
});

test('a timer that finished while the device was closed reports 0 / not running', () => {
  const startedAt = new Date(Date.now() - 400000).toISOString();
  const result = computeFromServer({ running: true, remaining_seconds: 300, duration_seconds: 1500, started_at: startedAt });
  assert.equal(result.timeLeft, 0);
  assert.equal(result.isRunning, false);
  assert.equal(result.startedAt, null);
});
