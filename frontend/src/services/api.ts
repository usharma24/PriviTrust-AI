// Self-contained static mock database & risk scoring engine for browser-only mode.
export let API_BASE_URL = "static-mock";

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem("privitrust_api_url", url);
};

export const getApiBaseUrl = () => {
  return localStorage.getItem("privitrust_api_url") || "static-mock";
};

export const autoDetectApiUrl = async (): Promise<string> => {
  return "static-mock";
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  session_id: number;
  risk_score: number;
  status: string;
  challenge_required: string | null;
  otp_simulated?: string | null;
}

const presets = [
  { id: 1, name: "Alice Support", email: "alice_support@privitrust.com", password: "AlicePassword123!", role: "privileged_user" },
  { id: 2, name: "Bob Auditor", email: "bob_auditor@privitrust.com", password: "BobPassword123!", role: "privileged_user" },
  { id: 3, name: "Charlie Engineer", email: "charlie_engineer@privitrust.com", password: "CharliePassword123!", role: "privileged_user" },
  { id: 4, name: "Security Administrator", email: "security_admin@privitrust.com", password: "AdminPassword123!", role: "admin" }
];

// Seed initial mock DB tables if empty
const initMockDB = () => {
  if (!localStorage.getItem("mock_sessions")) {
    localStorage.setItem("mock_sessions", JSON.stringify([]));
  }
  
  if (!localStorage.getItem("mock_security_events")) {
    const defaultEvents = [
      { id: 1, user_id: 1, email: "alice_support@privitrust.com", event_type: "Access granted", severity: "Low", description: "Standard dashboard session initiated from corporate workstation.", created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, user_id: 2, email: "bob_auditor@privitrust.com", event_type: "Resource accessed", severity: "Low", description: "Audit trail log generated: fetched transaction records table.", created_at: new Date(Date.now() - 1800000).toISOString() }
    ];
    localStorage.setItem("mock_security_events", JSON.stringify(defaultEvents));
  }

  if (!localStorage.getItem("mock_audit_logs")) {
    const logs = [];
    const now = Date.now();
    // Pre-populate 30 mock history logs spanning past hours
    for (let i = 30; i >= 0; i--) {
      const ts = new Date(now - i * 45 * 60 * 1000); // every 45 mins
      const userIdx = i % 3;
      const user = presets[userIdx];
      logs.push({
        id: 100 + i,
        user_id: user.id,
        email: user.email,
        event_type: "Action simulation",
        event_description: `Access resource file_${i}.xml`,
        risk_score: Math.floor(10 + (i % 4) * 8 + Math.random() * 5),
        timestamp: ts.toISOString()
      });
    }
    localStorage.setItem("mock_audit_logs", JSON.stringify(logs));
  }
};

// Initialize DB on file load
initMockDB();

const getMockSessions = () => JSON.parse(localStorage.getItem("mock_sessions") || "[]");
const saveMockSessions = (sessions: any[]) => localStorage.setItem("mock_sessions", JSON.stringify(sessions));

const getMockSecurityEvents = () => JSON.parse(localStorage.getItem("mock_security_events") || "[]");
const saveMockSecurityEvents = (events: any[]) => localStorage.setItem("mock_security_events", JSON.stringify(events));

const getMockAuditLogs = () => JSON.parse(localStorage.getItem("mock_audit_logs") || "[]");
const saveMockAuditLogs = (logs: any[]) => localStorage.setItem("mock_audit_logs", JSON.stringify(logs));

export const api = {
  // Authentication
  async login(email: string, password: string, deviceFingerprint: string, browserInfo: string, osInfo: string, ipAddress: string): Promise<LoginResponse> {
    initMockDB();
    const cleanEmail = email.trim().toLowerCase();
    const userPreset = presets.find(p => p.email.toLowerCase() === cleanEmail);
    
    if (!userPreset || password !== userPreset.password) {
      throw new Error("Invalid credentials or access parameters.");
    }

    // Determine initial risk score
    // Untrusted device check (is untrusted if not matching the registered corporate signature or trust settings)
    const isUntrusted = !deviceFingerprint.includes("macbook") && !deviceFingerprint.includes("windows") && !deviceFingerprint.includes("workstation");
    
    // Off hours check (e.g. after 6pm and before 8am)
    const currentHour = new Date().getHours();
    const isOffHours = currentHour >= 18 || currentHour < 8;

    let riskScore = 0;
    if (isUntrusted) riskScore += 30;
    if (isOffHours) riskScore += 15;

    const newSessionId = Math.floor(Math.random() * 900000) + 100000;
    let challenge: string | null = null;
    let status = "Active";
    let otpSimulated = null;

    if (riskScore >= 31 && riskScore <= 60) {
      challenge = "OTP";
      status = "MFA_Pending";
      otpSimulated = "123456";
    } else if (riskScore >= 61) {
      challenge = "ReAuth";
      status = "MFA_Pending";
    }

    const session = {
      id: newSessionId,
      user_id: userPreset.id,
      email: userPreset.email,
      jwt_token: `mock_jwt_${newSessionId}`,
      risk_score: riskScore,
      status: status,
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress,
      login_time: new Date().toISOString()
    };

    const sessions = getMockSessions();
    sessions.push(session);
    saveMockSessions(sessions);

    // Save initial audit log
    const auditLogs = getMockAuditLogs();
    auditLogs.unshift({
      id: Math.floor(Math.random() * 10000),
      user_id: userPreset.id,
      email: userPreset.email,
      event_type: "Login attempt",
      event_description: `User successfully logged in via ${browserInfo} (${osInfo}). Risk: ${riskScore}`,
      risk_score: riskScore,
      timestamp: new Date().toISOString()
    });
    saveMockAuditLogs(auditLogs);

    return {
      access_token: session.jwt_token,
      token_type: "bearer",
      user: {
        id: userPreset.id,
        name: userPreset.name,
        email: userPreset.email,
        role: userPreset.role
      },
      session_id: session.id,
      risk_score: riskScore,
      status: session.status,
      challenge_required: challenge,
      otp_simulated: otpSimulated
    };
  },

  async logout(sessionId: number): Promise<void> {
    const sessions = getMockSessions();
    const updated = sessions.filter((s: any) => s.id !== sessionId);
    saveMockSessions(updated);
    
    localStorage.removeItem("privitrust_token");
    localStorage.removeItem("privitrust_user");
    localStorage.removeItem("privitrust_session_id");
  },

  async verifyOtp(sessionId: number, otpCode: string): Promise<{ success: boolean; message: string }> {
    if (otpCode !== "123456") {
      throw new Error("Invalid OTP code. Please use 123456.");
    }
    
    const sessions = getMockSessions();
    const session = sessions.find((s: any) => s.id === sessionId);
    if (session) {
      session.status = "Active";
      saveMockSessions(sessions);
    }
    return { success: true, message: "OTP verification successful." };
  },

  async reauthenticate(sessionId: number, password: string): Promise<{ success: boolean; message: string }> {
    const sessions = getMockSessions();
    const session = sessions.find((s: any) => s.id === sessionId);
    if (!session) throw new Error("Session not found.");
    
    const userPreset = presets.find(p => p.id === session.user_id);
    if (!userPreset || password !== userPreset.password) {
      throw new Error("Incorrect validation password.");
    }
    
    session.status = "Active";
    saveMockSessions(sessions);
    return { success: true, message: "Re-Authentication successful." };
  },

  // User details
  async getMe(): Promise<User> {
    const activeUserIdStr = localStorage.getItem("privitrust_user");
    if (!activeUserIdStr) throw new Error("No active user session");
    const activeUser = JSON.parse(activeUserIdStr);
    return activeUser;
  },

  async getDevices(): Promise<any[]> {
    const activeUserIdStr = localStorage.getItem("privitrust_user");
    if (!activeUserIdStr) return [];
    const activeUser = JSON.parse(activeUserIdStr);
    
    return [
      { id: 1, user_id: activeUser.id, device_fingerprint: "registered_corp_workstation", device_trust_score: 100, last_used: new Date().toISOString() },
      { id: 2, user_id: activeUser.id, device_fingerprint: "mobile_fingerprint_authenticated", device_trust_score: 90, last_used: new Date(Date.now() - 3600000).toISOString() }
    ];
  },

  // Simulated actions
  async performAction(
    actionType: string,
    resourceCount: number,
    simulatedTime?: string,
    simulatedIp?: string,
    simulatedFingerprint?: string,
    simulatedDeviceTrusted?: boolean
  ): Promise<any> {
    const sessionToken = localStorage.getItem("privitrust_token");
    const sessions = getMockSessions();
    const session = sessions.find((s: any) => s.jwt_token === sessionToken);
    
    if (!session) throw new Error("No active authenticated session.");
    if (session.status === "Blocked") throw new Error("Security Engine Block: session revoked.");

    // Evaluate Risk parameters
    const isUntrusted = simulatedDeviceTrusted === false || (simulatedFingerprint && !simulatedFingerprint.includes("macbook") && !simulatedFingerprint.includes("windows") && !simulatedFingerprint.includes("workstation"));
    
    // Evaluate simulated off hours
    let isOffHours = false;
    if (simulatedTime) {
      const parts = simulatedTime.split(":");
      if (parts.length >= 1) {
        const hour = parseInt(parts[0]);
        isOffHours = hour >= 18 || hour < 8;
      }
    } else {
      const hour = new Date().getHours();
      isOffHours = hour >= 18 || hour < 8;
    }

    // Evaluate excessive access
    const isExcessive = resourceCount > 5 || actionType === "Export Bank Transaction Records";
    
    // Evaluate anomalies (Ml Isolation Forest mock prediction)
    const isAnomalous = actionType.includes("SuperAdmin") || actionType.includes("Restart Core Services") || isUntrusted;

    // Risk Calculation Formula
    let riskScore = 0;
    if (isUntrusted) riskScore += 30;
    if (isAnomalous) riskScore += 25;
    if (isExcessive) riskScore += 20;
    if (isOffHours) riskScore += 15;

    // Limit to 100 max
    riskScore = Math.min(riskScore, 100);
    session.risk_score = riskScore;

    let challenge = null;
    let otpSimulated = null;

    if (riskScore >= 81) {
      session.status = "Blocked";
      challenge = "Block";
    } else if (riskScore >= 61) {
      session.status = "MFA_Pending";
      challenge = "ReAuth";
    } else if (riskScore >= 31) {
      session.status = "MFA_Pending";
      challenge = "OTP";
      otpSimulated = "123456";
    } else {
      session.status = "Active";
    }

    saveMockSessions(sessions);

    // Save audit log
    const auditLogs = getMockAuditLogs();
    const actionLog = {
      id: Math.floor(Math.random() * 100000),
      user_id: session.user_id,
      email: session.email,
      event_type: "Perform action",
      event_description: `Simulated action "${actionType}" executed. Risk Score: ${riskScore}%${isAnomalous ? " [ANOMALY DETECTED]" : ""}`,
      risk_score: riskScore,
      timestamp: new Date().toISOString()
    };
    auditLogs.unshift(actionLog);
    saveMockAuditLogs(auditLogs);

    // Create security warning event if risk exceeds Low (30)
    if (riskScore > 30) {
      const secEvents = getMockSecurityEvents();
      secEvents.unshift({
        id: Math.floor(Math.random() * 10000),
        user_id: session.user_id,
        email: session.email,
        event_type: isAnomalous ? "Anomalous Behavior Alert" : "Elevated Risk Action",
        severity: riskScore >= 81 ? "Critical" : riskScore >= 61 ? "High" : "Medium",
        description: `Risk trigger on operation "${actionType}". Threat rating: ${riskScore}%. IP: ${simulatedIp || session.ip_address}`,
        created_at: new Date().toISOString()
      });
      saveMockSecurityEvents(secEvents);
    }

    return {
      success: riskScore < 81,
      risk_score: riskScore,
      status: session.status,
      challenge_required: challenge,
      otp_simulated: otpSimulated,
      action_logged: actionLog
    };
  },

  // Admin dashboard metrics
  async getAdminDashboard(): Promise<any> {
    initMockDB();
    const sessions = getMockSessions();
    const events = getMockSecurityEvents();

    const lowCount = sessions.filter((s: any) => s.risk_score <= 30).length;
    const medCount = sessions.filter((s: any) => s.risk_score > 30 && s.risk_score <= 60).length;
    const highCount = sessions.filter((s: any) => s.risk_score > 60 && s.risk_score <= 80).length;
    const critCount = sessions.filter((s: any) => s.risk_score > 80).length;

    // Generate average risk trend (6 past points)
    const trend = [24, 30, 28, 35, 41, 38];

    return {
      active_sessions: sessions.length || 3,
      high_risk_users: sessions.filter((s: any) => s.risk_score > 50).length,
      critical_alerts: events.filter((e: any) => e.severity === "Critical").length,
      threat_ratio: events.length > 0 ? Math.floor((events.filter((e: any) => e.severity !== "Low").length / events.length) * 100) : 15,
      risk_distribution: {
        Low: lowCount || 2,
        Medium: medCount || 1,
        High: highCount || 0,
        Critical: critCount || 0
      },
      risk_trend: trend
    };
  },

  async terminateSession(sessionId: number): Promise<any> {
    const sessions = getMockSessions();
    const session = sessions.find((s: any) => s.id === sessionId);
    if (session) {
      session.status = "Blocked";
      session.risk_score = 100;
      saveMockSessions(sessions);

      // Log security event
      const secEvents = getMockSecurityEvents();
      secEvents.unshift({
        id: Math.floor(Math.random() * 10000),
        user_id: session.user_id,
        email: session.email,
        event_type: "Session Revoked",
        severity: "High",
        description: `Active session with ID ${sessionId} was forcibly terminated by security admin command.`,
        created_at: new Date().toISOString()
      });
      saveMockSecurityEvents(secEvents);
    }
    return { success: true, message: "Session terminated successfully." };
  },

  // Admin audit logs & events
  async getAuditLogs(userId?: number, eventType?: string, minRisk?: number): Promise<any[]> {
    initMockDB();
    let logs = getMockAuditLogs();
    
    if (userId) {
      logs = logs.filter((l: any) => l.user_id === userId);
    }
    if (eventType) {
      logs = logs.filter((l: any) => l.event_type.toLowerCase().includes(eventType.toLowerCase()));
    }
    if (minRisk !== undefined) {
      logs = logs.filter((l: any) => l.risk_score >= minRisk);
    }
    return logs;
  },

  async getSecurityEvents(severity?: string): Promise<any[]> {
    initMockDB();
    let events = getMockSecurityEvents();
    if (severity) {
      events = events.filter((e: any) => e.severity.toLowerCase() === severity.toLowerCase());
    }
    return events;
  }
};
