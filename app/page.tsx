"use client";

import { useState } from "react";
import { DEFAULT_USER_PROMPT } from "@/lib/default-user-prompt";
import { extractWebhookOutputText } from "@/lib/extract-webhook-text";

type Mode = "test-prompt" | "generate-summary";

function tryFormatJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

const nav: { id: Mode; label: string; description: string }[] = [
  {
    id: "test-prompt",
    label: "Test Prompt",
    description: "System + user prompts → response from webhook",
  },
  {
    id: "generate-summary",
    label: "Generate Summary",
    description: "Paste text → summary webhook",
  },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("test-prompt");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);

  const [summaryInput, setSummaryInput] = useState("");

  const [outputText, setOutputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePromptSubmit(e: React.FormEvent) {
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

  async function handleSummarySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const text = summaryInput.trim();
    if (!text) {
      setError("Enter some text to summarize.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/webhook-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 py-6">
        <p className="px-4 pb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Modes
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-md px-3 py-2.5 text-left text-sm transition ${
                mode === item.id
                  ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
              }`}
            >
              <span className="block">{item.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-zinc-500">
                {item.description}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-6 py-10">
        {mode === "test-prompt" ? (
          <>
            <header className="space-y-1">
              <h1 className="text-lg font-medium tracking-tight">
                Test Prompt
              </h1>
              <p className="text-sm text-zinc-500">
                System and user prompts are sent to the scoring webhook; the
                assistant text from the response is shown below.
              </p>
            </header>

            <form onSubmit={handlePromptSubmit} className="flex flex-col gap-6">
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
          </>
        ) : (
          <>
            <header className="space-y-1">
              <h1 className="text-lg font-medium tracking-tight">
                Generate Summary
              </h1>
              <p className="text-sm text-zinc-500">
                Paste or type the content to summarize. It is sent as{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  text
                </code>{" "}
                in the JSON body to the summary webhook; the response is shown
                below.
              </p>
            </header>

            <form
              onSubmit={handleSummarySubmit}
              className="flex flex-col gap-6"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm text-zinc-600">Text to summarize</span>
                <textarea
                  value={summaryInput}
                  onChange={(e) => setSummaryInput(e.target.value)}
                  rows={14}
                  className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-zinc-400 focus:ring-2"
                  placeholder="Paste transcript, notes, or any text…"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !summaryInput.trim()}
                className="self-start rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-600">Response</h2>
          <pre className="max-h-[min(70vh,32rem)] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {outputText || "—"}
          </pre>
        </section>
      </div>
    </div>
  );
}
