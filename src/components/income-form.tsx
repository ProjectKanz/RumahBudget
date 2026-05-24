"use client";

import type { Income } from "@/src/types/income";
import type { ActiveUser } from "@/src/types/user";
import { FormEvent, useMemo, useState } from "react";

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type IncomeFormProps = {
  activeUser: ActiveUser;
  incomes: Income[];
  onAddIncome: (income: Income) => void;
  onDeleteIncome: (id: string) => void;
};

export default function IncomeForm({
  activeUser,
  incomes,
  onAddIncome,
  onDeleteIncome,
}: IncomeFormProps) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const totalIncome = useMemo(
    () => incomes.reduce((total, income) => total + income.amount, 0),
    [incomes],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const numericAmount = Number(amount);
    const trimmedSource = source.trim();

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Masukkan amount pemasukan yang lebih besar dari 0.");
      return;
    }

    if (!trimmedSource) {
      setError("Masukkan sumber pemasukan.");
      return;
    }

    onAddIncome({
      id: crypto.randomUUID(),
      owner: activeUser,
      createdAt: Date.now(),
      amount: numericAmount,
      source: trimmedSource,
      note: note.trim(),
    });

    setAmount("");
    setSource("");
    setNote("");
    setError("");
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6"
      id="income-form"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Catat Pemasukan
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tambah dana masuk
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Tersimpan untuk {activeUser} dan dipakai menghitung saldo pribadi.
          </p>
        </div>

        <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className={labelClassName}>
            Jumlah
            <input
              className={inputClassName}
              name="incomeAmount"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Rp0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className={labelClassName}>
            Sumber
            <input
              className={inputClassName}
              name="source"
              type="text"
              placeholder="Contoh: gaji, bonus, usaha"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </label>

          <label className={`${labelClassName} sm:col-span-2`}>
            Catatan
            <input
              className={inputClassName}
              name="incomeNote"
              type="text"
              placeholder="Catatan opsional"
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
              Simpan Pemasukan
            </button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Riwayat Pemasukan
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
              Total {rupiahFormatter.format(totalIncome)}
            </h2>
          </div>
          <p className="text-sm text-slate-400">
            {incomes.length} transaksi tersimpan
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {incomes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              Belum ada pemasukan. Tambahkan dana masuk dari form di atas.
            </div>
          ) : (
            incomes.map((income) => (
              <article
                className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={income.id}
              >
                <div>
                  <p className="text-lg font-bold text-white">
                    {rupiahFormatter.format(income.amount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {income.source}
                  </p>
                  {income.note ? (
                    <p className="mt-2 text-sm text-slate-500">
                      {income.note}
                    </p>
                  ) : null}
                </div>

                <button
                  className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/10"
                  type="button"
                  onClick={() => onDeleteIncome(income.id)}
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
