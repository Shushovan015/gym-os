import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { AdminButton, AdminCard, AdminField, AdminInput, AdminNotice } from "@src/components/admin/AdminUI";
import LoginIntro from "@src/components/branding/LoginIntro";
import gymLogo from "@src/assets/logo.jpg";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginSucceeded, setLoginSucceeded] = useState(false);
  const finishLogin = useCallback(() => navigate("/admin", { replace: true }), [navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError(authError.message === "Invalid login credentials" ? "Incorrect email or password." : authError.message);
        return;
      }
      setLoginSucceeded(true);
    } catch {
      setError("The local Gym database is not running. Close this browser tab, double-click OPEN GYM APP, and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loginSucceeded) return <LoginIntro onComplete={finishLogin} />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_30%_35%,rgba(245,158,11,0.09),transparent_30rem),#070a0f] px-4 py-8 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative flex flex-col items-center justify-center border-b border-slate-800 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.12),transparent_65%)] px-6 py-10 text-center lg:border-b-0 lg:border-r lg:px-10 lg:py-12">
            <img
              src={gymLogo}
              alt="A&A Health Club"
              className="h-auto w-[min(19rem,68vw)] rounded-2xl border border-amber-400/20 object-contain shadow-[0_24px_70px_rgba(245,158,11,0.13)]"
            />
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
              <ShieldCheck className="h-4 w-4" />
              Secure gym administration
            </div>
            <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
              A&A Health Club
            </h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
              Members, attendance, billing and inventory in one protected workspace.
            </p>
          </section>

          <AdminCard className="flex flex-col justify-center rounded-none border-0 bg-transparent p-6 shadow-none sm:p-9 lg:p-10">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-normal text-white">Admin login</h1>
                <p className="text-sm text-slate-500">Sign in to continue to your dashboard.</p>
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
