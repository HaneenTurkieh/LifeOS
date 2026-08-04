const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDedupeKey } = require('./notificationDedupe');

test('overdue task dedupes across days — same task, different days, same key', () => {
  const key1 = buildDedupeKey('overdue', '/tasks?task=42', '2026-08-01');
  const key2 = buildDedupeKey('overdue', '/tasks?task=42', '2026-08-04');
  assert.equal(key1, key2);
});

test('different tasks produce different keys', () => {
  const key1 = buildDedupeKey('overdue', '/tasks?task=1', '2026-08-04');
  const key2 = buildDedupeKey('overdue', '/tasks?task=2', '2026-08-04');
  assert.notEqual(key1, key2);
});

test('goal deadline dedupes by goal id, not by day', () => {
  const key1 = buildDedupeKey('deadline', '/goals?goal=7', '2026-08-01');
  const key2 = buildDedupeKey('deadline', '/goals?goal=7', '2026-08-09');
  assert.equal(key1, key2);
});

test('streak notifications DO recur daily (different keys per day)', () => {
  const key1 = buildDedupeKey('streak', '/goals', '2026-08-04');
  const key2 = buildDedupeKey('streak', '/goals', '2026-08-05');
  assert.notEqual(key1, key2);
});

test('mood notifications dedupe within the same day', () => {
  const key1 = buildDedupeKey('mood', '/', '2026-08-04');
  const key2 = buildDedupeKey('mood', '/', '2026-08-04');
  assert.equal(key1, key2);
});
