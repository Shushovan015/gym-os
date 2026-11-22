import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminAttendance from "./AdminAttendance";
import AdminBilling from "./AdminBilling";
import AdminMembers from "./AdminMembers";
import { formatMembershipFeeAmount } from "./adminUtils";

const fixture = vi.hoisted(() => ({
  member: {
    id: 42, full_name: "Ram Shrestha", member_id: "M-42", phone: "555-0123",
    email: "ram@example.test", is_active: true, membership_type: "monthly",
    membership_status: "active", payment_status: "unpaid",
    start_date: "2026-09-01", end_date: "2026-12-01",
  },
  fees: [
    { id: 10, due_date: "2026-09-01", amount_minor: 0, paid_amount_minor: 0, currency_code: "NPR", status: "unpaid" },
    { id: 11, due_date: "2026-10-01", amount_minor: 100000, paid_amount_minor: 20000, currency_code: "NPR", status: "partial" },
    { id: 12, due_date: "2026-11-01", amount_minor: 100000, paid_amount_minor: 0, currency_code: "NPR", status: "unpaid" },
  ],
  rpc: vi.fn(),
  selectedMember: vi.fn(),
}));

vi.mock("@src/Client/supabase", () => ({
  supabase: {
    from(table: string) {
      const data = table === "members" ? [fixture.member] : [];
      const result = { data, error: null, count: data.length };
      const chain = {
        ...Object.fromEntries(["select", "is", "eq", "gte", "lte", "range", "not", "in", "order", "limit", "filter"].map((key) => [
          key, (...args: unknown[]) => {
            if (table === "members" && key === "eq" && args[0] === "id") fixture.selectedMember(args[1]);
            return chain;
          },
        ])),
        then: Promise.resolve(result).then.bind(Promise.resolve(result)),
        maybeSingle: () => Promise.resolve({ ...result, data: data[0] ?? null }),
      };
      return chain;
    },
    rpc: fixture.rpc,
  },
}));

vi.mock("@src/features/billing/useBillEmail", () => ({
  useBillEmail: () => ({ deliveries: {} }),
}));

beforeEach(() => {
  fixture.selectedMember.mockClear();
  fixture.rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === "get_member_membership_fee_status") return { data: {
      has_outstanding: true,
      summary: { total_due: 180000, currency_code: "NPR", overdue_count: 1, unpaid_count: 1 },
      outstanding_fees: fixture.fees,
      paid_fees: [],
    } };
    if (name === "next_bill_number") return { data: 21 };
    if (name === "record_membership_fee_payment_multi") return { data: { invoice_number: "21" } };
    return { data: null };
  });
});
afterEach(cleanup);

it("explains zero-amount fee periods and cannot create a zero-value membership bill", async () => {
  const original = fixture.rpc.getMockImplementation()!;
  fixture.rpc.mockImplementation(async (name: string) => {
    if (name === "get_member_membership_fee_status") {
      return { data: { outstanding_fees: [fixture.fees[0]] } };
    }
    return original(name);
  });
  render(<MemoryRouter initialEntries={[{ pathname: "/admin/billing", state: { memberId: 42 } }]}>
    <AdminBilling />
  </MemoryRouter>);
  const bill = within(await screen.findByRole("dialog", { name: "New Bill" }));
  expect(await bill.findByText(/1 fee period has a zero amount/)).toBeInTheDocument();
  expect(bill.getByRole("button", { name: "Create Bill" })).toBeDisabled();
  expect(bill.queryAllByRole("checkbox")).toHaveLength(0);
});

it("opens Billing for the fee period clicked in the Members popup without recording a payment", async () => {
  render(<MemoryRouter initialEntries={["/admin/members"]}>
    <Routes>
      <Route path="/admin/members" element={<AdminMembers />} />
      <Route path="/admin/billing" element={<AdminBilling />} />
    </Routes>
  </MemoryRouter>);
  fireEvent.click((await screen.findAllByRole("button", { name: /Ram Shrestha/ }))[0]);
  const profile = within(await screen.findByRole("dialog", { name: "Ram Shrestha" }));
  const paymentButtons = await profile.findAllByRole("button", { name: /^Record payment$/i });
  fireEvent.click(paymentButtons[paymentButtons.length - 1]);

  const bill = within(await screen.findByRole("dialog", { name: "New Bill" }));
  expect(bill.getByDisplayValue("Ram Shrestha (M-42)")).toBeInTheDocument();
  const periods = await bill.findAllByRole("checkbox");
  expect(periods[0]).not.toBeChecked();
  expect(periods[1]).toBeChecked();
  expect(fixture.rpc.mock.calls.some(([name]) => name.startsWith("record_membership_fee_payment"))).toBe(false);
});

it("opens the Billing dialog from Attendance and collects the reviewed fee periods once", async () => {
  render(<MemoryRouter initialEntries={["/admin/attendance"]}>
    <Routes>
      <Route path="/admin/attendance" element={<AdminAttendance />} />
      <Route path="/admin/billing" element={<AdminBilling />} />
    </Routes>
  </MemoryRouter>);
  const profiles = await screen.findAllByRole("button", { name: /Ram Shrestha/ });
  fireEvent.click(profiles[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Record Payment" }));

  const bill = within(await screen.findByRole("dialog", { name: "New Bill" }));
  expect(fixture.selectedMember).toHaveBeenCalledWith(42);
  expect(bill.getByDisplayValue("Ram Shrestha (M-42)")).toBeInTheDocument();
  const feePeriods = await bill.findAllByRole("checkbox");
  expect(feePeriods).toHaveLength(2);
  expect(feePeriods[0]).toBeChecked();
  expect(bill.getByText("ram@example.test")).toBeInTheDocument();
  expect(bill.getByDisplayValue(formatMembershipFeeAmount(180000, "NPR"))).toBeInTheDocument();
  expect(bill.getByLabelText("Amount received")).toHaveAttribute("readonly");
  expect(bill.getByLabelText("Amount received")).toHaveValue(800);
  expect(bill.queryByText("Add a discount")).not.toBeInTheDocument();
  expect(fixture.rpc.mock.calls.some(([name]) => name === "record_membership_fee_payment_multi")).toBe(false);

  fireEvent.click(bill.getAllByRole("checkbox")[1]);
  const save = bill.getByRole("button", { name: "Create Bill" });
  fireEvent.click(save);
  fireEvent.click(save);
  await waitFor(() => expect(fixture.rpc.mock.calls.filter(([name]) => name === "record_membership_fee_payment_multi")).toHaveLength(1));
  expect(fixture.rpc).toHaveBeenCalledWith("record_membership_fee_payment_multi", expect.objectContaining({ p_fee_ids: [11, 12] }));
  await screen.findByText(/membership fees collected successfully/i);
});

it("defaults every fresh bill to Gym Member and clears the previous walk-in details", async () => {
  render(<MemoryRouter><AdminBilling /></MemoryRouter>);
  fireEvent.click((await screen.findAllByRole("button", { name: "New Bill" }))[0]);
  let bill = within(await screen.findByRole("dialog", { name: "New Bill" }));
  expect(bill.getByPlaceholderText("Start typing a name")).toHaveValue("");
  fireEvent.click(bill.getByRole("button", { name: "Walk-in Customer" }));
  fireEvent.change(bill.getByDisplayValue("Walk-in Customer"), { target: { value: "Previous customer" } });
  fireEvent.click(bill.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getAllByRole("button", { name: "New Bill" })[0]);
  bill = within(await screen.findByRole("dialog", { name: "New Bill" }));
  expect(bill.getByPlaceholderText("Start typing a name")).toHaveValue("");
  expect(bill.queryByDisplayValue("Previous customer")).not.toBeInTheDocument();
});
