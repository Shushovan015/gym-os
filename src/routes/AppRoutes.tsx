import { lazy, Suspense } from "react";
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

import ProtectedAdminRoute from "../pages/admin/ProtectedAdminRoute";

const AdminLogin = lazy(() => import("../pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("../pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminTestimonials = lazy(() => import("../pages/admin/AdminTestimonials"));
const AdminTrainers = lazy(() => import("../pages/admin/AdminTrainers"));
const AdminFacilities = lazy(() => import("../pages/admin/AdminFacilities"));
const AdminPricing = lazy(() => import("../pages/admin/AdminPricing"));
const AdminFooter = lazy(() => import("../pages/admin/AdminFooter"));
const AdminContact = lazy(() => import("../pages/admin/AdminContact"));
const AdminHome = lazy(() => import("../pages/admin/AdminHome"));
const AdminProShop = lazy(() => import("../pages/admin/AdminProShop"));
const AdminMembers = lazy(() => import("../pages/admin/AdminMembers"));
const AdminAttendance = lazy(() => import("../pages/admin/AdminAttendance"));
const AdminHolidayManager = lazy(() => import("../pages/admin/AdminHolidayManager"));
const AdminSettings = lazy(() => import("../pages/admin/AdminSettings"));
const AdminInventory = lazy(() => import("../pages/admin/AdminInventory"));
const AdminBilling = lazy(() => import("../pages/admin/AdminBilling"));
const StudioLayout = lazy(() => import("../pages/admin/StudioLayout"));
const AdminWebsite = lazy(() => import("../pages/admin/AdminWebsite"));
const AdminReports = lazy(() => import("../pages/admin/AdminReports"));
const LegacyImportPage = lazy(() => import("../features/legacy-import/ui/LegacyImportPage").then(({ LegacyImportPage }) => ({ default: LegacyImportPage })));

function LegacyStudioRedirect({ editor = "" }: { editor?: string }) {
  const { search, hash } = useLocation();
  const pathname = editor ? "/studio/" + editor : "/studio";
  return <Navigate to={{ pathname, search, hash }} replace />;
}

export default function AppRoutes() {
  const location = useLocation();

  const withTransition = (element: ReactElement) => (
    <RouteTransition>
      <Suspense fallback={<div role="status" className="p-6">Loading page…</div>}>{element}</Suspense>
    </RouteTransition>
  );

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
            <Route path="members" element={<AdminMembers />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="holidays" element={<AdminHolidayManager />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="legacy-import" element={<LegacyImportPage />} />
            <Route path="website" element={<LegacyStudioRedirect />} />
            <Route path="testimonials" element={<LegacyStudioRedirect editor="testimonials" />} />
            <Route path="trainers" element={<LegacyStudioRedirect editor="trainers" />} />
            <Route path="facilities" element={<LegacyStudioRedirect editor="facilities" />} />
            <Route path="pricing" element={<LegacyStudioRedirect editor="pricing" />} />
            <Route path="footer" element={<LegacyStudioRedirect editor="footer" />} />
            <Route path="contact" element={<LegacyStudioRedirect editor="contact" />} />
            <Route path="home" element={<LegacyStudioRedirect editor="home" />} />
            <Route path="proshop" element={<LegacyStudioRedirect editor="proshop" />} />
          </Route>
          <Route path="/studio" element={withTransition(<StudioLayout />)}>
            <Route index element={<AdminWebsite />} />
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
    </AnimatePresence>
  );
}
