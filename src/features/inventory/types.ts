export type StockMovementType = "opening" | "purchase" | "manual_increase" | "manual_decrease" | "damaged" | "return" | "correction";

export type InventoryProduct = {
  id: number; title: string; category: string; description: string; image: string; is_active: boolean;
  sku: string | null; brand: string | null; unit: string; barcode: string | null; supplier_id: number | null;
  inventory_enabled: boolean; cost_price_minor: number; selling_price_minor: number; wholesale_price_minor: number;
  low_stock_threshold: number; inventory_notes: string | null; deactivated_at: string | null;
};

export type InventoryVariant = {
  id: number; product_id: number; name: string; sku: string; barcode: string | null; size: string | null;
  color: string | null; flavour: string | null; package_size: string | null; cost_price_minor: number | null;
  selling_price_minor: number | null; wholesale_price_minor: number | null; current_quantity: number; low_stock_threshold: number | null;
  is_active: boolean; created_at: string; updated_at: string;
};

export type StockMovement = {
  id: number; variant_id: number; movement_type: string; quantity_delta: number;
  previous_quantity: number; resulting_quantity: number; reference: string | null;
  notes: string | null; created_at: string;
};

export type Supplier = { id: number; name: string; contact_person: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null; is_active: boolean };
