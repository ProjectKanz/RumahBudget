export type SandboxTransaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  label: string;
  amount: number;
  timing: "recurring" | "one-time";
  monthOffset?: number; // 1-12
};
