import { Sparkles, MessageSquare, Briefcase, History, Sun, Moon } from "lucide-react";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "interview", label: "Interview", icon: Briefcase },
  { id: "history", label: "History", icon: History },
];

export default function Navbar({ view, setView, theme, toggleTheme }) {
  return (
    <div className="navbar">
      <a className="nav-brand" onClick={() => setView("chat")}>
        <div className="brand-icon">
          <Sparkles size={18} color="white" />
        </div>
        <span className="nav-title">Aura AI</span>
      </a>
      <div className="nav-links">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${view === t.id || (t.id === "interview" && view.startsWith("interview")) ? "active" : ""}`}
            onClick={() => setView(t.id === "interview" ? "interview-setup" : t.id)}
          >
            <t.icon size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
            {t.label}
          </button>
        ))}
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </div>
  );
}
