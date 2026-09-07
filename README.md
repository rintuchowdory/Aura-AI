# Aura AI ✨

A fast, beautiful AI assistant + mock interview coach, powered by Groq's LPU inference.

Live at: **https://rintuchowdory.github.io/Aura-AI/**

## Features

- 💬 **Streaming Chat** — answers stream in live, with tokens/sec speed badge
- 🌌 **Aurora UI** — animated aurora background, glassmorphism, dark/light theme
- 🗂️ **Chat Sessions** — sidebar with saved history (localStorage), per-session persona
- 🎤 **Voice Input** — speak instead of typing (Whisper transcription via Groq)
- 🌡️ **Controls** — model picker, temperature, max tokens, personas
- 📤 **Export** — chat as Markdown, or any page as PDF (print)
- 🧑‍💼 **Interview Mode** — adaptive mock interview for your role & difficulty, optional resume upload (PDF), graded 0–100 with strengths/improvements/tips
- 📊 **History** — past interview scores with stats

## Architecture

```
Browser (React 19 + Vite, GitHub Pages)
   │
   ▼
Cloudflare Worker  groq-proxy.chowdoryrintu.workers.dev   ← worker/groq-proxy/
   │  holds the GROQ_API_KEY server-side, restricts CORS
   ▼
Groq API (chat completions, streaming, /models, Whisper transcriptions)
```

The API key is **never** in the frontend — only in the Worker's secrets. Update it with:

```bash
cd worker/groq-proxy
npx wrangler secret put GROQ_API_KEY
npx wrangler deploy
```

## Models

The Worker curates the current Groq lineup and serves it at `GET /models`
(GPT-OSS 120B/20B, Compound, Qwen3). The frontend auto-refreshes the list.

## Dev

```bash
npm install
npm run dev
```

Deploy happens automatically on push to `master` via GitHub Actions (ubuntu runner).
