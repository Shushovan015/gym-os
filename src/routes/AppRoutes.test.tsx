import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppRoutes from "./AppRoutes";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), role: vi.fn() }));

vi.mock("@src/Client/supabase", () => ({
  supabase: {
    auth: { getSession: auth.getSession },
    from: () => ({ select: () => ({ eq: () => ({ single: auth.role }) }) }),
  },
}));
vi.mock("@src/components/motion/RouteTransition", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../pages/admin/AdminLogin", () => ({ default: () => <h1>Admin login</h1> }));
vi.mock("../pages/admin/AdminPricing", () => ({ default: () => <h1>Pricing editor</h1> }));
vi.mock("../pages/admin/AdminDashboard", () => ({ default: () => <h1>Operations dashboard</h1> }));
vi.mock("../pages/admin/AdminLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});

function CurrentLocation() {
  const { pathname, search, hash } = useLocation();
  return <output>{pathname}{search}{hash}</output>;
}

function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes /><CurrentLocation /></MemoryRouter>);
}

beforeEach(() => {
  auth.getSession.mockReset();
  auth.role.mockReset();
});
afterEach(cleanup);

describe("private workspaces", () => {
  it.each(["/admin", "/studio/pricing"])("requires a session for %s", async (path) => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    open(path);
    expect(await screen.findByRole("heading", { name: "Admin login" })).toBeInTheDocument();
    expect(auth.role).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-administrator", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } } });
    auth.role.mockResolvedValue({ data: { role: "user" } });
    open("/studio");
    expect(await screen.findByRole("heading", { name: "Admin login" })).toBeInTheDocument();
  });

  it("opens the Studio editor from an old bookmark and preserves its query and hash", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "admin" } } } });
    auth.role.mockResolvedValue({ data: { role: "admin" } });
    open("/admin/pricing?plan=monthly#plans");
    expect(await screen.findByRole("heading", { name: "Pricing editor" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Website Studio navigation" })).toBeInTheDocument();
    expect(screen.getByText("/studio/pricing?plan=monthly#plans")).toBeInTheDocument();
  });
});
