import type { LoopState } from './types.js';

export interface ApiServer {
  port: number;
  stop: () => void;
  /** Broadcast a state change to all connected WebSocket clients. */
  broadcast: (state: LoopState) => void;
}

export interface ApiHandlers {
  getState: () => LoopState;
  startLoop: () => Promise<void>;
  stopLoop: () => Promise<void>;
  triggerIteration: () => Promise<void>;
}

/**
 * Start an HTTP/WebSocket API server on the given port.
 *
 * HTTP Endpoints:
 * - GET /state  → returns current LoopState as JSON
 * - POST /start → starts loop iteration, returns { status: 'ok' }
 * - POST /stop  → stops loop iteration, returns { status: 'ok' }
 * - POST /trigger → triggers a single iteration, returns { status: 'ok' }
 *
 * WebSocket (ws://host:port/):
 * - Server broadcasts state change events as JSON messages
 * - Each message: { type: 'state_change', data: LoopState }
 *
 * Uses Bun.serve with built-in WebSocket support. Zero external deps.
 */
export function startApiServer(
  port: number,
  handlers: ApiHandlers,
): ApiServer {
  const clients = new Set<WebSocket>();

  const server = Bun.serve<undefined>({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === '/') {
        const upgraded = server.upgrade(req);
        if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 });
        return undefined;
      }

      // GET /state
      if (url.pathname === '/state' && req.method === 'GET') {
        return new Response(JSON.stringify(handlers.getState()), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /start
      if (url.pathname === '/start' && req.method === 'POST') {
        await handlers.startLoop();
        return new Response(JSON.stringify({ status: 'ok' }));
      }

      // POST /stop
      if (url.pathname === '/stop' && req.method === 'POST') {
        await handlers.stopLoop();
        return new Response(JSON.stringify({ status: 'ok' }));
      }

      // POST /trigger
      if (url.pathname === '/trigger' && req.method === 'POST') {
        await handlers.triggerIteration();
        return new Response(JSON.stringify({ status: 'ok' }));
      }

      return new Response('Not found', { status: 404 });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
      },
      message(ws, message) {
        // ponytail: client control messages not needed yet, add when bidirectional control required
      },
      close(ws) {
        clients.delete(ws);
      },
    },
  });

  return {
    port: server.port,
    stop: () => { server.stop(); },
    broadcast: (state: LoopState) => {
      const msg = JSON.stringify({ type: 'state_change', data: state });
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    },
  };
}
