import { inventoryPriceToMinor } from "@src/features/billing/pricing";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Archive,
  Boxes,
  History,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
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
import {
  formatMoney,
  majorToMinor,
  minorToInput,
} from "@src/features/billing/currency";
import type {
  InventoryProduct,
  InventoryVariant,
  StockMovement,
  StockMovementType,
  Supplier,
} from "@src/features/inventory/types";
import { formatDateTime, friendlyAdminError } from "./adminUtils";

type ProductForm = {
  title: string;
  category: string;
  sku: string;
  brand: string;
  unit: string;
  barcode: string;
  wholesale: string;
  cost: string;
  price: string;
  threshold: string;
  description: string;
  image: string;
  notes: string;
  active: boolean;
  startingStock: string;
  supplierId: string;
};
type VariantForm = {
  name: string;
  sku: string;
  barcode: string;
  size: string;
  color: string;
  flavour: string;
  packageSize: string;
  wholesale: string;
  cost: string;
  price: string;
  threshold: string;
};
const emptyProduct: ProductForm = {
  title: "",
  category: "",
  sku: "",
  brand: "",
  unit: "piece",
  barcode: "",
  wholesale: "0",
  cost: "0",
  price: "0",
  threshold: "3",
  description: "",
  image: "",
  notes: "",
  active: true,
  startingStock: "0",
  supplierId: "",
};
const emptyVariant: VariantForm = {
  name: "Default",
  sku: "",
  barcode: "",
  size: "",
  color: "",
  flavour: "",
  packageSize: "",
  wholesale: "",
  cost: "",
  price: "",
  threshold: "",
};
const movementOptions = [
  { value: "purchase", label: "Received new stock" },
  { value: "manual_decrease", label: "Sold or lost outside this system" },
  { value: "damaged", label: "Damaged" },
  { value: "return", label: "Returned to the gym" },
  { value: "manual_increase", label: "Other increase" },
  { value: "correction", label: "Stock count correction" },
] satisfies Array<{ value: StockMovementType; label: string }>;

function stockTone(stock: number, threshold: number) {
  return stock <= 0
    ? ("danger" as const)
    : stock <= threshold
      ? ("warning" as const)
      : ("success" as const);
}
function stockLabel(stock: number, threshold: number) {
  return stock <= 0
    ? "Out of stock"
    : stock <= threshold
      ? "Low stock"
      : "In stock";
}

export default function AdminInventory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [inventoryCategories, setInventoryCategories] = useState<string[]>([]);
  const [inventorySummary, setInventorySummary] = useState({ units: 0, low: 0, out: 0, cost: 0, retail: 0 });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState(() => { const value = searchParams.get("stock"); return value === "low" || value === "out" ? value : "all"; });
  const [activeFilter, setActiveFilter] = useState("active");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [productOpen, setProductOpen] = useState(searchParams.get("action") === "add-product");
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [variantProduct, setVariantProduct] = useState<InventoryProduct | null>(
    null,
  );
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariant);
  const [editingVariant, setEditingVariant] = useState<InventoryVariant | null>(
    null,
  );
  const [stockVariant, setStockVariant] = useState<InventoryVariant | null>(
    null,
  );
  const [movementType, setMovementType] =
    useState<StockMovementType>("purchase");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [historyVariant, setHistoryVariant] = useState<InventoryVariant | null>(
    null,
  );
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [stockMode, setStockMode] = useState<"add" | "change">("add");
  const [stockBuyingPrice, setStockBuyingPrice] = useState("");
  const [stockSupplierId, setStockSupplierId] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    const [paged, s] = await Promise.all([
      supabase.rpc("admin_inventory_page", { p_search: search.trim(), p_category: category, p_stock: stockFilter, p_active: activeFilter, p_offset: (page - 1) * pageSize, p_limit: pageSize }),
      supabase.from("inventory_suppliers").select("*").order("name"),
    ]);
    const issue = paged.error ?? s.error;
    if (issue) setMessage(issue.message);
    const data = paged.data as { total?: number; rows?: Array<{ product: InventoryProduct; variant: InventoryVariant }>; categories?: string[]; summary?: typeof inventorySummary } | null;
    setProducts((data?.rows ?? []).map((row) => row.product));
    setVariants((data?.rows ?? []).map((row) => row.variant));
    setInventoryCount(data?.total ?? 0);
    setInventoryCategories(data?.categories ?? []);
    if (data?.summary) setInventorySummary(data.summary);
    setSuppliers((s.data ?? []) as Supplier[]);
    setLoading(false);
  };

  const setProductsActive = async (productIds: number[], active: boolean) => {
    const ids = Array.from(new Set(productIds));
    if (!ids.length) return;
    const verb = active ? "restore" : "delete";
    if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${ids.length} selected inventory product${ids.length === 1 ? "" : "s"}? Existing bill history will be kept.`)) return;
    const productResult = await supabase.from("shop_items").update({ is_active: active, deactivated_at: active ? null : new Date().toISOString() }).in("id", ids);
    if (productResult.error) { setMessage(productResult.error.message); return; }
    const variantResult = await supabase.from("inventory_product_variants").update({ is_active: active }).in("product_id", ids);
    if (variantResult.error) { setMessage(variantResult.error.message); return; }
    setSelectedProductIds(new Set());
    setMessage(`${ids.length} inventory product${ids.length === 1 ? "" : "s"} ${active ? "restored" : "deleted"}.`);
    await load();
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [activeFilter, category, page, search, stockFilter]);

  const rows = useMemo(
    () =>
      variants
        .map((variant) => ({
          variant,
          product: products.find((p) => p.id === variant.product_id),
        }))
        .filter(
          (
            row,
          ): row is { variant: InventoryVariant; product: InventoryProduct } =>
            Boolean(row.product),
        ),
    [products, variants],
  );
  const pageRows = rows;
  const pages = Math.max(1, Math.ceil(inventoryCount / pageSize));
  const totalUnits = inventorySummary.units;
  const low = inventorySummary.low;
  const out = inventorySummary.out;
  const costValue = inventorySummary.cost;
  const retailValue = inventorySummary.retail;

  const openProduct = (product?: InventoryProduct) => {
    setEditing(product ?? null);
    setProductForm(
      product
        ? {
            title: product.title,
            category: product.category,
            sku: product.sku ?? "",
            brand: product.brand ?? "",
            unit: product.unit,
            barcode: product.barcode ?? "",
            wholesale: minorToInput(product.wholesale_price_minor),
            cost: minorToInput(product.cost_price_minor),
            price: minorToInput(product.selling_price_minor),
            threshold: String(product.low_stock_threshold),
            description: product.description ?? "",
            image: product.image ?? "",
            notes: product.inventory_notes ?? "",
            active: product.is_active,
            startingStock: "0",
            supplierId: product.supplier_id ? String(product.supplier_id) : "",
          }
        : emptyProduct,
    );
    setProductOpen(true);
  };
  const saveProduct = async () => {
    const wholesale = inventoryPriceToMinor(productForm.wholesale);
    const cost = inventoryPriceToMinor(productForm.cost);
    const price = inventoryPriceToMinor(productForm.price);
    const threshold = Number(productForm.threshold);
    const startingStock = Number(productForm.startingStock);
    if (
      !productForm.title.trim() ||
      !productForm.category.trim() ||
      wholesale === null ||
      cost === null ||
      price === null ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      !Number.isFinite(startingStock) ||
      startingStock < 0
    ) {
      setMessage(
        "Enter a name, category, valid prices, and a non-negative threshold.",
      );
      return;
    }
    const payload = {
      title: productForm.title.trim(),
      category: productForm.category.trim(),
      sku:
        productForm.sku.trim() ||
        `${
          productForm.title
            .replace(/[^a-z0-9]/gi, "")
            .slice(0, 6)
            .toUpperCase() || "ITEM"
        }-${String(Date.now()).slice(-6)}`,
      brand: productForm.brand.trim() || null,
      unit: productForm.unit.trim() || "piece",
      barcode: productForm.barcode.trim() || null,
      wholesale_price_minor: wholesale,
      cost_price_minor: cost,
      selling_price_minor: price,
      low_stock_threshold: threshold,
      description: productForm.description.trim(),
      image: productForm.image.trim(),
      inventory_notes: productForm.notes.trim() || null,
      inventory_enabled: true,
      is_active: productForm.active,
      deactivated_at: productForm.active ? null : new Date().toISOString(),
      supplier_id: productForm.supplierId
        ? Number(productForm.supplierId)
        : null,
      price: formatMoney(price),
      badge: "",
      inquire_link: "/contact",
      sort_order: 0,
      is_featured: false,
    };
    const result = editing
      ? await supabase
          .from("shop_items")
          .update(payload)
          .eq("id", editing.id)
          .select("id")
          .single()
      : await supabase.from("shop_items").insert(payload).select("id").single();
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (!editing) {
      const productId = Number(result.data.id);
      const sku = payload.sku;
      const variant = await supabase
        .from("inventory_product_variants")
        .insert({
          product_id: productId,
          name: "Default",
          sku,
          current_quantity: 0,
          is_active: true,
        })
        .select("id")
        .single();
      if (variant.error) {
        setMessage(
          `Product saved, but default variant failed: ${variant.error.message}`,
        );
        await load();
        return;
      }
      const openingQuantity = startingStock;
      if (openingQuantity > 0) {
        const opening = await supabase.rpc("record_stock_movement", {
          p_variant_id: Number(variant.data.id),
          p_movement_type: "opening",
          p_quantity_delta: openingQuantity,
          p_reference: "Product setup",
          p_notes: null,
          p_supplier_id: productForm.supplierId
            ? Number(productForm.supplierId)
            : null,
        });
        if (opening.error)
          setMessage(
            `Product added, but starting stock could not be saved: ${opening.error.message}`,
          );
      }
    }
    setProductOpen(false);
    setMessage(
      editing
        ? `${productForm.title} updated.`
        : `${productForm.title} added successfully.`,
    );
    await load();
  };
  const saveVariant = async () => {
    if (!variantProduct || !variantForm.name.trim()) {
      setMessage(
        "Give this option a name, such as Chocolate 1kg or Black / Large.",
      );
      return;
    }
    const wholesale = variantForm.wholesale ? inventoryPriceToMinor(variantForm.wholesale) : null;
    const cost = variantForm.cost ? inventoryPriceToMinor(variantForm.cost) : null;
    const price = variantForm.price ? inventoryPriceToMinor(variantForm.price) : null;
    const threshold =
      variantForm.threshold === "" ? null : Number(variantForm.threshold);
    if (
      (wholesale === null && variantForm.wholesale) ||
      (cost === null && variantForm.cost) ||
      (price === null && variantForm.price) ||
      (threshold !== null && (!Number.isFinite(threshold) || threshold < 0))
    ) {
      setMessage("Variant prices and threshold are invalid.");
      return;
    }
    const payload = {
      product_id: variantProduct.id,
      name: variantForm.name.trim(),
      sku:
        variantForm.sku.trim() ||
        `${(variantProduct.sku || variantProduct.title)
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 6)
          .toUpperCase()}-${String(Date.now()).slice(-6)}`,
      barcode: variantForm.barcode.trim() || null,
      size: variantForm.size.trim() || null,
      color: variantForm.color.trim() || null,
      flavour: variantForm.flavour.trim() || null,
      package_size: variantForm.packageSize.trim() || null,
      wholesale_price_minor: wholesale,
      cost_price_minor: cost,
      selling_price_minor: price,
      low_stock_threshold: threshold,
      is_active: true,
    };
    const { error } = editingVariant
      ? await supabase
          .from("inventory_product_variants")
          .update(payload)
          .eq("id", editingVariant.id)
      : await supabase
          .from("inventory_product_variants")
          .insert({ ...payload, current_quantity: 0 });
    if (error) {
      setMessage(error.message);
      return;
    }
    setVariantProduct(null);
    setEditingVariant(null);
    setVariantForm(emptyVariant);
    setMessage(editingVariant ? "Variant updated." : "Variant created.");
    await load();
  };
  const recordStock = async () => {
    if (!stockVariant) return;
    if (stockMode === "add" && stockBuyingPrice && inventoryPriceToMinor(stockBuyingPrice) === null) { setMessage("Enter a valid non-negative cost price with at most two decimal places."); return; }
    const raw = Number(movementQuantity);
    if (!Number.isFinite(raw) || raw <= 0) {
      setMessage("Quantity must be greater than zero.");
      return;
    }
    const negative =
      movementType === "manual_decrease" || movementType === "damaged";
    const delta = negative ? -raw : raw;
    const { error } = await supabase.rpc("record_stock_movement", {
      p_variant_id: stockVariant.id,
      p_movement_type: stockMode === "add" ? "purchase" : movementType,
      p_quantity_delta: delta,
      p_reference: null,
      p_notes: movementNotes.trim() || null,
      p_supplier_id: stockSupplierId ? Number(stockSupplierId) : null,
    });
    if (error) {
      setMessage(
        error.message.includes("Insufficient stock")
          ? `Only ${stockVariant.current_quantity} items are available. Enter a smaller quantity.`
          : friendlyAdminError(error.message),
      );
      return;
    }
    if (stockMode === "add" && stockBuyingPrice) {
      const buyingPrice = majorToMinor(stockBuyingPrice);
      if (buyingPrice !== null)
        await supabase
          .from("inventory_product_variants")
          .update({ cost_price_minor: buyingPrice })
          .eq("id", stockVariant.id);
    }
    const newStock =
      stockVariant.current_quantity + (stockMode === "add" ? raw : delta);
    setStockVariant(null);
    setMovementQuantity("");
    setMovementNotes("");
    setStockBuyingPrice("");
    setStockSupplierId("");
    setMessage(
      `${raw} ${raw === 1 ? "item" : "items"} ${stockMode === "add" ? "added" : "recorded"}. New stock: ${newStock}.`,
    );
    await load();
  };
  const uploadProductPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file such as JPG, PNG or WebP.");
      return;
    }
    setUploadingPhoto(true);
    const extension = file.name.split(".").pop() || "jpg";
    const path = `products/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("gym-media")
      .upload(path, file, { upsert: false });
    if (error) setMessage(`Photo upload failed. ${error.message}`);
    else
      setProductForm((form) => ({
        ...form,
        image: supabase.storage.from("gym-media").getPublicUrl(path).data
          .publicUrl,
      }));
    setUploadingPhoto(false);
  };
  const showHistory = async (variant: InventoryVariant) => {
    setHistoryVariant(variant);
    setMovements([]);
    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("variant_id", variant.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setMessage(error.message);
    else setMovements((data ?? []) as StockMovement[]);
  };
  const saveSupplier = async () => {
    if (!supplierName.trim()) return;
    const { error } = await supabase.from("inventory_suppliers").insert({
      name: supplierName.trim(),
      phone: supplierPhone.trim() || null,
    });
    if (error) setMessage(error.message);
    else {
      setSupplierOpen(false);
      setSupplierName("");
      setSupplierPhone("");
      setMessage("Supplier created.");
      await load();
    }
  };

  if (loading) return <AdminLoading label="Loading inventory" />;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Stock operations"
        title="Inventory"
        description="Products, variants, stock levels and an immutable movement history."
        actions={
          <div className="flex gap-2">
            <AdminButton
              variant="secondary"
              onClick={() => setSupplierOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Supplier
            </AdminButton>
            <AdminButton variant="primary" onClick={() => openProduct()}>
              <PackagePlus className="h-4 w-4" />
              Add product
            </AdminButton>
          </div>
        }
      />
      {message ? (
        <AdminNotice
          tone={
            message.toLowerCase().includes("invalid") ||
            message.toLowerCase().includes("failed") ||
            message.toLowerCase().includes("insufficient")
              ? "danger"
              : "success"
          }
        >
          {message}
        </AdminNotice>
      ) : null}
      {searchParams.get("action") === "add-stock" ? <AdminNotice tone="accent" title="Add stock to a product">Find the product below, then choose <b>Add Stock</b>. Current quantities are shown beside each product.</AdminNotice> : null}
      {low + out > 0 ? (
        <AdminNotice
          tone="warning"
          title={`${low + out} ${low + out === 1 ? "product needs" : "products need"} restocking`}
        >
          <button
            className="font-bold underline"
            onClick={() => setStockFilter("low")}
          >
            View products that are running low
          </button>
        </AdminNotice>
      ) : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <AdminMetricCard
          label="Active products"
          value={String(products.filter((p) => p.is_active).length)}
          icon={Boxes}
        />
        <AdminMetricCard
          label="Units in stock"
          value={String(totalUnits)}
          icon={Archive}
        />
        <AdminMetricCard
          label="Low stock"
          value={String(low)}
          icon={TriangleAlert}
        />
        <AdminMetricCard
          label="Out of stock"
          value={String(out)}
          icon={TriangleAlert}
        />
        <AdminMetricCard
          label="Cost value"
          value={formatMoney(costValue)}
          icon={Boxes}
        />
        <AdminMetricCard
          label="Retail value"
          value={formatMoney(retailValue)}
          icon={Boxes}
        />
      </div>
      <AdminCard>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <AdminInput
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search products or SKU"
            />
          </div>
          <AdminSelect
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All categories" },
              ...inventoryCategories.map(
                (value) => ({ value, label: value }),
              ),
            ]}
          />
          <AdminSelect
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All stock" },
              { value: "in", label: "In stock" },
              { value: "low", label: "Low stock" },
              { value: "out", label: "Out of stock" },
            ]}
          />
          <AdminSelect
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "all", label: "All statuses" },
            ]}
          />
        </div>
      </AdminCard>
      {selectedProductIds.size > 0 ? (
        <AdminCard className="flex flex-col gap-3 border-amber-400/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold text-white">{selectedProductIds.size} product{selectedProductIds.size === 1 ? "" : "s"} selected</div>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="danger" onClick={() => setProductsActive(Array.from(selectedProductIds), false)}><Trash2 className="h-4 w-4" />Delete selected</AdminButton>
            <AdminButton variant="secondary" onClick={() => setProductsActive(Array.from(selectedProductIds), true)}><Archive className="h-4 w-4" />Restore selected</AdminButton>
            <AdminButton variant="ghost" onClick={() => setSelectedProductIds(new Set())}>Clear selection</AdminButton>
          </div>
        </AdminCard>
      ) : null}
      {pageRows.length === 0 ? (
        <AdminEmptyState
          title={
            products.length === 0
              ? "No products yet"
              : `No products found${search ? ` for “${search}”` : ""}`
          }
          description={
            products.length === 0
              ? "Add your first product to start tracking stock."
              : "Try a different product name or filter."
          }
          action={
            products.length === 0 ? (
              <AdminButton variant="primary" onClick={() => openProduct()}>
                <PackagePlus className="h-4 w-4" />
                Add Product
              </AdminButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {pageRows.map(({ product, variant }) => {
              const threshold =
                variant.low_stock_threshold ?? product.low_stock_threshold;
              return (
                <AdminCard key={variant.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" aria-label={`Select ${product.title}`} checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} className="mt-1 h-4 w-4 accent-amber-300" />
                      <div>
                      <h3 className="font-black text-white">{product.title}</h3>
                      <p className="text-xs text-slate-500">
                        {variant.name !== "Default"
                          ? variant.name
                          : product.category}
                      </p>
                      </div>
                    </div>
                    <AdminBadge
                      tone={stockTone(variant.current_quantity, threshold)}
                    >
                      {stockLabel(variant.current_quantity, threshold)}
                    </AdminBadge>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-black text-white">
                        {variant.current_quantity <= threshold &&
                        variant.current_quantity > 0
                          ? `Only ${variant.current_quantity} left`
                          : variant.current_quantity <= 0
                            ? "0 available"
                            : `${variant.current_quantity} in stock`}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">Cost: {formatMoney(variant.cost_price_minor ?? product.cost_price_minor)}</div>
                      <div className="mt-1 text-sm text-slate-400">Wholesale: {formatMoney(variant.wholesale_price_minor ?? product.wholesale_price_minor)}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Selling: {formatMoney(
                          variant.selling_price_minor ??
                            product.selling_price_minor,
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <AdminButton
                      variant="primary"
                      onClick={() => {
                        setStockMode("add");
                        setMovementType("purchase");
                        setStockVariant(variant);
                      }}
                    >
                      Add Stock
                    </AdminButton>
                    <AdminButton
                      variant="secondary"
                      disabled={variant.current_quantity <= 0}
                      onClick={() => navigate("/admin/billing?mode=shop")}
                    >
                      Sell
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => openProduct(product)}
                    >
                      Edit
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => void showHistory(variant)}
                    >
                      History
                    </AdminButton>
                    <AdminButton variant="danger" onClick={() => setProductsActive([product.id], product.is_active === false)}>
                      {product.is_active === false ? "Restore" : "Delete"}
                    </AdminButton>
                  </div>
                </AdminCard>
              );
            })}
          </div>
          <AdminTableShell>
            <AdminTableScroll>
              <table className="hidden min-w-full text-sm md:table">
                <thead className="bg-slate-900 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all inventory products on this page"
                        checked={pageRows.length > 0 && pageRows.every(({ product }) => selectedProductIds.has(product.id))}
                        onChange={(event) => setSelectedProductIds((current) => {
                          const next = new Set(current);
                          pageRows.forEach(({ product }) => event.target.checked ? next.add(product.id) : next.delete(product.id));
                          return next;
                        })}
                        className="h-4 w-4 accent-amber-300"
                      />
                    </th>
                    {[
                      "Product",
                      "Category",
                      "Stock",
                      "Cost price",
                      "Wholesale price",
                      "Selling price",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pageRows.map(({ product, variant }) => {
                    const threshold =
                      variant.low_stock_threshold ??
                      product.low_stock_threshold;
                    return (
                      <tr key={variant.id} className="bg-slate-950/60">
                        <td className="px-4 py-4"><input type="checkbox" aria-label={`Select ${product.title}`} checked={selectedProductIds.has(product.id)} onChange={() => toggleProductSelection(product.id)} className="h-4 w-4 accent-amber-300" /></td>
                        <td className="px-4 py-4">
                          <button
                            className="font-bold text-white hover:text-amber-200"
                            onClick={() => openProduct(product)}
                          >
                            {product.title}
                          </button>
                          <div className="text-xs text-slate-500">
                            {product.brand || product.unit}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {product.category}
                          <div className="text-xs text-slate-500">
                            {variant.name !== "Default" ? variant.name : ""}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <b className="text-white">
                            {variant.current_quantity}
                          </b>
                          <div className="text-xs text-slate-500">
                            {variant.current_quantity <= threshold
                              ? `${variant.current_quantity} remaining`
                              : "Available"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-300">{formatMoney(variant.cost_price_minor ?? product.cost_price_minor)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatMoney(variant.wholesale_price_minor ?? product.wholesale_price_minor)}</td>
                        <td className="px-4 py-4 text-slate-300">
                          {formatMoney(
                            variant.selling_price_minor ??
                              product.selling_price_minor,
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <AdminBadge
                            tone={stockTone(
                              variant.current_quantity,
                              threshold,
                            )}
                          >
                            {stockLabel(variant.current_quantity, threshold)}
                          </AdminBadge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <AdminButton
                              variant="primary"
                              onClick={() => {
                                setStockMode("add");
                                setMovementType("purchase");
                                setStockVariant(variant);
                              }}
                            >
                              Add Stock
                            </AdminButton>
                            <AdminButton
                              variant="secondary"
                              disabled={variant.current_quantity <= 0}
                              onClick={() =>
                                navigate("/admin/billing?mode=shop")
                              }
                            >
                              Sell
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => {
                                setStockMode("change");
                                setMovementType("manual_decrease");
                                setStockVariant(variant);
                              }}
                            >
                              Change Stock
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => openProduct(product)}
                            >
                              Edit
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => void showHistory(variant)}
                              aria-label={`View stock history for ${product.title}`}
                            >
                              <History className="h-4 w-4" />
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => {
                                setEditingVariant(null);
                                setVariantProduct(product);
                                setVariantForm({
                                  ...emptyVariant,
                                  name: "",
                                  sku: "",
                                });
                              }}
                            >
                              Add option
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => {
                                setEditingVariant(variant);
                                setVariantProduct(product);
                                setVariantForm({
                                  name: variant.name,
                                  sku: variant.sku,
                                  barcode: variant.barcode ?? "",
                                  size: variant.size ?? "",
                                  color: variant.color ?? "",
                                  flavour: variant.flavour ?? "",
                                  packageSize: variant.package_size ?? "",
                                  wholesale: variant.wholesale_price_minor === null ? "" : minorToInput(variant.wholesale_price_minor),
                                  cost:
                                    variant.cost_price_minor === null
                                      ? ""
                                      : minorToInput(variant.cost_price_minor),
                                  price:
                                    variant.selling_price_minor === null
                                      ? ""
                                      : minorToInput(
                                          variant.selling_price_minor,
                                        ),
                                  threshold:
                                    variant.low_stock_threshold === null
                                      ? ""
                                      : String(variant.low_stock_threshold),
                                });
                              }}
                            >
                              Edit option
                            </AdminButton>
                            <AdminButton variant="danger" onClick={() => setProductsActive([product.id], product.is_active === false)}>
                              {product.is_active === false ? "Restore" : "Delete"}
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableScroll>
          </AdminTableShell>
        </>
      )}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{inventoryCount} variants</span>
        <div className="flex gap-2">
          <AdminButton
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous
          </AdminButton>
          <span className="px-2 py-2">
            {page} / {pages}
          </span>
          <AdminButton
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage((v) => v + 1)}
          >
            Next
          </AdminButton>
        </div>
      </div>

      <AdminDialog
        open={productOpen}
        size="2xl"
        title={editing ? `Edit ${editing.title}` : "Add Product"}
        description={
          editing
            ? "Update the information customers and staff see."
            : "Add the essentials now. You can change optional details later."
        }
        onClose={() => setProductOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AdminButton
              variant="secondary"
              onClick={() => setProductOpen(false)}
            >
              Cancel
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void saveProduct()}>
              {editing ? "Save changes" : "Add Product"}
            </AdminButton>
          </div>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-black text-white">Product</h3>
            <div className="mt-3 space-y-4">
              <AdminField label="Product name *">
                <AdminInput
                  autoFocus
                  placeholder="Example: Whey Protein"
                  value={productForm.title}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </AdminField>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Category">
                  <AdminInput
                    list="inventory-categories"
                    placeholder="Example: Protein"
                    value={productForm.category}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        category: e.target.value,
                      }))
                    }
                  />
                  <datalist id="inventory-categories">
                    {Array.from(
                      new Set(inventoryCategories),
                    ).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </AdminField>
                <AdminField label="Brand" hint="Optional">
                  <AdminInput
                    placeholder="Example: Optimum Nutrition"
                    value={productForm.brand}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, brand: e.target.value }))
                    }
                  />
                </AdminField>
              </div>
            </div>
          </section>
          <section className="border-t border-slate-800 pt-5">
            <h3 className="text-sm font-black text-white">Price</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <AdminField
                label="Cost price"
                hint="How much the gym paid for one item."
              >
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.cost}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, cost: e.target.value }))
                  }
                />
              </AdminField>
              <AdminField label="Wholesale price *" hint="Price for wholesale customers."><AdminInput type="number" min="0" step="0.01" value={productForm.wholesale} onChange={(e) => setProductForm((f) => ({ ...f, wholesale: e.target.value }))} /></AdminField>
              <AdminField
                label="Selling price *"
                hint="What the customer pays."
              >
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </AdminField>
            </div>
          </section>
          <section className="border-t border-slate-800 pt-5">
            <h3 className="text-sm font-black text-white">Stock</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {!editing ? (
                <AdminField label="How many do you currently have?">
                  <AdminInput
                    type="number"
                    min="0"
                    step="0.001"
                    value={productForm.startingStock}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        startingStock: e.target.value,
                      }))
                    }
                  />
                </AdminField>
              ) : null}
              <AdminField
                label="Low stock warning"
                hint="We'll alert you when stock reaches this amount."
              >
                <AdminInput
                  type="number"
                  min="0"
                  step="0.001"
                  value={productForm.threshold}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, threshold: e.target.value }))
                  }
                />
              </AdminField>
            </div>
          </section>
          <details className="rounded-lg border border-slate-800 bg-slate-900/50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-200">
              More options
            </summary>
            <div className="grid gap-4 border-t border-slate-800 p-4 sm:grid-cols-2">
              <AdminField
                label="Product code (SKU)"
                hint="Generated automatically if left blank."
              >
                <AdminInput
                  value={productForm.sku}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      sku: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Barcode">
                <AdminInput
                  value={productForm.barcode}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, barcode: e.target.value }))
                  }
                />
              </AdminField>
              <AdminField label="Unit">
                <AdminInput
                  value={productForm.unit}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, unit: e.target.value }))
                  }
                />
              </AdminField>
              <AdminField label="Supplier">
                <AdminSelect
                  value={productForm.supplierId}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      supplierId: e.target.value,
                    }))
                  }
                  options={[
                    { value: "", label: "No supplier" },
                    ...suppliers.map((supplier) => ({
                      value: String(supplier.id),
                      label: supplier.name,
                    })),
                  ]}
                />
              </AdminField>
              <AdminField label="Product photo">
                <div className="space-y-2">
                  <AdminInput
                    type="file"
                    accept="image/*"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadProductPhoto(file);
                    }}
                  />
                  {productForm.image ? (
                    <img
                      src={productForm.image}
                      alt="Product preview"
                      className="h-28 w-28 rounded-lg object-cover"
                    />
                  ) : null}
                </div>
              </AdminField>
              <AdminField label="Public image URL" hint="Optional fallback">
                <AdminInput
                  value={productForm.image}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, image: e.target.value }))
                  }
                />
              </AdminField>
              <AdminField label="Description">
                <AdminTextarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Staff note">
                <AdminTextarea
                  rows={3}
                  value={productForm.notes}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </AdminField>
              <AdminField label="Availability">
                <AdminSelect
                  value={String(productForm.active)}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      active: e.target.value === "true",
                    }))
                  }
                  options={[
                    { value: "true", label: "Active — available to sell" },
                    { value: "false", label: "Inactive — hidden from sale" },
                  ]}
                />
              </AdminField>
            </div>
          </details>
        </div>
      </AdminDialog>
      <AdminDialog
        open={Boolean(variantProduct)}
        title={`${editingVariant ? "Edit" : "Add"} Product Option${variantProduct ? ` — ${variantProduct.title}` : ""}`}
        description="Use options for different sizes, flavours, colours or package sizes. Product codes are generated automatically."
        onClose={() => {
          setVariantProduct(null);
          setEditingVariant(null);
        }}
        footer={
          <AdminButton variant="primary" onClick={() => void saveVariant()}>
            {editingVariant ? "Save Option" : "Add Option"}
          </AdminButton>
        }
      >
        <div className="space-y-4">
          <AdminField
            label="Option name *"
            hint="Example: Chocolate 1kg or Black / Large"
          >
            <AdminInput
              autoFocus
              value={variantForm.name}
              onChange={(e) =>
                setVariantForm((form) => ({ ...form, name: e.target.value }))
              }
            />
          </AdminField>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Flavour">
              <AdminInput
                placeholder="Chocolate"
                value={variantForm.flavour}
                onChange={(e) =>
                  setVariantForm((form) => ({
                    ...form,
                    flavour: e.target.value,
                  }))
                }
              />
            </AdminField>
            <AdminField label="Package size">
              <AdminInput
                placeholder="1kg"
                value={variantForm.packageSize}
                onChange={(e) =>
                  setVariantForm((form) => ({
                    ...form,
                    packageSize: e.target.value,
                  }))
                }
              />
            </AdminField>
            <AdminField label="Size">
              <AdminInput
                placeholder="M, L, XL"
                value={variantForm.size}
                onChange={(e) =>
                  setVariantForm((form) => ({ ...form, size: e.target.value }))
                }
              />
            </AdminField>
            <AdminField label="Colour">
              <AdminInput
                placeholder="Black"
                value={variantForm.color}
                onChange={(e) =>
                  setVariantForm((form) => ({ ...form, color: e.target.value }))
                }
              />
            </AdminField>
            <AdminField label="Wholesale price" hint="Leave blank to use the product wholesale price."><AdminInput type="number" min="0" step="0.01" value={variantForm.wholesale} onChange={(e) => setVariantForm((f) => ({ ...f, wholesale: e.target.value }))} /></AdminField>
            <AdminField
              label="Selling price"
              hint="Leave blank to use the product price."
            >
              <AdminInput
                type="number"
                min="0"
                step="0.01"
                value={variantForm.price}
                onChange={(e) =>
                  setVariantForm((form) => ({ ...form, price: e.target.value }))
                }
              />
            </AdminField>
          </div>
          <details className="rounded-lg border border-slate-800">
            <summary className="cursor-pointer p-3 text-sm font-bold text-slate-300">
              More options
            </summary>
            <div className="grid gap-3 border-t border-slate-800 p-3 sm:grid-cols-2">
              <AdminField label="Product code">
                <AdminInput
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((form) => ({
                      ...form,
                      sku: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Barcode">
                <AdminInput
                  value={variantForm.barcode}
                  onChange={(e) =>
                    setVariantForm((form) => ({
                      ...form,
                      barcode: e.target.value,
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Cost price">
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.cost}
                  onChange={(e) =>
                    setVariantForm((form) => ({
                      ...form,
                      cost: e.target.value,
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Low stock warning">
                <AdminInput
                  type="number"
                  min="0"
                  value={variantForm.threshold}
                  onChange={(e) =>
                    setVariantForm((form) => ({
                      ...form,
                      threshold: e.target.value,
                    }))
                  }
                />
              </AdminField>
            </div>
          </details>
        </div>
      </AdminDialog>
      <AdminDialog
        open={Boolean(stockVariant)}
        title={`${stockMode === "add" ? "Add Stock" : "Change Stock"}${stockVariant ? ` — ${products.find((product) => product.id === stockVariant.product_id)?.title ?? stockVariant.name}` : ""}`}
        description={
          stockVariant
            ? `Available now: ${stockVariant.current_quantity}`
            : undefined
        }
        onClose={() => setStockVariant(null)}
        footer={
          <AdminButton variant="primary" onClick={() => void recordStock()}>
            {stockMode === "add"
              ? `Add ${movementQuantity || "Stock"}`
              : "Save Stock Change"}
          </AdminButton>
        }
      >
        <div className="space-y-4">
          {stockMode === "change" ? (
            <AdminField label="What happened?">
              <AdminSelect<StockMovementType>
                value={movementType}
                onChange={(e) =>
                  setMovementType(e.target.value as StockMovementType)
                }
                options={movementOptions}
              />
            </AdminField>
          ) : null}
          <AdminField
            label={
              stockMode === "add" ? "How many did you receive?" : "Quantity"
            }
          >
            <AdminInput
              type="number"
              min="0.001"
              step="0.001"
              value={movementQuantity}
              onChange={(e) => setMovementQuantity(e.target.value)}
            />
          </AdminField>
          {stockMode === "add" ? (
            <>
              <AdminField
                label="Buying price per item"
                hint="Optional — updates the latest buying price."
              >
                <AdminInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={stockBuyingPrice}
                  onChange={(e) => setStockBuyingPrice(e.target.value)}
                />
              </AdminField>
              <AdminField label="Supplier" hint="Optional">
                <AdminSelect
                  value={stockSupplierId}
                  onChange={(e) => setStockSupplierId(e.target.value)}
                  options={[
                    { value: "", label: "No supplier selected" },
                    ...suppliers.map((supplier) => ({
                      value: String(supplier.id),
                      label: supplier.name,
                    })),
                  ]}
                />
              </AdminField>
            </>
          ) : null}
          <AdminField label="Note" hint="Optional">
            <AdminTextarea
              value={movementNotes}
              onChange={(e) => setMovementNotes(e.target.value)}
            />
          </AdminField>
        </div>
      </AdminDialog>
      <AdminDrawer
        open={Boolean(historyVariant)}
        title="Stock history"
        description={historyVariant?.sku}
        onClose={() => setHistoryVariant(null)}
      >
        {movements.length === 0 ? (
          <AdminEmptyState title="No stock movements" />
        ) : (
          <div className="space-y-3">
            {movements.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-slate-800 p-3"
              >
                <div className="flex justify-between">
                  <b className="text-white">
                    {m.movement_type.replaceAll("_", " ")}
                  </b>
                  <span
                    className={
                      m.quantity_delta > 0 ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {m.quantity_delta > 0 ? "+" : ""}
                    {m.quantity_delta}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {m.previous_quantity} → {m.resulting_quantity} ·{" "}
                  {formatDateTime(m.created_at)}
                </div>
                {m.notes ? (
                  <p className="mt-2 text-sm text-slate-400">{m.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </AdminDrawer>
      <AdminDialog
        open={supplierOpen}
        title="Add supplier"
        onClose={() => setSupplierOpen(false)}
        footer={
          <AdminButton variant="primary" onClick={() => void saveSupplier()}>
            Save supplier
          </AdminButton>
        }
      >
        <div className="space-y-4">
          <AdminField label="Supplier name">
            <AdminInput
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </AdminField>
          <AdminField label="Phone">
            <AdminInput
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
            />
          </AdminField>
        </div>
      </AdminDialog>
    </div>
  );
}
