import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateWallet, classifyRecord, aggregateActivity } from './dashboardUtils.js';

const record = (id, value, classification, extra = {}) => ({
  id,
  amount: { value, currencyCode: 'MAD' },
  recordDate: '2026-10-10T12:00:00Z',
  recordState: 'cleared',
  recordType: value > 0 ? 'income' : 'expense',
  labels: classification ? [{ name: classification }] : [],
  ...extra,
});

test('a non-working day cancels expected earnings without inflating costs', () => {
  const result = aggregateWallet([
    record('expected', 440, 'Expected earnings'),
    record('lost', -440, 'Lost earnings'),
    record('repair', -50, 'Operating cost'),
  ]);
  assert.equal(result.expectedIncome, 440);
  assert.equal(result.lostEarnings, 440);
  assert.equal(result.earned, 0);
  assert.equal(result.operatingCost, 50);
  assert.equal(result.result, -50);
  assert.equal(result.recordedNet, -50);
  assert.equal(result.complete, true);
});

test('already received driver payments are not reduced a second time', () => {
  const result = aggregateWallet([
    record('received', 4000, 'Received income'),
    record('lost', -440, 'Lost earnings'),
  ]);
  assert.equal(result.earned, 4000);
  assert.equal(result.unmatchedLoss, 440);
  assert.equal(result.complete, false);
});

test('deductions match expected earnings on the same recorded day only', () => {
  const result = aggregateWallet([
    record('expected', 440, 'Expected earnings'),
    record('lost', -440, 'Lost earnings', { recordDate: '2026-10-09T12:00:00Z' }),
  ]);
  assert.equal(result.earned, 440);
  assert.equal(result.unmatchedLoss, 440);
});

test('unknown costs, foreign currency, uncleared records, and transfers cannot silently become costs', () => {
  const result = aggregateWallet([
    record('unknown', -2135),
    record('foreign', -50, 'Operating cost', { amount: { value: -50, currencyCode: 'EUR' } }),
    record('pending', -50, 'Operating cost', { recordState: 'pending' }),
    record('transfer', -100, 'Operating cost', { transfer: { id: 'other' } }),
  ]);
  assert.equal(result.operatingCost, 0);
  assert.equal(result.recordedNet, -2135);
  assert.equal(result.unclassifiedCount, 1);
  assert.equal(result.excludedCount, 2);
  assert.equal(result.complete, false);
});

test('per-record overrides resolve old records; ambiguous rules remain unclassified', () => {
  const item = record('old', -50, null, { note: 'Ma khdemch' });
  assert.equal(classifyRecord(item), 'unclassified');
  assert.equal(classifyRecord(item, { overrides: { old: 'operatingCost' } }), 'operatingCost');
  assert.equal(
    classifyRecord(record('ambiguous', -50, 'Cost'), {
      rules: { operatingCost: 'Cost', lostEarnings: 'Cost' },
    }),
    'unclassified',
  );
});

test('advances and household withdrawals affect recorded movement separately from operations', () => {
  const result = aggregateWallet([
    record('income', 440, 'Received income'),
    record('advance', -200, 'Advance'),
    record('home', -100, 'Household'),
    record('adjust', 20, 'Adjustment'),
  ]);
  assert.equal(result.earned, 440);
  assert.equal(result.result, 440);
  assert.equal(result.recordedNet, 160);
  assert.equal(result.advance, 200);
  assert.equal(result.household, 100);
  assert.equal(result.adjustment, 20);
});

test('duplicate records are counted once and decimal amounts are summed in minor units', () => {
  const item = record('one', 0.1, 'Received income');
  const result = aggregateWallet([item, item, record('two', 0.2, 'Received income')]);
  assert.equal(result.earned, 0.3);
  assert.equal(result.transactions.length, 2);
});

test('vehicle activity uses trip duration, not engine hours, for driving time', () => {
  const result = aggregateActivity(
    [
      { startTime: '2026-10-10T12:00:00Z', distance: 100000 },
      { startTime: '2026-10-09T12:00:00Z', distance: 0 },
    ],
    [{ duration: 7200000 }],
  );
  assert.equal(result.distance, 100000);
  assert.equal(result.drivingHours, 2);
  assert.equal(result.activeDays, 1);
});
