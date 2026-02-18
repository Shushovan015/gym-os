import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";
import GlobalLoader from "./components/GlobalLoader";
import ToastHost from "./components/ToastHost";
import Footer from "./pages/Footer";
import ScrollToTop from "./components/ScrollToTop";

export default function App() {
  return (
    <div className="min-h-screen">
      <ScrollToTop />
      <Navbar />
      <GlobalLoader />
      <main className="w-full pb-10">
        <AppRoutes />
      </main>
      <Footer />
      <ToastHost />
    </div>
  );
}
