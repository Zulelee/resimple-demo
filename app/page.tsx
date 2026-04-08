"use client";

import { useState } from "react";
import { DEFAULT_USER_PROMPT } from "@/lib/default-user-prompt";
import { extractWebhookOutputText } from "@/lib/extract-webhook-text";

function tryFormatJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

export default function Home() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);
  const [outputText, setOutputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
        }),
      });

      const data = (await res.json()) as unknown;

      if (!res.ok) {
        const errObj = data as { error?: string; data?: unknown };
        setOutputText("");
        setError(
          errObj.error ??
            `Request failed (${res.status}). ${JSON.stringify(errObj.data ?? data)}`,
        );
        return;
      }

      const raw = extractWebhookOutputText(data);
      setOutputText(tryFormatJson(raw));
    } catch (err) {
      setOutputText("");
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-lg font-medium tracking-tight">Prompt</h1>
        <p className="text-sm text-zinc-500">
          System and user prompts are sent to the scoring webhook; the assistant
          text from the response is shown below.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-600">System prompt</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
            placeholder="Optional system instructions…"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-600">User prompt</span>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={14}
            className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-zinc-400 focus:ring-2"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-600">Response</h2>
        <pre className="max-h-[min(70vh,32rem)] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {outputText || "—"}
        </pre>
      </section>
    </div>
  );
}
