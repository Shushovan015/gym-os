import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { AdminButton, AdminDialog, AdminLoading, AdminNotice } from "@src/components/admin/AdminUI";
import type { InvoiceRow } from "./types";

type Delivery = { invoice_id: number; status: "sending" | "sent" | "failed" | "uncertain"; error_message?: string | null };

export function useBillEmail(invoices: InvoiceRow[], sender: string | null, onSuccess: (message: string) => void) {
  const [deliveries, setDeliveries] = useState<Record<number, Delivery>>({});
  const [target, setTarget] = useState<InvoiceRow | null>(null);
  const [recipient, setRecipient] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const requestId = useRef(0);
  const ids = Array.from(new Set(invoices.map((invoice) => invoice.id))).sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!ids) return;
    let alive = true;
    void supabase.from("invoice_email_deliveries").select("invoice_id,status,error_message")
      .in("invoice_id", ids.split(",").map(Number)).then(({ data, error: loadError }) => {
        if (!alive || loadError) return;
        setDeliveries((current) => {
          const next = { ...current };
          for (const row of (data ?? []) as Delivery[]) {
            if (current[row.invoice_id]?.status !== "sent") next[row.invoice_id] = row;
          }
          return next;
        });
      });
    return () => { alive = false; };
  }, [ids]);
  useEffect(() => () => { requestId.current += 1; }, []);

  const close = () => {
    if (guard.current) return;
    requestId.current += 1; setTarget(null);
  };
  const prepare = async (invoice: InvoiceRow) => {
    if (guard.current) return;
    const currentRequest = ++requestId.current;
    setTarget(invoice); setRecipient(""); setError(""); setPreparing(true);
    try {
      const [member, delivery] = await Promise.all([
        supabase.from("members").select("email").eq("id", invoice.member_ref).is("deleted_at", null).maybeSingle(),
        supabase.from("invoice_email_deliveries").select("invoice_id,status,error_message").eq("invoice_id", invoice.id).maybeSingle(),
      ]);
      if (currentRequest !== requestId.current) return;
      if (delivery.error) throw new Error("Email setup is incomplete. Apply the Gmail bill migration first.");
      if (delivery.data) setDeliveries((current) => ({ ...current, [invoice.id]: delivery.data as Delivery }));
      if (member.error || !member.data?.email?.trim()) throw new Error("Save an email address on the member's profile first.");
      setRecipient(member.data.email.trim());
    } catch (problem) {
      if (currentRequest === requestId.current) setError(problem instanceof Error ? problem.message : "Could not check the member email. Try again.");
    } finally { if (currentRequest === requestId.current) setPreparing(false); }
  };
  const send = async () => {
    if (!target || !recipient || guard.current) return;
    const invoice = target;
    const currentRequest = requestId.current;
    guard.current = true; setSending(true); setError("");
    try {
      const result = await supabase.functions.invoke("send-bill", { body: { invoice_id: invoice.id, expected_email: recipient } });
      if (currentRequest !== requestId.current) return;
      if (result.error || !result.data?.ok) {
        let details = result.data;
        if (result.error && "context" in result.error && result.error.context instanceof Response) {
          details = await result.error.context.json().catch(() => null);
        }
        if (details?.status && ["sent", "sending", "failed", "uncertain"].includes(details.status)) {
          setDeliveries((current) => ({ ...current, [invoice.id]: { invoice_id: invoice.id, status: details.status, error_message: details.error } }));
        }
        throw new Error(details?.error || "Could not reach the email function. Check the connection and Gmail setup before retrying.");
      }
      setDeliveries((current) => ({ ...current, [invoice.id]: { invoice_id: invoice.id, status: "sent" } }));
      onSuccess(result.data.already_sent ? "This bill was already sent. No duplicate was sent." : `Bill ${invoice.invoice_number} accepted by Gmail for ${recipient}.`);
      setTarget(null);
    } catch (problem) {
      if (currentRequest === requestId.current) setError(problem instanceof Error ? problem.message : "Could not confirm bill delivery.");
    } finally { guard.current = false; if (currentRequest === requestId.current) setSending(false); }
  };

  const targetStatus = target ? deliveries[target.id]?.status : undefined;
  const blocked = targetStatus === "sent" || targetStatus === "uncertain";
  const button = (invoice: InvoiceRow) => {
    const status = deliveries[invoice.id]?.status;
    return <AdminButton variant="secondary" disabled={sending || status === "sent" || invoice.invoice_status !== "issued" || !invoice.member_ref} title={!invoice.member_ref ? "Link this bill to a member with a saved email" : undefined} onClick={() => void prepare(invoice)}>
      <Mail className="h-4 w-4" />{status === "sent" ? "Bill sent" : status === "uncertain" || status === "sending" ? "Check email status" : "Send Bill"}
    </AdminButton>;
  };
  const dialog = <AdminDialog open={Boolean(target)} title={`Send bill ${target?.invoice_number ?? ""}?`} onClose={close}
    footer={<div className="flex flex-wrap justify-end gap-2"><AdminButton disabled={sending} onClick={close}>Close</AdminButton><AdminButton variant="primary" disabled={preparing || sending || !recipient || !sender || blocked} onClick={() => void send()}>{sending ? "Sending..." : targetStatus === "sending" ? "Check status" : "Confirm and send"}</AdminButton></div>}>
    <div className="space-y-3" aria-live="polite">
      {preparing ? <AdminLoading label="Checking member email..." /> : <p className="break-words text-sm text-slate-300">Send to <b>{recipient || "the member's saved email"}</b> from <b>{sender || "an unconfigured sender"}</b>.</p>}
      <p className="text-sm text-slate-400">Includes the bill and a printable invoice. Sending requires internet. Each invoice can be sent once.</p>
      {!sender ? <AdminNotice tone="warning">Set Bill sender email in System Settings to your Gmail address.</AdminNotice> : null}
      {targetStatus === "sent" ? <AdminNotice tone="success">This bill was already sent.</AdminNotice> : null}
      {targetStatus === "uncertain" ? <AdminNotice tone="warning">Check Gmail Sent for this invoice. The previous result is unknown, so resending is blocked to prevent duplicates.</AdminNotice> : null}
      {targetStatus === "sending" ? <AdminNotice>This bill is already being sent. Checking its status will not send another copy.</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}
    </div>
  </AdminDialog>;
  return { button, dialog };
}
