import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunEvent } from "@/lib/types";

/** Minimal EventSource stand-in: server-sent messages are MessageEvents, a dropped connection is a bare Event. */
class FakeEventSource extends EventTarget {
  static last: FakeEventSource | null = null;
  closed = false;
  constructor(public readonly url: string) {
    super();
    FakeEventSource.last = this;
  }
  set onerror(handler: (e: Event) => void) {
    this.addEventListener("error", handler);
  }
  close() {
    this.closed = true;
  }
}

async function loadApi() {
  vi.resetModules();
  vi.stubGlobal("EventSource", FakeEventSource);
  return await import("@/lib/api");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function subscribe(api: Awaited<ReturnType<typeof loadApi>>) {
  const events: RunEvent[] = [];
  let fallbacks = 0;
  api.openRunStream(
    "run-1",
    (e) => events.push(e),
    () => {
      fallbacks += 1;
    },
  );
  const es = FakeEventSource.last as FakeEventSource;
  return { events, es, fallbacks: () => fallbacks };
}

describe("openRunStream", () => {
  it("treats a dropped connection as a transport error and hands over to the fallback, not as a pipeline error", async () => {
    const api = await loadApi();
    const { events, es, fallbacks } = subscribe(api);

    es.dispatchEvent(new MessageEvent("pm", { data: JSON.stringify("PM 說") }));
    es.dispatchEvent(new Event("error")); // the browser's connection error carries no data

    expect(events).toEqual([{ stage: "pm", data: "PM 說" }]);
    expect(fallbacks()).toBe(1);
    expect(es.closed).toBe(true);
  });

  it("still delivers the backend's own error event and does not start the fallback", async () => {
    const api = await loadApi();
    const { events, es, fallbacks } = subscribe(api);

    es.dispatchEvent(new MessageEvent("error", { data: JSON.stringify("執行失敗，請查看伺服器日誌") }));

    expect(events).toEqual([{ stage: "error", data: "執行失敗，請查看伺服器日誌" }]);
    expect(fallbacks()).toBe(0);
    expect(es.closed).toBe(true);
  });

  it("closes after done and ignores the connection error the server's close produces", async () => {
    const api = await loadApi();
    const { events, es, fallbacks } = subscribe(api);

    es.dispatchEvent(new MessageEvent("done", { data: JSON.stringify({ decision_id: "d" }) }));
    es.dispatchEvent(new Event("error"));

    expect(events.map((e) => e.stage)).toEqual(["done"]);
    expect(fallbacks()).toBe(0);
    expect(es.closed).toBe(true);
  });
});
