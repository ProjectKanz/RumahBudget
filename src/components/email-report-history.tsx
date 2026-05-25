"use client";

import type { EmailReport } from "@/src/types/email-report";

type EmailReportHistoryProps = {
  emailReports: EmailReport[];
  error: string;
  isLoading: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function EmailReportHistory({
  emailReports,
  error,
  isLoading,
}: EmailReportHistoryProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20 sm:px-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <div className="border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Email Report History
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Recent deliveries
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Delivery records for the signed-in account.
          </p>
        </div>

        {error ? (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              Loading email report history...
            </div>
          ) : emailReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              No email reports have been sent yet.
            </div>
          ) : (
            emailReports.map((report) => (
              <article
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                key={report.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          report.status === "success"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-red-400/15 text-red-300"
                        }`}
                      >
                        {report.status === "success" ? "Success" : "Failed"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dateTimeFormatter.format(new Date(report.sentAt))}
                      </span>
                    </div>

                    <p className="mt-3 text-lg font-bold text-white">
                      {report.reportType}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {report.periodLabel}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Sent to {report.recipientEmail}
                    </p>
                  </div>
                </div>

                {report.errorMessage ? (
                  <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {report.errorMessage}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
