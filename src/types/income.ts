import type { ActiveUser } from "@/src/types/user";

export type Income = {
  id: string;
  owner: ActiveUser;
  amount: number;
  source: string;
  note: string;
};
