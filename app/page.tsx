export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Family Expense Tracker
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            RumahBudget
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Catat pengeluaran keluarga dengan mudah, lihat kondisi keuangan
            bulanan, dan siapkan laporan mingguan atau bulanan untuk keluarga.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Sisa Bulan Ini</p>
              <p className="mt-2 text-2xl font-bold">Rp0</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Pengeluaran</p>
              <p className="mt-2 text-2xl font-bold">Rp0</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">Aman</p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <button className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950">
              + Catat Pengeluaran
            </button>

            <button className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200">
              Lihat Riwayat
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}