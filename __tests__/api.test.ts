import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { startApiServer } from "../src/api.js";
import type { LoopState, ApiHandlers } from "../src/api.js";
import type { ApiServer } from "../src/api.js";

function makeHandlers(overrides?: Partial<ApiHandlers>): ApiHandlers {
  const emptyState: LoopState = {
    currentState: "init",
    iteration: 0,
    phaseResults: {},
    startTime: "",
    errors: [],
  };
  return {
    getState: () => emptyState,
    startLoop: async () => {},
    stopLoop: async () => {},
    triggerIteration: async () => {},
    ...overrides,
  };
}

describe("startApiServer", () => {
  test("GET /state returns current state", async () => {
    const state: LoopState = {
      currentState: "init",
      iteration: 0,
      phaseResults: {},
      startTime: "2026-01-01T00:00:00.000Z",
      errors: [],
    };
    const server = startApiServer(0, makeHandlers({ getState: () => state }));
    try {
      const resp = await fetch(`http://localhost:${server.port}/state`);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.currentState).toBe("init");
      expect(body.iteration).toBe(0);
    } finally {
      server.stop();
    }
  });

  test("POST /start returns ok", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      const resp = await fetch(`http://localhost:${server.port}/start`, {
        method: "POST",
      });
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.status).toBe("ok");
    } finally {
      server.stop();
    }
  });

  test("POST /stop returns ok", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      const resp = await fetch(`http://localhost:${server.port}/stop`, {
        method: "POST",
      });
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.status).toBe("ok");
    } finally {
      server.stop();
    }
  });

  test("POST /trigger returns ok", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      const resp = await fetch(`http://localhost:${server.port}/trigger`, {
        method: "POST",
      });
      expect(resp.status).toBe(200);
      const body = await resp.json();
      expect(body.status).toBe("ok");
    } finally {
      server.stop();
    }
  });

  test("returns 404 for unknown routes", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      const resp = await fetch(`http://localhost:${server.port}/unknown`);
      expect(resp.status).toBe(404);
    } finally {
      server.stop();
    }
  });

  test("GET /state returns updated state after iteration changes", async () => {
    let currentState: LoopState = {
      currentState: "init",
      iteration: 0,
      phaseResults: {},
      startTime: "",
      errors: [],
    };
    const handlers = makeHandlers({
      getState: () => currentState,
      startLoop: async () => {
        currentState = { ...currentState, currentState: "run", iteration: 1 };
      },
    });
    const server = startApiServer(0, handlers);
    try {
      await fetch(`http://localhost:${server.port}/start`, { method: "POST" });
      const resp = await fetch(`http://localhost:${server.port}/state`);
      const body = await resp.json();
      expect(body.currentState).toBe("run");
      expect(body.iteration).toBe(1);
    } finally {
      server.stop();
    }
  });

  test("calls startLoop handler on POST /start", async () => {
    let called = false;
    const server = startApiServer(
      0,
      makeHandlers({ startLoop: async () => { called = true; } }),
    );
    try {
      await fetch(`http://localhost:${server.port}/start`, { method: "POST" });
      expect(called).toBe(true);
    } finally {
      server.stop();
    }
  });

  test("calls triggerIteration handler on POST /trigger", async () => {
    let called = false;
    const server = startApiServer(
      0,
      makeHandlers({ triggerIteration: async () => { called = true; } }),
    );
    try {
      await fetch(`http://localhost:${server.port}/trigger`, {
        method: "POST",
      });
      expect(called).toBe(true);
    } finally {
      server.stop();
    }
  });

  test("calls stopLoop handler on POST /stop", async () => {
    let called = false;
    const server = startApiServer(
      0,
      makeHandlers({ stopLoop: async () => { called = true; } }),
    );
    try {
      await fetch(`http://localhost:${server.port}/stop`, { method: "POST" });
      expect(called).toBe(true);
    } finally {
      server.stop();
    }
  });

  test("broadcast sends to connected WebSocket clients", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      const ws = new WebSocket(`ws://localhost:${server.port}/`);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("WebSocket failed to open"));
      });

      const state: LoopState = {
        currentState: "run",
        iteration: 1,
        phaseResults: {},
        startTime: "",
        errors: [],
      };

      const msgPromise = new Promise<void>((resolve) => {
        ws.onmessage = (event) => {
          const parsed = JSON.parse(event.data as string);
          expect(parsed.type).toBe("state_change");
          expect(parsed.data.currentState).toBe("run");
          ws.close();
          resolve();
        };
      });

      server.broadcast(state);
      await msgPromise;
    } finally {
      server.stop();
    }
  });

  test("returns port number", async () => {
    const server = startApiServer(0, makeHandlers());
    try {
      expect(server.port).toBeGreaterThan(0);
    } finally {
      server.stop();
    }
  });

  test("stop() makes the server unreachable", async () => {
    const server = startApiServer(0, makeHandlers());
    const { port } = server;
    server.stop();
    let caught = false;
    try {
      await fetch(`http://localhost:${port}/state`);
    } catch {
      caught = true;
    }
    expect(caught).toBe(true);
  });
});
