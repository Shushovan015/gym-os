import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@Pages/Dashboard";
import Builder from "@Pages/Builder";
import History from "@Pages/History";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/builder" element={<Builder />} />
      <Route path="/history" element={<History />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
