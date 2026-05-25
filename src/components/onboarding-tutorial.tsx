"use client";

type OnboardingStep = {
  title: string;
  description: string;
};

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Create your first money account",
    description:
      "Start with where your money lives: a bank account, e-wallet, cash, investment account, or another wallet.",
  },
  {
    title: "Add income to an account",
    description:
      "Record salary, business income, bonuses, or other incoming funds and choose which account receives the money.",
  },
  {
    title: "Add an expense from an account",
    description:
      "Track spending by category and select the account the money came from so balances stay accurate.",
  },
  {
    title: "Transfer money between accounts",
    description:
      "Move money between your own accounts without changing income or expense totals.",
  },
  {
    title: "Review charts and financial reports",
    description:
      "Use the dashboard charts and report preview to understand balances, expense patterns, and monthly cashflow.",
  },
];

export const onboardingStepCount = onboardingSteps.length;

type OnboardingTutorialProps = {
  currentStep: number;
  isOpen: boolean;
  onBack: () => void;
  onFinish: () => void;
  onNext: () => void;
  onSkip: () => void;
};

export default function OnboardingTutorial({
  currentStep,
  isOpen,
  onBack,
  onFinish,
  onNext,
  onSkip,
}: OnboardingTutorialProps) {
  if (!isOpen) {
    return null;
  }

  const step = onboardingSteps[currentStep] ?? onboardingSteps[0];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div
      aria-labelledby="onboarding-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end bg-slate-950/80 px-4 py-4 backdrop-blur-sm sm:items-center sm:justify-center sm:px-6"
      role="dialog"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/60 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Getting Started
            </p>
            <h2
              className="mt-3 text-2xl font-bold tracking-tight text-white"
              id="onboarding-title"
            >
              {step.title}
            </h2>
          </div>
          <p className="shrink-0 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
            {currentStep + 1} / {onboardingSteps.length}
          </p>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-300">
          {step.description}
        </p>

        <div className="mt-6 grid grid-cols-5 gap-2">
          {onboardingSteps.map((item, index) => (
            <div
              aria-label={item.title}
              className={`h-2 rounded-full ${
                index <= currentStep ? "bg-emerald-400" : "bg-slate-800"
              }`}
              key={item.title}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
            type="button"
            onClick={onSkip}
          >
            Skip tutorial
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isFirstStep}
              onClick={onBack}
            >
              Back
            </button>
            <button
              className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              type="button"
              onClick={isLastStep ? onFinish : onNext}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
