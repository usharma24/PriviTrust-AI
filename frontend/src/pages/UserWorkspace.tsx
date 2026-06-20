import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { User } from "../services/api";
import { 
  Activity, 
  Clock, 
  Cpu, 
  Database, 
  Download, 
  FileText, 
  Fingerprint, 
  Globe, 
  Key, 
  Lock, 
  LogOut, 
  AlertTriangle, 
  CheckCircle,
  ShieldCheck,
  Smartphone
} from "lucide-react";

interface UserWorkspaceProps {
  user: User;
  sessionId: number;
  initialFp: string;
  initialIp: string;
  initialTime: string;
  onLogout: () => void;
  onNavigateToAdmin: () => void;
}

export default function UserWorkspace({ 
  user, 
  sessionId, 
  initialFp, 
  initialIp, 
  initialTime, 
  onLogout,
  onNavigateToAdmin 
}: UserWorkspaceProps) {
  // Environmental Simulation States
  const [ipAddress, setIpAddress] = useState(initialIp || "192.168.1.50");
  const [deviceFp, setDeviceFp] = useState(initialFp || "alice_macbook_chrome_fingerprint");
  const [deviceTrusted, setDeviceTrusted] = useState(true);
  const [timeOverride, setTimeOverride] = useState(initialTime || "");

  // Action status/results
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    status: string;
    message: string;
    riskScore: number;
    riskLevel: string;
    factors: Record<string, boolean>;
  } | null>(null);

  // Live Risk Indicator
  const [liveRisk, setLiveRisk] = useState(0);

  // Adaptive Challenges state
  const [challengeType, setChallengeType] = useState<"OTP" | "ReAuth" | null>(null);
  const [challengeAction, setChallengeAction] = useState<any>(null); // Save action to retry
  
  // Modals inputs
  const [otpCode, setOtpCode] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [simulatedOtpHint, setSimulatedOtpHint] = useState("");
  const [challengeError, setChallengeError] = useState("");

  // Update animated dial when feedback changes
  useEffect(() => {
    if (feedback) {
      setLiveRisk(feedback.riskScore);
    }
  }, [feedback]);

  // List of simulated privileged actions
  const actions = [
    {
      title: "View Support Tickets",
      type: "View Support Tickets",
      desc: "Standard read action. Low risk, regular internal maintenance.",
      icon: <FileText size={20} color="var(--brand)" />,
      count: 1
    },
    {
      title: "Verify Customer Identity",
      type: "Verify Customer Identity",
      desc: "Checks security codes and profile verification details.",
      icon: <ShieldCheck size={20} color="var(--brand)" />,
      count: 1
    },
    {
      title: "Query Customer Transactions",
      type: "Search Account Transactions",
      desc: "Fetches sensitive ledger records for a specific client.",
      icon: <Activity size={20} color="hsl(var(--risk-medium))" />,
      count: 1
    },
    {
      title: "Bulk Account Records Export",
      type: "Export Bank Records",
      desc: "Simulates bulk access (>10 items) resulting in risk flags.",
      icon: <Download size={20} color="hsl(var(--risk-high))" />,
      count: 25
    },
    {
      title: "Modify System Permissions",
      type: "Modify Permissions",
      desc: "Sysadmin privilege management. Highly protected action.",
      icon: <Key size={20} color="hsl(var(--risk-high))" />,
      count: 1
    },
    {
      title: "Restart Core Services",
      type: "Restart Core Services",
      desc: "Triggers system-wide critical component reboot.",
      icon: <Cpu size={20} color="hsl(var(--risk-critical))" />,
      count: 1
    }
  ];

  const handlePerformAction = async (actionItem: typeof actions[0]) => {
    setLoading(true);
    setChallengeError("");
    setSimulatedOtpHint("");
    
    // Compile environmental simulation time
    let formattedTime: string | undefined = undefined;
    if (timeOverride.trim()) {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      formattedTime = `${today}T${timeOverride}:00`;
    }

    try {
      const res = await api.performAction(
        actionItem.type,
        actionItem.count,
        formattedTime,
        ipAddress,
        deviceFp,
        deviceTrusted
      );

      // Handle response status
      if (res.status === "Allowed") {
        setFeedback({
          success: true,
          status: res.status,
          message: res.message,
          riskScore: res.risk_score,
          riskLevel: res.risk_level,
          factors: res.factors
        });
      } else if (res.status === "OTP_Required") {
        setChallengeType("OTP");
        setChallengeAction(actionItem);
        setSimulatedOtpHint(res.otp_simulated || "");
        setLiveRisk(res.risk_score);
      } else if (res.status === "ReAuth_Required") {
        setChallengeType("ReAuth");
        setChallengeAction(actionItem);
        setLiveRisk(res.risk_score);
      }
    } catch (err: any) {
      // If session is blocked or locked out
      setFeedback({
        success: false,
        status: "Blocked",
        message: err.message || "Action blocked: Session terminated or locked.",
        riskScore: 100,
        riskLevel: "Critical",
        factors: { "blocked_session": true }
      });
      // Redirect or log out after a brief wait if blocked
      if (err.message.includes("blocked") || err.message.includes("locked")) {
        setLiveRisk(100);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setChallengeError("");

    try {
      const res = await api.verifyOtp(sessionId, otpCode);
      if (res.success && challengeAction) {
        setChallengeType(null);
        setOtpCode("");
        // Re-execute action now that MFA has succeeded
        await handlePerformAction(challengeAction);
      }
    } catch (err: any) {
      setChallengeError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setChallengeError("");

    try {
      const res = await api.reauthenticate(sessionId, passwordInput);
      if (res.success && challengeAction) {
        setChallengeType(null);
        setPasswordInput("");
        // Re-execute action now that re-auth succeeded
        await handlePerformAction(challengeAction);
      }
    } catch (err: any) {
      setChallengeError(err.message || "Re-authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  // Determine risk dial colors
  const getRiskColor = (score: number) => {
    if (score <= 30) return "hsl(var(--risk-low))";
    if (score <= 60) return "hsl(var(--risk-medium))";
    if (score <= 80) return "hsl(var(--risk-high))";
    return "hsl(var(--risk-critical))";
  };

  const getRiskDialRotation = (score: number) => {
    // Semi-circle gauge rotation from -90 to 90 degrees
    const percentage = score / 100;
    return -90 + percentage * 180;
  };

  return (
    <div className="app-container">
      {/* Workspace Sidebar */}
      <div className="sidebar">
        <div>
          <div className="brand-section">
            <div className="brand-logo">P</div>
            <div>
              <span className="brand-title">PriviTrust AI</span>
              <div style={{ fontSize: "0.65rem", color: "var(--brand)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>
                Active Session
              </div>
            </div>
          </div>

          <div style={{ padding: "0 12px 20px 12px", borderBottom: "1px solid var(--border-color)", marginBottom: "20px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              CURRENT ENVIRONMENT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Globe size={12} color="var(--brand)" />
                <span style={{ fontWeight: "500" }}>IP: {ipAddress}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Fingerprint size={12} color="var(--brand)" />
                <span style={{ fontWeight: "500", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  FP: {deviceFp.substring(0, 16)}...
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={12} color="var(--brand)" />
                <span style={{ fontWeight: "500" }}>
                  Time: {timeOverride ? `${timeOverride} (Simulated)` : "Live System Time"}
                </span>
              </div>
            </div>
          </div>

          <ul className="nav-list">
            <li className="nav-item active">
              <Database size={18} />
              <span>Action Workspace</span>
            </li>
            {user.role === "admin" && (
              <li className="nav-item" onClick={onNavigateToAdmin}>
                <Smartphone size={18} />
                <span>Security Dashboard</span>
              </li>
            )}
          </ul>
        </div>

        <div className="user-profile-section" style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="user-avatar">
              {user.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-role-badge">{user.role.replace("_", " ")}</div>
            </div>
          </div>
          <button 
            onClick={() => api.logout(sessionId).then(onLogout)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "8px", 
              padding: "10px", 
              border: "1px solid var(--border-color)", 
              borderRadius: "8px", 
              backgroundColor: "transparent",
              color: "hsl(var(--risk-critical))",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "var(--transition-smooth)"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "hsla(0, 84.2%, 60.2%, 0.05)"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <LogOut size={14} />
            <span>End Work Session</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="main-content">
        <div className="header-bar">
          <div>
            <h1 style={{ fontSize: "1.5rem", letterSpacing: "-0.01em" }}>Employee Workspace</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Perform operations and monitor your continuous trust status.
            </p>
          </div>
          {user.role === "admin" && (
            <button 
              onClick={onNavigateToAdmin}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--brand-light)",
                color: "var(--brand)",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              Go to Security Admin Dashboard
            </button>
          )}
        </div>

        <div className="content-body">
          <div className="sim-grid">
            
            {/* Simulation controls panel */}
            <div className="sim-sidebar">
              <div className="card" style={{ padding: "20px" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Globe size={18} color="var(--brand)" />
                  <span>Environment Simulator</span>
                </h3>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="workspaceIp">IP Address</label>
                  <input
                    id="workspaceIp"
                    type="text"
                    className="form-input"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="workspaceFp">Device Fingerprint</label>
                  <input
                    id="workspaceFp"
                    type="text"
                    className="form-input"
                    value={deviceFp}
                    onChange={(e) => setDeviceFp(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="workspaceTime">Time of Action Override</label>
                  <input
                    id="workspaceTime"
                    type="text"
                    placeholder="e.g. 23:30 (leave blank for live)"
                    className="form-input"
                    value={timeOverride}
                    onChange={(e) => setTimeOverride(e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                  <input
                    id="deviceTrustedCheckbox"
                    type="checkbox"
                    checked={deviceTrusted}
                    onChange={(e) => setDeviceTrusted(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="deviceTrustedCheckbox" style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--primary-light)", cursor: "pointer" }}>
                    Force Device Trusted Status
                  </label>
                </div>
              </div>

              {/* Animated Risk Dial Card */}
              <div className="card" style={{ textAlign: "center", padding: "24px" }}>
                <h3 style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Active Trust Score
                </h3>
                
                <div style={{ position: "relative", width: "180px", height: "110px", margin: "0 auto" }}>
                  {/* Gauge SVG */}
                  <svg width="180" height="100" viewBox="0 0 100 55">
                    {/* Background gauge */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                    
                    {/* Colored risk gauge */}
                    <path 
                      d="M 10 50 A 40 40 0 0 1 90 50" 
                      fill="none" 
                      stroke={getRiskColor(liveRisk)} 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray="126"
                      strokeDashoffset={126 - (liveRisk / 100) * 126}
                      style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.8s ease" }}
                    />
                    
                    {/* Dial needle */}
                    <g transform="translate(50, 50)">
                      <line 
                        x1="0" y1="0" x2="0" y2="-38" 
                        stroke="#0f172a" 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        transform={`rotate(${getRiskDialRotation(liveRisk)})`}
                        style={{ transition: "transform 0.8s cubic-bezier(0.18, 0.89, 0.32, 1.28)" }}
                      />
                      <circle cx="0" cy="0" r="4" fill="#0f172a" />
                    </g>
                  </svg>
                  
                  <div style={{ position: "absolute", bottom: "0", left: "0", right: "0" }}>
                    <div style={{ fontSize: "1.65rem", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                      {liveRisk.toFixed(0)} Risk
                    </div>
                    <div style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: "700", 
                      textTransform: "uppercase", 
                      color: getRiskColor(liveRisk),
                      letterSpacing: "1px",
                      marginTop: "2px"
                    }}>
                      {liveRisk <= 30 ? "TRUSTED (LOW)" : liveRisk <= 60 ? "ELEVATED (MEDIUM)" : liveRisk <= 80 ? "HIGH RISK" : "SESSION BLOCKED"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action triggering console */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card">
                <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Continuous Action Console</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                  Select an administrative action below to simulate operation logs. The engine will continuously score trust and adjust verification challenges.
                </p>

                <div className="action-grid">
                  {actions.map((act) => (
                    <button
                      key={act.title}
                      onClick={() => handlePerformAction(act)}
                      disabled={loading || liveRisk >= 81}
                      className="action-btn-card"
                    >
                      <div className="action-title">
                        <span>{act.title}</span>
                        {act.icon}
                      </div>
                      <p className="action-desc">{act.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action output logs / feedback */}
              <div className="card" style={{ flexGrow: 1 }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>Action Engine Diagnostics</h3>
                
                {!feedback ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    <Activity size={32} style={{ marginBottom: "12px", opacity: "0.5" }} />
                    <p style={{ fontSize: "0.9rem" }}>No action execution logs. Trigger an action from the console above.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "12px", 
                      padding: "12px 16px", 
                      borderRadius: "8px", 
                      backgroundColor: feedback.success ? "hsla(142.1, 76.2%, 36.3%, 0.05)" : "hsla(0, 84.2%, 60.2%, 0.05)",
                      border: `1px solid ${feedback.success ? "hsla(142.1, 76.2%, 36.3%, 0.2)" : "hsla(0, 84.2%, 60.2%, 0.2)"}`
                    }}>
                      {feedback.success ? (
                        <CheckCircle size={20} color="hsl(var(--risk-low))" />
                      ) : (
                        <AlertTriangle size={20} color="hsl(var(--risk-critical))" />
                      )}
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "0.95rem", color: feedback.success ? "hsl(var(--risk-low))" : "hsl(var(--risk-critical))" }}>
                          {feedback.status === "Allowed" ? "Action Allowed" : "Security Intercepted"}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "var(--primary-light)" }}>{feedback.message}</div>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" }}>
                        Risk Contributor Breakdown
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                        {Object.entries(feedback.factors).map(([factorName, triggered]) => (
                          <div 
                            key={factorName} 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between",
                              padding: "10px 12px", 
                              borderRadius: "6px", 
                              border: "1px solid var(--border-color)",
                              backgroundColor: triggered ? "hsla(12, 88%, 53%, 0.03)" : "var(--bg-tertiary)",
                              fontSize: "0.8rem"
                            }}
                          >
                            <span style={{ fontWeight: "500", textTransform: "capitalize" }}>
                              {factorName.replace(/_/g, " ")}
                            </span>
                            <span style={{ 
                              fontWeight: "700", 
                              color: triggered ? "hsl(var(--risk-high))" : "hsl(var(--risk-low))" 
                            }}>
                              {triggered ? "+ Triggered" : "Normal"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Verification Challenges Modals */}
      {challengeType === "OTP" && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "50%", 
                backgroundColor: "hsla(37.7, 92.1%, 50.2%, 0.1)", 
                display: "inline-flex", 
                alignItems: "center", 
                justifyContent: "center",
                marginBottom: "12px"
              }}>
                <Smartphone size={24} color="hsl(var(--risk-medium))" />
              </div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Adaptive Verification</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                Your current risk score ({liveRisk}) triggers a Multi-Factor Authentication challenge.
              </p>
            </div>

            {simulatedOtpHint && (
              <div className="risk-medium-bg" style={{ padding: "10px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "hsl(var(--risk-medium))", fontWeight: "500", marginBottom: "16px", textAlign: "center" }}>
                <span>Simulated push code: <b>{simulatedOtpHint}</b></span>
              </div>
            )}

            {challengeError && (
              <div className="risk-critical-bg" style={{ padding: "10px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "hsl(var(--risk-critical))", fontWeight: "500", marginBottom: "16px", textAlign: "center" }}>
                {challengeError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ marginBottom: "0" }}>
                <label className="form-label" htmlFor="verifyOtpCode">Enter 6-Digit OTP</label>
                <input
                  id="verifyOtpCode"
                  type="text"
                  placeholder="000000"
                  className="form-input"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  style={{ textAlign: "center", letterSpacing: "4px", fontSize: "1.1rem" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "10px",
                  backgroundColor: "var(--brand)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                {loading ? "Verifying..." : "Verify & Continue Action"}
              </button>
              
              <button
                type="button"
                onClick={() => setChallengeType(null)}
                style={{
                  padding: "10px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {challengeType === "ReAuth" && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "50%", 
                backgroundColor: "hsla(12, 88%, 53%, 0.1)", 
                display: "inline-flex", 
                alignItems: "center", 
                justifyContent: "center",
                marginBottom: "12px"
              }}>
                <Lock size={24} color="hsl(var(--risk-high))" />
              </div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: "700" }}>Identity Confirmation</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                High risk score ({liveRisk}) requires re-authentication. Enter your password to proceed.
              </p>
            </div>

            {challengeError && (
              <div className="risk-critical-bg" style={{ padding: "10px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "hsl(var(--risk-critical))", fontWeight: "500", marginBottom: "16px", textAlign: "center" }}>
                {challengeError}
              </div>
            )}

            <form onSubmit={handleReauth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group" style={{ marginBottom: "0" }}>
                <label className="form-label" htmlFor="verifyPassword">Password</label>
                <input
                  id="verifyPassword"
                  type="password"
                  placeholder="Enter account password"
                  className="form-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "10px",
                  backgroundColor: "var(--brand)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                {loading ? "Re-authenticating..." : "Verify & Continue Action"}
              </button>
              
              <button
                type="button"
                onClick={() => setChallengeType(null)}
                style={{
                  padding: "10px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
