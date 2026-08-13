function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function localDateInputToTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

export function timestampToLocalDateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? toLocalDateInputValue(date) : "";
}

export type LedgerTransactionUpdate =
  | {
      type: "expense";
      id: string;
      accountId: string;
      amount: number;
      category: string;
      description: string;
      note: string;
      paymentMethod: string;
      transactionDate: string;
    }
  | {
      type: "income";
      id: string;
      accountId: string;
      amount: number;
      note: string;
      source: string;
      transactionDate: string;
    }
  | {
      type: "transfer";
      id: string;
      amount: number;
      fromAccountId: string;
      note: string;
      toAccountId: string;
      transactionDate: string;
    };
