import { NextResponse } from "next/server";

const WEBHOOK_URL =
  "https://resimpli.app.n8n.cloud/webhook/f5368833-7264-449c-a47e-b07c44c2f1d0";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = body as {
    system_prompt?: string;
    user_prompt?: string;
  };

  const system_prompt = typeof parsed.system_prompt === "string" ? parsed.system_prompt : "";
  const user_prompt = typeof parsed.user_prompt === "string" ? parsed.user_prompt : "";

  const upstream = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_prompt, user_prompt }),
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

  return NextResponse.json(data);
}
