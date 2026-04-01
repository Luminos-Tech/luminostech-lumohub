/**
 * Resolve WebSocket origin when the page is served on a public host but
 * NEXT_PUBLIC_WS_URL still points at localhost (typical tunnel / Docker misconfig).
 */
export function getWebSocketBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "");
  if (typeof window === "undefined") {
    return env || "ws://localhost:8000";
  }

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^127\.\d+\.\d+\.\d+$/.test(host);

  if (isLocal) {
    return env || "ws://localhost:8000";
  }

  const envPointsLocal =
    !env || env.includes("localhost") || env.includes("127.0.0.1");
  if (env && !envPointsLocal) {
    return env;
  }

  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host) && host.includes(".")) {
    const labels = host.split(".");
    if (labels.length >= 3) {
      const apex = labels.slice(-2).join(".");
      const secure = window.location.protocol === "https:";
      return `${secure ? "wss" : "ws"}://api.${apex}`;
    }
  }

  return env || "ws://localhost:8000";
}
