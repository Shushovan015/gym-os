import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminDashboard from "../pages/admin/AdminDashboard";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy dashboard access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status });
const payload = {
  today: "2026-11-23", periodStart: "2026-10-25", horizon: 15,
  settings: { weekly_closing_day: 6, currency_code: "NPR", currency_minor_unit: 2, absent_after_days: 8 },
  metrics: { liveCount: 4, deletedCount: 0, activeCount: 3, newCount: 1, expiringCount: 0, expiredCount: 0,
    unpaidCount: 1, attendanceTodayCount: 1, absentCount: 0, lowCount: 1, outCount: 0, revenueToday: 300, outstanding: 500 },
  expiringMembers: [], unpaidMembers: [], recentMembers: [],
  attendanceLabels: ["2026-11-23"], attendanceValues: [1], upcomingHolidays: [], planDistribution: {},
};

it("loads PHP metrics and reports a failed period refresh", async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/admin/dashboard?period=30") return response(payload);
    if (url === "/api/admin/dashboard?period=7") return response({ error: "Dashboard unavailable" }, 503);
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
  expect(screen.getByText("Loading dashboard metrics...")).toBeInTheDocument();
  expect(await screen.findByLabelText("Attendance trend")).toBeInTheDocument();
  expect(screen.getByTitle("2026-11-23: 1")).toBeInTheDocument();
  expect(screen.getByText("No expiring memberships")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Dashboard period"), { target: { value: "7" } });
  expect(await screen.findByText("Dashboard unavailable")).toBeInTheDocument();
});
