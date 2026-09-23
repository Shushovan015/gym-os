import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@src/Client/supabase";

export function numericBillNumber(value: string): string | null {
  if (!/^\d{1,16}$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number > 0 ? String(number) : null;
}

export function useNextBillNumber(open: boolean) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError("");
    setValue("");
    try {
      const result = await supabase.rpc("next_bill_number");
      if (request.current !== current) return;
      if (result.error) throw new Error(result.error.message);
      const next = numericBillNumber(String(result.data));
      if (!next) throw new Error("The next bill number is unavailable.");
      setValue(next);
    } catch (problem) {
      if (request.current === current) setError(problem instanceof Error ? problem.message : "Could not load the next bill number.");
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
    return () => { request.current += 1; };
  }, [open, refresh]);

  const canonical = numericBillNumber(value);
  return {
    value,
    setValue,
    loading,
    error,
    refresh,
    ready: !loading && !error && Boolean(canonical),
    numberToSave: canonical,
  };
}
