import dayjs from 'dayjs';

export const classificationKeys = {
  receivedIncome: 'dashboardReceivedIncome',
  expectedIncome: 'dashboardExpectedIncome',
  lostEarnings: 'dashboardLostEarnings',
  operatingCost: 'dashboardOperatingCosts',
  advance: 'dashboardAdvances',
  household: 'dashboardHousehold',
  adjustment: 'dashboardAdjustments',
  ignore: 'dashboardExcluded',
  unclassified: 'dashboardUnclassified',
};

export const defaultRules = {
  expectedIncome: 'Expected earnings',
  receivedIncome: 'Received income',
  lostEarnings: 'Lost earnings',
  operatingCost: 'Operating cost',
  advance: 'Advance',
  household: 'Household',
  adjustment: 'Adjustment',
};

const normalize = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();

export const classifyRecord = (record, settings = {}) => {
  if (record.transfer || record.recordType === 'transfer') {
    return 'ignore';
  }
  const override = settings.overrides?.[record.id];
  if (override && Object.hasOwn(classificationKeys, override)) {
    return override;
  }
  const names = new Set([
    normalize(record.category?.name),
    ...(record.labels || []).map((label) => normalize(label.name)),
  ]);
  const rules = Object.fromEntries(
    Object.keys(defaultRules).map((key) => [key, settings.rules?.[key] ?? defaultRules[key]]),
  );
  const matches = Object.entries(rules).filter(([, labels]) =>
    String(labels || '')
      .split(',')
      .some((label) => label.trim() && names.has(normalize(label))),
  );
  if (matches.length === 1) {
    return matches[0][0];
  }
  if (matches.length > 1) {
    return 'unclassified';
  }
  return record.recordType === 'income' && record.category?.group?.id === 'income'
    ? 'receivedIncome'
    : 'unclassified';
};

const emptyDay = (date) => ({
  date,
  receivedIncome: 0,
  expectedIncome: 0,
  lostEarnings: 0,
  operatingCost: 0,
  earned: 0,
  result: 0,
});

export const aggregateWallet = (records, settings = {}, currency = 'MAD') => {
  const totals = {
    receivedIncome: 0,
    expectedIncome: 0,
    lostEarnings: 0,
    operatingCost: 0,
    advance: 0,
    household: 0,
    adjustment: 0,
    recordedNet: 0,
    earned: 0,
    result: 0,
    unmatchedLoss: 0,
    unclassifiedCount: 0,
    excludedCount: 0,
  };
  const days = new Map();
  const seen = new Set();
  const transactions = [];
  records.forEach((record) => {
    if (seen.has(record.id)) {
      return;
    }
    seen.add(record.id);
    const value = record.amount?.value;
    const date = dayjs(record.recordDate);
    const excluded =
      record.recordState !== 'cleared' ||
      record.amount?.currencyCode !== currency ||
      !Number.isFinite(value) ||
      !date.isValid();
    let classification = excluded ? 'ignore' : classifyRecord(record, settings);
    const income = ['receivedIncome', 'expectedIncome'].includes(classification);
    const outflow = ['lostEarnings', 'operatingCost', 'advance', 'household'].includes(
      classification,
    );
    if (!excluded && ((income && value < 0) || (outflow && value > 0))) {
      classification = 'unclassified';
    }
    transactions.push({ ...record, classification, excluded });
    if (excluded || classification === 'ignore') {
      if (excluded) {
        totals.excludedCount += 1;
      }
      return;
    }
    // Sum integer minor units, then convert once for display.
    const amount = Math.round(value * 100);
    totals.recordedNet += amount;
    const key = date.locale('en').format('YYYY-MM-DD');
    if (!days.has(key)) {
      days.set(key, emptyDay(key));
    }
    const daily = days.get(key);
    if (classification === 'unclassified') {
      totals.unclassifiedCount += 1;
    } else if (classification === 'adjustment') {
      totals.adjustment += amount;
    } else {
      totals[classification] += Math.abs(amount);
      if (classification in daily) {
        daily[classification] += Math.abs(amount);
      }
    }
  });
  days.forEach((daily) => {
    // Received remittances are already net. Cancel only expected income on the same day.
    const appliedLoss = Math.min(daily.expectedIncome, daily.lostEarnings);
    totals.unmatchedLoss += daily.lostEarnings - appliedLoss;
    daily.earned = daily.receivedIncome + daily.expectedIncome - appliedLoss;
    daily.result = daily.earned - daily.operatingCost;
    totals.earned += daily.earned;
    totals.result += daily.result;
    Object.keys(daily)
      .filter((key) => key !== 'date')
      .forEach((key) => {
        daily[key] /= 100;
      });
  });
  Object.keys(totals)
    .filter((key) => !key.endsWith('Count'))
    .forEach((key) => {
      totals[key] /= 100;
    });
  return {
    ...totals,
    complete: !totals.unclassifiedCount && !totals.excludedCount && !totals.unmatchedLoss,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    transactions: transactions.sort(
      (a, b) => dayjs(b.recordDate).valueOf() - dayjs(a.recordDate).valueOf(),
    ),
  };
};

export const aggregateActivity = (summaries, trips) => ({
  distance: summaries.reduce((sum, item) => sum + (item.distance || 0), 0),
  drivingHours: trips.reduce((sum, item) => sum + (item.duration || 0), 0) / 3600000,
  activeDays: new Set(
    summaries
      .filter((item) => item.distance > 0)
      .map((item) => dayjs(item.startTime).locale('en').format('YYYY-MM-DD')),
  ).size,
  tripCount: trips.length,
  days: summaries.map((item) => ({
    date: dayjs(item.startTime).locale('en').format('YYYY-MM-DD'),
    distance: (item.distance || 0) / 1000,
  })),
});
