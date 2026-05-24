export type EmailReportStatus = "success" | "failed";

export type EmailReport = {
  id: string;
  userId: string;
  recipientEmail: string;
  reportType: string;
  periodLabel: string;
  status: EmailReportStatus;
  errorMessage: string;
  sentAt: number;
};
