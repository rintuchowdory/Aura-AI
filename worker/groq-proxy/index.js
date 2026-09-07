const ALLOWED_ORIGINS = [
  "https://rintuchowdory.github.io",
  "https://aura-ai.pages.dev",
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.aura-ai\.pages\.dev$/.test(origin)) return true; // CF preview deploys
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// Chat-capable text models we want to expose in the UI (curated + labeled).
const CHAT_MODEL_META = {
  "openai/gpt-oss-120b": { label: "GPT-OSS 120B", desc: "Flagship quality, open-weight" },
  "openai/gpt-oss-20b": { label: "GPT-OSS 20B", desc: "Fast & light" },
  "groq/compound": { label: "Compound", desc: "Agentic, can browse & use tools" },
  "groq/compound-mini": { label: "Compound Mini", desc: "Lighter agentic model" },
  "qwen/qwen3.8-27b": { label: "Qwen3 27B", desc: "Strong reasoning" },
};

async function handleModels(env, origin) {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    });
    const data = await r.json();
    const live = new Set((data.data || []).filter((m) => m.active).map((m) => m.id));
    const models = Object.entries(CHAT_MODEL_META)
      .filter(([id]) => live.has(id))
      .map(([id, meta]) => ({ id, ...meta }));
    return new Response(JSON.stringify({ models }), {
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    // Fall back to the curated list if Groq's /models call fails
    const models = Object.entries(CHAT_MODEL_META).map(([id, meta]) => ({ id, ...meta }));
    return new Response(JSON.stringify({ models }), {
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
}

async function handleChat(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid JSON body" } }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const payload = {
    model: body.model || "openai/gpt-oss-20b",
    messages: body.messages || [],
    temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
    max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 1024,
    stream: !!body.stream,
  };

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (payload.stream) {
    // Pass the SSE stream straight through to the browser
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        ...corsHeaders(origin),
      },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function handleTranscribe(request, env, origin) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file) {
    return new Response(JSON.stringify({ error: { message: "No audio file provided" } }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, "audio.webm");
  upstreamForm.append("model", "whisper-large-v3-turbo");

  const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: upstreamForm,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method === "GET" && url.pathname === "/models") {
      return handleModels(env, origin);
    }

    if (request.method === "POST" && url.pathname === "/transcribe") {
      return handleTranscribe(request, env, origin);
    }

    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "")) {
      return handleChat(request, env, origin);
    }

    return new Response(JSON.stringify({ error: { message: "Not found" } }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};
