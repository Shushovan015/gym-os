import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import nodemailer from "npm:nodemailer@10.0.10";
import { createBillHandler } from "./handler.ts";
import type { SendMail } from "./gmail.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const gmailUser = Deno.env.get("GMAIL_USER")?.trim() ?? "";
const password = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "") ?? "";
const sendMail: SendMail | null = gmailUser && password ? async (message) => {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: gmailUser, pass: password },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail(message);
    return { accepted: result.accepted ?? [], messageId: result.messageId };
  } finally { transport.close(); }
} : null;

Deno.serve(createBillHandler(db, gmailUser, sendMail));
