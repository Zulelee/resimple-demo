import { NextResponse } from "next/server";

const WEBHOOK_URL =
  "https://resimpli.app.n8n.cloud/webhook/19f9eb39-c7d7-4e93-bf30-6f7544fdb3dd";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = body as { text?: string };
  const text = typeof parsed.text === "string" ? parsed.text : "";

  const upstream = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const rawText = await upstream.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText) as unknown;
  } catch {
    data = { raw: rawText };
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Webhook request failed", status: upstream.status, data },
      { status: 502 },
    );
  }

  // Upstream returns the same JSON as /api/webhook: { text, cost }.
  return NextResponse.json(data);
}
