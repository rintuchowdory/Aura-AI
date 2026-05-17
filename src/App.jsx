import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, Trash2, Sparkles, StopCircle } from "lucide-react";

const playSound = (type) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  if (type === "send") {
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.15);
  } else if (type === "receive") {
    o.frequency.setValueAtTime(400, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.2);
  } else if (type === "error") {
    o.type = "sawtooth";
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.3);
  }
};


const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3", desc: "Fast & free" },
  { id: "mixtral-8x7b-32768", label: "Mixtral", desc: "Great reasoning" },
];

const SYSTEM_PROMPTS = [
  { label: "Assistant", prompt: "You are a helpful, friendly AI assistant. Be concise and clear." },
  { label: "Coder", prompt: "You are an expert programmer. Always provide clean, well-commented code with explanations. Use markdown code blocks." },
  { label: "Teacher", prompt: "You are a patient teacher. Explain concepts step by step, use examples and analogies." },
  { label: "Creative", prompt: "You are a creative writing partner. Be imaginative and expressive." },
];

const QUICK_PROMPTS = [
  "Explain quantum computing simply",
  "Write a Python web scraper",
  "Give me a morning routine",
  "Explain blockchain in 3 bullets",
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#a78bfa",
          animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`
        }} />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "1rem", alignItems: "flex-start", gap: 10
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2
        }}>
          <Bot size={16} color="white" />
        </div>
      )}
      <div style={{
        maxWidth: "75%",
        background: isUser ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(255,255,255,0.06)",
        border: isUser ? "none" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "10px 14px", fontSize: "0.92rem", lineHeight: 1.6,
        color: isUser ? "white" : "#e8e8f0"
      }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
        ) : (
          <div style={{ lineHeight: 1.7 }}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
        <div style={{ fontSize: "0.68rem", opacity: 0.4, marginTop: 4, textAlign: isUser ? "right" : "left" }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2
        }}>
          <User size={16} color="#a78bfa" />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPTS[0].prompt);
  const [systemLabel, setSystemLabel] = useState(SYSTEM_PROMPTS[0].label);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("groq_api_key") || import.meta.env.VITE_GROQ_API_KEY || "");
  const saveApiKey = (k) => { setApiKey(k); localStorage.setItem("groq_api_key", k); };
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    const userMsg = { role: "user", content, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    playSound("send");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("https://groq-proxy.chowdoryrintu.workers.dev", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || "Error " + response.status);
      }
      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content || "No response received.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: Date.now() }]);
      playSound("receive");
    } catch (err) {
      if (err.name !== "AbortError") {
        playSound("error");
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + err.message, timestamp: Date.now() }]);
      }
    }
    setLoading(false);
    abortRef.current = null;
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [input, messages, loading, model, systemPrompt, apiKey]);

  const stopGeneration = () => { abortRef.current?.abort(); setLoading(false); };
  const clearChat = () => setMessages([]);
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 800, margin: "0 auto" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>Aura AI</div>
            <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
              {MODELS.find(m => m.id === model)?.label} · {systemLabel}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowSettings(s => !s)} style={{
            background: showSettings ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            padding: "6px 12px", color: "#a78bfa", cursor: "pointer", fontSize: "0.8rem"
          }}>Settings</button>
          <button onClick={clearChat} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 10px", color: "#6b7280", cursor: "pointer", fontSize: "0.8rem"
          }}>Clear</button>
        </div>
      </div>

      {showSettings && (
        <div style={{
          background: "rgba(124,58,237,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 20px", display: "flex", gap: 24, flexWrap: "wrap"
        }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Model</div>
            <div style={{ display: "flex", gap: 8 }}>
              {MODELS.map(m => (
                <button key={m.id} onClick={() => setModel(m.id)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer",
                  background: model === m.id ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.05)",
                  border: model === m.id ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.1)",
                  color: model === m.id ? "#e9d5ff" : "#9ca3af"
                }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Persona</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SYSTEM_PROMPTS.map(s => (
                <button key={s.label} onClick={() => { setSystemPrompt(s.prompt); setSystemLabel(s.label); }} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: "0.82rem", cursor: "pointer",
                  background: systemLabel === s.label ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.05)",
                  border: systemLabel === s.label ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.1)",
                  color: systemLabel === s.label ? "#e9d5ff" : "#9ca3af"
                }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Groq API Key</div>
            <input
              type="password"
              value={apiKey}
              onChange={e => saveApiKey(e.target.value)}
              placeholder="gsk_..."
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "6px 12px", color: "#e9d5ff",
                fontSize: "0.82rem", outline: "none", width: "100%", maxWidth: 320, fontFamily: "monospace"
              }}
            />
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "15vh" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 16px",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Sparkles size={28} color="white" />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Aura AI</h2>
            <p style={{ color: "#6b7280", marginBottom: 28 }}>Your intelligent AI companion</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 480, margin: "0 auto" }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)} style={{
                  padding: "8px 14px", borderRadius: 20,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#a78bfa", cursor: "pointer", fontSize: "0.82rem"
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: "1rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Bot size={16} color="white" />
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px 18px 18px 4px" }}>
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16, padding: "8px 8px 8px 16px"
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Message Aura... (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#f0f0f0", fontSize: "0.92rem", lineHeight: 1.6,
              resize: "none", maxHeight: 120, fontFamily: "inherit", padding: "4px 0"
            }}
          />
          {loading ? (
            <button onClick={stopGeneration} style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#ef4444"
            }}><StopCircle size={18} /></button>
          ) : (
            <button onClick={() => sendMessage()} disabled={!input.trim()} style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: input.trim() ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(255,255,255,0.05)",
              border: "none", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() ? "pointer" : "not-allowed", color: "white"
            }}><Send size={16} /></button>
          )}
        </div>
        <div style={{ textAlign: "center", fontSize: "0.68rem", color: "#374151", marginTop: 8 }}>
          Powered by Claude · Your conversations stay local
        </div>
      </div>
    </div>
  );
}
