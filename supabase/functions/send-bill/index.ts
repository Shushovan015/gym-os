import { createClient } from "npm:@supabase/supabase-js@2.97.0";
import { createSendBillHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve(createSendBillHandler(db, resendKey));
