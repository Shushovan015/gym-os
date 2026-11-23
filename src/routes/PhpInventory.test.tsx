import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import AdminInventory from "../pages/admin/AdminInventory";

vi.hoisted(() => vi.stubEnv("VITE_GYM_BACKEND", "php"));
vi.mock("@src/Client/supabase", () => ({
  supabase: new Proxy({}, { get: () => { throw new Error("Unexpected legacy data access"); } }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads the stock page through PHP and posts an exact purchase quantity", async () => {
  let quantity = "2.750";
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.startsWith("/api/inventory/variants?")) {
      return json({ total: 1, categories: ["Equipment"], summary: { units: quantity, low: 0, out: 0, cost: 1200, retail: 2000 },
        rows: [{
          product: { id: 8, title: "Training bottle", category: "Equipment", is_active: 1, low_stock_threshold: "1",
            unit: "piece", selling_price_minor: 1000, wholesale_price_minor: 800, cost_price_minor: 500 },
          variant: { id: 9, product_id: 8, name: "Default", sku: "BOTTLE", current_quantity: quantity, is_active: 1, low_stock_threshold: null },
        }],
      });
    }
    if (url === "/api/inventory/suppliers") return json({ suppliers: [] });
    if (url === "/api/auth/session") return json({ csrfToken: "csrf" });
    if (url === "/api/inventory/stock") {
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("csrf");
      expect(JSON.parse(String(options?.body))).toMatchObject({ variantId: 9, type: "purchase", quantityDelta: "1.125" });
      quantity = "3.875";
      return json({ current_quantity: quantity });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<MemoryRouter><AdminInventory /></MemoryRouter>);
  fireEvent.click((await screen.findAllByRole("button", { name: "Add Stock" }))[0]);
  const dialog = screen.getByRole("dialog", { name: /Add Stock.*Training bottle/ });
  fireEvent.change(within(dialog).getByLabelText("How many did you receive?"), { target: { value: "1.125" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Add 1.125" }));
  expect(await screen.findByText("Stock recorded. New stock: 3.875.")).toBeInTheDocument();
});

it("stages a product photo and publishes its URL when the product is saved", async () => {
  const photoUrl = "/api/media/product?key=fixture.png";
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.startsWith("/api/inventory/variants?")) return json({
      total: 0, categories: [], rows: [], summary: { units: 0, low: 0, out: 0, cost: 0, retail: 0 },
    });
    if (url === "/api/inventory/suppliers") return json({ suppliers: [] });
    if (url === "/api/auth/session") return json({ csrfToken: "csrf" });
    if (url === "/api/inventory/media/upload") {
      expect((options?.body as FormData).get("photo")).toBeInstanceOf(File);
      expect(new Headers(options?.headers).get("X-CSRF-Token")).toBe("csrf");
      return json({ url: photoUrl });
    }
    if (url === "/api/inventory/catalog/save") {
      expect(JSON.parse(String(options?.body))).toMatchObject({
        entity: "product", fields: { title: "Fixture product", category: "Equipment", image: photoUrl },
      });
      return json({ id: 9 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/admin/inventory?action=add-product"]}><AdminInventory /></MemoryRouter>);
  const dialog = await screen.findByRole("dialog", { name: "Add Product" });
  fireEvent.change(within(dialog).getByPlaceholderText("Example: Whey Protein"), { target: { value: "Fixture product" } });
  fireEvent.change(within(dialog).getByPlaceholderText("Example: Protein"), { target: { value: "Equipment" } });
  fireEvent.change(within(dialog).getByLabelText("Product photo"), { target: { files: [new File(["fixture"], "photo.png", { type: "image/png" })] } });
  expect(await within(dialog).findByAltText("Product preview")).toHaveAttribute("src", photoUrl);
  fireEvent.click(within(dialog).getByRole("button", { name: "Add Product" }));
  expect(await screen.findByText("Product added.")).toBeInTheDocument();
});
