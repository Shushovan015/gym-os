export const supabase = new Proxy({}, {
  get() {
    throw new Error("The legacy backend is unavailable in this PHP build.");
  },
});
