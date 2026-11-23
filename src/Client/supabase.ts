import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const createConfiguredClient = () => createClient(supabaseUrl, supabaseAnonKey);
type Client = ReturnType<typeof createConfiguredClient>;
let client: Client | undefined;

export const supabase = new Proxy({} as Client, {
  get(_target, property: keyof Client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase configuration is missing. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
    client ??= createConfiguredClient();
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
