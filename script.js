const WEBHOOK_URL = 'https://resimpli.app.n8n.cloud/webhook/f5368833-7264-449c-a47e-b07c44c2f1d0';

const form = document.getElementById('prompt-form');
const systemPromptInput = document.getElementById('systemPrompt');
const userPromptInput = document.getElementById('userPrompt');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');

function setStatus(message) {
  statusEl.textContent = message;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    systemPrompt: systemPromptInput.value.trim(),
    userPrompt: userPromptInput.value.trim(),
  };

  if (!payload.systemPrompt || !payload.userPrompt) {
    setStatus('Both System Prompt and User Prompt are required.');
    return;
  }

  submitBtn.disabled = true;
  setStatus('Sending request…');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    let parsedBody = rawBody;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // keep raw string body when not JSON
    }

    setStatus(
      JSON.stringify(
        {
          ok: response.ok,
          status: response.status,
          response: parsedBody,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    setStatus(`Request failed: ${error?.message || String(error)}`);
  } finally {
    submitBtn.disabled = false;
  }
});
