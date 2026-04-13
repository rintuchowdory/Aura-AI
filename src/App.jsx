import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { Toaster } from "sonner";
import Layout from "./Layout";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Chat />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
