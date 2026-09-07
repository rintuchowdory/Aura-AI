import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Briefcase, Upload, FileText, Sparkles, Send, Bot, User, Mic, Square,
  RotateCcw, Download, History as HistoryIcon, CheckCircle2, AlertTriangle, Lightbulb, ArrowRight,
} from "lucide-react";
import { chatComplete, transcribeAudio, FALLBACK_MODELS, fetchModels } from "../lib/api";
import { extractPdfText } from "../lib/pdf";
import { addInterviewResult, uid } from "../lib/storage";
import { playSound } from "../lib/sound";

const ROLES = ["Frontend Developer", "Backend Developer", "Full-Stack Developer", "Data Scientist", "DevOps Engineer", "Product Manager"];
const DIFFICULTIES = ["Junior", "Mid-level", "Senior"];
const QUESTION_COUNTS = [3, 5, 7];

function buildInterviewerSystemPrompt({ role, difficulty, resumeText, questionCount }) {
  return [
    `You are a rigorous but supportive senior technical interviewer conducting a ${difficulty} ${role} interview.`,
    resumeText ? `The candidate's resume/background:\n"""${resumeText.slice(0, 3000)}"""` : "The candidate did not provide a resume — ask generally relevant questions for the role.",
    `Ask exactly ONE question at a time, tailored to the role, difficulty, and (if given) the resume. Build follow-up questions on the candidate's previous answers when it makes sense.`,
    `You will ask a total of ${questionCount} questions across this conversation. Keep each question focused, realistic, and concise (2-4 sentences max). Do not number the questions or add preambles like "Question 1:" — just ask naturally, like a real interviewer would.`,
    `After the candidate has answered all ${questionCount} questions, respond with ONLY the exact token [INTERVIEW_COMPLETE] and nothing else.`,
  ].join("\n\n");
}

function scoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 55) return "var(--amber)";
  return "var(--red)";
}

function ScoreRing({ score }) {
  const r = 60, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  return (
    <div className="score-ring">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg4)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="score-number">
        <div className="score-value" style={{ color: scoreColor(score) }}>{score}</div>
        <div className="score-label">/ 100</div>
      </div>
    </div>
  );
}

export default function Interview({ goToHistory }) {
  const [stage, setStage] = useState("setup"); // setup | session | grading | results
  const [role, setRole] = useState(ROLES[0]);
  const [customRole, setCustomRole] = useState("");
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [questionCount, setQuestionCount] = useState(5);
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [pastingResume, setPastingResume] = useState(false);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [model, setModel] = useState(null);

  const [messages, setMessages] = useState([]); // {role: 'interviewer'|'candidate', content}
  const [answeredCount, setAnsweredCount] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const savedRef = useRef(false);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => { fetchModels().then((m) => { setModels(m); setModel((c) => c || m[0]?.id); }); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  const effectiveRole = customRole.trim() || role;

  const handleFile = async (file) => {
    if (!file) return;
    setResumeFileName(file.name);
    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const text = await extractPdfText(file);
        setResumeText(text);
      } else {
        setResumeText(await file.text());
      }
    } catch {
      alert("Couldn't read that file — try pasting your resume text instead.");
      setResumeFileName("");
    }
  };

  const startInterview = async () => {
    setBusy(true);
    setStage("session");
    const sys = buildInterviewerSystemPrompt({ role: effectiveRole, difficulty, resumeText, questionCount });
    try {
      const { content } = await chatComplete({
        model,
        temperature: 0.8,
        maxTokens: 400,
        messages: [{ role: "system", content: sys }, { role: "user", content: "Begin the interview." }],
      });
      setMessages([{ role: "interviewer", content, timestamp: Date.now() }]);
    } catch (e) {
      setMessages([{ role: "interviewer", content: "Sorry, I couldn't start the interview: " + e.message, timestamp: Date.now() }]);
    }
    setBusy(false);
  };

  const sys = buildInterviewerSystemPrompt({ role: effectiveRole, difficulty, resumeText, questionCount });

  const sendAnswer = async (text) => {
    const content = (text || input).trim();
    if (!content || busy) return;
    const next = [...messages, { role: "candidate", content, timestamp: Date.now() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    playSound("send");
    const newAnswered = answeredCount + 1;
    setAnsweredCount(newAnswered);
    try {
      const { content: reply } = await chatComplete({
        model,
        temperature: 0.8,
        maxTokens: 400,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "Begin the interview." },
          ...next.map((m) => ({ role: m.role === "interviewer" ? "assistant" : "user", content: m.content })),
        ],
      });
      const done = reply.includes("[INTERVIEW_COMPLETE]") || newAnswered >= questionCount;
      if (!done) {
        setMessages((prev) => [...prev, { role: "interviewer", content: reply, timestamp: Date.now() }]);
        playSound("receive");
      } else {
        setStage("grading");
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "interviewer", content: "Error: " + e.message, timestamp: Date.now() }]);
    }
    setBusy(false);
  };

  const endInterview = () => setStage("grading");

  useEffect(() => {
    if (stage !== "grading") return;
    (async () => {
      const transcript = messages.map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.content}`).join("\n\n");
      const gradingPrompt = [
        `You are grading a mock ${difficulty} ${effectiveRole} interview. Here is the transcript:`,
        transcript,
        `Return ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:`,
        `{"score": <integer 0-100>, "strengths": ["...", "..."], "improvements": ["...", "..."], "tips": ["...", "..."], "next_steps": ["...", "..."]}`,
        `Give 2-4 items per array. Be specific and reference what the candidate actually said.`,
      ].join("\n\n");
      try {
        const { content } = await chatComplete({
          model, temperature: 0.3, maxTokens: 1200,
          messages: [{ role: "user", content: gradingPrompt }],
        });
        const match = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : content);
        setResult({
          score: Math.max(0, Math.min(100, parseInt(parsed.score) || 0)),
          strengths: parsed.strengths || [],
          improvements: parsed.improvements || [],
          tips: parsed.tips || [],
          nextSteps: parsed.next_steps || [],
        });
      } catch (e) {
        setResult({ score: 0, strengths: [], improvements: ["Grading failed: " + e.message], tips: [], nextSteps: [] });
      }
      setStage("results");
    })();
  }, [stage]);

  useEffect(() => {
    if (stage === "results" && result && !savedRef.current) {
      savedRef.current = true;
      addInterviewResult({
        id: uid(), role: effectiveRole, difficulty, score: result.score,
        date: Date.now(), transcript: messages, feedback: result, questionCount,
      });
    }
  }, [stage, result]);

  const toggleRecording = async () => {
    if (recording) { mediaRecorderRef.current?.stop(); return; }
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
        try {
          const text = await transcribeAudio(blob);
          setInput((prev) => (prev ? prev + " " : "") + text);
        } catch { /* ignore transcription failure */ }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const resetAll = () => {
    setStage("setup"); setMessages([]); setAnsweredCount(0); setResult(null);
    savedRef.current = false; setResumeText(""); setResumeFileName("");
  };

  if (stage === "setup") {
    return (
      <div className="main-content">
        <div className="home-hero">
          <div className="hero-badge"><Briefcase size={13} /> INTERVIEW MODE</div>
          <h1 className="hero-title">Practice your next <span>technical interview</span></h1>
          <p className="hero-sub">Pick a role and difficulty, optionally add your resume, and Aura will run a real, adaptive mock interview — then score your answers.</p>
        </div>
        <div className="config-card">
          <div className="config-grid">
            <div className="config-section">
              <div className="config-label">Target Role</div>
              <div className="pill-group">
                {ROLES.map((r) => (
                  <button key={r} className={`pill ${role === r && !customRole ? "active" : ""}`} onClick={() => { setRole(r); setCustomRole(""); }}>{r}</button>
                ))}
              </div>
              <input
                className="config-select" style={{ marginTop: 8 }} placeholder="Or type a custom role…"
                value={customRole} onChange={(e) => setCustomRole(e.target.value)}
              />
            </div>
            <div className="config-section">
              <div className="config-label">Difficulty</div>
              <div className="pill-group">
                {DIFFICULTIES.map((d) => (
                  <button key={d} className={`pill ${difficulty === d ? "active" : ""}`} onClick={() => setDifficulty(d)}>{d}</button>
                ))}
              </div>
              <div className="config-label" style={{ marginTop: 14 }}>Questions</div>
              <div className="pill-group">
                {QUESTION_COUNTS.map((n) => (
                  <button key={n} className={`pill ${questionCount === n ? "active" : ""}`} onClick={() => setQuestionCount(n)}>{n}</button>
                ))}
              </div>
            </div>

            <div className="divider" />

            {!pastingResume ? (
              <label className={`upload-zone ${resumeFileName ? "has-file" : ""}`}>
                <input type="file" accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
                <div className="upload-icon">{resumeFileName ? <FileText size={28} /> : <Upload size={28} />}</div>
                <p>{resumeFileName ? `${resumeFileName} loaded` : <>Drop your resume (PDF/txt) or <span>browse</span> — optional</>}</p>
              </label>
            ) : (
              <div className="config-section" style={{ gridColumn: "1 / -1" }}>
                <div className="config-label">Paste resume text</div>
                <textarea className="config-select" style={{ minHeight: 100, resize: "vertical" }} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume or background here…" />
              </div>
            )}
            <button
              className="pill" style={{ gridColumn: "1 / -1", justifySelf: "start" }}
              onClick={() => setPastingResume((v) => !v)}
            >
              {pastingResume ? "Upload a file instead" : "Or paste resume text instead"}
            </button>

            <button className="start-btn" onClick={startInterview} disabled={busy}>
              <Sparkles size={16} /> Start Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "session" || stage === "grading") {
    const progress = Math.min(100, (answeredCount / questionCount) * 100);
    return (
      <div className="main-content interview-layout">
        <div className="interview-header">
          <div className="interview-meta">
            <span className="meta-badge"><span className="dot" /> {effectiveRole} · {difficulty}</span>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            <span className="meta-badge">{answeredCount}/{questionCount}</span>
          </div>
          <button className="end-btn" onClick={endInterview} disabled={stage === "grading"}>End Interview</button>
        </div>

        <div className="chat-window">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "candidate" ? "user" : "ai"}`}>
                <div className="msg-avatar">{m.role === "candidate" ? <User size={16} /> : <Bot size={16} color="var(--accent)" />}</div>
                <div className="msg-bubble"><ReactMarkdown>{m.content}</ReactMarkdown></div>
              </div>
            ))}
            {busy && (
              <div className="msg ai">
                <div className="msg-avatar"><Bot size={16} color="var(--accent)" /></div>
                <div className="msg-bubble typing-indicator"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
              </div>
            )}
            {stage === "grading" && <div className="msg ai"><div className="msg-bubble">Grading your interview…</div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-area">
            <button className={`mic-btn ${recording ? "recording" : ""}`} onClick={toggleRecording} title="Voice input">
              {recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <textarea
              className="chat-textarea" rows={1} placeholder="Type your answer… (Enter to send)"
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
              disabled={busy || stage === "grading"}
            />
            <button className="send-btn" onClick={() => sendAnswer()} disabled={busy || stage === "grading" || !input.trim()}><Send size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  // results
  return (
    <div className="main-content results-layout">
      <div className="score-hero">
        <ScoreRing score={result?.score ?? 0} />
        <div className="score-title">Interview complete</div>
        <div className="score-sub">{effectiveRole} · {difficulty} · {questionCount} questions</div>
      </div>
      <div className="feedback-grid">
        <div className="feedback-card strengths">
          <div className="feedback-card-title"><CheckCircle2 size={14} /> Strengths</div>
          <ul className="feedback-list">{(result?.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="feedback-card improve">
          <div className="feedback-card-title"><AlertTriangle size={14} /> Areas to improve</div>
          <ul className="feedback-list">{(result?.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="feedback-card tips">
          <div className="feedback-card-title"><Lightbulb size={14} /> Tips</div>
          <ul className="feedback-list">{(result?.tips || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="feedback-card next">
          <div className="feedback-card-title"><ArrowRight size={14} /> Next steps</div>
          <ul className="feedback-list">{(result?.nextSteps || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      </div>
      <div className="results-actions">
        <button className="btn-primary" onClick={resetAll}><RotateCcw size={15} /> Try Again</button>
        <button className="btn-secondary" onClick={() => window.print()}><Download size={15} /> Export PDF</button>
        <button className="btn-secondary" onClick={goToHistory}><HistoryIcon size={15} /> View History</button>
      </div>

      <div className="print-transcript">
        <h1>Interview Report — {effectiveRole} ({difficulty})</h1>
        <p className="print-meta">Score: {result?.score}/100 · {new Date().toLocaleString()}</p>
        <h2>Strengths</h2>
        <ul>{(result?.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h2>Areas to improve</h2>
        <ul>{(result?.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h2>Transcript</h2>
        {messages.map((m, i) => (
          <div key={i} className="print-msg"><strong>{m.role === "candidate" ? "You" : "Interviewer"}:</strong><p>{m.content}</p></div>
        ))}
      </div>
    </div>
  );
}
