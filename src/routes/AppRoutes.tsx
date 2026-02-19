import { Routes, Route, Navigate } from "react-router-dom";

import Home from "@src/pages/Home";
import Facilities from "@src/pages/Facilities";
import Trainers from "@src/pages/Trainers";
import Pricing from "@src/pages/Pricing";
import Contact from "@src/pages/Contact";
import About from "@src/pages/About";
import ProShop from "@src/pages/ProShop";

import AdminLogin from "../pages/admin/AdminLogin";
import AdminLayout from "../pages/admin/AdminLayout";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminTestimonials from "../pages/admin/AdminTestimonials";
import ProtectedAdminRoute from "../pages/admin/ProtectedAdminRoute";
import AdminTrainers from "../pages/admin/AdminTrainers";
import AdminFacilities from "../pages/admin/AdminFacilities";
import AdminPricing from "../pages/admin/AdminPricing";
import AdminFooter from "../pages/admin/AdminFooter";
import AdminContact from "../pages/admin/AdminContact";
import AdminHome from "../pages/admin/AdminHome";
import AdminProShop from "../pages/admin/AdminProShop";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/facilities" element={<Facilities />} />
      <Route path="/trainers" element={<Trainers />} />
      <Route path="/shop" element={<ProShop />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<Contact />} />

      {/* Admin Login */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Admin Routes */}
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="testimonials" element={<AdminTestimonials />} />
          <Route path="trainers" element={<AdminTrainers />} />
          <Route path="facilities" element={<AdminFacilities />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="footer" element={<AdminFooter />} />
          <Route path="contact" element={<AdminContact />} />
          <Route path="home" element={<AdminHome />} />
          <Route path="proshop" element={<AdminProShop />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
