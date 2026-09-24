import type { SupabaseClient } from "npm:@supabase/supabase-js@2.97.0";
import { classifySmtpError, type SendMail } from "./gmail.ts";
import { renderBill, validEmail, generateBillPDF } from "./template.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export function createBillHandler(db: SupabaseClient, gmailUser: string, sendMail: SendMail | null) {
  return async (request: Request) => {
    console.log("send-bill: start");
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      console.log("send-bill: parsing auth");
      const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return json({ error: "Sign in to send a bill." }, 401);
      const { data: auth, error: authError } = await db.auth.getUser(token);
      console.log("send-bill: auth result", { auth: !!auth, authError: authError?.message });
      if (authError || !auth.user) return json({ error: "Your session expired. Sign in again." }, 401);
      const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", auth.user.id).single();
      console.log("send-bill: profile result", { profile: profile?.role, profileError: profileError?.message });
      if (profileError || profile?.role !== "admin") return json({ error: "Admin access required." }, 403);
      let body: { invoice_id?: unknown; expected_email?: unknown };
      try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const id = body?.invoice_id;
      if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return json({ error: "Invalid invoice ID." }, 400);

      const { data: delivery, error: deliveryError } = await db.from("invoice_email_deliveries").select("status").eq("invoice_id", id).maybeSingle();
      if (deliveryError) return json({ error: "Email delivery storage is unavailable. Apply the Gmail bill migration first." }, 503);
      if (delivery?.status === "sent") return json({ ok: true, already_sent: true });
      if (delivery?.status === "uncertain") return json({ status: "uncertain", error: "The previous send has an unknown result. Check Gmail Sent before any retry; resending is blocked to prevent duplicates." }, 409);
      if (!sendMail || !validEmail(gmailUser)) return json({ error: "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD on the server." }, 503);

      const [billResult, settingsResult, itemsResult] = await Promise.all([
        db.from("invoices").select("*").eq("id", id).single(),
        db.from("admin_settings").select("*").eq("id", 1).single(),
        db.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order").order("id"),
      ]);
      const bill = billResult.data;
      const settings = settingsResult.data;
      if (billResult.error || !bill) return json({ error: "Invoice not found." }, 404);
      if (settingsResult.error || itemsResult.error || !settings) return json({ error: "Could not load the bill or gym settings." }, 500);
      if (bill.invoice_status !== "issued" || !bill.invoice_number || !bill.member_ref) return json({ error: "Only issued bills linked to a member can be emailed." }, 422);
      const { data: member, error: memberError } = await db.from("members").select("email,full_name").eq("id", bill.member_ref).is("deleted_at", null).single();
      const recipient = member?.email?.trim();
      if (memberError || !validEmail(recipient)) return json({ error: "Save a valid email address on the member's profile first." }, 422);
      if (body.expected_email !== recipient) return json({ error: "The member email changed. Close this window and open Send Bill again." }, 409);
      const sender = settings.bill_sender_email?.trim();
      if (!validEmail(sender) || sender.toLowerCase() !== gmailUser.toLowerCase()) {
        return json({ error: "Bill sender email in System Settings must match the Gmail account configured on the server." }, 422);
      }
      if (!itemsResult.data?.length) return json({ error: "This bill has no items." }, 422);
      const { html, text } = renderBill(bill, itemsResult.data, settings, member.full_name);
      const pdfBytes = await generateBillPDF(bill, itemsResult.data, settings, member.full_name);
      const { data: claim, error: claimError } = await db.rpc("claim_gmail_bill", {
        p_invoice_id: id, p_recipient: recipient, p_sender: gmailUser, p_admin_id: auth.user.id,
      });
      if (claimError) return json({ error: "Could not reserve the bill. Refresh and check the member and sender email settings." }, 409);
      if (claim?.state === "sent") return json({ ok: true, already_sent: true });
      if (claim?.state === "sending") return json({ status: "sending", error: "This bill is already being sent. Wait and check again." }, 409);
      if (claim?.state !== "claimed") return json({ status: "uncertain", error: "The previous send did not finish. Check Gmail Sent; automatic resend is blocked." }, 409);

      const finish = async (status: string, messageId: string | null, error: string | null) => {
        const result = await db.rpc("finish_gmail_bill", { p_invoice_id: id, p_attempt_id: claim.attempt_id, p_status: status, p_message_id: messageId, p_error: error });
        if (result.error || result.data !== true) throw new Error("Delivery status could not be saved");
      };
      let sent: Awaited<ReturnType<SendMail>>;
      try {
        sent = await sendMail({
          from: { name: String(settings.gym_name).replace(/[\r\n]/g, " "), address: gmailUser },
          to: recipient,
          subject: `Invoice ${String(bill.invoice_number).replace(/[\r\n]/g, " ")} - ${String(settings.gym_name).replace(/[\r\n]/g, " ")}`,
          html, text,
          messageId: `<gym-bill-${claim.attempt_id}@${gmailUser.split("@")[1]}>`,
          attachments: [
            { filename: `invoice-${String(bill.invoice_number).replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`, content: pdfBytes, contentType: "application/pdf" },
            { filename: `invoice-${String(bill.invoice_number).replace(/[^a-zA-Z0-9-]/g, "_")}.html`, content: html, contentType: "text/html; charset=utf-8" }],
        });
      } catch (error) {
        const failure = classifySmtpError(error);
        await finish(failure.status, null, failure.message);
        return json({ status: failure.status, error: failure.message }, 502);
      }
      if (!sent.accepted.length) {
        const message = "Gmail did not accept the recipient. Check the member's email address before retrying.";
        await finish("failed", null, message);
        return json({ status: "failed", error: message }, 502);
      }
      await finish("sent", sent.messageId, null);
      return json({ ok: true, recipient });
    } catch (error) {
      console.error("send-bill error:", error);
      return json({ status: "uncertain", error: "Could not confirm delivery. Check Gmail Sent and refresh the bill before retrying." }, 500);
    }
  };
}
