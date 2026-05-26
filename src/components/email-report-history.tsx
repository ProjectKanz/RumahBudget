"use client";

import {
  EmptyState,
  Notice,
  SectionHeader,
  StatusChip,
  TerminalPanel,
} from "@/src/components/cockpit-ui";
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
    <section
      className="mx-auto w-full max-w-5xl px-5 pb-12 sm:px-6"
      id="email-history"
    >
      <TerminalPanel className="!p-5 sm:!p-6">
        <SectionHeader
          description="Delivery records for the signed-in account."
          eyebrow="Email Report History"
          title="Recent deliveries"
          tone="lime"
        />

        {error ? (
          <Notice className="mt-6" tone="rose">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <EmptyState>
              Loading email report history...
            </EmptyState>
          ) : emailReports.length === 0 ? (
            <EmptyState>
              No email reports have been sent yet.
            </EmptyState>
          ) : (
            emailReports.map((report) => (
              <article
                className="cockpit-card border border-white/10 bg-white/[0.03] p-4"
                key={report.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip
                        className="py-1"
                        tone={report.status === "success" ? "lime" : "rose"}
                      >
                        {report.status === "success" ? "Success" : "Failed"}
                      </StatusChip>
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
                  <Notice className="mt-4" tone="rose">
                    {report.errorMessage}
                  </Notice>
                ) : null}
              </article>
            ))
          )}
        </div>
      </TerminalPanel>
    </section>
  );
}
