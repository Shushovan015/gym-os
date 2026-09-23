// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { numericBillNumber, useNextBillNumber } from "./useNextBillNumber";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@src/Client/supabase", () => ({ supabase: { rpc } }));
let root: Root;
let host: HTMLDivElement;
let state: ReturnType<typeof useNextBillNumber>;
function Form({ open }: { open: boolean }) { state = useNextBillNumber(open); return <input value={state.value} onChange={(e) => state.setValue(e.target.value)} />; }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); rpc.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("read-only bill-number preview", () => {
  it("loads the next bill number from RPC and uses it directly", async () => {
    rpc.mockResolvedValue({ data: "1002", error: null });
    await act(async () => root.render(<Form open />));
    expect(host.querySelector("input")?.value).toBe("1002");
    expect(state.ready).toBe(true); expect(state.numberToSave).toBe("1002");
    expect(rpc).toHaveBeenCalledWith("next_bill_number");
  });
  it("refreshes after closing and reopening without using a stale response", async () => {
    let finish!: (value: unknown) => void;
    rpc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => root.render(<Form open />));
    await act(async () => root.render(<Form open={false} />));
    rpc.mockResolvedValue({ data: "1003", error: null });
    await act(async () => root.render(<Form open />));
    await act(async () => finish({ data: "1002", error: null }));
    expect(state.value).toBe("1003");
  });
  it("blocks saving on preview failure and allows retry", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } });
    await act(async () => root.render(<Form open />));
    expect(state.ready).toBe(false); expect(state.error).toBe("Database unavailable");
    rpc.mockResolvedValueOnce({ data: "1004", error: null });
    await act(async () => state.refresh());
    expect(state.value).toBe("1004"); expect(state.ready).toBe(true);
    await act(async () => state.setValue("-2")); expect(state.ready).toBe(false);
  });
  it.each(["", "0", "-1", "1.5", "1e3", "GYM-1002", "9007199254740992"])("rejects invalid new number %s", (value) => expect(numericBillNumber(value)).toBeNull());
  it("normalizes numeric edits without losing precision", () => {
    expect(numericBillNumber(" 001002 ")).toBe("1002");
    expect(numericBillNumber("9007199254740991")).toBe("9007199254740991");
  });
});
