/**
 * FYERS data-socket client with reconnect. Demo mode uses a local ticker bus.
 */
import { FYERS_ENDPOINTS, isFyersConnected, getFyersState } from "./fyers.js";
import { Storage } from "./storage.js";

const MAX_BACKOFF = 15000;

export const WS = {
  status: "DISCONNECTED",
  socket: null,
  timer: null,
  attempt: 0,
  handlers: new Set(),
  symbols: new Set(),

  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  },

  setStatus(s) {
    this.status = s;
    window.dispatchEvent(new CustomEvent("nstox:ws", { detail: { status: s } }));
  },

  connect(symbols = []) {
    symbols.forEach((s) => this.symbols.add(s));
    if (!isFyersConnected()) {
      this.setStatus("DEMO");
      return;
    }
    this.open();
  },

  open() {
    this.close();
    const { config } = getFyersState();
    const url = `${FYERS_ENDPOINTS.wsData}?access_token=${encodeURIComponent(config.appId + ":" + config.accessToken)}`;
    this.setStatus("RECONNECTING");
    try {
      this.socket = new WebSocket(url);
    } catch {
      this.setStatus("DISCONNECTED");
      this.schedule();
      return;
    }
    this.socket.onopen = () => {
      this.attempt = 0;
      this.setStatus("CONNECTED");
      this.subscribe([...this.symbols]);
      this.heartbeat();
    };
    this.socket.onmessage = (ev) => {
      try {
        const msg = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        for (const fn of this.handlers) fn(msg);
      } catch {
        /* binary / lite packets ignored */
      }
    };
    this.socket.onerror = () => this.setStatus("DISCONNECTED");
    this.socket.onclose = () => {
      this.setStatus("DISCONNECTED");
      this.schedule();
    };
  },

  subscribe(symbols) {
    if (!this.socket || this.socket.readyState !== 1) return;
    const payload = { T: "SUB_DATA", TLIST: symbols, SUB_T: 1 };
    this.socket.send(JSON.stringify(payload));
  },

  unsubscribe(symbols) {
    if (!this.socket || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify({ T: "SUB_DATA", TLIST: symbols, SUB_T: -1 }));
  },

  heartbeat() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.socket?.readyState === 1) {
        try {
          this.socket.send("ping");
        } catch {
          /* ignore */
        }
      }
    }, 10000);
  },

  schedule() {
    if (!isFyersConnected()) return;
    this.attempt += 1;
    const wait = Math.min(MAX_BACKOFF, 800 * 2 ** Math.min(this.attempt, 4));
    this.setStatus("RECONNECTING");
    setTimeout(() => this.open(), wait);
  },

  close() {
    clearInterval(this.timer);
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.close();
      } catch {
        /* ignore */
      }
    }
    this.socket = null;
  },
};
