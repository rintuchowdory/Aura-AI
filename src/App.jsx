import { useState, useEffect } from "react";
import AuroraBackground from "./components/AuroraBackground";
import Navbar from "./components/Navbar";
import ChatView from "./components/ChatView";
import Interview from "./components/Interview";
import HistoryView from "./components/HistoryView";
import { loadPrefs, savePrefs } from "./lib/storage";

export default function App() {
  const [view, setView] = useState("chat");
  const [theme, setTheme] = useState(() => loadPrefs().theme || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    savePrefs({ ...loadPrefs(), theme });
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <>
      <AuroraBackground />
      <Navbar view={view} setView={setView} theme={theme} toggleTheme={toggleTheme} />
      {view === "chat" && <ChatView />}
      {view.startsWith("interview") && <Interview goToHistory={() => setView("history")} />}
      {view === "history" && <HistoryView />}
    </>
  );
}
