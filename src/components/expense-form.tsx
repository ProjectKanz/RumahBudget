"use client";

import type { Expense } from "@/src/types/expense";
import type { ActiveUser } from "@/src/types/user";
import { FormEvent, useMemo, useState } from "react";

const categories = [
  { label: "Belanja Dapur", value: "Belanja Dapur" },
  { label: "Transportasi", value: "Transportasi" },
  { label: "Tagihan", value: "Tagihan" },
  { label: "Pendidikan", value: "Pendidikan" },
  { label: "Kesehatan", value: "Kesehatan" },
  { label: "Lainnya", value: "Lainnya" },
];

const paymentMethods = [
  { label: "Tunai", value: "Tunai" },
  { label: "Kartu Debit", value: "Kartu Debit" },
  { label: "E-Wallet", value: "E-Wallet" },
  { label: "Transfer Bank", value: "Transfer Bank" },
];

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type ExpenseFormProps = {
  activeUser: ActiveUser;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
};

export default function ExpenseForm({
  activeUser,
  expenses,
  onAddExpense,
  onDeleteExpense,
}: ExpenseFormProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0].value);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const totalExpense = useMemo(
    () => expenses.reduce((total, expense) => total + expense.amount, 0),
    [expenses],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Masukkan amount yang lebih besar dari 0.");
      return;
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      owner: activeUser,
      createdAt: Date.now(),
      amount: numericAmount,
      category,
      paymentMethod,
      note: note.trim(),
    };

    onAddExpense(expense);
    setAmount("");
    setNote("");
    setError("");
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="expense-form"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Catat Pengeluaran
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tambah transaksi pribadi
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Tersimpan untuk {activeUser} di prototype lokal ini.
          </p>
        </div>

        <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Jumlah
            <input
              className={inputClassName}
              name="amount"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Rp0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className={labelClassName}>
            Kategori
            <select
              className={inputClassName}
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Metode Pembayaran
            <select
              className={inputClassName}
              name="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              {paymentMethods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClassName} sm:col-span-2`}>
            Catatan
            <input
              className={inputClassName}
              name="note"
              type="text"
              placeholder="Contoh: belanja mingguan di pasar"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:col-span-2">
              {error}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto"
              type="submit"
            >
              Simpan Pengeluaran
            </button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Riwayat Pengeluaran
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Total {rupiahFormatter.format(totalExpense)}
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            {expenses.length} transaksi tersimpan
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {expenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              Belum ada pengeluaran. Tambahkan transaksi pertama dari form di
              atas.
            </div>
          ) : (
            expenses.map((expense) => (
              <article
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={expense.id}
              >
                <div>
                  <p className="text-lg font-bold text-white">
                    {rupiahFormatter.format(expense.amount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {expense.category} / {expense.paymentMethod}
                  </p>
                  {expense.note ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {expense.note}
                    </p>
                  ) : null}
                </div>

                <button
                  className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/10"
                  type="button"
                  onClick={() => onDeleteExpense(expense.id)}
                >
                  Hapus
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
