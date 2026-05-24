const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20";

const labelClassName = "text-sm font-medium text-slate-300";

export default function ExpenseForm() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-20">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Catat Pengeluaran
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tambah transaksi keluarga
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Simpan detail pengeluaran harian. Data belum dikirim ke database.
          </p>
        </div>

        <form className="grid gap-5 sm:grid-cols-2">
          <label className={labelClassName}>
            Amount
            <input
              className={inputClassName}
              name="amount"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Rp0"
            />
          </label>

          <label className={labelClassName}>
            Category
            <select className={inputClassName} name="category" defaultValue="">
              <option value="" disabled>
                Pilih kategori
              </option>
              <option value="groceries">Belanja Dapur</option>
              <option value="transport">Transportasi</option>
              <option value="utilities">Tagihan</option>
              <option value="education">Pendidikan</option>
              <option value="health">Kesehatan</option>
              <option value="other">Lainnya</option>
            </select>
          </label>

          <label className={labelClassName}>
            Paid by
            <select className={inputClassName} name="paidBy" defaultValue="">
              <option value="" disabled>
                Pilih anggota
              </option>
              <option value="ayah">Ayah</option>
              <option value="ibu">Ibu</option>
              <option value="keluarga">Keluarga</option>
            </select>
          </label>

          <label className={labelClassName}>
            Payment method
            <select className={inputClassName} name="paymentMethod" defaultValue="">
              <option value="" disabled>
                Pilih metode
              </option>
              <option value="cash">Tunai</option>
              <option value="debit">Kartu Debit</option>
              <option value="ewallet">E-Wallet</option>
              <option value="bank-transfer">Transfer Bank</option>
            </select>
          </label>

          <label className={`${labelClassName} sm:col-span-2`}>
            Note
            <input
              className={inputClassName}
              name="note"
              type="text"
              placeholder="Contoh: belanja mingguan di pasar"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              className="w-full rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto"
              type="submit"
            >
              Save expense
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
