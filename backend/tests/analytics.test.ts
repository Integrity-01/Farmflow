import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeTaskWhere, rangeCondition } from '../src/utils/analytics-sql.js';

test('rangeCondition emits a predicate without a leading WHERE/AND', () => {
  assert.equal(rangeCondition(30), 't.created_at >= now() - INTERVAL 30 DAY');
  assert.equal(rangeCondition(0), '');
  assert.equal(rangeCondition(-5), '');
});

test('composeTaskWhere adds WHERE when there is no scope', () => {
  assert.equal(composeTaskWhere('', 30), 'WHERE t.created_at >= now() - INTERVAL 30 DAY');
});

test('composeTaskWhere joins scope and range with AND', () => {
  assert.equal(
    composeTaskWhere("t.assigned_to = 'abc'", 7),
    "WHERE t.assigned_to = 'abc' AND t.created_at >= now() - INTERVAL 7 DAY",
  );
});

test('composeTaskWhere keeps a bare scope and an empty clause', () => {
  assert.equal(composeTaskWhere("t.assigned_to = 'abc'", 0), "WHERE t.assigned_to = 'abc'");
  assert.equal(composeTaskWhere('', 0), '');
});

test('composeTaskWhere never starts with AND', () => {
  for (const scope of ['', "t.assigned_to = 'abc'"]) {
    for (const days of [0, 7, 30, 90]) {
      const clause = composeTaskWhere(scope, days);
      assert.ok(!clause.startsWith('AND'), `unexpected leading AND for ${scope}/${days}`);
    }
  }
});
