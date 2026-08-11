import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";
import GlobalLoader from "./components/GlobalLoader";
import ToastHost from "./components/ToastHost";
import Footer from "./pages/Footer";
import ScrollToTop from "./components/ScrollToTop";
import { useLocation } from "react-router-dom";

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-screen">
      <ScrollToTop />
      {!isAdminRoute ? <Navbar /> : null}
      <GlobalLoader />
      <main className={isAdminRoute ? "w-full" : "w-full pb-10"}>
        <AppRoutes />
      </main>
      {!isAdminRoute ? <Footer /> : null}
      <ToastHost />
    </div>
  );
}
