import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { AdminButton, AdminCard, AdminField, AdminInput, AdminNotice } from "@src/components/admin/AdminUI";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-[#070a0f] px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
              <ShieldCheck className="h-4 w-4" />
              A&A Health Club operations
            </div>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight tracking-normal text-white">
              Admin access for daily gym management.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Members, attendance, holidays and settings are protected by Supabase authentication and the admin role check.
            </p>
          </div>

          <AdminCard className="p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-normal text-white">Admin login</h1>
                <p className="text-sm text-slate-500">Use an account with `profiles.role = admin`.</p>
              </div>
            </div>

            {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <AdminField label="Email">
                <AdminInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </AdminField>
              <AdminField label="Password">
                <AdminInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </AdminField>
              <AdminButton type="submit" variant="primary" className="w-full" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </AdminButton>
            </form>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
