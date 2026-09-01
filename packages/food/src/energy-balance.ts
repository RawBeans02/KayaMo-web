/**
 * Intake vs expenditure as ranges. Never present intake minus exercise
 * as an authoritative "net calories" figure.
 */
export type EnergyBalanceInput = {
  intakeKcal: number;
  intakeLow: number;
  intakeHigh: number;
  expenditureKcal: number | null;
  expenditureLow: number | null;
  expenditureHigh: number | null;
};

export type EnergyBalance = {
  intakeKcal: number;
  intakeLow: number;
  intakeHigh: number;
  expenditureKcal: number | null;
  expenditureLow: number | null;
  expenditureHigh: number | null;
  balanceLow: number | null;
  balanceHigh: number | null;
};

export function estimateEnergyBalance(input: EnergyBalanceInput): EnergyBalance {
  const intakeKcal = Math.max(0, Math.round(input.intakeKcal));
  const intakeLow = Math.max(0, Math.round(Math.min(input.intakeLow, intakeKcal)));
  const intakeHigh = Math.max(intakeKcal, Math.round(input.intakeHigh));
  const expenditureKcal =
    input.expenditureKcal === null || !Number.isFinite(input.expenditureKcal)
      ? null
      : Math.round(input.expenditureKcal);
  const expenditureLow =
    input.expenditureLow === null || !Number.isFinite(input.expenditureLow)
      ? expenditureKcal
      : Math.round(input.expenditureLow);
  const expenditureHigh =
    input.expenditureHigh === null || !Number.isFinite(input.expenditureHigh)
      ? expenditureKcal
      : Math.round(input.expenditureHigh);

  if (expenditureKcal === null || expenditureLow === null || expenditureHigh === null) {
    return {
      intakeKcal,
      intakeLow,
      intakeHigh,
      expenditureKcal: null,
      expenditureLow: null,
      expenditureHigh: null,
      balanceLow: null,
      balanceHigh: null,
    };
  }

  return {
    intakeKcal,
    intakeLow,
    intakeHigh,
    expenditureKcal,
    expenditureLow,
    expenditureHigh,
    // Intake low vs spend high … intake high vs spend low.
    balanceLow: intakeLow - expenditureHigh,
    balanceHigh: intakeHigh - expenditureLow,
  };
}

export function formatKcalRange(low: number, high: number): string {
  if (low === high) return `${low.toLocaleString('en-PH')} kcal`;
  return `${low.toLocaleString('en-PH')}–${high.toLocaleString('en-PH')} kcal`;
}
