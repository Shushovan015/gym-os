// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDialog, AdminDrawer, AdminBsDateInput } from "../components/admin/AdminUI";
import { useDebouncedValue } from "./useDebouncedValue";
import { useLatestRequest } from "./useLatestRequest";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.useRealTimers();
  document.body.removeAttribute("style"); document.documentElement.removeAttribute("style");
});

describe("search interactions", () => {
  it("updates the input immediately but waits 350ms after the last keystroke for results", async () => {
    vi.useFakeTimers();
    let type: (value: string) => void = () => undefined;
    function Search() {
      const [value, setValue] = useState(""); type = setValue;
      const debounced = useDebouncedValue(value);
      return <><input value={value} onChange={(e) => setValue(e.target.value)} /><output>{debounced}</output></>;
    }
    await act(async () => root.render(<Search />));
    const input = host.querySelector("input");
    await act(async () => type("a"));
    expect(input?.value).toBe("a");
    await act(async () => vi.advanceTimersByTime(300));
    await act(async () => type("alice"));
    await act(async () => vi.advanceTimersByTime(349));
    expect(host.querySelector("output")?.textContent).toBe("");
    await act(async () => vi.advanceTimersByTime(1));
    expect(host.querySelector("output")?.textContent).toBe("alice");
    expect(host.querySelector("input")).toBe(input);
  });
  it("invalidates previous requests on input change, replacement, and unmount", async () => {
    let begin: () => () => boolean = () => () => false;
    function Search({ query }: { query: string }) { begin = useLatestRequest(query); return null; }
    await act(async () => root.render(<Search query="a" />));
    const old = begin(); expect(old()).toBe(true);
    await act(async () => root.render(<Search query="ab" />));
    expect(old()).toBe(false);
    const second = begin(); const third = begin();
    expect(second()).toBe(false); expect(third()).toBe(true);
    await act(async () => root.render(null)); expect(third()).toBe(false);
  });
});

describe("shared popups", () => {
  it("portals out of route containers and keeps the page locked until the last popup closes", async () => {
    document.body.style.overflow = "auto";
    document.body.style.paddingRight = "7px";
    const draw = (parent: boolean, child: boolean) => <><AdminDrawer open={parent} title="Bill" onClose={() => undefined}><p>Details</p></AdminDrawer><AdminDialog open={child} title="Payment" onClose={() => undefined}>Content</AdminDialog></>;
    await act(async () => root.render(draw(true, true)));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => root.render(draw(true, false)));
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => root.render(draw(false, false)));
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.style.paddingRight).toBe("7px");
    expect(document.documentElement.style.overflow).toBe("");
  });
  it("Escape closes only the topmost popup", async () => {
    const outer = vi.fn(); const inner = vi.fn();
    await act(async () => root.render(<><AdminDrawer open title="Bill" onClose={outer}>Bill</AdminDrawer><AdminDialog open title="Send" onClose={inner}>Send?</AdminDialog></>));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(inner).toHaveBeenCalledOnce(); expect(outer).not.toHaveBeenCalled();
  });
  it("prioritizes the visible dialog over a drawer mounted later", async () => {
    const style = document.createElement("style");
    style.textContent = 'div[class*="z-[130]"] { z-index: 130; } div[class*="z-[120]"] { z-index: 120; }';
    document.head.append(style);
    const dialog = vi.fn(); const drawer = vi.fn();
    try {
      await act(async () => root.render(<><AdminDialog open title="Bill created" onClose={dialog}>Success</AdminDialog><AdminDrawer open title="Bill details" onClose={drawer}>Details</AdminDrawer></>));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(dialog).toHaveBeenCalledOnce(); expect(drawer).not.toHaveBeenCalled();
    } finally { style.remove(); }
  });
  it("opens a calendar outside its scrolling parent and releases its scroll lock", async () => {
    await act(async () => root.render(<AdminBsDateInput value="2026-09-21" onChange={() => undefined} />));
    await act(async () => (host.querySelector("button") as HTMLButtonElement).click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[aria-label="Nepali calendar"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[aria-label="Nepali calendar"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
