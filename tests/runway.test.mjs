import assert from "node:assert/strict";
import test from "node:test";

import {
  DAYS_PER_MONTH,
  calculateBurnProfile,
  calculateRunwayDays,
  calculateRunwayMonths,
  splitBalancesByPurpose,
} from "../src/lib/runway.ts";

const NOW = new Date(2026, 7, 25, 12, 0, 0); // 25 August 2026, local

function expense(amount, year, monthIndex, day) {
  return { amount, createdAt: new Date(year, monthIndex, day, 12, 0, 0).getTime() };
}

function account(id, purpose = "general", isArchived = false) {
  return { id, initialBalance: 0, isArchived, purpose };
}

test("a month still in progress no longer counts as a full month", () => {
  // One quiet onboarding month plus a heavy month that is only 25 days old.
  const expenses = [
    expense(400_000, 2026, 6, 20),
    expense(8_000_000, 2026, 7, 10),
  ];

  const profile = calculateBurnProfile({ expenses, now: NOW });

  // Window runs from 20 July to 25 August inclusive = 37 days.
  assert.equal(profile.observedDays, 37);
  assert.equal(profile.totalObservedSpending, 8_400_000);
  assert.equal(profile.averageDailyBurn, 8_400_000 / 37);
  assert.equal(profile.basis, "observed-window");

  // The old calendar-bucket average was (400k + 8m) / 2 = 4.2m, which understated
  // the real pace badly. Day-weighting lands far higher.
  assert.ok(profile.averageMonthlyBurn > 6_800_000);
});

test("monthly and daily runway readings agree with each other", () => {
  const expenses = [expense(3_000_000, 2026, 6, 27)];
  const profile = calculateBurnProfile({ expenses, now: NOW });

  const months = calculateRunwayMonths(10_000_000, profile.averageMonthlyBurn);
  const days = calculateRunwayDays(10_000_000, profile.averageDailyBurn);

  assert.ok(months !== null && days !== null);
  // The two readings are the same quantity in different units.
  assert.ok(Math.abs(months * DAYS_PER_MONTH - days) <= 1);
});

test("an empty ledger reads as unknown, never as an infinite reserve", () => {
  const profile = calculateBurnProfile({ expenses: [], now: NOW });

  assert.equal(profile.basis, "insufficient-data");
  assert.equal(profile.averageMonthlyBurn, 0);
  assert.equal(profile.observedDays, 0);
  assert.equal(calculateRunwayMonths(12_000_000, profile.averageMonthlyBurn), null);
  assert.equal(calculateRunwayDays(12_000_000, profile.averageDailyBurn), null);
});

test("future-dated rows are ignored instead of inflating the burn rate", () => {
  const real = [expense(1_000_000, 2026, 7, 20)];
  const withTypo = [...real, expense(9_000_000, 2026, 11, 31)];

  assert.deepEqual(
    calculateBurnProfile({ expenses: withTypo, now: NOW }),
    calculateBurnProfile({ expenses: real, now: NOW }),
  );
});

test("spending recorded today is counted, and today is a full observed day", () => {
  const profile = calculateBurnProfile({
    expenses: [expense(250_000, 2026, 7, 25)],
    now: NOW,
  });

  assert.equal(profile.observedDays, 1);
  assert.equal(profile.totalObservedSpending, 250_000);
  assert.equal(profile.averageDailyBurn, 250_000);
});

test("the lookback window caps how far back the rate reaches", () => {
  const expenses = [
    expense(50_000_000, 2025, 7, 25), // a year ago, outside any window
    expense(300_000, 2026, 7, 24),
    expense(300_000, 2026, 7, 25),
  ];

  const profile = calculateBurnProfile({ expenses, lookbackDays: 30, now: NOW });

  assert.equal(profile.observedDays, 30);
  assert.equal(profile.totalObservedSpending, 600_000);
});

test("quiet days inside the window pull the rate down honestly", () => {
  const single = calculateBurnProfile({
    expenses: [expense(900_000, 2026, 7, 25)],
    now: NOW,
  });
  const spread = calculateBurnProfile({
    expenses: [expense(900_000, 2026, 6, 27)],
    now: NOW,
  });

  assert.equal(single.averageDailyBurn, 900_000);
  assert.ok(spread.averageDailyBurn < single.averageDailyBurn);
  assert.equal(spread.observedDays, 30);
});

test("an invalid lookback window fails closed", () => {
  assert.throws(() => calculateBurnProfile({ expenses: [], lookbackDays: 0 }));
  assert.throws(() => calculateBurnProfile({ expenses: [], lookbackDays: 1.5 }));
});

test("broker money is kept out of household cash", () => {
  const accounts = [
    account("bca"),
    account("bri"),
    account("broker", "trading"),
    account("closed", "general", true),
  ];
  const balances = {
    bca: 2_000_000,
    bri: 4_000_000,
    broker: 6_500_000,
    closed: 999_999,
  };

  assert.deepEqual(splitBalancesByPurpose(accounts, balances), {
    householdBalance: 6_000_000,
    tradingBalance: 6_500_000,
  });
});

test("runway is measured against household cash, not the broker balance", () => {
  const accounts = [account("bca"), account("broker", "trading")];
  const balances = { bca: 6_000_000, broker: 6_700_000 };
  const { householdBalance } = splitBalancesByPurpose(accounts, balances);

  const burn = 7_000_000;
  const householdRunway = calculateRunwayMonths(householdBalance, burn);
  const combinedRunway = calculateRunwayMonths(
    householdBalance + balances.broker,
    burn,
  );

  assert.ok(householdRunway !== null && combinedRunway !== null);
  assert.ok(householdRunway < 1);
  // Counting the broker balance roughly doubles the reading.
  assert.ok(combinedRunway > householdRunway * 1.9);
});
