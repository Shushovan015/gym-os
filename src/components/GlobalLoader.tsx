import { useAppSelector } from "../redux/hooks";

export default function GlobalLoader() {
  const loading = useAppSelector((s) => s.loader.loading);
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
      <div className="mt-4 px-4 py-2 rounded-full bg-black text-white text-sm shadow">
        Loading...
      </div>
    </div>
  );
}