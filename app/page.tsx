"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SMS_SYSTEM_PROMPT } from "@/lib/default-sms-system-prompt";
import { DEFAULT_USER_PROMPT } from "@/lib/default-user-prompt";
import {
  extractWebhookCost,
  extractWebhookOutputText,
} from "@/lib/extract-webhook-text";

type Mode = "test-prompt" | "test-sms" | "generate-summary";

type SmsRole = "user" | "assistant";

type SmsMessage = { role: SmsRole; content: string };

function tryFormatJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

function formatRecentSmsMarkdown(messages: SmsMessage[]): string {
  const last5 = messages.slice(-5);
  if (last5.length === 0) {
    return "_No messages yet._";
  }
  return last5
    .map((m, i) => {
      const label =
        m.role === "user" ? "User (inbound SMS)" : "Assistant (outbound SMS)";
      const body = m.content.replace(/\r\n/g, "\n").trim();
      return `${i + 1}. **${label}:** ${body || "_[empty]_"}`;
    })
    .join("\n");
}

function formatWebhookCost(cost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(cost);
}

const CHICAGO_TZ = "America/Chicago";

/** e.g. "Monday 13 April 2026 17:26" (24h, America/Chicago). */
function formatChicagoDateTimeLine(at: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHICAGO_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPart["type"]) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekday = pick("weekday");
  const day = pick("day");
  const month = pick("month");
  const year = pick("year");
  const hour = pick("hour").padStart(2, "0");
  const minute = pick("minute").padStart(2, "0");
  return `${weekday} ${day} ${month} ${year} ${hour}:${minute}`;
}

function buildSmsUserPrompt(
  summaryContext: string,
  availableSlots: string,
  messages: SmsMessage[],
  chicagoNowLine: string,
): string {
  const summary = summaryContext.trim() || "_None._";
  const slots = availableSlots.trim() || "_None._";
  const smsBlock = formatRecentSmsMarkdown(messages);
  return `## Current date and time (America/Chicago)

${chicagoNowLine}

## Summary context

${summary}

## Available slots

${slots}

## Recent conversation (SMS, last 5 messages)

${smsBlock}
`;
}

const nav: { id: Mode; label: string; description: string }[] = [
  {
    id: "test-prompt",
    label: "Test Prompt",
    description: "System + user prompts → response from webhook",
  },
  {
    id: "test-sms",
    label: "Test SMS",
    description: "Simulate SMS thread → same webhook as Test Prompt",
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

  const [smsSystemPrompt, setSmsSystemPrompt] = useState(
    DEFAULT_SMS_SYSTEM_PROMPT,
  );
  const [smsSummaryContext, setSmsSummaryContext] = useState("");
  const [smsAvailableSlots, setSmsAvailableSlots] = useState("");
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [smsDraft, setSmsDraft] = useState("");

  const [outputText, setOutputText] = useState("");
  const [responseCost, setResponseCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Refreshes the built SMS user prompt clock while on Test SMS (preview). */
  const [smsTimeTick, setSmsTimeTick] = useState(0);

  useEffect(() => {
    if (mode === "test-sms") setSmsTimeTick((n) => n + 1);
  }, [mode]);

  useEffect(() => {
    if (mode !== "test-sms") return;
    const id = setInterval(() => setSmsTimeTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [mode]);

  const builtSmsUserPrompt = useMemo(() => {
    void smsTimeTick;
    return buildSmsUserPrompt(
      smsSummaryContext,
      smsAvailableSlots,
      smsMessages,
      formatChicagoDateTimeLine(new Date()),
    );
  }, [smsSummaryContext, smsAvailableSlots, smsMessages, smsTimeTick]);

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
        setResponseCost(null);
        setError(
          errObj.error ??
            `Request failed (${res.status}). ${JSON.stringify(errObj.data ?? data)}`,
        );
        return;
      }

      const raw = extractWebhookOutputText(data);
      setOutputText(tryFormatJson(raw));
      setResponseCost(extractWebhookCost(data));
    } catch (err) {
      setOutputText("");
      setResponseCost(null);
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
        setResponseCost(null);
        setError(
          errObj.error ??
            `Request failed (${res.status}). ${JSON.stringify(errObj.data ?? data)}`,
        );
        return;
      }

      const raw = extractWebhookOutputText(data);
      setOutputText(tryFormatJson(raw));
      setResponseCost(extractWebhookCost(data));
    } catch (err) {
      setOutputText("");
      setResponseCost(null);
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function resetSmsThread() {
    setSmsMessages([]);
    setSmsDraft("");
    setOutputText("");
    setResponseCost(null);
    setError(null);
  }

  async function handleSmsSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = smsDraft.trim();
    if (!text) {
      setError("Enter a message to send.");
      return;
    }
    setError(null);
    setSmsDraft("");
    const threadAfterUser: SmsMessage[] = [
      ...smsMessages,
      { role: "user", content: text },
    ];
    setSmsMessages(threadAfterUser);

    const user_prompt = buildSmsUserPrompt(
      smsSummaryContext,
      smsAvailableSlots,
      threadAfterUser,
      formatChicagoDateTimeLine(new Date()),
    );

    setLoading(true);
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: smsSystemPrompt,
          user_prompt,
        }),
      });

      const data = (await res.json()) as unknown;

      if (!res.ok) {
        const errObj = data as { error?: string; data?: unknown };
        setSmsMessages((prev) => prev.slice(0, -1));
        setSmsDraft(text);
        setOutputText("");
        setResponseCost(null);
        setError(
          errObj.error ??
            `Request failed (${res.status}). ${JSON.stringify(errObj.data ?? data)}`,
        );
        return;
      }

      const raw = extractWebhookOutputText(data);
      setOutputText(tryFormatJson(raw));
      setResponseCost(extractWebhookCost(data));
      setSmsMessages((prev) => [
        ...prev,
        { role: "assistant", content: raw },
      ]);
    } catch (err) {
      setSmsMessages((prev) => prev.slice(0, -1));
      setSmsDraft(text);
      setOutputText("");
      setResponseCost(null);
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

      <div
        className={`mx-auto flex min-h-full w-full flex-col gap-8 px-6 py-10 ${mode === "test-sms" ? "max-w-6xl" : "max-w-3xl"}`}
      >
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
        ) : mode === "test-sms" ? (
          <>
            <header className="space-y-1">
              <h1 className="text-lg font-medium tracking-tight">Test SMS</h1>
              <p className="text-sm text-zinc-500">
                Simulate an SMS thread on the left. The user prompt sent to the
                webhook is built as markdown from summary context, available
                slots, and the last five messages (same{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  /api/webhook
                </code>{" "}
                as Test Prompt).
              </p>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-zinc-800">
                    SMS thread
                  </h2>
                  <button
                    type="button"
                    onClick={resetSmsThread}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex max-h-[min(50vh,22rem)] min-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50/80 p-3">
                  {smsMessages.length === 0 ? (
                    <p className="text-center text-xs text-zinc-400">
                      No messages yet. Type below and send to call the model.
                    </p>
                  ) : (
                    smsMessages.map((m, idx) => (
                      <div
                        key={`${idx}-${m.role}-${m.content.slice(0, 24)}`}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                            m.role === "user"
                              ? "rounded-br-md bg-zinc-900 text-white"
                              : "rounded-bl-md border border-zinc-200 bg-white text-zinc-900"
                          }`}
                        >
                          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide opacity-70">
                            {m.role === "user" ? "Inbound" : "Outbound"}
                          </span>
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form
                  onSubmit={handleSmsSubmit}
                  className="flex flex-col gap-2 border-t border-zinc-100 pt-3"
                >
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-zinc-500">New SMS (user)</span>
                    <textarea
                      value={smsDraft}
                      onChange={(e) => setSmsDraft(e.target.value)}
                      rows={3}
                      className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                      placeholder="Type an inbound SMS…"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading || !smsDraft.trim()}
                    className="self-start rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {loading ? "Sending…" : "Send & get reply"}
                  </button>
                </form>
              </div>

              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-zinc-600">System prompt</span>
                  <textarea
                    value={smsSystemPrompt}
                    onChange={(e) => setSmsSystemPrompt(e.target.value)}
                    rows={4}
                    className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2"
                    placeholder="SMS agent system instructions…"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-zinc-600">Summary context</span>
                  <textarea
                    value={smsSummaryContext}
                    onChange={(e) => setSmsSummaryContext(e.target.value)}
                    rows={5}
                    className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-zinc-400 focus:ring-2"
                    placeholder="Lead / conversation summary for the model…"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-zinc-600">Available slots</span>
                  <textarea
                    value={smsAvailableSlots}
                    onChange={(e) => setSmsAvailableSlots(e.target.value)}
                    rows={4}
                    className="resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none ring-zinc-400 focus:ring-2"
                    placeholder="Scheduling slots or other structured context…"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-zinc-600">
                    User prompt (built, markdown)
                  </span>
                  <textarea
                    readOnly
                    value={builtSmsUserPrompt}
                    rows={14}
                    className="resize-y rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-800 outline-none"
                  />
                </label>
              </div>
            </div>
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
                in the JSON body to the summary webhook. The reply uses the same
                shape as Test Prompt (
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  text
                </code>
                ,{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  cost
                </code>
                ); both are shown below.
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
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium text-zinc-600">Response</h2>
            {responseCost != null ? (
              <p className="text-xs text-zinc-500">
                Cost{" "}
                <span className="font-mono text-zinc-700 tabular-nums">
                  {formatWebhookCost(responseCost)}
                </span>
              </p>
            ) : null}
          </div>
          <pre className="max-h-[min(70vh,32rem)] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {outputText || "—"}
          </pre>
        </section>
      </div>
    </div>
  );
}
