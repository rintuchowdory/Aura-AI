const PROXY_URL = "https://groq-proxy.chowdoryrintu.workers.dev";

export const FALLBACK_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", desc: "Flagship quality, open-weight" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", desc: "Fast & light" },
  { id: "groq/compound", label: "Compound", desc: "Agentic, can browse & use tools" },
  { id: "groq/compound-mini", label: "Compound Mini", desc: "Lighter agentic model" },
  { id: "qwen/qwen3.8-27b", label: "Qwen3 27B", desc: "Strong reasoning" },
];

export async function fetchModels() {
  try {
    const r = await fetch(`${PROXY_URL}/models`);
    if (!r.ok) throw new Error("bad status");
    const data = await r.json();
    if (Array.isArray(data.models) && data.models.length) return data.models;
    throw new Error("empty");
  } catch {
    return FALLBACK_MODELS;
  }
}

/**
 * Non-streaming completion. Returns { content, tokensPerSec, totalTokens }.
 */
export async function chatComplete({ model, messages, temperature = 0.7, maxTokens = 1024, signal }) {
  const started = performance.now();
  const res = await fetch(PROXY_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const totalTokens = data?.usage?.completion_tokens || 0;
  const seconds = (performance.now() - started) / 1000;
  return { content, tokensPerSec: seconds > 0 ? totalTokens / seconds : 0, totalTokens };
}

/**
 * Streaming completion. Calls onToken(deltaText) as chunks arrive.
 * Returns { content, tokensPerSec, totalTokens }.
 */
export async function chatCompleteStream({ model, messages, temperature = 0.7, maxTokens = 1024, signal, onToken }) {
  const started = performance.now();
  const res = await fetch(PROXY_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let tokenCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          tokenCount += 1;
          onToken?.(delta, content);
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
  const seconds = (performance.now() - started) / 1000;
  return { content, tokensPerSec: seconds > 0 ? tokenCount / seconds : 0, totalTokens: tokenCount };
}

export async function transcribeAudio(blob) {
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  const res = await fetch(`${PROXY_URL}/transcribe`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data?.text || "";
}
