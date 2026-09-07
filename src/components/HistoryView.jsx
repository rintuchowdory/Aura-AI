import { useState } from "react";
import { Trash2, Award, TrendingUp, ListChecks } from "lucide-react";
import { loadInterviewHistory, saveInterviewHistory } from "../lib/storage";

function scoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 55) return "var(--amber)";
  return "var(--red)";
}

export default function HistoryView() {
  const [history, setHistory] = useState(() => loadInterviewHistory());
  const [selected, setSelected] = useState(null);

  const remove = (id) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveInterviewHistory(next);
    if (selected?.id === id) setSelected(null);
  };

  const avg = history.length ? Math.round(history.reduce((a, h) => a + h.score, 0) / history.length) : 0;
  const best = history.length ? Math.max(...history.map((h) => h.score)) : 0;

  if (selected) {
    return (
      <div className="main-content results-layout">
        <button className="btn-secondary" style={{ alignSelf: "flex-start", flex: "none" }} onClick={() => setSelected(null)}>← Back to history</button>
        <div className="score-hero">
          <div className="score-title" style={{ color: scoreColor(selected.score) }}>{selected.score}/100</div>
          <div className="score-sub">{selected.role} · {selected.difficulty} · {new Date(selected.date).toLocaleString()}</div>
        </div>
        <div className="feedback-grid">
          <div className="feedback-card strengths">
            <div className="feedback-card-title">Strengths</div>
            <ul className="feedback-list">{(selected.feedback?.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div className="feedback-card improve">
            <div className="feedback-card-title">Areas to improve</div>
            <ul className="feedback-list">{(selected.feedback?.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content history-layout">
      <div className="history-header">
        <div className="history-title">Interview History</div>
      </div>
      {history.length > 0 && (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-value">{history.length}</div><div className="stat-label">Interviews</div></div>
          <div className="stat-card"><div className="stat-value">{avg}</div><div className="stat-label">Avg Score</div></div>
          <div className="stat-card"><div className="stat-value">{best}</div><div className="stat-label">Best Score</div></div>
        </div>
      )}
      {history.length === 0 ? (
        <div className="history-empty">
          <div className="empty-icon"><ListChecks size={40} /></div>
          <p>No interviews yet — head to Interview mode to run your first mock interview.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <div key={h.id} className="history-card" onClick={() => setSelected(h)}>
              <div className="history-score" style={{ background: `${scoreColor(h.score)}22`, color: scoreColor(h.score) }}>{h.score}</div>
              <div className="history-info">
                <div className="history-role">{h.role}</div>
                <div className="history-meta">
                  <span>{h.difficulty}</span>
                  <span>{h.questionCount} questions</span>
                  <span>{new Date(h.date).toLocaleDateString()}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); remove(h.id); }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
