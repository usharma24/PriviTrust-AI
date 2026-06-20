import { useState } from "react";
import { api, getApiBaseUrl, setApiBaseUrl } from "../services/api";
import type { LoginResponse } from "../services/api";
import { Shield, Lock, Monitor, Globe, Key, AlertTriangle, Settings } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (data: LoginResponse, customFp: string, customIp: string, customTime: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState("alice_support@privitrust.com");
  const [password, setPassword] = useState("AlicePassword123!");
  
  // Device Simulation Parameters
  const [ipAddress, setIpAddress] = useState("192.168.1.50");
  const [deviceFp, setDeviceFp] = useState("alice_macbook_chrome_fingerprint");
  const [browserInfo, setBrowserInfo] = useState("Chrome v124.0.0");
  const [osInfo, setOsInfo] = useState("macOS Sonoma");
  const [simulatedTime, setSimulatedTime] = useState("");

  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [tempLoginRes, setTempLoginRes] = useState<LoginResponse | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [showApiSettings, setShowApiSettings] = useState(false);

  // Preset accounts for convenience
  const presets = [
    {
      name: "Alice Support (Privileged)",
      email: "alice_support@privitrust.com",
      password: "AlicePassword123!",
      fp: "alice_macbook_chrome_fingerprint",
      os: "macOS Sonoma",
      browser: "Chrome v124.0.0",
      ip: "192.168.1.50"
    },
    {
      name: "Bob Auditor (Privileged)",
      email: "bob_auditor@privitrust.com",
      password: "BobPassword123!",
      fp: "bob_windows_edge_fingerprint",
      os: "Windows 11",
      browser: "Edge v123.0.0",
      ip: "192.168.1.72"
    },
    {
      name: "Security Admin (Dashboard)",
      email: "security_admin@privitrust.com",
      password: "AdminPassword123!",
      fp: "admin_workstation_fingerprint",
      os: "Windows 11",
      browser: "Chrome v124.0.0",
      ip: "10.0.0.15"
    }
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setEmail(p.email);
    setPassword(p.password);
    setDeviceFp(p.fp);
    setOsInfo(p.os);
    setBrowserInfo(p.browser);
    setIpAddress(p.ip);
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.login(email, password, deviceFp, browserInfo, osInfo, ipAddress);
      
      if (res.challenge_required === "OTP") {
        // Multi-Factor Authentication is triggered
        setTempLoginRes(res);
        setOtpMode(true);
        // OTP is generated and outputted. For simulation purpose, let's fetch it or output a hint
        // In backend, OTP is saved under user.id. Since we cannot read backend logs directly in the UI,
        // the backend logs the OTP. For interactive ease, we display a mock simulated alert showing the OTP.
        // We will mock calculate what the OTP is, or we can fetch a fake push alert.
        // Since we want this completely functional, the backend can return the OTP in header, 
        // but wait! The backend auth/login endpoint actually puts a print log. 
        // Wait, how does the user know the OTP code? Let's check:
        // In our auth_routes login, we return a dict with OTP challenge. We can check if backend returns a mock OTP field or we can guess it.
        // Let's see: we can write a simple endpoint or just return a response where if it is a simulation, 
        // we can fetch the OTP or let the user enter any 6 digits for the demo, or display a simulated push toast.
        // Wait! In `auth_routes.py`, `response_data` did NOT include `otp_simulated`, but we can query it or we can look up the code.
        // Ah! In `auth_routes.py` `response_data` does not return it, but wait! The code says:
        // `print(f"SIMULATED OTP generated for {user.name}: {otp_code}")`
        // Since the backend is running in the background, we can change `auth_routes.py` to return the `otp_simulated` 
        // in the JSON response when in DEVELOPMENT/SIMULATION mode so that it's easy to read! 
        // Wait, in my `ActionPerformResponse` Pydantic model, I added `otp_simulated: Optional[str] = None`.
        // But in `LoginResponse` Pydantic model, I did not add it. Let's modify `auth_routes.py` so that `LoginResponse` (or login API response) 
        // includes `otp_simulated` as well, so the frontend can Toast it! That is a genius idea for a self-contained web app demo!
        // Let's modify `auth_routes.py` to return `otp_simulated` in the login response if OTP is triggered, and let's add it to `LoginResponse` in `schemas.py`.
        // Let's double check if we can do this. Yes, let's make sure it's returned.
        // Let's check if the login response has it:
        // In `auth_routes.py` line 144:
        // `response_data = { ... "challenge_required": challenge_required }`
        // We can add `"otp_simulated": otp_code if challenge_required == "OTP" else None` to `response_data`.
        // Let's check `schemas.py`: `LoginResponse` has `challenge_required: Optional[str] = None`. Let's add `otp_simulated: Optional[str] = None`.
        // Let's implement that quick edit in `schemas.py` and `auth_routes.py`.
        // Wait, we can write it into Login.tsx first and support both. In Login.tsx, we will check if `res.otp_simulated` exists and display it!
        // If it exists, we display a beautiful green alert: "Simulated MFA Push: Use code 123456 to verify."
      } else {
        // Active session directly
        localStorage.setItem("privitrust_token", res.access_token);
        localStorage.setItem("privitrust_user", JSON.stringify(res.user));
        localStorage.setItem("privitrust_session_id", res.session_id.toString());
        onLoginSuccess(res, deviceFp, ipAddress, simulatedTime);
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials or blocked access.");
    } finally {
      setLoading(false);
    }
  };

  // If OTP is required, we verify it
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempLoginRes) return;
    setLoading(true);
    setError("");

    try {
      const res = await api.verifyOtp(tempLoginRes.session_id, otpCode);
      if (res.success) {
        localStorage.setItem("privitrust_token", tempLoginRes.access_token);
        localStorage.setItem("privitrust_user", JSON.stringify(tempLoginRes.user));
        localStorage.setItem("privitrust_session_id", tempLoginRes.session_id.toString());
        onLoginSuccess(tempLoginRes, deviceFp, ipAddress, simulatedTime);
      }
    } catch (err: any) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left side: Premium Banking Branding */}
      <div className="login-left-banner">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ 
            width: "40px", 
            height: "40px", 
            borderRadius: "8px", 
            background: "linear-gradient(135deg, #2563eb, #4f46e5)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            fontWeight: "bold",
            fontSize: "1.25rem" 
          }}>P</div>
          <span style={{ fontSize: "1.25rem", fontWeight: "700", letterSpacing: "-0.02em" }}>PriviTrust AI</span>
        </div>

        <div style={{ maxWidth: "520px", margin: "auto 0" }}>
          <h1 style={{ color: "#ffffff", fontSize: "2.8rem", lineHeight: "1.15", fontWeight: "700", marginBottom: "20px" }}>
            Trust Every Action,<br />
            <span style={{ color: "#3b82f6" }}>Not Just Every Login.</span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "1.1rem", lineHeight: "1.6", marginBottom: "32px" }}>
            A Continuous Identity Trust Framework evaluating session behavior, device signatures, and risk markers in real-time. Secure privileged accounts dynamically with adaptive authentication challenges.
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.95rem" }}>
              <Shield size={18} color="#3b82f6" />
              <span>Behavioral Profiling via Isolation Forest</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.95rem" }}>
              <Lock size={18} color="#3b82f6" />
              <span>Dynamic Multi-Factor Authentication Challenges</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.95rem" }}>
              <Monitor size={18} color="#3b82f6" />
              <span>Real-Time Device Trust Signature Verification</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
          © 2026 PriviTrust AI. All rights reserved. Secure Banking Portal.
        </div>
      </div>

      {/* Right side: Login and Simulation configuration */}
      <div className="login-right-form">
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>
              {otpMode ? "Verify Identity" : "Secure Gate Login"}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {otpMode ? "Multi-Factor Authentication required due to elevated access parameters." : "Access bank internal network and administrative systems."}
            </p>
            
            <div style={{ display: "flex", marginTop: "12px" }}>
              <button 
                type="button" 
                onClick={() => setShowApiSettings(!showApiSettings)} 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  fontSize: "0.8rem", 
                  color: "var(--brand)", 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer",
                  fontWeight: "600",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  backgroundColor: "var(--brand-light)"
                }}
              >
                <Settings size={14} />
                <span>API Server Settings</span>
              </button>
            </div>

            {showApiSettings && (
              <div style={{ 
                marginTop: "12px", 
                padding: "16px", 
                backgroundColor: "var(--bg-tertiary)", 
                border: "1px solid var(--border-color)", 
                borderRadius: "8px"
              }}>
                <label className="form-label" style={{ fontSize: "0.75rem" }} htmlFor="apiUrlInput">Backend API Server URL</label>
                <input 
                  id="apiUrlInput"
                  type="text" 
                  className="form-input" 
                  value={apiUrl} 
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    setApiBaseUrl(e.target.value);
                  }}
                  placeholder="http://localhost:8000"
                  style={{ fontSize: "0.85rem", padding: "8px", marginTop: "4px" }}
                />
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "8px", lineHeight: "1.3" }}>
                  * Change this to <code>http://192.168.1.10:8000</code> if loading on your mobile phone on the same Wi-Fi.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="risk-critical-bg" style={{ 
              padding: "12px 16px", 
              borderRadius: "8px", 
              color: "hsl(var(--risk-critical))", 
              fontSize: "0.85rem", 
              fontWeight: "500", 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              marginBottom: "20px" 
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {otpMode && (
            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="risk-medium-bg" style={{ padding: "12px 16px", borderRadius: "8px", fontSize: "0.85rem", color: "hsl(var(--risk-medium))", fontWeight: "500" }}>
                <span>Verification code sent. For demonstration, check backend logs or use code: <b>{tempLoginRes?.otp_simulated || "MFA Code"}</b></span>
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="otpCode">OTP Code</label>
                <div style={{ position: "relative" }}>
                  <Key size={18} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    id="otpCode"
                    type="text"
                    placeholder="Enter 6-digit verification code"
                    className="form-input"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    style={{ paddingLeft: "40px", fontSize: "1.1rem", letterSpacing: "4px", textAlign: "center" }}
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--brand)",
                  color: "#ffffff",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.95rem"
                }}
              >
                {loading ? "Verifying..." : "Confirm Verification"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpMode(false);
                  setOtpCode("");
                  setError("");
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "transparent",
                  color: "var(--text-muted)",
                  fontWeight: "500",
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Back to Sign In
              </button>
            </form>
          )}

          {!otpMode && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Work Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Security Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Simulation overrides collapsible/header */}
              <div style={{ 
                border: "1px solid var(--border-color)", 
                borderRadius: "10px", 
                padding: "16px", 
                backgroundColor: "var(--bg-tertiary)",
                marginTop: "8px",
                marginBottom: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", fontWeight: "600", color: "var(--primary)", marginBottom: "12px" }}>
                  <Globe size={14} color="var(--brand)" />
                  <span>SIMULATION ENVIRONMENTAL FACTOR INJECTION</span>
                </div>
                
                <div className="login-sim-grid">
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }} htmlFor="simIp">Simulated IP</label>
                    <input
                      id="simIp"
                      type="text"
                      className="form-input"
                      style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }} htmlFor="simFp">Device Fingerprint</label>
                    <input
                      id="simFp"
                      type="text"
                      className="form-input"
                      style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                      value={deviceFp}
                      onChange={(e) => setDeviceFp(e.target.value)}
                    />
                  </div>
                </div>

                <div className="login-sim-grid" style={{ marginTop: "4px" }}>
                  <div className="form-group" style={{ marginBottom: "0" }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }} htmlFor="simOs">Simulated OS</label>
                    <input
                      id="simOs"
                      type="text"
                      className="form-input"
                      style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                      value={osInfo}
                      onChange={(e) => setOsInfo(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "0" }}>
                    <label className="form-label" style={{ fontSize: "0.75rem" }} htmlFor="simTime">Login Time Override</label>
                    <input
                      id="simTime"
                      type="text"
                      placeholder="e.g. 23:00 (Night)"
                      className="form-input"
                      style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                      value={simulatedTime}
                      onChange={(e) => setSimulatedTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--brand)",
                  color: "#ffffff",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  marginTop: "8px"
                }}
              >
                {loading ? "Authenticating..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Quick presets list */}
          {!otpMode && (
            <div style={{ marginTop: "28px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "10px", textAlign: "center" }}>
                QUICK-LOGIN PRESET ACCOUNTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {presets.map((p) => (
                  <button
                    key={p.email}
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", color: "var(--primary)" }}>{p.name}</div>
                      <div style={{ color: "var(--text-muted)" }}>{p.email}</div>
                    </div>
                    <span style={{ color: "var(--brand)", fontWeight: "500" }}>Select</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
