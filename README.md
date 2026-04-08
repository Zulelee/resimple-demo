# Webhook Prompt Sender (GitHub Pages)

A minimal static UI that sends a **System Prompt** and **User Prompt** to:

`https://resimpli.app.n8n.cloud/webhook/f5368833-7264-449c-a47e-b07c44c2f1d0`

## Local run

You can open `index.html` directly, or run a local static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Payload format

The app sends:

```json
{
  "systemPrompt": "...",
  "userPrompt": "..."
}
```

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In GitHub repo settings, ensure **Actions** are enabled.
3. The included workflow will deploy the site on pushes to `main`.
4. After deployment, your site will be at:
   - `https://<your-username>.github.io/<repo-name>/`

> If your webhook enforces CORS, you may need to allow the GitHub Pages origin.
