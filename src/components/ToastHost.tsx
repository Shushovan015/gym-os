import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import toastActions from "@Actions/toast";
import type { RootState } from "@Reducers/index";

export default function ToastHost() {
  const dispatch = useDispatch();
  const toast = useSelector((s: RootState) => s.toast);

  useEffect(() => {
    if (!toast.open) return;

    const t = setTimeout(() => {
      dispatch(toastActions.toastClear());
    }, 2500);

    return () => clearTimeout(t);
  }, [toast.open, dispatch]);

  if (!toast.open) return null;

  const bg =
    toast.kind === "success"
      ? "bg-green-600"
      : toast.kind === "error"
      ? "bg-red-600"
      : "bg-gray-900";

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className={`${bg} text-white px-4 py-3 rounded-lg shadow max-w-lg w-full`}>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">{toast.message}</div>
          <button
            className="text-white/80 hover:text-white text-sm"
            onClick={() => dispatch(toastActions.toastClear())}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
