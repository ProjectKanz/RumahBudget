"use client";

import {
  calculateAllocationBucketBalances,
  calculatePortfolioHoldings,
  getAllocationBarPercent,
  getLatestPriceByAsset,
  isAllocationStateOwnedByUser,
  validateInvestmentPurchase,
} from "@/src/lib/allocation-calculations";
import {
  EmptyState,
  MetricCell,
  Notice,
  NumberValue,
  SectionHeader,
  SharpButton,
  SharpInput,
  SharpSelect,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
import {
  hasStoredContent,
  loadAllocationState,
  saveAllocationState,
} from "@/src/lib/allocation-store";
import type { AllocationStoreClient } from "@/src/lib/allocation-store";
import { formatCurrency, hiddenBalanceLabel } from "@/src/lib/format";
import { supabase } from "@/src/lib/supabase";
import { fetchLatestPrice, getMockPriceQuote } from "@/src/lib/price-provider";
import { toLocalDateInputValue } from "@/src/lib/transaction-entry";
import type {
  AllocationDraftItem,
  AllocationIncomeRecord,
  AllocationRecord,
  AllocationState,
  AllocationTemplate,
  Bucket,
  BucketType,
} from "@/src/types/allocation";
import type { MoneyAccount } from "@/src/types/money-account";
import type {
  Asset,
  InvestmentTransaction,
  PriceProviderId,
  PriceSnapshot,
} from "@/src/types/portfolio";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MoneyAllocationWatchProps = {
  accounts: MoneyAccount[];
  isBalanceHidden: boolean;
  userId: string;
};

type ManualAllocationInput = Record<string, string>;

type NewInvestmentForm = {
  assetId: string;
  amountIdr: string;
  date: string;
  fee: string;
  note: string;
  price: string;
  quantity: string;
  sourceBucketId: string;
};

const defaultBucketDefinitions: Array<{
  id: string;
  name: string;
  targetAmount?: number;
  type: BucketType;
}> = [
  { id: "living", name: "Living / BCA", type: "living" },
  { id: "investment-cash", name: "Investment Cash", type: "investment_cash" },
  { id: "emergency", name: "Emergency Fund", targetAmount: 10_000_000, type: "emergency" },
  { id: "sinking", name: "Sinking Fund", type: "sinking" },
  { id: "trading-lab", name: "Trading Lab", type: "trading_lab" },
  { id: "lifestyle", name: "Lifestyle", type: "lifestyle" },
  { id: "giving", name: "Giving / Family", type: "giving" },
  { id: "unallocated", name: "Unallocated Cash", type: "unallocated" },
];

const bucketTone: Record<BucketType, string> = {
  custom: "border-white/10 bg-white/[0.03]",
  emergency: "border-lime-300/25 bg-lime-300/10",
  giving: "border-fuchsia-300/25 bg-fuchsia-300/10",
  investment_cash: "border-cyan-300/25 bg-cyan-300/10",
  lifestyle: "border-pink-300/25 bg-pink-300/10",
  living: "border-slate-300/20 bg-white/[0.03]",
  sinking: "border-amber-300/25 bg-amber-300/10",
  trading_lab: "border-orange-300/25 bg-orange-300/10",
  unallocated: "border-rose-300/25 bg-rose-300/10",
};

const labelClassName = "text-sm font-medium text-slate-300";

function todayIsoDate() {
  return toLocalDateInputValue();
}

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * The generated Supabase client type is far wider than this store needs, and
 * matching it structurally exceeds TypeScript's instantiation depth. The store
 * only ever calls select/upsert/delete, which this narrowing preserves.
 */
function asStoreClient(client: unknown) {
  return client as AllocationStoreClient;
}

function getStorageKey(userId: string) {
  return `rumahbudget.moneyAllocationPortfolio.v3.${userId}`;
}

function createDefaultBuckets(userId: string): Bucket[] {
  const timestamp = now();
  return defaultBucketDefinitions.map((bucket) => ({
    id: bucket.id,
    userId,
    name: bucket.name,
    type: bucket.type,
    targetAmount: bucket.targetAmount,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function createDefaultAssets(userId: string): Asset[] {
  return [
    {
      id: "asset-btc",
      userId,
      symbol: "BTC",
      name: "Bitcoin",
      type: "crypto",
      currency: "IDR",
      priceProvider: "coingecko",
    },
    {
      id: "asset-bbca",
      userId,
      symbol: "BBCA",
      name: "Bank Central Asia Tbk",
      type: "stock",
      currency: "IDR",
      priceProvider: "manual",
    },
    {
      id: "asset-bbri",
      userId,
      symbol: "BBRI",
      name: "Bank Rakyat Indonesia Tbk",
      type: "stock",
      currency: "IDR",
      priceProvider: "manual",
    },
  ];
}

function createDefaultTemplate(userId: string, buckets: Bucket[]): AllocationTemplate {
  const timestamp = now();
  const living = buckets.find((bucket) => bucket.type === "living")?.id ?? "living";
  const investment = buckets.find((bucket) => bucket.type === "investment_cash")?.id ?? "investment-cash";
  const emergency = buckets.find((bucket) => bucket.type === "emergency")?.id ?? "emergency";

  return {
    id: "template-default-50-30-20",
    userId,
    name: "Default 50 / 30 / 20",
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      { bucketId: living, percentage: 50 },
      { bucketId: investment, percentage: 30 },
      { bucketId: emergency, percentage: 20 },
    ],
  };
}

function createInitialState(userId: string): AllocationState {
  const buckets = createDefaultBuckets(userId);
  return {
    assets: createDefaultAssets(userId),
    buckets,
    incomeRecords: [],
    allocationRecords: [],
    investmentTransactions: [],
    priceSnapshots: [],
    templates: [createDefaultTemplate(userId, buckets)],
  };
}

function normalizeState(
  userId: string,
  parsed: Partial<AllocationState>,
): AllocationState {
  const fallback = createInitialState(userId);
  {
    const buckets = Array.isArray(parsed.buckets) && parsed.buckets.length > 0 ? parsed.buckets : fallback.buckets;
    const templates = Array.isArray(parsed.templates) && parsed.templates.length > 0
      ? parsed.templates
      : [createDefaultTemplate(userId, buckets)];

    return {
      assets: Array.isArray(parsed.assets) && parsed.assets.length > 0 ? parsed.assets : fallback.assets,
      buckets,
      incomeRecords: Array.isArray(parsed.incomeRecords) ? parsed.incomeRecords : [],
      allocationRecords: Array.isArray(parsed.allocationRecords) ? parsed.allocationRecords : [],
      investmentTransactions: Array.isArray(parsed.investmentTransactions) ? parsed.investmentTransactions : [],
      priceSnapshots: Array.isArray(parsed.priceSnapshots) ? parsed.priceSnapshots : [],
      templates,
    };
  }
}

function safeParseState(userId: string, raw: string | null): AllocationState {
  if (!raw) {
    return createInitialState(userId);
  }

  try {
    return normalizeState(userId, JSON.parse(raw) as Partial<AllocationState>);
  } catch {
    return createInitialState(userId);
  }
}

export default function MoneyAllocationWatch({
  accounts,
  isBalanceHidden,
  userId,
}: MoneyAllocationWatchProps) {
  const [state, setState] = useState<AllocationState>(() => createInitialState(userId));
  const [isLoaded, setIsLoaded] = useState(false);
  const [templateName, setTemplateName] = useState("Default 50 / 30 / 20");
  const [templatePercentages, setTemplatePercentages] = useState<Record<string, string>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState("template-default-50-30-20");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState("");
  const [incomeDate, setIncomeDate] = useState(todayIsoDate());
  const [incomeNote, setIncomeNote] = useState("");
  const [shouldAllocateNow, setShouldAllocateNow] = useState(true);
  const [manualAllocation, setManualAllocation] = useState<ManualAllocationInput>({});
  const [allocationNotice, setAllocationNotice] = useState("");
  const [allocationError, setAllocationError] = useState("");
  const [newInvestment, setNewInvestment] = useState<NewInvestmentForm>({
    assetId: "asset-btc",
    amountIdr: "",
    date: todayIsoDate(),
    fee: "0",
    note: "",
    price: "",
    quantity: "",
    sourceBucketId: "investment-cash",
  });
  const [manualPriceAssetId, setManualPriceAssetId] = useState("asset-btc");
  const [manualPrice, setManualPrice] = useState("");
  const [priceNotice, setPriceNotice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");
  const [backupError, setBackupError] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isActive = true;

    function applyState(nextState: AllocationState, notice: string) {
      setState(nextState);
      setSelectedTemplateId(nextState.templates[0]?.id ?? "template-default-50-30-20");
      setTemplateName(nextState.templates[0]?.name ?? "Default 50 / 30 / 20");
      setTemplatePercentages(
        Object.fromEntries(
          nextState.buckets
            .filter((bucket) => bucket.type !== "unallocated")
            .map((bucket) => [
              bucket.id,
              String(nextState.templates[0]?.items.find((item) => item.bucketId === bucket.id)?.percentage ?? 0),
            ]),
        ),
      );
      setSyncNotice(notice);
      setIsLoaded(true);
    }

    async function hydrate() {
      const cached = safeParseState(
        userId,
        window.localStorage.getItem(getStorageKey(userId)),
      );
      const client = supabase;

      if (!client) {
        applyState(
          cached,
          "Supabase is not configured, so allocation and portfolio data stays in this browser only.",
        );
        return;
      }

      const result = await loadAllocationState(asStoreClient(client), userId);
      if (!isActive) {
        return;
      }

      if (!result.ok) {
        applyState(
          cached,
          `Could not load saved allocation data (${result.message}). Showing this browser's copy; changes will retry syncing.`,
        );
        return;
      }

      const remote = normalizeState(userId, result.state);
      // The account wins only when it actually holds entries. A browser opened
      // first would otherwise upload bare seeded defaults, and the browser that
      // holds the real portfolio would then adopt them and lose it.
      const keepLocal =
        !hasStoredContent(remote) && hasStoredContent(cached);

      applyState(
        result.isEmpty || keepLocal ? cached : remote,
        keepLocal
          ? "This browser holds allocation data that is not on your account yet. It will be uploaded with your next change."
          : "",
      );
    }

    void hydrate();

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    // localStorage is now a cache and an offline fallback, not the record.
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));

    const client = supabase;
    if (!client) {
      return;
    }

    // Debounced so a burst of edits becomes one write-through.
    const timer = window.setTimeout(() => {
      setIsSyncing(true);
      void saveAllocationState(asStoreClient(client), userId, state)
        .then((result) => {
          setSyncError(result.ok ? "" : result.message);
        })
        .catch((error: unknown) => {
          setSyncError(
            error instanceof Error ? error.message : "Allocation sync failed.",
          );
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isLoaded, state, userId]);

  const selectedTemplate = useMemo(
    () => state.templates.find((template) => template.id === selectedTemplateId) ?? state.templates[0],
    [selectedTemplateId, state.templates],
  );

  const bucketsById = useMemo(
    () => new Map(state.buckets.map((bucket) => [bucket.id, bucket])),
    [state.buckets],
  );

  const investmentCashBucketId = useMemo(
    () => state.buckets.find((bucket) => bucket.type === "investment_cash")?.id ?? "investment-cash",
    [state.buckets],
  );

  const unallocatedBucketId = useMemo(
    () => state.buckets.find((bucket) => bucket.type === "unallocated")?.id ?? "unallocated",
    [state.buckets],
  );

  const basePreviewItems = useMemo<AllocationDraftItem[]>(() => {
    const amount = parsePositiveNumber(incomeAmount);
    if (!selectedTemplate || amount <= 0) {
      return [];
    }

    return selectedTemplate.items
      .filter((item) => item.percentage > 0 && bucketsById.has(item.bucketId))
      .map((item) => ({
        bucketId: item.bucketId,
        percentage: item.percentage,
        amount: Math.round((amount * item.percentage) / 100),
      }));
  }, [bucketsById, incomeAmount, selectedTemplate]);

  const previewItems = useMemo<AllocationDraftItem[]>(() => {
    if (Object.keys(manualAllocation).length === 0) {
      return basePreviewItems;
    }

    return basePreviewItems.map((item) => ({
      ...item,
      amount: Number(manualAllocation[item.bucketId] ?? item.amount),
    }));
  }, [basePreviewItems, manualAllocation]);

  const previewTotal = previewItems.reduce((total, item) => total + item.amount, 0);
  const incomeAmountNumber = parsePositiveNumber(incomeAmount);
  const previewDifference = incomeAmountNumber - previewTotal;

  const bucketBalances = useMemo(
    () =>
      calculateAllocationBucketBalances(
        state.buckets,
        state.allocationRecords,
        state.investmentTransactions,
      ),
    [state.allocationRecords, state.buckets, state.investmentTransactions],
  );

  const totalBucketCash = Object.values(bucketBalances).reduce((total, amount) => total + amount, 0);
  const unallocatedBalance = bucketBalances[unallocatedBucketId] ?? 0;
  const emergencyBucket = state.buckets.find((bucket) => bucket.type === "emergency");
  const emergencyBalance = emergencyBucket ? bucketBalances[emergencyBucket.id] ?? 0 : 0;
  const emergencyTarget = emergencyBucket?.targetAmount ?? 0;
  const emergencyProgress = emergencyTarget > 0 ? Math.min(100, (emergencyBalance / emergencyTarget) * 100) : 0;

  const holdings = useMemo(
    () => calculatePortfolioHoldings(state.assets, state.investmentTransactions, state.priceSnapshots),
    [state.assets, state.investmentTransactions, state.priceSnapshots],
  );
  const totalInvested = holdings.reduce((total, holding) => total + holding.totalCost, 0);
  const totalPortfolioValue = holdings.reduce((total, holding) => total + holding.currentValue, 0);
  const totalPortfolioPnl = totalPortfolioValue - totalInvested;
  const totalPortfolioPnlPercent = totalInvested > 0 ? (totalPortfolioPnl / totalInvested) * 100 : 0;
  // Gains that have already been banked are a separate fact from paper gains.
  // Folding them together is what let a closed position keep showing a profit.
  const totalRealizedPnl = holdings.reduce((total, holding) => total + holding.realizedPnL, 0);
  const latestPrices = useMemo(() => getLatestPriceByAsset(state.priceSnapshots), [state.priceSnapshots]);
  const recentAllocations = state.allocationRecords
    .slice()
    .sort((first, second) => second.createdAt - first.createdAt)
    .slice(0, 5);

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAllocationError("");
    setAllocationNotice("");

    const items = Object.entries(templatePercentages)
      .map(([bucketId, percentage]) => ({ bucketId, percentage: Number(percentage) }))
      .filter((item) => Number.isFinite(item.percentage) && item.percentage > 0);
    const totalPercentage = items.reduce((total, item) => total + item.percentage, 0);

    if (!templateName.trim()) {
      setAllocationError("Enter a template name.");
      return;
    }

    if (Math.round(totalPercentage * 100) / 100 !== 100) {
      setAllocationError(`Template percentage must equal 100%. Current total: ${totalPercentage}%.`);
      return;
    }

    const timestamp = now();
    const template: AllocationTemplate = {
      id: selectedTemplateId || makeId("template"),
      userId,
      name: templateName.trim(),
      items,
      isDefault: true,
      createdAt: selectedTemplate?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    setState((current) => ({
      ...current,
      templates: [template, ...current.templates.filter((item) => item.id !== template.id).map((item) => ({ ...item, isDefault: false }))],
    }));
    setSelectedTemplateId(template.id);
    setAllocationNotice("Allocation template saved locally for this account.");
  }

  function saveIncomeAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAllocationError("");
    setAllocationNotice("");

    const amount = parsePositiveNumber(incomeAmount);
    if (amount <= 0) {
      setAllocationError("Enter incoming money amount greater than 0.");
      return;
    }

    if (!incomeSource.trim()) {
      setAllocationError("Enter income/source label.");
      return;
    }

    if (shouldAllocateNow && previewItems.some((item) => item.amount < 0)) {
      setAllocationError("Allocation amounts cannot be negative.");
      return;
    }

    if (shouldAllocateNow && previewTotal > amount) {
      setAllocationError("Allocation total cannot exceed incoming money amount. Reduce manual split amounts first.");
      return;
    }

    const timestamp = now();
    const incomeRecord: AllocationIncomeRecord = {
      id: makeId("allocation-income"),
      userId,
      date: incomeDate || todayIsoDate(),
      source: incomeSource.trim(),
      amount,
      note: incomeNote.trim(),
      allocationStatus: shouldAllocateNow ? (previewDifference === 0 ? "allocated" : "partially_allocated") : "unallocated",
      allocationTemplateId: shouldAllocateNow ? selectedTemplate?.id : undefined,
      createdAt: timestamp,
    };

    const records: AllocationRecord[] = shouldAllocateNow
      ? previewItems
          .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
          .map((item) => ({
            id: makeId("allocation"),
            userId,
            incomeRecordId: incomeRecord.id,
            bucketId: item.bucketId,
            amount: item.amount,
            percentage: amount > 0 ? (item.amount / amount) * 100 : item.percentage,
            createdAt: timestamp,
          }))
      : [
          {
            id: makeId("allocation"),
            userId,
            incomeRecordId: incomeRecord.id,
            bucketId: unallocatedBucketId,
            amount,
            percentage: 100,
            createdAt: timestamp,
          },
        ];

    if (shouldAllocateNow && previewTotal <= 0) {
      setAllocationError("Allocation preview is empty. Save or select a valid template first.");
      return;
    }

    if (shouldAllocateNow && Math.abs(previewDifference) > 0) {
      records.push({
        id: makeId("allocation"),
        userId,
        incomeRecordId: incomeRecord.id,
        bucketId: unallocatedBucketId,
        amount: previewDifference,
        percentage: amount > 0 ? (previewDifference / amount) * 100 : 0,
        createdAt: timestamp,
      });
    }

    setState((current) => ({
      ...current,
      incomeRecords: [incomeRecord, ...current.incomeRecords],
      allocationRecords: [...records, ...current.allocationRecords],
    }));
    setIncomeAmount("");
    setIncomeSource("");
    setIncomeNote("");
    setManualAllocation({});
    setAllocationNotice(shouldAllocateNow ? "Incoming money allocated and bucket balances updated." : "Incoming money saved to Unallocated Cash.");
  }

  function saveInvestmentTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceError("");
    setPriceNotice("");

    const asset = state.assets.find((item) => item.id === newInvestment.assetId);
    const price = parsePositiveNumber(newInvestment.price);
    const amountIdr = parsePositiveNumber(newInvestment.amountIdr);
    const fee = Number(newInvestment.fee || 0);
    const sourceBucketId =
      newInvestment.sourceBucketId || investmentCashBucketId;
    const sourceBucket = state.buckets.find(
      (bucket) => bucket.id === sourceBucketId,
    );

    if (!asset) {
      setPriceError("Select an asset first.");
      return;
    }

    if (!sourceBucket) {
      setPriceError("Select a valid source bucket first.");
      return;
    }

    const validation = validateInvestmentPurchase({
      amountIdr,
      availableBalance: bucketBalances[sourceBucket.id] ?? 0,
      fee,
      price,
      quantityInput: newInvestment.quantity,
    });
    if (!validation.ok) {
      setPriceError(validation.message);
      return;
    }

    const transaction: InvestmentTransaction = {
      id: makeId("investment-tx"),
      userId,
      assetId: asset.id,
      date: newInvestment.date || todayIsoDate(),
      type: "buy",
      price,
      amountIdr,
      quantity: validation.quantity,
      fee,
      sourceBucketId: sourceBucket.id,
      note: newInvestment.note.trim(),
      createdAt: now(),
    };

    setState((current) => ({
      ...current,
      investmentTransactions: [transaction, ...current.investmentTransactions],
    }));
    setNewInvestment((current) => ({
      ...current,
      amountIdr: "",
      fee: "0",
      note: "",
      price: "",
      quantity: "",
    }));
    setPriceNotice(
      `Recorded ${asset.symbol} buy transaction. Current market price was left unchanged.`,
    );
  }

  function saveManualPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceError("");
    setPriceNotice("");

    const asset = state.assets.find((item) => item.id === manualPriceAssetId);
    const price = parsePositiveNumber(manualPrice);

    if (!asset || price <= 0) {
      setPriceError("Select asset and enter current price greater than 0.");
      return;
    }

    const snapshot: PriceSnapshot = {
      id: makeId("price"),
      userId,
      assetId: asset.id,
      price,
      currency: "IDR",
      source: "manual",
      timestamp: now(),
      isManual: true,
    };

    setState((current) => ({
      ...current,
      priceSnapshots: [snapshot, ...current.priceSnapshots],
    }));
    setManualPrice("");
    setPriceNotice(`Manual ${asset.symbol} price saved.`);
  }

  async function handleFetchPrice(asset: Asset, provider: "latest" | "mock") {
    setIsFetchingPrice(true);
    setPriceError("");
    setPriceNotice("");

    const result = provider === "latest" ? await fetchLatestPrice(asset.symbol) : getMockPriceQuote(asset.symbol);
    setIsFetchingPrice(false);

    if (!result.ok) {
      setPriceError(result.message);
      return;
    }

    const snapshot: PriceSnapshot = {
      id: makeId("price"),
      userId,
      assetId: asset.id,
      price: result.quote.price,
      currency: result.quote.currency,
      source: result.quote.source as PriceProviderId,
      timestamp: result.quote.timestamp,
      isManual: false,
    };

    setState((current) => ({
      ...current,
      priceSnapshots: [snapshot, ...current.priceSnapshots],
    }));
    setPriceNotice(`${asset.symbol} price updated from ${result.quote.source}. ${result.quote.limitation ?? ""}`.trim());
  }

  function exportLocalBackup() {
    setBackupError("");
    setBackupNotice("");

    const payload = {
      exportedAt: new Date().toISOString(),
      format: "rumahbudget-allocation-backup",
      state,
      userId,
      version: 1,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rumahbudget-allocation-${todayIsoDate()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupNotice(
      "Local backup exported. Store the JSON file privately because it contains allocation and portfolio details.",
    );
  }

  async function importLocalBackup(event: ChangeEvent<HTMLInputElement>) {
    setBackupError("");
    setBackupNotice("");

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.size > 2_000_000) {
      setBackupError("Backup file is too large. Maximum size is 2 MB.");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as {
        format?: unknown;
        state?: unknown;
        userId?: unknown;
        version?: unknown;
      };
      if (
        parsed.format !== "rumahbudget-allocation-backup" ||
        parsed.version !== 1 ||
        parsed.userId !== userId ||
        !isAllocationStateOwnedByUser(userId, parsed.state)
      ) {
        setBackupError(
          "Invalid backup or the file belongs to a different RumahBudget user.",
        );
        return;
      }

      const nextState = parsed.state as AllocationState;
      setState(nextState);
      setSelectedTemplateId(
        nextState.templates[0]?.id ?? "template-default-50-30-20",
      );
      setTemplateName(
        nextState.templates[0]?.name ?? "Default 50 / 30 / 20",
      );
      setTemplatePercentages(
        Object.fromEntries(
          nextState.buckets
            .filter((bucket) => bucket.type !== "unallocated")
            .map((bucket) => [
              bucket.id,
              String(
                nextState.templates[0]?.items.find(
                  (item) => item.bucketId === bucket.id,
                )?.percentage ?? 0,
              ),
            ]),
        ),
      );
      setBackupNotice("Local allocation backup restored for this user.");
    } catch {
      setBackupError("Could not read this backup JSON file.");
    }
  }

  function resetLocalData() {
    const confirmed = window.confirm("Reset local Allocation + Portfolio Watch data for this user? Existing core ledger records are not touched.");
    if (!confirmed) {
      return;
    }

    const nextState = createInitialState(userId);
    setState(nextState);
    setSelectedTemplateId(nextState.templates[0].id);
    setTemplateName(nextState.templates[0].name);
    setTemplatePercentages(
      Object.fromEntries(
        nextState.buckets
          .filter((bucket) => bucket.type !== "unallocated")
          .map((bucket) => [
            bucket.id,
            String(nextState.templates[0].items.find((item) => item.bucketId === bucket.id)?.percentage ?? 0),
          ]),
      ),
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-5 sm:px-6" id="money-allocation-watch">
      <TerminalPanel className="!p-5 sm:!p-6">
        <SectionHeader
          action={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone="lime">V1 Manual</StatusChip>
              <StatusChip tone="cyan">V2 Provider Layer</StatusChip>
              <StatusChip tone="amber">V3 BTC Latest</StatusChip>
            </div>
          }
          description="Allocate incoming money into buckets first, then separately track what happens after investment cash is used to buy assets. Saved to your private Supabase tables, with this browser keeping a local copy as a fallback. Core ledger tables are not changed."
          eyebrow="Money Allocation + Portfolio Watch"
          title="Allocate income, watch buckets, and track portfolio P/L"
          tone="cyan"
        />

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <MetricCell
            label="Bucket cash"
            tone="cyan"
            value={<NumberValue>{isBalanceHidden ? hiddenBalanceLabel : formatCurrency(totalBucketCash)}</NumberValue>}
            description="Allocation layer total after investment cash movements."
          />
          <MetricCell
            label="Unallocated"
            tone="rose"
            value={<NumberValue>{isBalanceHidden ? hiddenBalanceLabel : formatCurrency(unallocatedBalance)}</NumberValue>}
            description="Money recorded but not assigned to a bucket yet."
          />
          <MetricCell
            label="Portfolio value"
            tone="fuchsia"
            value={<NumberValue>{isBalanceHidden ? hiddenBalanceLabel : formatCurrency(totalPortfolioValue)}</NumberValue>}
            description="Computed from holdings and latest/manual price snapshots."
          />
          <MetricCell
            label="Floating P/L"
            tone={
              isBalanceHidden
                ? "cyan"
                : totalPortfolioPnl >= 0
                  ? "lime"
                  : "rose"
            }
            value={
              <NumberValue>
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : `${formatCurrency(totalPortfolioPnl)} (${totalPortfolioPnlPercent.toFixed(1)}%)`}
              </NumberValue>
            }
            description="Unrealized only. Not guaranteed and depends on price inputs."
          />
          <MetricCell
            label="Realized P/L"
            tone={
              isBalanceHidden ? "cyan" : totalRealizedPnl >= 0 ? "lime" : "rose"
            }
            value={
              <NumberValue>
                {isBalanceHidden
                  ? hiddenBalanceLabel
                  : formatCurrency(totalRealizedPnl)}
              </NumberValue>
            }
            description="Already banked from closed and partially closed positions."
          />
        </div>

        {syncError ? (
          <Notice className="mt-5" tone="rose">
            Not saved to your account yet: {syncError} Your changes are held in
            this browser and will be retried on the next edit.
          </Notice>
        ) : syncNotice ? (
          <Notice className="mt-5" tone="amber">
            {syncNotice}
          </Notice>
        ) : (
          <Notice className="mt-5" tone="lime">
            {isSyncing
              ? "Saving to your account..."
              : "Saved to your account. Available from any browser you sign in on."}
          </Notice>
        )}

        <Notice className="mt-5" tone="amber">
          V3 safe live integration is limited to BTC via a server-side CoinGecko route. BBCA/BBRI stay manual until a reliable licensed IDX market-data provider is selected. No API keys are exposed. Core ledger accounts detected: {accounts.length}.
        </Notice>
        <div className="mt-4 flex flex-wrap gap-3">
          <SharpButton
            disabled={isBalanceHidden}
            onClick={exportLocalBackup}
            title={
              isBalanceHidden
                ? "Turn off privacy mode before exporting sensitive data."
                : undefined
            }
            type="button"
          >
            Export Local Backup
          </SharpButton>
          <SharpButton
            disabled={isBalanceHidden}
            onClick={() => backupInputRef.current?.click()}
            title={
              isBalanceHidden
                ? "Turn off privacy mode before importing allocation data."
                : undefined
            }
            type="button"
          >
            Import Local Backup
          </SharpButton>
          <input
            accept="application/json,.json"
            className="sr-only"
            onChange={importLocalBackup}
            ref={backupInputRef}
            type="file"
          />
        </div>
        {backupError ? (
          <Notice className="mt-4" tone="rose">
            {backupError}
          </Notice>
        ) : null}
        {backupNotice ? (
          <Notice className="mt-4" tone="lime">
            {backupNotice}
          </Notice>
        ) : null}
      </TerminalPanel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <TerminalPanel className="!p-5 sm:!p-6">
          <SectionHeader
            eyebrow="Allocation Template"
            title="Set your split rule"
            description="Default example is 50% Living, 30% Investment Cash, 20% Emergency Fund. Total must equal 100%."
            tone="lime"
          />
          <form className="mt-5 grid gap-4" onSubmit={saveTemplate}>
            <label className={labelClassName}>
              Template name
              <SharpInput value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {state.buckets
                .filter((bucket) => bucket.type !== "unallocated")
                .map((bucket) => (
                  <label className={labelClassName} key={bucket.id}>
                    {bucket.name} %
                    <SharpInput
                      inputMode="decimal"
                      min="0"
                      type="number"
                      value={templatePercentages[bucket.id] ?? "0"}
                      onChange={(event) =>
                        setTemplatePercentages((current) => ({
                          ...current,
                          [bucket.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
            </div>
            <SharpButton type="submit" variant="primary">Save Template</SharpButton>
          </form>
        </TerminalPanel>

        <TerminalPanel className="!p-5 sm:!p-6">
          <SectionHeader
            eyebrow="Income Allocation"
            title="Preview before saving"
            description="Record incoming money here when you want allocation logic. Existing Income form remains untouched."
            tone="cyan"
          />
          <form className="mt-5 grid gap-4" onSubmit={saveIncomeAllocation}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClassName}>
                Amount
                <SharpInput inputMode="numeric" min="0" type="number" value={incomeAmount} onChange={(event) => { setIncomeAmount(event.target.value); setManualAllocation({}); }} placeholder="3000000" />
              </label>
              <label className={labelClassName}>
                Source
                <SharpInput value={incomeSource} onChange={(event) => setIncomeSource(event.target.value)} placeholder="Salary, bonus, project" />
              </label>
              <label className={labelClassName}>
                Date
                <SharpInput type="date" value={incomeDate} onChange={(event) => setIncomeDate(event.target.value)} />
              </label>
              <label className={labelClassName}>
                Template
                <SharpSelect value={selectedTemplateId} onChange={(event) => { setSelectedTemplateId(event.target.value); setManualAllocation({}); }}>
                  {state.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </SharpSelect>
              </label>
              <label className={`${labelClassName} sm:col-span-2`}>
                Note
                <SharpInput value={incomeNote} onChange={(event) => setIncomeNote(event.target.value)} placeholder="Optional note" />
              </label>
            </div>

            <label className="flex items-center gap-3 border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-slate-200">
              <input checked={shouldAllocateNow} type="checkbox" onChange={(event) => setShouldAllocateNow(event.target.checked)} />
              Allocate this income now? Uncheck to send it to Unallocated Cash.
            </label>

            {shouldAllocateNow ? (
              <div className="border border-cyan-300/15 bg-cyan-300/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-200">Allocation preview</p>
                  <p className={`text-sm font-bold ${previewDifference === 0 ? "text-lime-200" : "text-amber-200"}`}>
                    Difference: {isBalanceHidden ? hiddenBalanceLabel : formatCurrency(previewDifference)}
                  </p>
                </div>
                <div className="space-y-3">
                  {previewItems.length === 0 ? (
                    <EmptyState>Enter amount and save/select a valid template to preview allocation.</EmptyState>
                  ) : (
                    previewItems.map((item) => {
                      const bucket = bucketsById.get(item.bucketId);
                      return (
                        <div className="grid gap-3 border border-white/10 bg-black/30 p-3 sm:grid-cols-[1fr_7rem_10rem] sm:items-center" key={item.bucketId}>
                          <div>
                            <p className="font-bold text-white">{bucket?.name ?? "Unknown bucket"}</p>
                            <p className="text-xs text-slate-400">{item.percentage.toFixed(1)}% suggested</p>
                          </div>
                          <p className="text-sm font-bold text-cyan-100">
                            {isBalanceHidden
                              ? hiddenBalanceLabel
                              : formatCurrency(Math.round((incomeAmountNumber * item.percentage) / 100))}
                          </p>
                          <SharpInput
                            inputMode="numeric"
                            min="0"
                            type="number"
                            value={String(item.amount)}
                            onChange={(event) => setManualAllocation((current) => ({ ...current, [item.bucketId]: event.target.value }))}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            {allocationError ? <Notice tone="rose">{allocationError}</Notice> : null}
            {allocationNotice ? <Notice tone="lime">{allocationNotice}</Notice> : null}
            <SharpButton type="submit" variant="primary">Save Incoming Money</SharpButton>
          </form>
        </TerminalPanel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <TerminalPanel className="!p-5 sm:!p-6">
          <SectionHeader
            eyebrow="Bucket Dashboard"
            title="Current allocation balances"
            description="Investment Cash decreases only when you record an asset buy linked to that bucket. Allocation is not automatically considered invested."
            tone="fuchsia"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {state.buckets.map((bucket) => {
              const balance = bucketBalances[bucket.id] ?? 0;
              const progress = bucket.targetAmount && bucket.targetAmount > 0 ? Math.min(100, (balance / bucket.targetAmount) * 100) : null;
              return (
                <article className={`border p-4 ${bucketTone[bucket.type]}`} key={bucket.id}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{bucket.type.replace(/_/g, " ")}</p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">{bucket.name}</h3>
                      <p className="mt-1 text-xl font-black text-white">
                        <NumberValue>{isBalanceHidden ? hiddenBalanceLabel : formatCurrency(balance)}</NumberValue>
                      </p>
                    </div>
                    {bucket.targetAmount ? <StatusChip tone="lime">Target</StatusChip> : null}
                  </div>
                  {progress !== null ? (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden bg-black/50">
                        <div
                          className="h-full bg-lime-300"
                          style={{
                            width: `${getAllocationBarPercent(progress, isBalanceHidden)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        {isBalanceHidden
                          ? hiddenBalanceLabel
                          : `${progress.toFixed(1)}% of ${formatCurrency(bucket.targetAmount ?? 0)}`}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="mt-5 border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Emergency Fund Progress</p>
            <div className="mt-3 h-3 overflow-hidden border border-white/10 bg-black/60">
              <div
                className="h-full bg-lime-300 shadow-[0_0_20px_rgba(190,242,100,0.35)]"
                style={{
                  width: `${getAllocationBarPercent(emergencyProgress, isBalanceHidden)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {isBalanceHidden
                ? hiddenBalanceLabel
                : `${formatCurrency(emergencyBalance)} / ${formatCurrency(emergencyTarget)} (${emergencyProgress.toFixed(1)}%)`}
            </p>
          </div>
        </TerminalPanel>

        <TerminalPanel className="!p-5 sm:!p-6">
          <SectionHeader
            eyebrow="Portfolio Tracker"
            title="Manual buys and price watch"
            description="Record buys separately from allocation. Manual/current prices calculate holdings and unrealized P/L."
            tone="cyan"
          />
          <form className="mt-5 grid gap-4" onSubmit={saveInvestmentTransaction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClassName}>
                Asset
                <SharpSelect value={newInvestment.assetId} onChange={(event) => setNewInvestment((current) => ({ ...current, assetId: event.target.value }))}>
                  {state.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol} — {asset.name}</option>)}
                </SharpSelect>
              </label>
              <label className={labelClassName}>
                Buy date
                <SharpInput type="date" value={newInvestment.date} onChange={(event) => setNewInvestment((current) => ({ ...current, date: event.target.value }))} />
              </label>
              <label className={labelClassName}>
                Buy price
                <SharpInput inputMode="decimal" min="0" type="number" value={newInvestment.price} onChange={(event) => setNewInvestment((current) => ({ ...current, price: event.target.value }))} placeholder="Price per unit" />
              </label>
              <label className={labelClassName}>
                Amount invested IDR
                <SharpInput inputMode="numeric" min="0" type="number" value={newInvestment.amountIdr} onChange={(event) => setNewInvestment((current) => ({ ...current, amountIdr: event.target.value }))} placeholder="900000" />
              </label>
              <label className={labelClassName}>
                Quantity / units optional
                <SharpInput inputMode="decimal" min="0" type="number" value={newInvestment.quantity} onChange={(event) => setNewInvestment((current) => ({ ...current, quantity: event.target.value }))} placeholder="Auto-calculated if empty" />
              </label>
              <label className={labelClassName}>
                Fee
                <SharpInput inputMode="numeric" min="0" type="number" value={newInvestment.fee} onChange={(event) => setNewInvestment((current) => ({ ...current, fee: event.target.value }))} />
              </label>
              <label className={labelClassName}>
                Source bucket
                <SharpSelect value={newInvestment.sourceBucketId} onChange={(event) => setNewInvestment((current) => ({ ...current, sourceBucketId: event.target.value }))}>
                  {state.buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}
                </SharpSelect>
              </label>
              <label className={labelClassName}>
                Note
                <SharpInput value={newInvestment.note} onChange={(event) => setNewInvestment((current) => ({ ...current, note: event.target.value }))} placeholder="Optional" />
              </label>
            </div>
            <SharpButton type="submit" variant="primary">Record Buy Transaction</SharpButton>
          </form>

          <form className="mt-5 grid gap-4 border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={saveManualPrice}>
            <label className={labelClassName}>
              Manual current price asset
              <SharpSelect value={manualPriceAssetId} onChange={(event) => setManualPriceAssetId(event.target.value)}>
                {state.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol}</option>)}
              </SharpSelect>
            </label>
            <label className={labelClassName}>
              Current price
              <SharpInput inputMode="numeric" min="0" type="number" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} />
            </label>
            <SharpButton type="submit">Save Manual Price</SharpButton>
          </form>

          {priceError ? <Notice className="mt-4" tone="rose">{priceError}</Notice> : null}
          {priceNotice ? <Notice className="mt-4" tone="lime">{priceNotice}</Notice> : null}
        </TerminalPanel>
      </div>

      <TerminalPanel className="mt-5 !p-5 sm:!p-6">
        <SectionHeader
          action={
            <SharpButton
              disabled={isBalanceHidden}
              onClick={resetLocalData}
              title={
                isBalanceHidden
                  ? "Turn off privacy mode before resetting allocation data."
                  : undefined
              }
              type="button"
              variant="danger"
            >
              Reset Local Data
            </SharpButton>
          }
          eyebrow="Portfolio Watch"
          title="Holdings, prices, and recent allocation history"
          description="BTC latest price can be fetched safely through the server route. BBCA/BBRI should use manual price for now."
          tone="amber"
        />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {holdings.length === 0 ? <EmptyState>No assets configured.</EmptyState> : holdings.map((holding) => {
              const asset = state.assets.find((item) => item.id === holding.assetId);
              const latestPrice = latestPrices[holding.assetId];
              return (
                <article className="border border-white/10 bg-white/[0.03] p-4" key={holding.assetId}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-white">
                          {isBalanceHidden ? "Private asset" : holding.symbol}
                        </h3>
                        <StatusChip
                          tone={
                            isBalanceHidden
                              ? "cyan"
                              : asset?.type === "crypto"
                                ? "amber"
                                : "cyan"
                          }
                        >
                          {isBalanceHidden ? "hidden" : asset?.type ?? "asset"}
                        </StatusChip>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {isBalanceHidden ? hiddenBalanceLabel : holding.name}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {isBalanceHidden
                          ? "Price details hidden"
                          : `Price source: ${latestPrice?.source ?? "buy fallback"} ${latestPrice ? `• ${new Date(latestPrice.timestamp).toLocaleString()}` : ""}`}
                      </p>
                    </div>
                    {!isBalanceHidden ? (
                      <div className="flex flex-wrap gap-2">
                        <SharpButton disabled={isFetchingPrice} onClick={() => asset && handleFetchPrice(asset, "latest")} type="button">Fetch Latest</SharpButton>
                        <SharpButton disabled={isFetchingPrice} onClick={() => asset && handleFetchPrice(asset, "mock")} type="button">Use Mock</SharpButton>
                      </div>
                    ) : null}
                  </div>
                  {holding.hasInvalidHistory ? (
                    <Notice className="mt-4" tone="amber">
                      This asset has sales recorded for more units than were ever
                      bought. Fix the transaction history before trusting these
                      figures.
                    </Notice>
                  ) : null}
                  <div className="mt-4 grid gap-3 sm:grid-cols-5">
                    <MiniStat label="Units" value={isBalanceHidden ? hiddenBalanceLabel : holding.totalQuantity.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")} />
                    <MiniStat label="Avg buy" value={isBalanceHidden ? hiddenBalanceLabel : formatCurrency(holding.averagePrice)} />
                    <MiniStat label="Current value" value={isBalanceHidden ? hiddenBalanceLabel : formatCurrency(holding.currentValue)} />
                    <MiniStat
                      label="Unrealized P/L"
                      value={isBalanceHidden ? hiddenBalanceLabel : `${formatCurrency(holding.unrealizedPnL)} (${holding.unrealizedPnLPercent.toFixed(1)}%)`}
                      valueClassName={
                        isBalanceHidden
                          ? "text-white"
                          : holding.unrealizedPnL >= 0
                            ? "text-lime-200"
                            : "text-rose-200"
                      }
                    />
                    <MiniStat
                      label="Realized P/L"
                      value={isBalanceHidden ? hiddenBalanceLabel : formatCurrency(holding.realizedPnL)}
                      valueClassName={
                        isBalanceHidden
                          ? "text-white"
                          : holding.realizedPnL >= 0
                            ? "text-lime-200"
                            : "text-rose-200"
                      }
                    />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden bg-black/50">
                    <div
                      className="h-full bg-cyan-300"
                      style={{
                        width: `${getAllocationBarPercent(holding.portfolioAllocationPercent, isBalanceHidden)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {isBalanceHidden
                      ? "Portfolio allocation hidden"
                      : `Portfolio allocation: ${holding.portfolioAllocationPercent.toFixed(1)}%`}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Recent allocation history</p>
            <div className="mt-4 space-y-3">
              {recentAllocations.length === 0 ? (
                <EmptyState>No allocations yet.</EmptyState>
              ) : recentAllocations.map((record) => {
                const bucket = bucketsById.get(record.bucketId);
                const income = state.incomeRecords.find((item) => item.id === record.incomeRecordId);
                return (
                  <article className="border border-white/10 bg-white/[0.03] p-3" key={record.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">
                          {isBalanceHidden
                            ? "Private allocation"
                            : bucket?.name ?? "Unknown bucket"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {isBalanceHidden
                            ? hiddenBalanceLabel
                            : `${income?.source ?? "Incoming money"} • ${income?.date ?? "No date"}`}
                        </p>
                      </div>
                      <p className="font-black text-lime-200">{isBalanceHidden ? hiddenBalanceLabel : formatCurrency(record.amount)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </TerminalPanel>
    </section>
  );
}

function MiniStat({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="border border-white/10 bg-black/30 p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-black ${valueClassName}`}>{value}</p>
    </div>
  );
}
