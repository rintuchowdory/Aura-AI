const CHAT_KEY = "aura_chat_sessions_v1";
const INTERVIEW_KEY = "aura_interview_history_v1";
const PREFS_KEY = "aura_prefs_v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — silently ignore */
  }
}

export function loadSessions() {
  return read(CHAT_KEY, []);
}
export function saveSessions(sessions) {
  write(CHAT_KEY, sessions);
}

export function loadInterviewHistory() {
  return read(INTERVIEW_KEY, []);
}
export function saveInterviewHistory(history) {
  write(INTERVIEW_KEY, history);
}
export function addInterviewResult(entry) {
  const history = loadInterviewHistory();
  history.unshift(entry);
  saveInterviewHistory(history);
  return history;
}

export function loadPrefs() {
  return read(PREFS_KEY, { theme: "dark", model: null, temperature: 0.7, maxTokens: 1024 });
}
export function savePrefs(prefs) {
  write(PREFS_KEY, prefs);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
