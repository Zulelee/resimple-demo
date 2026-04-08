"use client";
import { useState } from "react";

export default function Home() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [response, setResponse] = useState<any>(null);

  const leadText = `REPLACE_WITH_LEAD_TEXT`;

  const handleSubmit = async () => {
    const res = await fetch("https://resimpli.app.n8n.cloud/webhook/f5368833-7264-449c-a47e-b07c44c2f1d0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: leadText,
      }),
    });

    const data = await res.json();
    const text = data?.[0]?.output?.[0]?.content?.[0]?.text;

    setResponse({ raw: data, parsed: text });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Webhook Tester</h1>
      <textarea
        placeholder="System Prompt"
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        style={{ width: "100%", height: 100 }}
      />
      <button onClick={handleSubmit}>Send</button>

      {response && (
        <div>
          <h3>Parsed Response</h3>
          <pre>{response.parsed}</pre>

          <h3>Raw Response</h3>
          <pre>{JSON.stringify(response.raw, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
