import { Routes, Route, Navigate } from "react-router-dom";

import Home from "@src/pages/Home";
import Facilities from "@src/pages/Facilities";
import Trainers from "@src/pages/Trainers";
import Pricing from "@src/pages/Pricing";
import Contact from "@src/pages/Contact";
import About from "@src/pages/About";
import ProShop from "@src/pages/ProShop";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/facilities" element={<Facilities />} />
      <Route path="/trainers" element={<Trainers />} />
      <Route path="/shop" element={<ProShop />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
