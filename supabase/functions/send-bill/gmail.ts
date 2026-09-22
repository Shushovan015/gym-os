export type OutgoingBill = {
  from: { name: string; address: string }; to: string; subject: string;
  text: string; html: string; messageId: string;
  attachments: Array<{ filename: string; content: string; contentType: string }>;
};
export type SendMail = (message: OutgoingBill) => Promise<{ accepted: unknown[]; messageId: string }>;

// SMTP has no idempotency key. Only explicit rejection or failure before the
// SMTP envelope is sent is safe to retry. All other failures require review.
export function classifySmtpError(error: unknown): { status: "failed" | "uncertain"; message: string } {
  const value = error as { code?: string; responseCode?: number; command?: string } | null;
  if (value?.code === "EAUTH") return { status: "failed", message: "Gmail rejected the login. Check the Gmail address and Google App Password on the server." };
  if (value?.code === "EDNS" || value?.command === "CONN") return { status: "failed", message: "Could not connect to Gmail. Check the internet connection and try again." };
  if (value?.code === "EENVELOPE" || (value?.responseCode && value.responseCode >= 400 && value.responseCode < 600)) {
    return { status: "failed", message: "Gmail rejected the message. Check the recipient, account sending limits and Google account alerts before retrying." };
  }
  return { status: "uncertain", message: "Gmail did not confirm the result. Check Gmail Sent for this invoice; automatic retry is blocked to prevent duplicates." };
}
