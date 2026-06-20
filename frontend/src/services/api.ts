export let API_BASE_URL = localStorage.getItem("privitrust_api_url") || "http://localhost:8000";

export const setApiBaseUrl = (url: string) => {
  API_BASE_URL = url;
  localStorage.setItem("privitrust_api_url", url);
};

export const getApiBaseUrl = () => API_BASE_URL;

const probeUrl = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${url}/`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e) {
    return false;
  }
};

export const autoDetectApiUrl = async (): Promise<string> => {
  if (localStorage.getItem("privitrust_api_url")) {
    return API_BASE_URL;
  }
  
  const candidates = [
    "http://localhost:8000",
    "http://192.168.1.10:8000",
    "https://16f809b4764337.lhr.life"
  ];
  
  for (const url of candidates) {
    const isAlive = await probeUrl(url);
    if (isAlive) {
      API_BASE_URL = url;
      return url;
    }
  }
  return API_BASE_URL;
};

// Helper to get auth headers
function getHeaders() {
  const token = localStorage.getItem("privitrust_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

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

export const api = {
  // Authentication
  async login(email: string, password: string, deviceFingerprint: string, browserInfo: string, osInfo: string, ipAddress: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        device_fingerprint: deviceFingerprint,
        browser_info: browserInfo,
        os_info: osInfo,
        ip_address: ipAddress
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Authentication failed");
    }
    return res.json();
  },

  async logout(sessionId: number): Promise<void> {
    await fetch(`${API_BASE_URL}/auth/logout?session_id=${sessionId}`, {
      method: "POST",
      headers: getHeaders(),
    });
    localStorage.removeItem("privitrust_token");
    localStorage.removeItem("privitrust_user");
    localStorage.removeItem("privitrust_session_id");
  },

  async verifyOtp(sessionId: number, otpCode: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-otp?session_id=${sessionId}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ otp_code: otpCode })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Verification failed" }));
      throw new Error(err.detail || "Invalid OTP");
    }
    return res.json();
  },

  async reauthenticate(sessionId: number, password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/reauth?session_id=${sessionId}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Reauth failed" }));
      throw new Error(err.detail || "Incorrect password");
    }
    return res.json();
  },

  // User details
  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/users/me`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch user context");
    return res.json();
  },

  async getDevices(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/users/devices`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch registered devices");
    return res.json();
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
    const res = await fetch(`${API_BASE_URL}/actions/perform`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        action_type: actionType,
        resource_count: resourceCount,
        simulated_time: simulatedTime || null,
        simulated_ip: simulatedIp || null,
        simulated_fingerprint: simulatedFingerprint || null,
        simulated_device_trusted: simulatedDeviceTrusted !== undefined ? simulatedDeviceTrusted : null
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Action block" }));
      throw new Error(err.detail || "Session locked or blocked");
    }
    return res.json();
  },

  // Admin dashboard metrics
  async getAdminDashboard(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Access denied: Admin role required");
    return res.json();
  },

  async terminateSession(sessionId: number): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/admin/sessions/terminate/${sessionId}`, {
      method: "POST",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to terminate session");
    return res.json();
  },

  // Admin audit logs & events
  async getAuditLogs(userId?: number, eventType?: string, minRisk?: number): Promise<any[]> {
    let url = `${API_BASE_URL}/admin/audit-logs?`;
    if (userId) url += `user_id=${userId}&`;
    if (eventType) url += `event_type=${encodeURIComponent(eventType)}&`;
    if (minRisk !== undefined) url += `min_risk=${minRisk}&`;
    
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  },

  async getSecurityEvents(severity?: string): Promise<any[]> {
    let url = `${API_BASE_URL}/admin/security-events?`;
    if (severity) url += `severity=${severity}&`;
    
    const res = await fetch(url, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to fetch security events");
    return res.json();
  }
};
