import type { ReactElement } from "react";
import { AnimatePresence } from "framer-motion";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import RouteTransition from "@src/components/motion/RouteTransition";

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
import AdminMembers from "../pages/admin/AdminMembers";
import AdminAttendance from "../pages/admin/AdminAttendance";
import AdminHolidayManager from "../pages/admin/AdminHolidayManager";

export default function AppRoutes() {
  const location = useLocation();

  const withTransition = (element: ReactElement) => <RouteTransition>{element}</RouteTransition>;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={withTransition(<Home />)} />
        <Route path="/about" element={withTransition(<About />)} />
        <Route path="/facilities" element={withTransition(<Facilities />)} />
        <Route path="/trainers" element={withTransition(<Trainers />)} />
        <Route path="/shop" element={withTransition(<ProShop />)} />
        <Route path="/pricing" element={withTransition(<Pricing />)} />
        <Route path="/contact" element={withTransition(<Contact />)} />

        {/* Admin Login */}
        <Route path="/admin/login" element={withTransition(<AdminLogin />)} />

        {/* Protected Admin Routes */}
        <Route element={<ProtectedAdminRoute />}>
          <Route path="/admin" element={withTransition(<AdminLayout />)}>
            <Route index element={<AdminDashboard />} />
            <Route path="testimonials" element={<AdminTestimonials />} />
            <Route path="trainers" element={<AdminTrainers />} />
            <Route path="facilities" element={<AdminFacilities />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="footer" element={<AdminFooter />} />
            <Route path="contact" element={<AdminContact />} />
            <Route path="home" element={<AdminHome />} />
            <Route path="proshop" element={<AdminProShop />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="holidays" element={<AdminHolidayManager />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
