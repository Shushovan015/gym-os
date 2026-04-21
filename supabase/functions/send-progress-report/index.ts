// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeNum(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function changeText(label: string, oldVal: any, newVal: any, unit = "") {
  if (oldVal === null || newVal === null) return `${label}: ${newVal ?? "-"}${unit}`;
  const delta = Number(newVal) - Number(oldVal);
  const sign = delta > 0 ? "+" : "";
  return `${label}: ${oldVal}${unit} -> ${newVal}${unit} (${sign}${delta.toFixed(2)}${unit})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const gymName = Deno.env.get("REPORT_GYM_NAME") || "Gym";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const memberId = Number(body?.member_id);
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid member_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member, error: memberError } = await adminClient
      .from("members")
      .select("id, member_id, full_name")
      .eq("id", memberId)
      .single();
    if (memberError || !member) {
      return new Response(JSON.stringify({ ok: false, error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: measurements } = await adminClient
      .from("member_measurements")
      .select("recorded_at, weight_kg, body_fat_percent, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm")
      .eq("member_ref", member.id)
      .order("recorded_at", { ascending: true });

    const { data: timeline } = await adminClient
      .from("member_transformations")
      .select("captured_at, milestone_title, milestone_notes, photo_url")
      .eq("member_ref", member.id)
      .order("captured_at", { ascending: false })
      .limit(5);

    const first = measurements?.[0];
    const latest = measurements?.[measurements.length - 1];

    const summaryLines: string[] = [];
    if (first && latest) {
      summaryLines.push(changeText("Weight", safeNum(first.weight_kg), safeNum(latest.weight_kg), " kg"));
      summaryLines.push(
        changeText("Body Fat", safeNum(first.body_fat_percent), safeNum(latest.body_fat_percent), "%")
      );
      summaryLines.push(changeText("Waist", safeNum(first.waist_cm), safeNum(latest.waist_cm), " cm"));
      summaryLines.push(changeText("Chest", safeNum(first.chest_cm), safeNum(latest.chest_cm), " cm"));
      summaryLines.push(changeText("Hips", safeNum(first.hips_cm), safeNum(latest.hips_cm), " cm"));
      summaryLines.push(changeText("Arm", safeNum(first.arm_cm), safeNum(latest.arm_cm), " cm"));
      summaryLines.push(changeText("Thigh", safeNum(first.thigh_cm), safeNum(latest.thigh_cm), " cm"));
    } else {
      summaryLines.push("Not enough measurement history to compare old vs new.");
    }

    const recentMilestones = (timeline || []).map((t: any) => ({
      captured_at: t.captured_at,
      milestone_title: t.milestone_title || "Milestone",
      milestone_notes: t.milestone_notes || null,
      photo_url: t.photo_url || null,
    }));

    const { error: logInsertError } = await adminClient.from("member_report_logs").insert({
      member_ref: member.id,
      recipient_email: null,
      status: "sent",
      error_message: null,
      sent_by: null,
    });
    if (logInsertError) {
      return new Response(JSON.stringify({ ok: false, error: `Failed to write report log: ${logInsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      report: {
        gym_name: gymName,
        member_id: member.member_id,
        member_name: member.full_name,
        generated_at: new Date().toISOString(),
        summary_lines: summaryLines,
        recent_milestones: recentMilestones,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Unhandled error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
