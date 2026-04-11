# InterviewAI Coach 🎯

An AI-powered technical interview coach with real-time streaming feedback, scoring, and PDF export.

## ✨ Features

- 🤖 **AI Interviewer** — Realistic interview questions powered by Llama 3.3 via Groq
- 📡 **Real-time Streaming** — Watch answers stream in character by character
- 📄 **PDF Resume Analysis** — Upload your CV to get personalized questions
- 🌗 **Dark/Light Mode** — Beautiful UI that switches themes
- 💾 **Chat History** — All sessions saved locally, with stats
- 📊 **Smart Scoring** — Get scored 0-100 with detailed feedback
- 📥 **Export to PDF** — Download your interview report

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your free Groq API key (console.groq.com)
echo "VITE_GROQ_API_KEY=gsk_your_key_here" > .env

# 3. Run
npm run dev
```

## 🛠 Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool
- **Groq API** — Free AI inference (Llama 3.3 70B)
- **Streaming** — Real-time SSE token streaming
- **LocalStorage** — Persistent session history
- **PDF.js** — Resume parsing
- **CSS Variables** — Theming system

## 📁 Structure

```
src/
├── pages/
│   ├── Home.jsx       # Job config + file upload
│   ├── Interview.jsx  # Live chat with streaming AI
│   ├── Results.jsx    # Score ring + feedback cards
│   └── History.jsx    # Past sessions
├── utils/
│   ├── storage.js     # LocalStorage helpers
│   ├── pdfReader.js   # PDF text extraction
│   └── exportPDF.js   # Report generation
├── App.jsx            # Router + theme
└── index.css          # Full design system
```

## 🎓 Resume Highlight

> Built a full-stack AI interview coaching app with real-time LLM streaming, PDF analysis, dynamic scoring, and persistent session history — deployed locally with React + Vite + Groq API.