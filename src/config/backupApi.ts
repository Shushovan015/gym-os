const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL || "https://invalid.invalid");
const localDatabase = ["localhost", "127.0.0.1", "[::1]"].includes(supabaseUrl.hostname);

// Local servers forward these requests to the companion service on the same machine.
export const backupApi = localDatabase ? "" : null;
