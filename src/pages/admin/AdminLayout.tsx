import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@src/Client/supabase";

export default function AdminLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <div className="px-6 lg:px-12 xl:px-20 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-white">Admin Panel</h1>
        <button onClick={logout} className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Logout
        </button>
      </div>

      <div className="flex gap-3">
        <NavLink to="/admin" end className="rounded-xl bg-white/10 px-4 py-2 text-white">Dashboard</NavLink>
        <NavLink to="/admin/testimonials" className="rounded-xl bg-white/10 px-4 py-2 text-white">Testimonials</NavLink>
        <NavLink to="/admin/trainers" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Trainers
        </NavLink>
        <NavLink to="/admin/facilities" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Facilities
        </NavLink>
        <NavLink to="/admin/pricing" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Pricing
        </NavLink>
        <NavLink to="/admin/footer" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Footer
        </NavLink>
        <NavLink to="/admin/proshop" className="rounded-xl bg-white/10 px-4 py-2 text-white">ProShop</NavLink>
        <NavLink to="/admin/members" className="rounded-xl bg-white/10 px-4 py-2 text-white">Members</NavLink>
        <NavLink to="/admin/attendance" className="rounded-xl bg-white/10 px-4 py-2 text-white">Attendance</NavLink>
        <NavLink to="/admin/contact" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Contact
        </NavLink>
        <NavLink to="/admin/home" className="rounded-xl bg-white/10 px-4 py-2 text-white">
          Home
        </NavLink>
      </div>

      <Outlet />
    </div>
  );
}
