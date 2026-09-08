import { useEffect, useMemo, useState } from "react";
import { Banknote, Boxes, Download, ReceiptText, ShoppingCart, Users } from "lucide-react";
import { supabase } from "@src/Client/supabase";
import { fetchAllPages } from "@src/utils/fetchAllPages";
import { formatMoney } from "@src/features/billing/currency";
import type { InvoiceItemRow, InvoiceRow, PaymentMethod } from "@src/features/billing/types";
import type { InventoryProduct, InventoryVariant } from "@src/features/inventory/types";
import type { AdminSettings, MemberRow } from "./adminTypes";
import { adToBsString, bsStringToAdDate, defaultAdminSettings, getNepalTodayAdDate, statusLabel } from "./adminUtils";
import { AdminBsMonthInput, AdminButton, AdminCard, AdminDialog, AdminLoading, AdminMetricCard, AdminNotice, AdminPageHeader } from "@src/components/admin/AdminUI";

type PaymentRow = {
  id: number;
  invoice_id: number;
  amount_minor: number;
  payment_method: PaymentMethod;
  payment_date: string;
  is_reversal: boolean;
};

const nepaliMonths = ["Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
const bsMonthName = (month: string) => `${nepaliMonths[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)} BS`;
const getBsMonthDates = (month: string, currentBsDate: string) => {
  const dates: Array<{ ad: string; bs: string; label: string }> = [];
  for (let day = 1; day <= 32; day += 1) {
    const bs = `${month}-${String(day).padStart(2, "0")}`;
    const ad = bsStringToAdDate(bs);
    if (!ad) break;
    if (bs > currentBsDate) break;
    dates.push({ ad, bs, label: String(day) });
  }
  return dates;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function Breakdown({ title, rows, currency }: { title: string; rows: Array<{ label: string; value: number; count?: number }>; currency?: string }) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  return (
    <AdminCard>
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between gap-4 text-sm">
              <span className="text-slate-300">{row.label}{row.count !== undefined ? ` (${row.count})` : ""}</span>
              <b className="text-white">{currency ? formatMoney(row.value, currency) : row.value.toLocaleString()}</b>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, Math.abs(row.value) / max * 100)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">No activity in this month.</p>}
      </div>
    </AdminCard>
  );
}

export default function AdminReports() {
  const todayAd = getNepalTodayAdDate();
  const currentBsDate = adToBsString(todayAd);
  const currentMonth = currentBsDate.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [reportType, setReportType] = useState<"fees" | "products">("fees");
  const [selectedProductDate, setSelectedProductDate] = useState<string | null>(null);
  const [productDetailPage, setProductDetailPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<AdminSettings>(defaultAdminSettings);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [variants, setVariants] = useState<InventoryVariant[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const reportDays = getBsMonthDates(month, currentBsDate);
    const startDate = reportDays[0]?.ad ?? getNepalTodayAdDate();
    const endDate = reportDays.at(-1)?.ad ?? startDate;
    Promise.all([
      supabase.from("admin_settings").select("*").eq("id", 1).maybeSingle(),
      fetchAllPages<MemberRow>((from, to) => supabase.from("members").select("*").gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59`).range(from, to)),
      fetchAllPages<InvoiceRow>((from, to) => supabase.from("invoices").select("*").gte("billing_date", startDate).lte("billing_date", endDate).range(from, to)),
      fetchAllPages<InvoiceItemRow>((from, to) => supabase.from("invoice_items").select("*,invoices!inner(billing_date,invoice_status)").gte("invoices.billing_date", startDate).lte("invoices.billing_date", endDate).eq("invoices.invoice_status", "issued").range(from, to)),
      fetchAllPages<PaymentRow>((from, to) => supabase.from("invoice_payments").select("id,invoice_id,amount_minor,payment_method,payment_date,is_reversal").gte("payment_date", startDate).lte("payment_date", endDate).range(from, to)),
      fetchAllPages<InventoryProduct>((from, to) => supabase.from("shop_items").select("*").eq("inventory_enabled", true).range(from, to)),
      fetchAllPages<InventoryVariant>((from, to) => supabase.from("inventory_product_variants").select("*").range(from, to)),
    ]).then(([settingsRes, membersRes, invoicesRes, itemsRes, paymentsRes, productsRes, variantsRes]) => {
      if (!alive) return;
      const issue = settingsRes.error ?? membersRes.error ?? invoicesRes.error ?? itemsRes.error ?? paymentsRes.error ?? productsRes.error ?? variantsRes.error;
      if (issue) setError(issue.message);
      else {
        setSettings({ ...defaultAdminSettings, ...(settingsRes.data as AdminSettings | null) });
        setMembers(membersRes.data ?? []);
        setInvoices(invoicesRes.data ?? []);
        setItems(itemsRes.data ?? []);
        setPayments(paymentsRes.data ?? []);
        setProducts(productsRes.data ?? []);
        setVariants(variantsRes.data ?? []);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [currentBsDate, month]);

  const report = useMemo(() => {
    const calendarDays = getBsMonthDates(month, currentBsDate);
    const monthAdDates = new Set(calendarDays.map((day) => day.ad));
    const monthInvoices = invoices.filter((invoice) => invoice.invoice_status === "issued" && monthAdDates.has(invoice.billing_date));
    const monthInvoiceIds = new Set(monthInvoices.map((invoice) => invoice.id));
    const monthItems = items.filter((item) => monthInvoiceIds.has(item.invoice_id));
    const monthPayments = payments.filter((payment) => monthAdDates.has(payment.payment_date));
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const membershipInvoiceIds = new Set(items.filter((item) => item.item_type === "membership").map((item) => item.invoice_id));
    const membershipPayments = monthPayments.filter((payment) => membershipInvoiceIds.has(payment.invoice_id));
    const paidMemberIds = new Set<number>();
    membershipPayments.forEach((payment) => {
      const invoice = invoiceById.get(payment.invoice_id);
      if (!payment.is_reversal && membershipInvoiceIds.has(payment.invoice_id) && invoice?.member_ref) paidMemberIds.add(invoice.member_ref);
    });

    const planByInvoice = new Map<number, string>();
    items.filter((item) => item.item_type === "membership").forEach((item) => planByInvoice.set(item.invoice_id, item.description));
    const planCollections = new Map<string, { value: number; count: number }>();
    membershipPayments.forEach((payment) => {
      const label = planByInvoice.get(payment.invoice_id) ?? "Membership fee";
      const current = planCollections.get(label) ?? { value: 0, count: 0 };
      current.value += payment.is_reversal ? -payment.amount_minor : payment.amount_minor;
      current.count += payment.is_reversal ? 0 : 1;
      planCollections.set(label, current);
    });

    const categoryMap = new Map<string, { value: number; count: number }>();
    monthItems.forEach((item) => {
      const label = statusLabel(item.item_type);
      const current = categoryMap.get(label) ?? { value: 0, count: 0 };
      current.value += Math.round(item.quantity * item.unit_price_minor) - item.discount_minor;
      current.count += 1;
      categoryMap.set(label, current);
    });

    const paymentMap = new Map<string, { value: number; count: number }>();
    membershipPayments.forEach((payment) => {
      const label = statusLabel(payment.payment_method);
      const current = paymentMap.get(label) ?? { value: 0, count: 0 };
      current.value += payment.is_reversal ? -payment.amount_minor : payment.amount_minor;
      current.count += 1;
      paymentMap.set(label, current);
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const productMap = new Map<string, { value: number; count: number; cost: number }>();
    monthItems.filter((item) => item.item_type === "product").forEach((item) => {
      const product = item.product_id ? productById.get(item.product_id) : undefined;
      const variant = item.variant_id ? variantById.get(item.variant_id) : undefined;
      const current = productMap.get(item.description) ?? { value: 0, count: 0, cost: 0 };
      current.value += Math.round(item.quantity * item.unit_price_minor) - item.discount_minor;
      current.count += item.quantity;
      current.cost += item.quantity * (item.unit_cost_minor ?? variant?.cost_price_minor ?? product?.cost_price_minor ?? 0);
      productMap.set(item.description, current);
    });

    const productRows = Array.from(productMap, ([label, data]) => ({ label, value: data.value, count: data.count, cost: data.cost })).sort((a, b) => b.value - a.value);
    const daily = calendarDays.map(({ ad: date, bs: displayDate, label }) => {
      const dayPayments = membershipPayments.filter((payment) => payment.payment_date === date);
      return {
        label,
        date,
        displayDate,
        value: sum(dayPayments.map((payment) => payment.is_reversal ? -payment.amount_minor : payment.amount_minor)),
        payments: dayPayments.filter((payment) => !payment.is_reversal).length,
        members: new Set(dayPayments.map((payment) => invoiceById.get(payment.invoice_id)?.member_ref).filter(Boolean)).size,
      };
    });
    const productDaily = calendarDays.map(({ ad: date, bs: displayDate, label }) => {
      const dayInvoiceIds = new Set(monthInvoices.filter((invoice) => invoice.billing_date === date).map((invoice) => invoice.id));
      const dayItems = monthItems.filter((item) => item.item_type === "product" && dayInvoiceIds.has(item.invoice_id));
      const revenue = sum(dayItems.map((item) => Math.round(item.quantity * item.unit_price_minor) - item.discount_minor));
      const cost = sum(dayItems.map((item) => {
        const product = item.product_id ? productById.get(item.product_id) : undefined;
        const variant = item.variant_id ? variantById.get(item.variant_id) : undefined;
        return item.quantity * (item.unit_cost_minor ?? variant?.cost_price_minor ?? product?.cost_price_minor ?? 0);
      }));
      const detailMap = new Map<string, { units: number; revenue: number; cost: number }>();
      dayItems.forEach((item) => {
        const product = item.product_id ? productById.get(item.product_id) : undefined;
        const variant = item.variant_id ? variantById.get(item.variant_id) : undefined;
        const current = detailMap.get(item.description) ?? { units: 0, revenue: 0, cost: 0 };
        current.units += item.quantity;
        current.revenue += Math.round(item.quantity * item.unit_price_minor) - item.discount_minor;
        current.cost += item.quantity * (item.unit_cost_minor ?? variant?.cost_price_minor ?? product?.cost_price_minor ?? 0);
        detailMap.set(item.description, current);
      });
      const products = Array.from(detailMap, ([name, detail]) => ({ name, ...detail, profit: detail.revenue - detail.cost })).sort((a, b) => b.revenue - a.revenue);
      return { label, date, displayDate, units: sum(dayItems.map((item) => item.quantity)), revenue, cost, profit: revenue - cost, products };
    });
    const currentStockCost = sum(variants.map((variant) => variant.current_quantity * (variant.cost_price_minor ?? productById.get(variant.product_id)?.cost_price_minor ?? 0)));

    return {
      collected: sum(membershipPayments.map((payment) => payment.is_reversal ? -payment.amount_minor : payment.amount_minor)),
      feePaymentCount: membershipPayments.filter((payment) => !payment.is_reversal).length,
      billed: sum(monthInvoices.map((invoice) => invoice.total_minor)),
      outstanding: sum(monthInvoices.map((invoice) => invoice.balance_minor)),
      invoiceCount: monthInvoices.length,
      paidMembers: paidMemberIds.size,
      newMembers: members.filter((member) => monthAdDates.has(member.created_at.slice(0, 10))).length,
      activeMembers: members.filter((member) => !member.deleted_at && member.membership_status === "active").length,
      unitsSold: sum(productRows.map((row) => row.count)),
      productRevenue: sum(productRows.map((row) => row.value)),
      estimatedProductProfit: sum(productRows.map((row) => row.value - row.cost)),
      lowStock: variants.filter((variant) => variant.current_quantity <= (variant.low_stock_threshold ?? productById.get(variant.product_id)?.low_stock_threshold ?? 0)).length,
      currentStockCost,
      categoryRows: Array.from(categoryMap, ([label, data]) => ({ label, ...data })).sort((a, b) => b.value - a.value),
      paymentRows: Array.from(paymentMap, ([label, data]) => ({ label, ...data })).sort((a, b) => b.value - a.value),
      planRows: Array.from(planCollections, ([label, data]) => ({ label, ...data })).sort((a, b) => b.value - a.value),
      productRows,
      daily,
      productDaily,
    };
  }, [invoices, items, members, month, payments, products, variants]);

  if (loading) return <AdminLoading label="Preparing monthly report..." />;
  if (error) return <AdminNotice tone="danger" title="Report could not be loaded">{error}</AdminNotice>;
  const currency = settings.currency_code;
  const dailyMax = Math.max(...report.daily.map((day) => Math.abs(day.value)), 1);
  const selectedProductDay = report.productDaily.find((day) => day.date === selectedProductDate) ?? null;
  const productDetailPageSize = 20;
  const productDetailPageCount = Math.max(1, Math.ceil((selectedProductDay?.products.length ?? 0) / productDetailPageSize));
  const safeProductDetailPage = Math.min(productDetailPage, productDetailPageCount);
  const pagedProductDetails = selectedProductDay?.products.slice((safeProductDetailPage - 1) * productDetailPageSize, safeProductDetailPage * productDetailPageSize) ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow="Analytics" title="Monthly reports" description="Choose a Nepali (BS) month. The current month includes only dates up to today." actions={<><label className="text-xs font-semibold text-slate-400">Nepali month (BS)<div className="mt-1"><AdminBsMonthInput value={month} max={currentMonth} onChange={(value) => { setMonth(value); setSelectedProductDate(null); }} /></div></label><AdminButton variant="primary" onClick={() => window.print()}><Download className="h-4 w-4"/>Save {reportType === "fees" ? "Fee" : "Product"} PDF</AdminButton></>} />
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setReportType("fees")} className={`rounded-xl border p-5 text-left ${reportType === "fees" ? "border-amber-400 bg-amber-400/10" : "border-slate-800 bg-slate-950"}`}><Banknote className="h-6 w-6 text-amber-300"/><div className="mt-3 font-black text-white">Membership Fee Report</div><p className="mt-1 text-sm text-slate-400">Daily fee collections, members, plans and payment methods.</p></button>
        <button type="button" onClick={() => setReportType("products")} className={`rounded-xl border p-5 text-left ${reportType === "products" ? "border-amber-400 bg-amber-400/10" : "border-slate-800 bg-slate-950"}`}><ShoppingCart className="h-6 w-6 text-amber-300"/><div className="mt-3 font-black text-white">Product Sales & Profit Report</div><p className="mt-1 text-sm text-slate-400">Daily units, sales, cost and estimated profit.</p></button>
      </div>
      <div id="printable-monthly-report" className="monthly-report space-y-6">
        <div className="report-heading hidden">
          <h1>{settings.gym_name} — {reportType === "fees" ? "Membership Fee Report" : "Product Sales & Profit Report"}</h1>
          <p>{bsMonthName(month)} · Generated {currentBsDate} BS</p>
        </div>
        {reportType === "fees" ? <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminMetricCard label="Total fee collected" value={formatMoney(report.collected, currency)} icon={Banknote} tone="success"/><AdminMetricCard label="Fee payments" value={report.feePaymentCount} icon={ReceiptText}/><AdminMetricCard label="Members who paid" value={report.paidMembers} icon={Users}/><AdminMetricCard label="New members" value={report.newMembers} icon={Users}/></div>
          <AdminCard><h2 className="text-lg font-black text-white">Daily membership fee collection — {bsMonthName(month)}</h2><p className="mt-1 text-xs text-slate-500">Dates use the Nepali calendar (BS). The current month stops at today's date.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr className="border-b border-slate-800"><th className="py-2">Nepali date (BS)</th><th>Day</th><th>Payments</th><th>Members</th><th className="text-right">Fee collected</th></tr></thead><tbody>{report.daily.map((day) => <tr key={day.date} className="border-b border-slate-800/60"><td className="py-2.5 text-white">{day.displayDate}</td><td>{day.label}</td><td>{day.payments}</td><td>{day.members}</td><td className="text-right font-semibold">{formatMoney(day.value, currency)}</td></tr>)}</tbody><tfoot><tr className="font-black text-white"><td className="pt-3" colSpan={2}>MONTH TOTAL</td><td className="pt-3">{report.feePaymentCount}</td><td className="pt-3">{report.paidMembers}</td><td className="pt-3 text-right">{formatMoney(report.collected, currency)}</td></tr></tfoot></table></div></AdminCard>
          <AdminCard><h2 className="text-lg font-black text-white">Daily collection chart</h2><div className="mt-5 flex h-48 items-end gap-1 border-b border-slate-700 pb-5">{report.daily.map((day) => <div key={day.label} className="flex h-full min-w-0 flex-1 items-end" title={`${day.displayDate} BS: ${formatMoney(day.value, currency)}`}><div className="w-full rounded-t bg-emerald-400/75" style={{height:`${Math.max(day.value ? 4 : 0,Math.abs(day.value)/dailyMax*100)}%`}}/></div>)}</div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>1</span><span>BS day of month</span><span>{report.daily.length}</span></div></AdminCard>
          <div className="grid gap-4 lg:grid-cols-2"><Breakdown title="Fees collected by plan" rows={report.planRows} currency={currency}/><Breakdown title="Fees collected by payment method" rows={report.paymentRows} currency={currency}/></div>
        </> : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminMetricCard label="Product sales" value={formatMoney(report.productRevenue,currency)} icon={ShoppingCart}/><AdminMetricCard label="Units sold" value={report.unitsSold} icon={Boxes}/><AdminMetricCard label="Estimated product profit" value={formatMoney(report.estimatedProductProfit,currency)} icon={Banknote} tone="success"/><AdminMetricCard label="Current stock at cost" value={formatMoney(report.currentStockCost,currency)} icon={Boxes}/></div>
          <AdminCard><h2 className="text-lg font-black text-white">Daily product sales and profit — {bsMonthName(month)}</h2><p className="mt-1 text-xs text-slate-500">Click a day with sales to open its product details. Dates use BS and the current month stops at today.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr className="border-b border-slate-800"><th className="py-2">Nepali date (BS)</th><th>Units</th><th>Sales</th><th>Estimated cost</th><th className="text-right">Estimated profit</th></tr></thead><tbody>{report.productDaily.map((day)=><tr key={day.date} onClick={() => { if (day.products.length) { setSelectedProductDate(day.date); setProductDetailPage(1); } }} className={`border-b border-slate-800/60 ${day.products.length ? "cursor-pointer hover:bg-slate-900/70" : ""}`}><td className="py-2.5 text-white"><span className="inline-flex items-center gap-2">{day.displayDate}{day.products.length ? <span className="text-xs text-amber-300">View products</span> : null}</span></td><td>{day.units}</td><td>{formatMoney(day.revenue,currency)}</td><td>{formatMoney(day.cost,currency)}</td><td className="text-right font-semibold">{formatMoney(day.profit,currency)}</td></tr>)}</tbody><tfoot><tr className="font-black text-white"><td className="pt-3">MONTH TOTAL</td><td className="pt-3">{report.unitsSold}</td><td className="pt-3">{formatMoney(report.productRevenue,currency)}</td><td className="pt-3">{formatMoney(report.productRevenue-report.estimatedProductProfit,currency)}</td><td className="pt-3 text-right">{formatMoney(report.estimatedProductProfit,currency)}</td></tr></tfoot></table></div></AdminCard>
          <AdminCard><h2 className="text-lg font-black text-white">Product-by-product detail</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr className="border-b border-slate-800"><th className="py-2">Product</th><th>Units</th><th>Sales</th><th>Estimated cost</th><th className="text-right">Estimated profit</th></tr></thead><tbody>{report.productRows.map((row)=><tr key={row.label} className="border-b border-slate-800/70"><td className="py-3 text-white">{row.label}</td><td>{row.count}</td><td>{formatMoney(row.value,currency)}</td><td>{formatMoney(row.cost,currency)}</td><td className="text-right">{formatMoney(row.value-row.cost,currency)}</td></tr>)}</tbody></table>{!report.productRows.length?<p className="py-4 text-sm text-slate-500">No products were sold this month.</p>:null}</div><p className="mt-4 text-xs text-slate-500">Estimated cost and profit use each product's current recorded cost price. For permanent historical accuracy, cost must be saved on each invoice item at sale time.</p></AdminCard>
          <div className="grid gap-4 sm:grid-cols-2"><AdminMetricCard label="Low-stock variants" value={report.lowStock} icon={Boxes} tone={report.lowStock?"warning":"success"}/><Breakdown title="Product sales ranking" rows={report.productRows} currency={currency}/></div>
        </>}
      </div>
      <AdminDialog
        open={Boolean(selectedProductDay)}
        title={selectedProductDay ? `Products sold on ${selectedProductDay.displayDate} BS` : "Products sold"}
        description={selectedProductDay ? `${selectedProductDay.products.length} product types · ${selectedProductDay.units} units sold` : undefined}
        onClose={() => setSelectedProductDate(null)}
        size="2xl"
        footer={selectedProductDay ? <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-400">Page {safeProductDetailPage} of {productDetailPageCount} · {selectedProductDay.products.length} products</span><div className="flex gap-2"><AdminButton variant="secondary" disabled={safeProductDetailPage <= 1} onClick={() => setProductDetailPage((page) => Math.max(1, page - 1))}>Previous</AdminButton><AdminButton variant="secondary" disabled={safeProductDetailPage >= productDetailPageCount} onClick={() => setProductDetailPage((page) => Math.min(productDetailPageCount, page + 1))}>Next</AdminButton></div></div> : undefined}
      >
        {selectedProductDay ? <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="text-xs text-slate-500">Units</div><b className="mt-1 block text-white">{selectedProductDay.units}</b></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="text-xs text-slate-500">Sales</div><b className="mt-1 block text-white">{formatMoney(selectedProductDay.revenue, currency)}</b></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="text-xs text-slate-500">Estimated cost</div><b className="mt-1 block text-white">{formatMoney(selectedProductDay.cost, currency)}</b></div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"><div className="text-xs text-slate-500">Estimated profit</div><b className="mt-1 block text-emerald-300">{formatMoney(selectedProductDay.profit, currency)}</b></div>
          </div>
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="px-3 py-3">Product</th><th>Quantity</th><th>Sales</th><th>Cost</th><th className="pr-3 text-right">Profit</th></tr></thead>
              <tbody>{pagedProductDetails.map((product) => <tr key={product.name} className="border-t border-slate-800"><td className="px-3 py-3 font-semibold text-white">{product.name}</td><td>{product.units}</td><td>{formatMoney(product.revenue, currency)}</td><td>{formatMoney(product.cost, currency)}</td><td className="pr-3 text-right font-semibold text-emerald-300">{formatMoney(product.profit, currency)}</td></tr>)}</tbody>
            </table>
          </div>
        </div> : null}
      </AdminDialog>
    </div>
  );
}
