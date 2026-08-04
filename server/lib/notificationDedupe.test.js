const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDedupeKey } = require('./notificationDedupe');

test('overdue task dedupes across days', () => {
  assert.equal(
    buildDedupeKey('overdue', '/tasks?task=42', '2026-08-01'),
    buildDedupeKey('overdue', '/tasks?task=42', '2026-08-04')
  );
});
test('different tasks produce different keys', () => {
  assert.notEqual(
    buildDedupeKey('overdue', '/tasks?task=1', '2026-08-04'),
    buildDedupeKey('overdue', '/tasks?task=2', '2026-08-04')
  );
});
test('goal deadline dedupes by goal id, not by day', () => {
  assert.equal(
    buildDedupeKey('deadline', '/goals?goal=7', '2026-08-01'),
    buildDedupeKey('deadline', '/goals?goal=7', '2026-08-09')
  );
});
test('streak notifications recur daily', () => {
  assert.notEqual(
    buildDedupeKey('streak', '/goals', '2026-08-04'),
    buildDedupeKey('streak', '/goals', '2026-08-05')
  );
});
test('mood notifications fire once per checkpoint, not once per day', () => {
  const noon = buildDedupeKey('mood', '/?moodcheck=12', '2026-08-04');
  const three = buildDedupeKey('mood', '/?moodcheck=15', '2026-08-04');
  assert.notEqual(noon, three, 'different checkpoints on the same day must produce different keys');
});
test('same checkpoint on the same day still dedupes (no repeat within that window)', () => {
  const a = buildDedupeKey('mood', '/?moodcheck=12', '2026-08-04');
  const b = buildDedupeKey('mood', '/?moodcheck=12', '2026-08-04');
  assert.equal(a, b);
});