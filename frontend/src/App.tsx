import { useState, useEffect } from "react";
import Login from "./pages/Login";
import UserWorkspace from "./pages/UserWorkspace";
import AdminDashboard from "./pages/AdminDashboard";
import type { LoginResponse, User } from "./services/api";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Environmental simulation states passed from login
  const [initialFp, setInitialFp] = useState("alice_macbook_chrome_fingerprint");
  const [initialIp, setInitialIp] = useState("192.168.1.50");
  const [initialTime, setInitialTime] = useState("");

  // Navigation: 'workspace' | 'admin'
  const [currentView, setCurrentView] = useState<"workspace" | "admin">("workspace");

  useEffect(() => {
    const storedToken = localStorage.getItem("privitrust_token");
    const storedUser = localStorage.getItem("privitrust_user");
    const storedSession = localStorage.getItem("privitrust_session_id");

    if (storedToken && storedUser && storedSession) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setSessionId(parseInt(storedSession));
    }
  }, []);

  const handleLoginSuccess = (
    data: LoginResponse,
    customFp: string,
    customIp: string,
    customTime: string
  ) => {
    setToken(data.access_token);
    setUser(data.user);
    setSessionId(data.session_id);
    setInitialFp(customFp);
    setInitialIp(customIp);
    setInitialTime(customTime);

    // Default redirection
    if (data.user.role === "admin") {
      setCurrentView("admin");
    } else {
      setCurrentView("workspace");
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSessionId(null);
    setCurrentView("workspace");
  };

  // Render Login page if not authenticated
  if (!token || !user || !sessionId) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Admin View
  if (currentView === "admin" && user.role === "admin") {
    return (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        onNavigateToWorkspace={() => setCurrentView("workspace")}
      />
    );
  }

  // Default: Workspace View
  return (
    <UserWorkspace
      user={user}
      sessionId={sessionId}
      initialFp={initialFp}
      initialIp={initialIp}
      initialTime={initialTime}
      onLogout={handleLogout}
      onNavigateToAdmin={() => setCurrentView("admin")}
    />
  );
}
