/** Pulls assistant text from n8n / OpenAI-style webhook JSON. */
export function extractWebhookOutputText(data: unknown): string {
  if (typeof data !== "object" || data === null) {
    return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }

  const record = data as Record<string, unknown>;
  const output = record.output;

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0] as Record<string, unknown>;
    const content = first.content;
    if (Array.isArray(content) && content.length > 0) {
      const block = content[0] as Record<string, unknown>;
      const text = block.text;
      if (typeof text === "string") return text;
    }
  }

  return JSON.stringify(data, null, 2);
}
