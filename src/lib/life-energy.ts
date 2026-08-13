export type NumericValidationResult =
  | { ok: true; value: number }
  | { error: string; ok: false };

function validatePositiveFiniteNumber(
  value: number | string,
  label: string,
): NumericValidationResult {
  if (typeof value === "string" && value.trim() === "") {
    return { error: `${label} is required.`, ok: false };
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return { error: `${label} must be a valid number.`, ok: false };
  }
  if (numericValue <= 0) {
    return { error: `${label} must be greater than 0.`, ok: false };
  }
  if (!Number.isSafeInteger(Math.round(numericValue))) {
    return { error: `${label} is too large.`, ok: false };
  }

  return { ok: true, value: numericValue };
}

export function validateNetHourlyWage(value: number | string) {
  return validatePositiveFiniteNumber(value, "Net hourly wage");
}

export function calculateNetHourlyWage(
  monthlySalary: number | string,
  hoursPerMonth: number | string,
): NumericValidationResult {
  const salaryResult = validatePositiveFiniteNumber(monthlySalary, "Monthly salary");
  if (!salaryResult.ok) {
    return salaryResult;
  }

  const hoursResult = validatePositiveFiniteNumber(hoursPerMonth, "Hours per month");
  if (!hoursResult.ok) {
    return hoursResult;
  }

  const hourlyWage = salaryResult.value / hoursResult.value;
  if (!Number.isFinite(hourlyWage) || hourlyWage <= 0) {
    return { error: "Net hourly wage could not be calculated.", ok: false };
  }

  const roundedHourlyWage = Math.round(hourlyWage);
  if (roundedHourlyWage <= 0) {
    return { error: "Calculated net hourly wage must be at least 1.", ok: false };
  }

  return { ok: true, value: roundedHourlyWage };
}

export function calculateLifeEnergyHours(
  expenseAmount: number | string,
  netHourlyWage: number | string,
) {
  const amountResult = validatePositiveFiniteNumber(expenseAmount, "Expense amount");
  const wageResult = validateNetHourlyWage(netHourlyWage);

  if (!amountResult.ok || !wageResult.ok) {
    return null;
  }

  const hours = amountResult.value / wageResult.value;
  return Number.isFinite(hours) ? hours : null;
}
