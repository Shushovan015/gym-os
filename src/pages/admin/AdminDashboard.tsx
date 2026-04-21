import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@src/Client/supabase";

type MemberLite = {
  id: number;
  member_id: string;
  full_name: string;
  phone: string | null;
  membership_status: string | null;
  end_date: string | null;
  payment_status: string | null;
  payment_due_date: string | null;
};

type AttendanceLite = {
  member_ref: number;
  status: string;
};

const LOW_ATTENDANCE_MIN_DAYS = 8;
const EXPIRY_WARNING_DAYS = 7;

function dateOnly(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffInDays(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLite[]>([]);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => dateOnly(today), [today]);
  const monthStartStr = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return dateOnly(start);
  }, [today]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const membersReq = supabase
        .from("members")
        .select("id, member_id, full_name, phone, membership_status, end_date, payment_status, payment_due_date")
        .order("full_name", { ascending: true })
        .limit(5000);

      const attendanceReq = supabase
        .from("attendance_records")
        .select("member_ref, status")
        .gte("attendance_date", monthStartStr)
        .lte("attendance_date", todayStr)
        .in("status", ["present", "late"])
        .limit(20000);

      const [membersRes, attendanceRes] = await Promise.all([membersReq, attendanceReq]);

      if (membersRes.error) {
        setError(membersRes.error.message);
        setLoading(false);
        return;
      }
      if (attendanceRes.error) {
        setError(attendanceRes.error.message);
        setLoading(false);
        return;
      }

      setMembers((membersRes.data as MemberLite[]) || []);
      setAttendance((attendanceRes.data as AttendanceLite[]) || []);
      setLoading(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
  }, [monthStartStr, todayStr]);

  const attendanceByMember = useMemo(() => {
    const map = new Map<number, number>();
    attendance.forEach((a) => {
      map.set(a.member_ref, (map.get(a.member_ref) || 0) + 1);
    });
    return map;
  }, [attendance]);

  const lowAttendanceAlerts = useMemo(() => {
    return members
      .filter((m) => m.membership_status === "active")
      .map((m) => ({
        ...m,
        daysPresent: attendanceByMember.get(m.id) || 0,
      }))
      .filter((m) => m.daysPresent < LOW_ATTENDANCE_MIN_DAYS)
      .sort((a, b) => a.daysPresent - b.daysPresent)
      .slice(0, 20);
  }, [members, attendanceByMember]);

  const expiringAlerts = useMemo(() => {
    return members
      .filter((m) => m.end_date)
      .map((m) => {
        const end = new Date(`${m.end_date}T00:00:00`);
        return {
          ...m,
          daysLeft: diffInDays(today, end),
        };
      })
      .filter((m) => m.daysLeft >= 0 && m.daysLeft <= EXPIRY_WARNING_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 20);
  }, [members, today]);

  const unpaidAlerts = useMemo(() => {
    return members
      .filter((m) => m.payment_status === "unpaid" || m.payment_status === "overdue")
      .sort((a, b) => {
        if (a.payment_status === b.payment_status) return 0;
        return a.payment_status === "overdue" ? -1 : 1;
      })
      .slice(0, 30);
  }, [members]);

  if (loading) {
    return <div className="rounded-2xl bg-black/35 p-6 text-zinc-200">Loading dashboard alerts...</div>;
  }

  if (error) {
    return <div className="rounded-2xl bg-red-500/15 p-6 text-red-200">Alert load failed: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-black/35 p-6">
        <h2 className="text-2xl font-black text-white">In-App Alerts</h2>
        <p className="text-sm text-zinc-300 mt-1">
          Low attendance, membership expiry, and unpaid dues for quick admin action.
        </p>
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-amber-300">Low Attendance</h3>
          <Link to="/admin/attendance" className="text-xs rounded-lg bg-white/10 px-3 py-2 text-white">
            Open Attendance
          </Link>
        </div>
        {lowAttendanceAlerts.length === 0 ? (
          <p className="text-sm text-zinc-400">No low-attendance alerts.</p>
        ) : (
          lowAttendanceAlerts.map((m) => (
            <div key={m.id} className="rounded-xl bg-amber-500/15 p-3 text-sm text-zinc-100">
              {m.full_name} ({m.member_id}) - Present days this month: <b>{m.daysPresent}</b>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-sky-300">Expiring Memberships</h3>
          <Link to="/admin/members" className="text-xs rounded-lg bg-white/10 px-3 py-2 text-white">
            Open Members
          </Link>
        </div>
        {expiringAlerts.length === 0 ? (
          <p className="text-sm text-zinc-400">No expiry alerts.</p>
        ) : (
          expiringAlerts.map((m) => (
            <div key={m.id} className="rounded-xl bg-sky-500/15 p-3 text-sm text-zinc-100">
              {m.full_name} ({m.member_id}) - Expires in <b>{m.daysLeft}</b> day(s) ({m.end_date})
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl bg-black/35 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-rose-300">Unpaid Dues</h3>
          <Link to="/admin/members" className="text-xs rounded-lg bg-white/10 px-3 py-2 text-white">
            Open Members
          </Link>
        </div>
        {unpaidAlerts.length === 0 ? (
          <p className="text-sm text-zinc-400">No unpaid dues alerts.</p>
        ) : (
          unpaidAlerts.map((m) => (
            <div key={m.id} className="rounded-xl bg-rose-500/15 p-3 text-sm text-zinc-100">
              {m.full_name} ({m.member_id}) - Status: <b>{m.payment_status}</b>
              {m.payment_due_date ? ` | Due: ${m.payment_due_date}` : ""}
              {m.phone ? ` | Phone: ${m.phone}` : ""}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
