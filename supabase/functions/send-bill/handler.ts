import type { SupabaseClient } from "npm:@supabase/supabase-js@2.97.0";
import { encodeAttachment, renderBill, validEmail } from "./template.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function createSendBillHandler(db: SupabaseClient, resendKey: string, send: typeof fetch = fetch) {
return async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json({ error: "Sign in to send a bill." }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Your session has expired. Sign in again." }, 401);
    const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profileError || profile?.role !== "admin") return json({ error: "Admin access required." }, 403);
    if (!resendKey) return json({ error: "Bill email is not configured. Set the server-side Resend API key." }, 503);
    let body: { invoice_id?: unknown; expected_email?: unknown };
    try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const id = body?.invoice_id;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return json({ error: "Invalid invoice ID." }, 400);
    const { data: existing, error: existingError } = await db.from("invoice_email_deliveries").select("status").eq("invoice_id", id).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "sent") return json({ ok: true, already_sent: true });
    const [{ data: invoice, error: invoiceError }, { data: settings, error: settingsError }, { data: items, error: itemsError }] = await Promise.all([
      db.from("invoices").select("*").eq("id", id).single(),
      db.from("admin_settings").select("*").eq("id", 1).single(),
      db.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order").order("id"),
    ]);
    if (invoiceError || !invoice) return json({ error: "Invoice not found." }, 404);
    if (settingsError || itemsError || !settings) return json({ error: "Could not load bill details or gym settings." }, 500);
    if (invoice.invoice_status !== "issued" || !invoice.invoice_number || !invoice.member_ref) return json({ error: "Only issued bills linked to a member can be sent." }, 422);
    const { data: member, error: memberError } = await db.from("members").select("email,full_name").eq("id", invoice.member_ref).is("deleted_at", null).single();
    if (memberError || !validEmail(member?.email)) return json({ error: "Save a valid email address on the member's profile first." }, 422);
    if (body.expected_email !== member.email) return json({ error: "The member email has changed. Close this confirmation and open Send Bill again." }, 409);
    if (!validEmail(settings.bill_sender_email)) return json({ error: "Configure the bill sender email in System Settings first." }, 422);
    if (!items?.length) return json({ error: "The invoice has no billing items." }, 422);
    const html = renderBill(invoice, items, settings, member.full_name);
    // This app prints HTML and does not store bill PDFs. Attach a self-contained,
    // escaped printable document instead of exposing member bills at public URLs.
    const payload = {
      from: settings.bill_sender_email,
      to: [member.email],
      subject: `Invoice ${invoice.invoice_number} - ${String(settings.gym_name).replace(/[\r\n]/g, " ")}`,
      html,
      attachments: [{ filename: `invoice-${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, "_")}.html`, content: encodeAttachment(html), content_type: "text/html" }],
    };
    const { data: claim, error: claimError } = await db.rpc("claim_bill_email", { p_invoice_id: id, p_payload: payload });
    if (claimError) return json({ error: "Could not reserve this bill for sending. Refresh and retry." }, 409);
    if (claim.state === "sent") return json({ ok: true, already_sent: true });
    if (claim.state === "busy") return json({ error: "This bill is already being sent. Wait before checking again." }, 409);
    if (claim.state === "review_required") return json({ error: "The previous send has an unknown outcome. Check Resend delivery logs before any retry; automatic resend is blocked to prevent duplicates." }, 409);
    const delivery = claim.delivery;
    const finish = async (status: string, providerId: string | null, error: string | null) => {
      const result = await db.rpc("finish_bill_email", { p_invoice_id: id, p_lease_token: delivery.lease_token, p_status: status, p_provider_id: providerId, p_error: error });
      if (result.error) throw result.error;
    };
    let response: Response;
    try {
      response = await send("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `gym-bill/${delivery.delivery_key}` },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      await finish("uncertain", null, "Provider connection interrupted. Retry uses the same delivery key.");
      return json({ error: "Email service could not confirm the send. Retry within 23 hours to check safely without duplicating it." }, 502);
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const definiteRejection = [400, 401, 403, 404, 413, 422].includes(response.status);
      const message = definiteRejection ? "Resend rejected the bill. Check the API key, verified sender domain, recipient and attachment settings." : "Resend could not confirm delivery. A retry will use the same delivery key.";
      await finish(definiteRejection ? "failed" : "uncertain", null, message);
      return json({ error: message }, 502);
    }
    if (!result?.id) {
      await finish("uncertain", null, "Provider returned no delivery ID.");
      return json({ error: "Email acceptance could not be confirmed. Retry safely within 23 hours." }, 502);
    }
    await finish("sent", result.id, null);
    return json({ ok: true, recipient: delivery.recipient_email });
  } catch (error) {
    console.error("send-bill failed", error instanceof Error ? error.message : "Database operation failed");
    return json({ error: "Could not confirm bill delivery. Check the send status before retrying." }, 500);
  }
};
}
