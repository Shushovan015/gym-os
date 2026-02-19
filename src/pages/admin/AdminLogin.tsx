import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@src/Client/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }

    navigate("/admin");
  };

  return (
    <div className="min-h-[70vh] grid place-items-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-black/35 p-6 space-y-4">
        <h1 className="text-2xl font-black text-white">Admin Login</h1>
        <input
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="w-full rounded-xl bg-white py-3 font-black text-black">Sign in</button>
      </form>
    </div>
  );
}
