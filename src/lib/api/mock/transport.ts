import type { Transport } from "../transport";
import { DEFAULT_TIMING, MockServer, createSeedState, type MockState, type MockTiming } from "./server";

const STORAGE_KEY = "apx.mock-state.v2";

export interface MockTransportOptions {
  /** Simulated network latency range in ms. */
  latency?: [number, number];
  timing?: MockTiming;
  /** Persist state in sessionStorage so a reload keeps the demo's progress. */
  persist?: boolean;
  clock?: () => number;
  state?: MockState;
}

function load(): MockState | undefined {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as MockState;
    return parsed.version === 2 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function save(state: MockState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — the demo keeps working in memory */
  }
}

export function resetMockState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function createMockTransport(opts: MockTransportOptions = {}): Transport & { server: MockServer } {
  const { latency = [120, 380], timing = DEFAULT_TIMING, persist = false, clock = Date.now } = opts;
  const server = new MockServer(opts.state ?? (persist ? load() : undefined) ?? createSeedState(clock()), timing, clock);

  return {
    server,
    async request(req) {
      const [min, max] = latency;
      if (max > 0) await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
      if (req.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const res = await server.handle(req);
      if (persist) save(server.state);
      return res;
    },
  };
}
