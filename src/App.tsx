import { backupApi } from "./config/backupApi";
import { useScrollLock } from "./hooks/useScrollLock";
import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";
import GlobalLoader from "./components/GlobalLoader";
import ToastHost from "./components/ToastHost";
import Footer from "./pages/Footer";
import ScrollToTop from "./components/ScrollToTop";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isPrivateRoute = /^\/(admin|studio)(\/|$)/.test(location.pathname);
  const checksMaintenance = isPrivateRoute && location.pathname !== "/admin/login";
  const [maintenance, setMaintenance] = useState(false);
  useScrollLock(checksMaintenance && maintenance);

  useEffect(() => {
    if (!checksMaintenance || backupApi === null) return;
    let active = true;
    const check = () => fetch(`${backupApi}/api/maintenance`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (active) setMaintenance(body?.active === true); })
      .catch(() => { /* The optional local service may be stopped in development. */ });
    check(); const timer = window.setInterval(check, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [checksMaintenance]);

  return (
    <div className={isPrivateRoute ? "min-h-screen" : "public-site min-h-screen"}>
      <ScrollToTop />
      {!isPrivateRoute ? <Navbar /> : null}
      <GlobalLoader />
      {isPrivateRoute ? <AppRoutes /> : <main className="w-full pb-10"><AppRoutes /></main>}
      {!isPrivateRoute ? <Footer /> : null}
      <ToastHost />
      {checksMaintenance && maintenance ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 text-center text-white"><div className="max-h-[calc(100dvh-3rem)] overflow-auto overscroll-contain max-w-md rounded-xl border border-amber-400/40 bg-slate-900 p-8 shadow-2xl"><h2 className="text-xl font-black">System maintenance in progress</h2><p className="mt-3 text-slate-300">Database restore is currently running. Please do not close the application or computer.</p></div></div> : null}
    </div>
  );
}
