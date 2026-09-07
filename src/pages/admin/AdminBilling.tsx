import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  FilePlus2,
  Printer,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@src/Client/supabase";
import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminDialog,
  AdminDrawer,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminLoading,
  AdminMetricCard,
  AdminNotice,
  AdminPageHeader,
  AdminSelect,
  AdminTableScroll,
  AdminTableShell,
  AdminTextarea,
} from "@src/components/admin/AdminUI";
import type { MemberRow, AdminSettings } from "./adminTypes";
import {
  defaultAdminSettings,
  friendlyAdminError,
  formatBsDateFromAd,
  getNepalTodayAdDate,
} from "./adminUtils";
import type {
  InventoryProduct,
  InventoryVariant,
} from "@src/features/inventory/types";
import type {
  DraftLine,
  InvoiceItemRow,
  InvoicePaymentRow,
  InvoiceRow,
  PaymentMethod,
} from "@src/features/billing/types";
import { calculateInvoiceTotals } from "@src/features/billing/calculations";
import { fetchAllPages } from "@src/utils/fetchAllPages";
import {
  formatMoney,
  majorToMinor,
  minorToInput,
} from "@src/features/billing/currency";

type BillingSettings = AdminSettings & {
  invoice_prefix: string;
  currency_code: string;
  currency_minor_unit: number;
  tax_enabled: boolean;
  tax_label: string;
  tax_rate_basis_points: number;
  pan_vat_number: string | null;
  receipt_footer: string;
};
type LocationState = { memberId?: number };
type BillablePlan = { id: number; title: string; price: string; is_active: boolean };
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "digital_wallet", label: "Digital wallet" },
  { value: "other", label: "Other" },
];
const makeKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const statusTone = (status: string) =>
  status === "paid"
    ? ("success" as const)
    : status === "partially_paid"
      ? ("warning" as const)
      : status === "cancelled"
        ? ("danger" as const)
        : ("neutral" as const);
const displayPriceToInput = (value: string) => {
  const normalized = value
    .replace(/[,_\s]/g, "")
    .match(/[0-9]+(?:\.[0-9]+)?/)?.[0];
  return normalized && Number(normalized) >= 0 ? normalized : "";
};

export default function AdminBilling() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = getNepalTodayAdDate();
  const [settings, setSettings] = useState<BillingSettings>({
    ...defaultAdminSettings,
    invoice_prefix: "GYM",
    currency_code: "NPR",
    currency_minor_unit: 2,
    tax_enabled: false,
    tax_label: "Tax",
    tax_rate_basis_points: 0,
    pan_vat_number: null,
    receipt_footer: "Thank you for choosing us.",
  });
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<BillablePlan[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<BillablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [memberId, setMemberId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentTouched, setPaymentTouched] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [lineType, setLineType] = useState<DraftLine["itemType"]>("membership");
  const [lineDescription, setLineDescription] = useState("");
  const [linePrice, setLinePrice] = useState("");
  const [lineVariant, setLineVariant] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [detailItems, setDetailItems] = useState<InvoiceItemRow[]>([]);
  const [detailPayments, setDetailPayments] = useState<InvoicePaymentRow[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [newPayment, setNewPayment] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [customerMode, setCustomerMode] = useState<"member" | "walkin">(
    "member",
  );
  const [productSearch, setProductSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [successInvoice, setSuccessInvoice] = useState<InvoiceRow | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const load = async () => {
    const [i, m, p, v, s, pricing, training] = await Promise.all([
      fetchAllPages<InvoiceRow>((from, to) => supabase.from("invoices").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      fetchAllPages<MemberRow>((from, to) => supabase.from("members").select("*").is("deleted_at", null).order("full_name").order("id").range(from, to)),
      supabase
        .from("shop_items")
        .select(
          "id,title,category,description,image,is_active,sku,brand,unit,barcode,supplier_id,inventory_enabled,cost_price_minor,selling_price_minor,low_stock_threshold,inventory_notes,deactivated_at",
        )
        .eq("inventory_enabled", true)
        .eq("is_active", true)
        .order("title"),
      supabase
        .from("inventory_product_variants")
        .select("*")
        .eq("is_active", true)
        .order("sku"),
      supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("pricing_items").select("id,title,price,is_active").eq("kind", "plan").eq("is_active", true).order("sort_order"),
      supabase.from("personal_training_plans").select("id,title:name,price:details,is_active").eq("is_active", true).order("sort_order"),
    ]);
    const issue = i.error ?? m.error ?? p.error ?? v.error ?? s.error ?? pricing.error ?? training.error;
    if (issue) setMessage(issue.message);
    setInvoices((i.data ?? []) as InvoiceRow[]);
    setMembers((m.data ?? []) as MemberRow[]);
    setProducts((p.data ?? []) as InventoryProduct[]);
    setVariants((v.data ?? []) as InventoryVariant[]);
    setMembershipPlans((pricing.data ?? []) as BillablePlan[]);
    setTrainingPlans((training.data ?? []) as BillablePlan[]);
    if (s.data) setSettings((x) => ({ ...x, ...(s.data as BillingSettings) }));
    setLoading(false);
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (!loading && state?.memberId) {
      const member = members.find((m) => m.id === state.memberId);
      if (member) {
        const timeout = window.setTimeout(() => {
          setMemberId(String(member.id));
          setCustomerName(member.full_name);
          setCustomerPhone(member.phone);
          setCustomerEmail(member.email ?? "");
          setDueDate(today);
          setNotes("");
          setLines([]);
          setDiscount("0");
          setPaymentAmount("0");
          setLineType("membership");
          setLineDescription(
            `${member.membership_type.charAt(0).toUpperCase() + member.membership_type.slice(1)} membership fee`,
          );
          setCreateOpen(true);
          window.history.replaceState({}, document.title);
        }, 0);
        return () => window.clearTimeout(timeout);
      }
    }
  }, [loading, location.state, members, today]);
  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const q = search.trim().toLowerCase();
        if (
          q &&
          !`${invoice.invoice_number ?? "draft"} ${invoice.customer_name} ${invoice.customer_phone ?? ""}`
            .toLowerCase()
            .includes(q)
        )
          return false;
        if (paymentFilter !== "all" && invoice.payment_status !== paymentFilter)
          return false;
        if (statusFilter !== "all" && invoice.invoice_status !== statusFilter)
          return false;
        if (dateFrom && invoice.billing_date < dateFrom) return false;
        if (dateTo && invoice.billing_date > dateTo) return false;
        return true;
      }),
    [invoices, search, paymentFilter, statusFilter, dateFrom, dateTo],
  );
  const issued = invoices.filter((i) => i.invoice_status === "issued");
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageInvoices = filtered.slice((page - 1) * pageSize, page * pageSize);
  const month = today.slice(0, 7);
  const revenueToday = issued
    .filter((i) => i.billing_date === today)
    .reduce((s, i) => s + i.paid_minor, 0);
  const revenueMonth = issued
    .filter((i) => i.billing_date.startsWith(month))
    .reduce((s, i) => s + i.paid_minor, 0);
  const outstanding = issued.reduce((s, i) => s + i.balance_minor, 0);
  const automaticPrice = majorToMinor(linePrice, settings.currency_minor_unit);
  const billLines = lineType === "product" ? lines : automaticPrice !== null && lineDescription.trim() ? [{ key: "automatic", itemType: lineType, productId: null, variantId: null, description: lineDescription.trim(), quantity: 1, unitPriceMinor: automaticPrice, discountMinor: 0 } satisfies DraftLine] : [];
  const totals = calculateInvoiceTotals(
    billLines,
    majorToMinor(discount, settings.currency_minor_unit) ?? 0,
    settings.tax_enabled,
    settings.tax_rate_basis_points,
  );
  const openCreate = useCallback((member?: MemberRow) => {
    setCustomerMode(member ? "member" : "walkin");
    setMemberId(member ? String(member.id) : "");
    setCustomerName(member?.full_name ?? "");
    setCustomerPhone(member?.phone ?? "");
    setCustomerEmail(member?.email ?? "");
    setDueDate(today);
    setNotes("");
    setLines([]);
    setDiscount("0");
    setPaymentAmount("0");
    setPaymentTouched(false);
    setSelectedPlanId("");
    setMemberSearch("");
    setCreateError("");
    setCreateOpen(true);
    if (member) {
      setLineType("membership");
      setLineDescription(
        `${member.membership_type.charAt(0).toUpperCase() + member.membership_type.slice(1)} membership fee`,
      );
    }
  }, [today]);
  useEffect(() => {
    if (loading) return;
    const mode = searchParams.get("mode");
    if (
      mode !== "shop" &&
      mode !== "membership" &&
      searchParams.get("action") !== "new"
    )
      return;
    const timeout = window.setTimeout(() => {
      openCreate();
      if (mode === "shop") {
        setLineType("product");
        setCustomerMode("walkin");
        setCustomerName("Walk-in Customer");
      }
      if (mode === "membership") {
        setLineType("membership");
        setCustomerMode("member");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loading, openCreate, searchParams]);
  const selectMember = (value: string) => {
    setMemberId(value);
    const member = members.find((m) => m.id === Number(value));
    if (member) {
      setCustomerName(member.full_name);
      setCustomerPhone(member.phone);
      setCustomerEmail(member.email ?? "");
      setLineDescription(
        `${member.membership_type.charAt(0).toUpperCase() + member.membership_type.slice(1)} membership fee`,
      );
      const memberPlan = membershipPlans.find((plan) =>
        plan.title.toLowerCase().includes(member.membership_type.toLowerCase()),
      );
      if (memberPlan) {
        setSelectedPlanId(String(memberPlan.id));
        setLineDescription(memberPlan.title);
        setLinePrice(displayPriceToInput(memberPlan.price));
      }
    }
  };
  const selectVariant = (value: string) => {
    setLineVariant(value);
    const variant = variants.find((v) => v.id === Number(value));
    const product = variant
      ? products.find((p) => p.id === variant.product_id)
      : null;
    if (variant && product) {
      const description = `${product.title}${variant.name !== "Default" ? ` — ${variant.name}` : ""}`;
      const unitPriceMinor = variant.selling_price_minor ?? product.selling_price_minor;
      setLines((current) => current.some((line)=>line.variantId===variant.id) ? current : [...current, { key: makeKey(), itemType: "product", productId: product.id, variantId: variant.id, description, quantity: 1, unitPriceMinor, discountMinor: 0 }]);
    }
  };
  const createInvoice = async () => {
    setCreateError("");
    if (customerMode === "member" && !memberId) {
      setCreateError("Select a gym member from the search results before creating the bill.");
      return;
    }
    if (!customerName.trim()) {
      setCreateError("Enter or select a customer name.");
      return;
    }
    if (lineType === "product" && lines.length === 0) {
      setCreateError("Select at least one shop product for this bill.");
      return;
    }
    if (lineType !== "product" && !lineDescription.trim()) {
      setCreateError(
        lineType === "miscellaneous"
          ? "Enter what this charge is for."
          : "Choose a plan before creating the bill.",
      );
      return;
    }
    if (billLines.length === 0 || totals.totalMinor <= 0) {
      setCreateError("Enter an amount greater than zero.");
      return;
    }
    const initialPayment = paymentTouched
      ? majorToMinor(paymentAmount, settings.currency_minor_unit)
      : totals.totalMinor;
    if (initialPayment === null || initialPayment < 0 || initialPayment > totals.totalMinor) {
      setCreateError("Amount received must be between zero and the bill total.");
      return;
    }
    if (initialPayment < totals.totalMinor && !dueDate) {
      setCreateError("Choose a payment due date for the remaining balance.");
      return;
    }
    setSaving(true);
    try {
      const invoiceRes = await supabase
      .from("invoices")
      .insert({
        member_ref: memberId ? Number(memberId) : null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim() || null,
        billing_date: today,
        due_date: dueDate || null,
        currency_code: settings.currency_code,
        discount_minor: totals.discountMinor,
        tax_enabled: settings.tax_enabled,
        tax_label: settings.tax_label,
        tax_rate_basis_points: settings.tax_rate_basis_points,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
      if (invoiceRes.error) {
        setCreateError(friendlyAdminError(invoiceRes.error.message));
        return;
      }
      const invoiceId = Number(invoiceRes.data.id);
      const itemPayload = billLines.map((line, index) => ({
      invoice_id: invoiceId,
      item_type: line.itemType,
      product_id: line.productId,
      variant_id: line.variantId,
      description: line.description,
      quantity: line.quantity,
      unit_price_minor: line.unitPriceMinor,
      discount_minor: line.discountMinor,
      tax_minor: index === billLines.length - 1 ? totals.taxMinor : 0,
      line_total_minor:
        Math.round(line.quantity * line.unitPriceMinor) -
        line.discountMinor +
        (index === billLines.length - 1 ? totals.taxMinor : 0),
      sort_order: index,
    }));
      const itemsRes = await supabase.from("invoice_items").insert(itemPayload);
      if (itemsRes.error) {
        setCreateError(`The draft was created, but its items could not be saved: ${friendlyAdminError(itemsRes.error.message)} Please cancel it from the bill list and try again.`);
        return;
      }
      const finalRes = await supabase.rpc("finalize_invoice", {
      p_invoice_id: invoiceId,
      p_payment_amount_minor: initialPayment,
      p_payment_method: paymentMethod,
      p_payment_reference: null,
    });
      if (finalRes.error) {
        setCreateError(
        friendlyAdminError(
          finalRes.error.message,
          lineDescription || "product",
        ),
      );
        await load();
        return;
      }
      setCreateOpen(false);
      setMessage("Invoice issued successfully.");
      await load();
      const created = (
      Array.isArray(finalRes.data) ? finalRes.data[0] : finalRes.data
      ) as InvoiceRow | undefined;
      if (created) {
        setSuccessInvoice(created);
        void showDetail(created);
      }
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? `Could not create the bill: ${error.message}`
          : "Could not create the bill. Check the local Supabase connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  const showDetail = async (invoice: InvoiceRow) => {
    setDetail(invoice);
    const [items, payments] = await Promise.all([
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("sort_order"),
      supabase
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("created_at"),
    ]);
    if (items.error || payments.error)
      setMessage(
        items.error?.message ??
          payments.error?.message ??
          "Invoice detail failed.",
      );
    setDetailItems((items.data ?? []) as InvoiceItemRow[]);
    setDetailPayments((payments.data ?? []) as InvoicePaymentRow[]);
  };
  const recordPayment = async () => {
    if (!detail) return;
    const amount = majorToMinor(newPayment, settings.currency_minor_unit);
    if (amount === null || amount <= 0 || amount > detail.balance_minor) {
      setMessage("Payment must be positive and cannot exceed the balance.");
      return;
    }
    const { error } = await supabase.rpc("record_invoice_payment", {
      p_invoice_id: detail.id,
      p_amount_minor: amount,
      p_payment_method: newPaymentMethod,
      p_payment_date: today,
      p_reference: null,
      p_notes: null,
    });
    if (error) {
      setMessage(friendlyAdminError(error.message));
      return;
    }
    setPaymentOpen(false);
    setNewPayment("");
    setMessage("Payment recorded.");
    await load();
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", detail.id)
      .single();
    if (data) await showDetail(data as InvoiceRow);
  };
  const cancelInvoice = async () => {
    if (!detail || !cancellationReason.trim()) return;
    const { error } = await supabase.rpc("cancel_invoice", {
      p_invoice_id: detail.id,
      p_reason: cancellationReason.trim(),
    });
    if (error) {
      setMessage(friendlyAdminError(error.message));
      return;
    }
    setCancelOpen(false);
    setCancellationReason("");
    setMessage(
      `Bill ${detail.invoice_number ?? ""} cancelled. Any sold products were returned to stock.`,
    );
    await load();
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", detail.id)
      .single();
    if (data) await showDetail(data as InvoiceRow);
  };
  if (loading) return <AdminLoading label="Loading billing" />;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Sales and collections"
        title="Bills & Payments"
        description="Record membership payments, make shop sales and print bills."
        actions={
          <AdminButton variant="primary" onClick={() => openCreate()}>
            <FilePlus2 className="h-4 w-4" />
            New Bill
          </AdminButton>
        }
      />
      {message ? (
        <AdminNotice
          tone={
            message.includes("success") ||
            message.includes("recorded") ||
            message.includes("cancelled")
              ? "success"
              : "danger"
          }
        >
          {message}
        </AdminNotice>
      ) : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <AdminMetricCard
          label="Revenue today"
          value={formatMoney(revenueToday, settings.currency_code)}
          icon={Banknote}
        />
        <AdminMetricCard
          label="Revenue this month"
          value={formatMoney(revenueMonth, settings.currency_code)}
          icon={WalletCards}
        />
        <AdminMetricCard
          label="Invoices today"
          value={String(
            invoices.filter(
              (i) => i.billing_date === today && i.invoice_status !== "draft",
            ).length,
          )}
          icon={ReceiptText}
        />
        <AdminMetricCard
          label="Unpaid"
          value={String(
            issued.filter((i) => i.payment_status === "unpaid").length,
          )}
          icon={ReceiptText}
        />
        <AdminMetricCard
          label="Partially paid"
          value={String(
            issued.filter((i) => i.payment_status === "partially_paid").length,
          )}
          icon={ReceiptText}
        />
        <AdminMetricCard
          label="Outstanding"
          value={formatMoney(outstanding, settings.currency_code)}
          icon={Banknote}
        />
      </div>
      <AdminCard>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <AdminInput
              className="pl-9"
              placeholder="Search bills by number or customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <AdminInput
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <AdminInput
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <AdminSelect
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            options={[
              { value: "all", label: "All payments" },
              { value: "unpaid", label: "Unpaid" },
              { value: "partially_paid", label: "Partially paid" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <AdminSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All invoices" },
              { value: "draft", label: "Draft" },
              { value: "issued", label: "Issued" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        </div>
      </AdminCard>
      {filtered.length === 0 ? (
        <AdminEmptyState
          title={
            invoices.length === 0
              ? "No bills created yet"
              : `No bills found${search ? ` for “${search}”` : ""}`
          }
          description={
            invoices.length === 0
              ? "Create your first membership bill or shop sale."
              : "Try a different customer, bill number or filter."
          }
          action={
            invoices.length === 0 ? (
              <AdminButton variant="primary" onClick={() => openCreate()}>
                Create First Bill
              </AdminButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {pageInvoices.map((invoice) => (
              <AdminCard key={invoice.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-white">
                      {invoice.invoice_number ?? `Draft #${invoice.id}`}
                    </b>
                    <p className="mt-1 text-sm text-slate-400">
                      {invoice.customer_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {invoice.billing_date}
                    </p>
                  </div>
                  <AdminBadge tone={statusTone(invoice.payment_status)}>
                    {invoice.payment_status.replaceAll("_", " ")}
                  </AdminBadge>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <b className="text-xl text-white">
                    {formatMoney(invoice.total_minor, invoice.currency_code)}
                  </b>
                  <AdminButton
                    variant="secondary"
                    onClick={() => void showDetail(invoice)}
                  >
                    View Bill
                  </AdminButton>
                </div>
              </AdminCard>
            ))}
          </div>
          <AdminTableShell>
            <AdminTableScroll>
              <table className="hidden min-w-full text-sm md:table">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Invoice",
                      "Date",
                      "Customer",
                      "Total",
                      "Payment",
                      "Invoice status",
                      "Action",
                    ].map((h) => (
                      <th className="px-4 py-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pageInvoices.map((invoice) => (
                    <tr key={invoice.id} className="bg-slate-950/60">
                      <td className="px-4 py-4 font-bold text-white">
                        {invoice.invoice_number ?? `Draft #${invoice.id}`}
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {invoice.billing_date}
                        <div className="text-xs text-slate-500">
                          BS {formatBsDateFromAd(invoice.billing_date)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {invoice.customer_name}
                      </td>
                      <td className="px-4 py-4 text-white">
                        {formatMoney(
                          invoice.total_minor,
                          invoice.currency_code,
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <AdminBadge tone={statusTone(invoice.payment_status)}>
                          {invoice.payment_status.replaceAll("_", " ")}
                        </AdminBadge>
                      </td>
                      <td className="px-4 py-4">
                        <AdminBadge tone={statusTone(invoice.invoice_status)}>
                          {invoice.invoice_status}
                        </AdminBadge>
                      </td>
                      <td className="px-4 py-4">
                        <AdminButton
                          variant="secondary"
                          onClick={() => void showDetail(invoice)}
                        >
                          View
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
          </AdminTableShell>
        </>
      )}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{filtered.length} invoices</span>
        <div className="flex items-center gap-2">
          <AdminButton
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </AdminButton>
          <span>
            {page} / {pageCount}
          </span>
          <AdminButton
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </AdminButton>
        </div>
      </div>
      <AdminDialog
        open={createOpen}
        size="2xl"
        title="New Bill"
        description="Choose the customer, what they are paying for, and how they paid."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="space-y-3">
            {createError ? (
              <AdminNotice tone="danger">{createError}</AdminNotice>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <b className="text-lg text-white">
                Total: {formatMoney(totals.totalMinor, settings.currency_code)}
              </b>
              <div className="flex gap-2">
                <AdminButton variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</AdminButton>
                <AdminButton variant="primary" disabled={saving} onClick={() => void createInvoice()}>
                  {saving ? "Completing..." : "Create Bill"}
                </AdminButton>
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-black text-white">Customer</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("member");
                  setCustomerName("");
                }}
                className={`min-h-16 rounded-lg border p-3 text-sm font-bold ${customerMode === "member" ? "border-amber-400 bg-amber-400/10 text-white" : "border-slate-800 text-slate-400"}`}
              >
                Gym Member
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("walkin");
                  setMemberId("");
                  setCustomerName("Walk-in Customer");
                }}
                className={`min-h-16 rounded-lg border p-3 text-sm font-bold ${customerMode === "walkin" ? "border-amber-400 bg-amber-400/10 text-white" : "border-slate-800 text-slate-400"}`}
              >
                Walk-in Customer
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {customerMode === "member" ? (
                <AdminField label="Search member by name or ID">
                  <AdminInput placeholder="Start typing a name or member ID" value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberId(""); setCustomerName(""); }} />
                  {memberSearch.trim() && !memberId ? (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-1">
                      {members.filter((member) => `${member.full_name} ${member.member_id}`.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 8).map((member) => (
                        <button key={member.id} type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800" onClick={() => { selectMember(String(member.id)); setMemberSearch(`${member.full_name} (${member.member_id})`); }}>
                          {member.full_name} <span className="text-slate-500">{member.member_id}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </AdminField>
              ) : (
                <AdminField label="Customer name">
                  <AdminInput
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </AdminField>
              )}
              {customerMode === "walkin" ? (
                <AdminField label="Phone" hint="Optional">
                  <AdminInput
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </AdminField>
              ) : null}
              {customerMode === "walkin" ? (
                <AdminField label="Email" hint="Optional">
                  <AdminInput
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </AdminField>
              ) : null}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-black text-white">
              What are they paying for?
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  { value: "membership", label: "Membership" },
                  { value: "product", label: "Shop Product" },
                  { value: "personal_training", label: "Personal Training" },
                  { value: "miscellaneous", label: "Other" },
                ] as const
              ).map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => {
                    setLineType(choice.value);
                    setLineVariant("");
                    setSelectedPlanId("");
                    setLineDescription("");
                    setLinePrice("");
                  }}
                  className={`min-h-16 rounded-lg border p-3 text-sm font-bold ${lineType === choice.value ? "border-amber-400 bg-amber-400/10 text-white" : "border-slate-800 text-slate-400 hover:text-white"}`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
          <AdminCard>
            <div className="space-y-4">
              {lineType === "product" ? (
                <div>
                  <AdminField label="Search products">
                    <AdminInput
                      placeholder="Search protein, shirt, creatine..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </AdminField>
                  <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                    {variants
                      .filter((variant) => {
                        const product = products.find(
                          (item) => item.id === variant.product_id,
                        );
                        const query = productSearch.trim().toLowerCase();
                        return (
                          !query ||
                          `${product?.title ?? ""} ${product?.category ?? ""} ${variant.name} ${variant.sku}`
                            .toLowerCase()
                            .includes(query)
                        );
                      })
                      .map((variant) => {
                        const product = products.find(
                          (item) => item.id === variant.product_id,
                        );
                        const selected = lineVariant === String(variant.id);
                        return (
                          <button
                            type="button"
                            disabled={variant.current_quantity <= 0}
                            key={variant.id}
                            onClick={() => selectVariant(String(variant.id))}
                            className={`rounded-lg border p-3 text-left ${selected ? "border-amber-400 bg-amber-400/10" : "border-slate-800 bg-slate-950"} disabled:opacity-45`}
                          >
                            <b className="text-sm text-white">
                              {product?.title}
                              {variant.name !== "Default"
                                ? ` — ${variant.name}`
                                : ""}
                            </b>
                            <div className="mt-1 flex justify-between text-xs text-slate-400">
                              <span>
                                {formatMoney(
                                  variant.selling_price_minor ??
                                    product?.selling_price_minor ??
                                    0,
                                  settings.currency_code,
                                )}
                              </span>
                              <span>
                                {variant.current_quantity > 0
                                  ? `${variant.current_quantity} available`
                                  : "Out of stock"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : lineType === "membership" || lineType === "personal_training" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                  <AdminField
                    label={lineType === "membership" ? "Membership plan" : "Training plan"}
                    hint={lineType === "membership" ? "Selecting a plan fills its current price automatically." : undefined}
                  >
                    <AdminSelect
                      value={selectedPlanId}
                      onChange={(event) => {
                        const plan = (lineType === "membership" ? membershipPlans : trainingPlans).find((item) => item.id === Number(event.target.value));
                        setSelectedPlanId(event.target.value);
                        setLineDescription(plan?.title ?? "");
                        setLinePrice(plan ? displayPriceToInput(plan.price) : "");
                      }}
                      options={[
                        { value: "", label: "Choose a plan" },
                        ...(lineType === "membership" ? membershipPlans : trainingPlans).map((plan) => ({ value: String(plan.id), label: `${plan.title} — ${plan.price}` })),
                      ]}
                    />
                  </AdminField>
                  <AdminField label={`Amount (${settings.currency_code})`}>
                    <AdminInput type="number" min="0" step="0.01" value={linePrice} onChange={(event) => setLinePrice(event.target.value)} />
                  </AdminField>
                  </div>
                  {lineType === "membership" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
                      <span>
                        {membershipPlans.length
                          ? "Rates come from Membership Plans. Update a plan there whenever its price changes."
                          : "No active membership plans are available. Add and activate a plan first."}
                      </span>
                      <AdminButton type="button" variant="secondary" onClick={() => navigate("/admin/pricing")}>
                        Manage membership plans
                      </AdminButton>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <AdminField label="What is this charge for?">
                    <AdminInput value={lineDescription} onChange={(event) => setLineDescription(event.target.value)} />
                  </AdminField>
                  <AdminField label={`Amount (${settings.currency_code})`}>
                    <AdminInput type="number" min="0" step="0.01" value={linePrice} onChange={(event) => setLinePrice(event.target.value)} />
                  </AdminField>
                </div>
              )}
            </div>
          </AdminCard>
          {lineType === "product" && lines.length === 0 ? (
            <AdminEmptyState title="No invoice items" />
          ) : lineType === "product" ? (
            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between rounded-lg border border-slate-800 p-3"
                >
                  <div>
                    <b className="text-white">{line.description}</b>
                    <div className="mt-2 flex items-center gap-2">
                      <AdminButton
                        className="h-9 min-h-9 w-9 p-0"
                        variant="secondary"
                        disabled={line.quantity <= 1}
                        onClick={() =>
                          setLines((items) =>
                            items.map((item) =>
                              item.key === line.key
                                ? { ...item, quantity: item.quantity - 1 }
                                : item,
                            ),
                          )
                        }
                      >
                        −
                      </AdminButton>
                      <span className="min-w-8 text-center text-sm text-white">
                        {line.quantity}
                      </span>
                      <AdminButton
                        className="h-9 min-h-9 w-9 p-0"
                        variant="secondary"
                        disabled={Boolean(line.variantId && line.quantity >= (variants.find((variant) => variant.id === line.variantId)?.current_quantity ?? 0))}
                        onClick={() =>
                          setLines((items) =>
                            items.map((item) =>
                              item.key === line.key
                                ? { ...item, quantity: item.quantity + 1 }
                                : item,
                            ),
                          )
                        }
                      >
                        +
                      </AdminButton>
                      <span className="text-xs text-slate-500">
                        ×{" "}
                        {formatMoney(
                          line.unitPriceMinor,
                          settings.currency_code,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <b>
                      {formatMoney(
                        Math.round(line.quantity * line.unitPriceMinor),
                        settings.currency_code,
                      )}
                    </b>
                    <AdminButton
                      variant="ghost"
                      onClick={() =>
                        setLines((x) =>
                          x.filter((item) => item.key !== line.key),
                        )
                      }
                    >
                      Remove
                    </AdminButton>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-4">
            <details>
              <summary className="cursor-pointer text-sm font-bold text-slate-300">
                Add a discount
              </summary>
              <div className="mt-3 max-w-xs">
                <AdminField label="Discount amount">
                  <AdminInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </AdminField>
              </div>
            </details>
            <AdminField label="Amount received">
              <AdminInput
                type="number"
                min="0"
                step="0.01"
                value={paymentTouched ? paymentAmount : minorToInput(totals.totalMinor, settings.currency_minor_unit)}
                onChange={(e) => { setPaymentTouched(true); setPaymentAmount(e.target.value); }}
              />
            </AdminField>
            {(paymentTouched ? majorToMinor(paymentAmount, settings.currency_minor_unit) ?? 0 : totals.totalMinor) < totals.totalMinor ? (
              <AdminField label="Payment due date">
                <AdminInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </AdminField>
            ) : null}
            <AdminField label="How did they pay?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {paymentMethods.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`min-h-12 rounded-lg border px-2 text-sm font-bold ${paymentMethod === method.value ? "border-amber-400 bg-amber-400/10 text-white" : "border-slate-800 text-slate-400"}`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </AdminField>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-bold text-slate-300">Add a note</summary>
            <div className="mt-3"><AdminField label="Notes"><AdminTextarea value={notes} onChange={(e) => setNotes(e.target.value)} /></AdminField></div>
          </details>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <b>{formatMoney(totals.subtotalMinor, settings.currency_code)}</b>
            </div>
            {totals.discountMinor > 0 ? <div className="flex justify-between">
              <span>Discount</span>
              <b>
                -{formatMoney(totals.discountMinor, settings.currency_code)}
              </b>
            </div> : null}
            {settings.tax_enabled ? <div className="flex justify-between">
              <span>{settings.tax_label}</span>
              <b>{formatMoney(totals.taxMinor, settings.currency_code)}</b>
            </div> : null}
            <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 text-base text-white"><span>Total</span><b>{formatMoney(totals.totalMinor, settings.currency_code)}</b></div>
            <div className="flex justify-between"><span>Received</span><b>{formatMoney(paymentTouched ? majorToMinor(paymentAmount, settings.currency_minor_unit) ?? 0 : totals.totalMinor, settings.currency_code)}</b></div>
            <div className="flex justify-between"><span>Balance</span><b>{formatMoney(Math.max(0, totals.totalMinor - (paymentTouched ? majorToMinor(paymentAmount, settings.currency_minor_unit) ?? 0 : totals.totalMinor)), settings.currency_code)}</b></div>
          </div>
        </div>
      </AdminDialog>
      <AdminDialog
        open={Boolean(successInvoice)}
        title="Bill created successfully"
        description={successInvoice?.invoice_number ? `Invoice ${successInvoice.invoice_number} is ready.` : "The invoice is ready."}
        onClose={() => setSuccessInvoice(null)}
        footer={<div className="flex justify-end gap-2"><AdminButton variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print Bill</AdminButton><AdminButton variant="primary" onClick={() => setSuccessInvoice(null)}>Done</AdminButton></div>}
      >
        {successInvoice ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-center"><p className="text-sm text-emerald-200">Amount received</p><p className="mt-2 text-3xl font-black text-white">{formatMoney(successInvoice.paid_minor, settings.currency_code)}</p></div> : null}
      </AdminDialog>
      <AdminDrawer
        open={Boolean(detail)}
        size="2xl"
        title={detail?.invoice_number ?? "Invoice detail"}
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print bill
              </AdminButton>
              {detail.invoice_status === "issued" &&
              detail.balance_minor > 0 ? (
                <AdminButton
                  variant="primary"
                  onClick={() => setPaymentOpen(true)}
                >
                  Record payment
                </AdminButton>
              ) : null}
              {detail.invoice_status === "issued" ? (
                <AdminButton
                  variant="danger"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel Bill
                </AdminButton>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {detail ? (
          <div
            id="printable-invoice"
            className="invoice-print rounded-xl bg-white p-6 text-slate-900"
          >
            <div className="flex justify-between gap-6 border-b pb-5">
              <div className="flex gap-3">
                {settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt="Gym logo"
                    className="h-14 w-14 object-contain"
                  />
                ) : null}
                <div>
                  <h2 className="text-2xl font-black">{settings.gym_name}</h2>
                  <p className="text-sm">{settings.address}</p>
                  <p className="text-sm">
                    {settings.phone} · {settings.email}
                  </p>
                  {settings.pan_vat_number ? (
                    <p className="text-sm">
                      PAN/VAT: {settings.pan_vat_number}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <h3 className="text-xl font-black">INVOICE</h3>
                <p>{detail.invoice_number}</p>
                <p className="text-sm">AD {detail.billing_date}</p>
                <p className="text-sm">
                  BS {formatBsDateFromAd(detail.billing_date)}
                </p>
              </div>
            </div>
            <div className="my-5 flex justify-between">
              <div>
                <div className="text-xs uppercase text-slate-500">Bill to</div>
                <b>{detail.customer_name}</b>
                <p className="text-sm">{detail.customer_phone}</p>
                <p className="text-sm">{detail.customer_email}</p>
              </div>
              <div className="text-right">
                <AdminBadge tone={statusTone(detail.invoice_status)}>
                  {detail.invoice_status}
                </AdminBadge>
                <div className="mt-2">
                  <AdminBadge tone={statusTone(detail.payment_status)}>
                    {detail.payment_status.replaceAll("_", " ")}
                  </AdminBadge>
                </div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left">
                  <th className="py-2">Item</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">
                      {item.description}
                      <div className="text-xs text-slate-500">
                        {item.item_type.replaceAll("_", " ")}
                      </div>
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      {formatMoney(item.unit_price_minor, detail.currency_code)}
                    </td>
                    <td className="text-right">
                      {formatMoney(item.line_total_minor, detail.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-5 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <b>
                  {formatMoney(detail.subtotal_minor, detail.currency_code)}
                </b>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <b>
                  -{formatMoney(detail.discount_minor, detail.currency_code)}
                </b>
              </div>
              <div className="flex justify-between">
                <span>{detail.tax_enabled ? detail.tax_label : "Tax"}</span>
                <b>{formatMoney(detail.tax_minor, detail.currency_code)}</b>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg">
                <span>Total</span>
                <b>{formatMoney(detail.total_minor, detail.currency_code)}</b>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <b>{formatMoney(detail.paid_minor, detail.currency_code)}</b>
              </div>
              <div className="flex justify-between">
                <span>Balance</span>
                <b>{formatMoney(detail.balance_minor, detail.currency_code)}</b>
              </div>
            </div>
            {detailPayments.length ? (
              <div className="mt-6">
                <h4 className="font-bold">Payments</h4>
                {detailPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="mt-2 flex justify-between border-b py-2 text-sm"
                  >
                    <span>
                      {payment.payment_date} ·{" "}
                      {payment.payment_method.replaceAll("_", " ")}
                    </span>
                    <b>
                      {formatMoney(payment.amount_minor, detail.currency_code)}
                    </b>
                  </div>
                ))}
              </div>
            ) : null}
            {detail.notes ? (
              <p className="mt-5 text-sm">Notes: {detail.notes}</p>
            ) : null}
            {detail.invoice_status === "cancelled" ? (
              <p className="mt-5 rounded bg-red-50 p-3 text-sm text-red-800">
                Cancelled: {detail.cancellation_reason}
              </p>
            ) : null}
            <p className="mt-8 border-t pt-4 text-center text-sm">
              {settings.receipt_footer}
            </p>
          </div>
        ) : null}
      </AdminDrawer>
      <AdminDialog
        open={paymentOpen}
        title="Record payment"
        description={
          detail
            ? `Outstanding: ${formatMoney(detail.balance_minor, detail.currency_code)}`
            : undefined
        }
        onClose={() => setPaymentOpen(false)}
        footer={
          <AdminButton variant="primary" onClick={() => void recordPayment()}>
            Save payment
          </AdminButton>
        }
      >
        <div className="space-y-4">
          <AdminField label="Amount">
            <AdminInput
              type="number"
              min="0.01"
              step="0.01"
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
            />
          </AdminField>
          <AdminField label="Payment method">
            <AdminSelect<PaymentMethod>
              value={newPaymentMethod}
              onChange={(e) =>
                setNewPaymentMethod(e.target.value as PaymentMethod)
              }
              options={paymentMethods}
            />
          </AdminField>
        </div>
      </AdminDialog>
      <AdminDialog
        open={cancelOpen}
        title={`Cancel bill ${detail?.invoice_number ?? ""}?`}
        description="Products sold on this bill will be returned to stock. The bill and payment history will remain saved."
        onClose={() => setCancelOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AdminButton
              variant="secondary"
              onClick={() => setCancelOpen(false)}
            >
              Keep Bill
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={!cancellationReason.trim()}
              onClick={() => void cancelInvoice()}
            >
              Cancel Bill
            </AdminButton>
          </div>
        }
      >
        <AdminField label="Why is this bill being cancelled?">
          <AdminTextarea
            autoFocus
            rows={3}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Example: Customer returned the products"
          />
        </AdminField>
      </AdminDialog>
    </div>
  );
}
