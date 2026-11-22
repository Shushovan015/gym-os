import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminAttendance from "../pages/admin/AdminAttendance";
import { getNepalTodayAdDate } from "../pages/admin/adminUtils";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy data access"); } }),
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const member = { id: 8, member_id: "TEST", full_name: "Test Member", membership_status: "active", is_active: true };
const date = getNepalTodayAdDate();
const settings = { weekly_closing_day: (new Date(`${date}T00:00:00Z`).getUTCDay() + 1) % 7 };

function open() {
  return render(<MemoryRouter><AdminAttendance /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads a month, marks, removes and restores a record, and reloads on month change", async () => {
  let state = "";
  const fetchMock = vi.fn(async (input: string, options?: RequestInit) => {
    if (input === "/api/admin/settings") return json({ settings });
    if (input === "/api/auth/session") return json({ csrfToken: "csrf-token" });
    if (input === "/api/attendance/change") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("csrf-token");
      const change = JSON.parse(String(options?.body));
      expect(change).toMatchObject({ memberId: member.id, date });
      state = change.action;
      return json({ lastVisitDate: date });
    }
    const url = new URL(input, "http://localhost");
    expect(url.pathname).toBe("/api/attendance/grid");
    const inMonth = url.searchParams.get("start")! <= date && url.searchParams.get("end")! >= date;
    const row = { id: 1, member_ref: member.id, attendance_date: date, status: "present", deleted_at: null };
    return json({
      members: [member], count: 1, holidays: [],
      records: inMonth && (state === "mark" || state === "restore") ? [row] : [],
      deletedRecords: inMonth && state === "remove" ? [{ ...row, deleted_at: new Date().toISOString() }] : [],
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const view = open();
  expect(screen.getByText("Loading attendance...")).toBeInTheDocument();
  fireEvent.click(await screen.findByTitle("Mark present"));
  fireEvent.click(await screen.findByTitle("Remove attendance"));
  fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
  expect(await screen.findByTitle("Remove attendance")).toBeEnabled();
  view.unmount();
  open();
  expect(await screen.findByTitle("Remove attendance")).toBeEnabled();
  const month = screen.getByRole("combobox", { name: "Attendance month" }) as HTMLSelectElement;
  fireEvent.change(month, { target: { value: String((Number(month.value) + 1) % 12) } });
  await waitFor(() => {
    const queries = fetchMock.mock.calls.map(([path]) => path).filter((path) => path.startsWith("/api/attendance/grid"));
    expect(new Set(queries).size).toBeGreaterThan(1);
  });
  await waitFor(() => expect(screen.queryByTitle("Remove attendance")).not.toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText("Search members by name"), { target: { value: "Test" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Member activation filter" }), { target: { value: "all" } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => path.includes("search=Test") && path.includes("enabled=all"))).toBe(true));
});

it("shows a failed grid response and leaves attendance actions unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input === "/api/admin/settings"
    ? json({ settings })
    : json({ error: "Attendance service unavailable" }, 503)));
  open();
  expect(await screen.findByText("Attendance service unavailable")).toBeInTheDocument();
  expect(screen.queryByTitle("Mark present")).not.toBeInTheDocument();
});
