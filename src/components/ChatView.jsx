import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Bot, User, Trash2, StopCircle, Mic, Square, Copy, Check,
  Download, FileText, PanelLeftOpen, PanelLeftClose, Plus, Settings2, Zap,
} from "lucide-react";
import { chatCompleteStream, fetchModels, FALLBACK_MODELS } from "../lib/api";
import { transcribeAudio } from "../lib/api";
import { loadSessions, saveSessions, uid } from "../lib/storage";
import { playSound } from "../lib/sound";

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

function newSession() {
  return {
    id: uid(),
    title: "New chat",
    messages: [],
    systemLabel: SYSTEM_PROMPTS[0].label,
    systemPrompt: SYSTEM_PROMPTS[0].prompt,
    createdAt: Date.now(),
  };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="msg-copy-btn"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg ${isUser ? "user" : "ai"}`}>
      <div className="msg-avatar">{isUser ? <User size={16} /> : <Bot size={16} color="var(--accent)" />}</div>
      <div style={{ maxWidth: "80%", position: "relative" }} className="msg-bubble-wrap">
        <div className="msg-bubble">
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown>{msg.content || " "}</ReactMarkdown>
              {msg.streaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>
        <div className="msg-time">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {msg.tokensPerSec > 0 && (
            <span className="tok-badge"><Zap size={10} /> {msg.tokensPerSec.toFixed(0)} tok/s</span>
          )}
          {!isUser && !msg.streaming && msg.content && <CopyButton text={msg.content} />}
        </div>
      </div>
    </div>
  );
}

export default function ChatView() {
  const [sessions, setSessions] = useState(() => {
    const s = loadSessions();
    return s.length ? s : [newSession()];
  });
  const [activeId, setActiveId] = useState(() => sessions[0]?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [model, setModel] = useState(null);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);

  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const session = sessions.find((s) => s.id === activeId) || sessions[0];

  useEffect(() => {
    fetchModels().then((m) => {
      setModels(m);
      setModel((cur) => cur || m[0]?.id);
    });
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages?.length, loading]);

  const updateSession = useCallback((id, patch) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const setMessages = useCallback((id, updater) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, messages: typeof updater === "function" ? updater(s.messages) : updater } : s))
    );
  }, []);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading || !session) return;
    const sid = session.id;
    const userMsg = { role: "user", content, timestamp: Date.now() };
    const priorMessages = session.messages;
    const nextMessages = [...priorMessages, userMsg];
    setMessages(sid, nextMessages);
    if (priorMessages.length === 0) {
      updateSession(sid, { title: content.slice(0, 42) + (content.length > 42 ? "…" : "") });
    }
    setInput("");
    setLoading(true);
    playSound("send");

    const assistantMsg = { role: "assistant", content: "", timestamp: Date.now(), streaming: true, tokensPerSec: 0 };
    setMessages(sid, (msgs) => [...msgs, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { content: finalContent, tokensPerSec } = await chatCompleteStream({
        model,
        temperature,
        maxTokens,
        signal: controller.signal,
        messages: [
          { role: "system", content: session.systemPrompt },
          ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        onToken: (_delta, full) => {
          setMessages(sid, (msgs) => {
            const copy = [...msgs];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: full };
            return copy;
          });
        },
      });
      setMessages(sid, (msgs) => {
        const copy = [...msgs];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: finalContent || "No response received.", streaming: false, tokensPerSec };
        }
        return copy;
      });
      playSound("receive");
    } catch (err) {
      if (err.name !== "AbortError") {
        playSound("error");
        setMessages(sid, (msgs) => {
          const copy = [...msgs];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: "Error: " + err.message, streaming: false };
          return copy;
        });
      } else {
        setMessages(sid, (msgs) => {
          const copy = [...msgs];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, streaming: false };
          return copy;
        });
      }
    }
    setLoading(false);
    abortRef.current = null;
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [input, loading, session, model, temperature, maxTokens, setMessages, updateSession]);

  const stopGeneration = () => { abortRef.current?.abort(); setLoading(false); };
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const createChat = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setSidebarOpen(false);
  };
  const deleteChat = (id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next.length ? next : [newSession()];
    });
  };
  const clearChat = () => updateSession(session.id, { messages: [], title: "New chat" });

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return;
        setInput((prev) => (prev ? prev + " " : "") + "…transcribing…");
        try {
          const text = await transcribeAudio(blob);
          setInput((prev) => prev.replace("…transcribing…", "").trim() + (text ? " " + text : ""));
        } catch {
          setInput((prev) => prev.replace("…transcribing…", "").trim());
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const exportMarkdown = () => {
    const lines = [`# ${session.title}`, ""];
    session.messages.forEach((m) => {
      lines.push(`**${m.role === "user" ? "You" : "Aura"}** (${new Date(m.timestamp).toLocaleString()})`, "", m.content, "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "chat"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => window.print();

  const currentModel = models.find((m) => m.id === model);

  return (
    <div className="chat-layout">
      <div className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="sidebar-new-btn" onClick={createChat}><Plus size={14} /> New chat</button>
        <div className="sidebar-list">
          {sessions.map((s) => (
            <div key={s.id} className={`sidebar-item ${s.id === activeId ? "active" : ""}`} onClick={() => setActiveId(s.id)}>
              <span className="sidebar-item-title">{s.title}</span>
              <button className="sidebar-item-del" onClick={(e) => { e.stopPropagation(); deleteChat(s.id); }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <div className="chat-toolbar">
          <button className="icon-btn" onClick={() => setSidebarOpen((v) => !v)} title="Sessions">
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <div className="chat-toolbar-info">
            <span className="model-chip">{currentModel?.label || "…"}</span>
            <span className="dot-sep">·</span>
            <span>{session.systemLabel}</span>
          </div>
          <div className="chat-toolbar-actions">
            <button className="icon-btn" onClick={() => setShowSettings((v) => !v)} title="Settings"><Settings2 size={16} /></button>
            <button className="icon-btn" onClick={exportMarkdown} title="Export Markdown"><FileText size={16} /></button>
            <button className="icon-btn" onClick={exportPdf} title="Export PDF"><Download size={16} /></button>
            <button className="icon-btn" onClick={clearChat} title="Clear chat"><Trash2 size={16} /></button>
          </div>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <div className="settings-group">
              <div className="config-label">Model</div>
              <div className="pill-group">
                {models.map((m) => (
                  <button key={m.id} className={`pill ${model === m.id ? "active" : ""}`} title={m.desc} onClick={() => setModel(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group">
              <div className="config-label">Persona</div>
              <div className="pill-group">
                {SYSTEM_PROMPTS.map((sp) => (
                  <button
                    key={sp.label}
                    className={`pill ${session.systemLabel === sp.label ? "active" : ""}`}
                    onClick={() => updateSession(session.id, { systemLabel: sp.label, systemPrompt: sp.prompt })}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-group">
              <div className="config-label">Temperature: {temperature.toFixed(1)}</div>
              <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="aura-slider" />
            </div>
            <div className="settings-group">
              <div className="config-label">Max tokens: {maxTokens}</div>
              <input type="range" min="128" max="4096" step="128" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="aura-slider" />
            </div>
          </div>
        )}

        <div className="chat-messages">
          {session.messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon"><Bot size={28} color="var(--accent)" /></div>
              <p>Ask me anything — powered by Groq's LPU inference.</p>
              <div className="quick-prompts">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} className="pill" onClick={() => sendMessage(q)}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {session.messages.map((m, i) => <Message key={i} msg={m} />)}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <button className={`mic-btn ${recording ? "recording" : ""}`} onClick={toggleRecording} title={recording ? "Stop recording" : "Voice input"}>
            {recording ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Message Aura… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          {loading ? (
            <button className="send-btn" onClick={stopGeneration} title="Stop"><StopCircle size={18} /></button>
          ) : (
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()} title="Send"><Send size={18} /></button>
          )}
        </div>
      </div>

      <div className="print-transcript">
        <h1>{session.title}</h1>
        <p className="print-meta">Aura AI · {currentModel?.label} · exported {new Date().toLocaleString()}</p>
        {session.messages.map((m, i) => (
          <div key={i} className="print-msg">
            <strong>{m.role === "user" ? "You" : "Aura"}:</strong>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
