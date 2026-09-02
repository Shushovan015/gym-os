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
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => fetch("http://127.0.0.1:4174/api/maintenance", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => { if (active) setMaintenance(body?.active === true); })
      .catch(() => { /* The optional local service may be stopped in development. */ });
    check(); const timer = window.setInterval(check, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <div className={isAdminRoute ? "min-h-screen" : "public-site min-h-screen"}>
      <ScrollToTop />
      {!isAdminRoute ? <Navbar /> : null}
      <GlobalLoader />
      <main className={isAdminRoute ? "w-full" : "w-full pb-10"}>
        <AppRoutes />
      </main>
      {!isAdminRoute ? <Footer /> : null}
      <ToastHost />
      {maintenance ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 text-center text-white"><div className="max-w-md rounded-xl border border-amber-400/40 bg-slate-900 p-8 shadow-2xl"><h2 className="text-xl font-black">System maintenance in progress</h2><p className="mt-3 text-slate-300">Database restore is currently running. Please do not close the application or computer.</p></div></div> : null}
    </div>
  );
}
