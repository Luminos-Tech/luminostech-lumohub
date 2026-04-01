import { NextRequest, NextResponse } from "next/server";

function backendBase(): string {
  return (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

async function proxy(req: NextRequest, ctx: { params: { path: string[] } }) {
  const subpath = (ctx.params.path || []).join("/");
  const url = new URL(req.url);
  const target = `${backendBase()}/api/v1/${subpath}${url.search}`;

  const headers = new Headers();
  const forward = ["authorization", "content-type", "accept", "accept-language"];
  for (const name of forward) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });
  } catch {
    return NextResponse.json({ detail: "Không kết nối được tới API backend" }, { status: 502 });
  }

  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: { params: { path: string[] } }) {
  return proxy(req, ctx);
}
