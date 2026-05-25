"use client";

type OnboardingStep = {
  title: string;
  description: string;
};

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Welcome to RumahBudget",
    description:
      "This quick tour will move through the main dashboard sections automatically as you use Next and Back.",
  },
  {
    title: "Create your first money account",
    description:
      "Add a bank account, e-wallet, cash wallet, or investment account so every transaction has a place to live.",
  },
  {
    title: "Record income",
    description:
      "Use the Income tab to record salary, business income, bonuses, or other incoming funds.",
  },
  {
    title: "Record an expense",
    description:
      "Use the Expense tab, choose the account the money came from, and categorize the spending.",
  },
  {
    title: "Transfer money between accounts",
    description:
      "Use the Transfer tab to move money between your own accounts without changing income or expense totals.",
  },
  {
    title: "Review dashboard charts",
    description:
      "Check account balance and expense breakdown charts to understand where your money sits and where it goes.",
  },
  {
    title: "Generate a financial report",
    description:
      "Preview weekly or monthly summaries and send a test report email when you are ready.",
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
      className="fixed inset-x-0 bottom-0 z-50 px-4 py-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-xl sm:px-0 sm:py-0"
      role="dialog"
    >
      <div className="w-full rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur sm:p-8">
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

        <div className="mt-6 grid grid-cols-7 gap-2">
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
