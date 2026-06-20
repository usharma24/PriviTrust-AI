import { useState, useEffect } from "react";
import { api } from "../services/api";
import type { User } from "../services/api";
import { 
  Shield, 
  Users, 
  Clock, 
  AlertOctagon, 
  Activity, 
  FileSpreadsheet, 
  Trash2, 
  Search, 
  UserMinus, 
  Database,
  RefreshCw,
  AlertTriangle,
  FileText,
  Menu,
  X
} from "lucide-react";

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigateToWorkspace: () => void;
}

export default function AdminDashboard({ user, onLogout, onNavigateToWorkspace }: AdminDashboardProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  
  // Tab control: 'overview' | 'sessions' | 'audit' | 'threats' | 'reports'
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "audit" | "threats" | "reports">("overview");

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState("");
  const [auditMinRisk, setAuditMinRisk] = useState<number>(0);

  // Auto-refresh states
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mobile responsiveness state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const data = await api.getAdminDashboard();
      setMetrics(data.metrics);
      setActiveSessions(data.active_sessions);
      setSecurityEvents(data.security_events);
      
      // Also fetch audit logs if active tab is audit
      if (activeTab === "audit") {
        const logs = await api.getAuditLogs();
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  };

  // Poll for dashboard updates every 3 seconds if active/autoRefresh is on
  useEffect(() => {
    fetchDashboardData();
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab]);

  // Load audit logs on tab switch
  useEffect(() => {
    if (activeTab === "audit") {
      api.getAuditLogs().then(setAuditLogs).catch(console.error);
    }
  }, [activeTab]);

  const handleTerminateSession = async (sessionId: number) => {
    if (!confirm("Are you sure you want to administratively terminate this session?")) return;
    try {
      await api.terminateSession(sessionId);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to terminate session");
    }
  };

  // Report download simulator (CSV Generator)
  const downloadReport = (reportType: "user_activity" | "security" | "audit") => {
    let csvContent = "data:text/csv;charset=utf-8,";
    let filename = "";

    if (reportType === "audit") {
      filename = "privitrust_audit_report.csv";
      csvContent += "Log ID,Timestamp,User Name,Email,Action Type,Details,Risk Score\n";
      auditLogs.forEach(log => {
        csvContent += `"${log.id}","${log.timestamp}","${log.user_name}","${log.user_email}","${log.event_type}","${log.event_description.replace(/"/g, '""')}","${log.risk_score}"\n`;
      });
    } else if (reportType === "security") {
      filename = "privitrust_security_alerts.csv";
      csvContent += "Alert ID,Created At,User Name,Email,Event,Severity,Details\n";
      securityEvents.forEach(evt => {
        csvContent += `"${evt.id}","${evt.created_at}","${evt.user_name}","${evt.email}","${evt.event_type}","${evt.severity}","${evt.description.replace(/"/g, '""')}"\n`;
      });
    } else {
      filename = "privitrust_user_activity.csv";
      csvContent += "Session ID,User,Email,Role,Login Time,Risk Score,Status\n";
      activeSessions.forEach(s => {
        csvContent += `"${s.id}","${s.name}","${s.email}","${s.role}","${s.login_time}","${s.risk_score}","${s.status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.user_name.toLowerCase().includes(auditSearch.toLowerCase()) || 
      log.event_type.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.event_description.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesFilter = auditFilter ? log.event_type.toLowerCase().includes(auditFilter.toLowerCase()) : true;
    const matchesRisk = log.risk_score >= auditMinRisk;
    return matchesSearch && matchesFilter && matchesRisk;
  });

  // Calculate colors for risk scores
  const getRiskLabelColor = (score: number) => {
    if (score <= 30) return "risk-low-bg risk-low-text";
    if (score <= 60) return "risk-medium-bg risk-medium-text";
    if (score <= 80) return "risk-high-bg risk-high-text";
    return "risk-critical-bg risk-critical-text";
  };

  // SVG Chart Computations
  const distribution = metrics?.risk_distribution || { Low: 0, Medium: 0, High: 0, Critical: 0 };
  const trend = metrics?.risk_trend || [];
  
  const totalRiskCount = (Object.values(distribution).reduce((a: any, b: any) => a + b, 0) as number) || 1;
  const donutData = [
    { label: "Low", value: distribution.Low, color: "hsl(var(--risk-low))" },
    { label: "Medium", value: distribution.Medium, color: "hsl(var(--risk-medium))" },
    { label: "High", value: distribution.High, color: "hsl(var(--risk-high))" },
    { label: "Critical", value: distribution.Critical, color: "hsl(var(--risk-critical))" }
  ];

  // Donut SVG path calculations
  let accumulatedAngle = 0;
  const radius = 35;
  const strokeWidth = 10;

  return (
    <div className="app-container">
      {/* Mobile overlay backdrop */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          <div className="brand-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="brand-logo" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>A</div>
              <div>
                <span className="brand-title">PriviTrust Admin</span>
                <div style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", marginTop: "2px" }}>
                  Security Center
                </div>
              </div>
            </div>
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <ul className="nav-list">
            <li className={`nav-item ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
              <Shield size={18} />
              <span>Security Overview</span>
            </li>
            <li className={`nav-item ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>
              <Clock size={18} />
              <span>Active Sessions ({activeSessions.length})</span>
            </li>
            <li className={`nav-item ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>
              <Database size={18} />
              <span>Audit Records</span>
            </li>
            <li className={`nav-item ${activeTab === "threats" ? "active" : ""}`} onClick={() => setActiveTab("threats")}>
              <AlertOctagon size={18} />
              <span>Threat Alerts ({metrics?.critical_alerts || 0})</span>
            </li>
            <li className={`nav-item ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
              <FileSpreadsheet size={18} />
              <span>Compliance Reports</span>
            </li>
          </ul>
        </div>

        <div className="user-profile-section" style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="user-avatar" style={{ backgroundColor: "#e0f2fe", color: "#0284c7" }}>
              {user.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-role-badge">Administrator</div>
            </div>
          </div>
          
          <button 
            onClick={onNavigateToWorkspace}
            style={{
              padding: "8px",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              backgroundColor: "var(--brand-light)",
              color: "var(--brand)",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            Access User Workspace
          </button>
          
          <button 
            onClick={() => api.logout(0).then(onLogout)}
            style={{ 
              padding: "10px", 
              border: "1px solid var(--border-color)", 
              borderRadius: "8px", 
              backgroundColor: "transparent",
              color: "hsl(var(--risk-critical))",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Panel Frame */}
      <div className="main-content">
        <div className="header-bar">
          <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: "1.5rem" }}>Security Intelligence Panel</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Continuous identity trust monitoring and threat management console.
            </p>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                id="autoRefreshCheck"
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ width: "14px", height: "14px", cursor: "pointer" }}
              />
              <label htmlFor="autoRefreshCheck" style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "500", cursor: "pointer" }}>
                Auto Poll (3s)
              </label>
            </div>

            <button 
              onClick={fetchDashboardData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.8rem"
              }}
            >
              <RefreshCw size={12} />
              <span>Sync Live</span>
            </button>
          </div>
        </div>

        <div className="content-body">
          {/* Metrics summary cards */}
          <div className="metrics-grid">
            <div className="card metric-card">
              <div className="metric-icon-box" style={{ backgroundColor: "#eff6ff", color: "#3b82f6" }}>
                <Users size={24} />
              </div>
              <div>
                <div className="metric-label">Monitored Users</div>
                <div className="metric-value">{metrics?.total_users || 0}</div>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-icon-box" style={{ backgroundColor: "hsla(var(--risk-low), 0.1)", color: "hsl(var(--risk-low))" }}>
                <Activity size={24} />
              </div>
              <div>
                <div className="metric-label">Online Sessions</div>
                <div className="metric-value">{metrics?.active_sessions || 0}</div>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-icon-box" style={{ backgroundColor: "hsla(var(--risk-high), 0.1)", color: "hsl(var(--risk-high))" }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="metric-label">High Risk Sessions</div>
                <div className="metric-value">{metrics?.high_risk_users || 0}</div>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-icon-box" style={{ backgroundColor: "hsla(var(--risk-critical), 0.1)", color: "hsl(var(--risk-critical))" }}>
                <AlertOctagon size={24} />
              </div>
              <div>
                <div className="metric-label">Critical Alerts</div>
                <div className="metric-value">{metrics?.critical_alerts || 0}</div>
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW & SVG VISUALIZATIONS */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Row: SVG Charts */}
              <div className="dashboard-double-grid">
                
                {/* Segmented Donut Chart */}
                <div className="card">
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Active Session Risk Allocation</h3>
                  <div className="donut-chart-container">
                    
                    <div style={{ width: "140px", height: "140px", position: "relative" }}>
                      <svg width="140" height="140" viewBox="0 0 100 100">
                        {totalRiskCount === 0 || metrics?.active_sessions === 0 ? (
                          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
                        ) : (
                          donutData.map((d, index) => {
                            if (d.value === 0) return null;
                            const share = d.value / totalRiskCount;
                            const circumference = 2 * Math.PI * radius;
                            const strokeDash = `${share * circumference} ${circumference}`;
                            const rotation = accumulatedAngle;
                            accumulatedAngle += share * 360;
                            return (
                              <circle
                                key={index}
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke={d.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={strokeDash}
                                transform={`rotate(${rotation - 90} 50 50)`}
                                style={{ transition: "stroke-dasharray 0.5s ease" }}
                              />
                            );
                          })
                        )}
                        <circle cx="50" cy="50" r="28" fill="white" />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>{metrics?.active_sessions || 0}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>Sessions</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "160px" }}>
                      {donutData.map((d) => (
                        <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem" }}>
                          <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "3px", backgroundColor: d.color, marginRight: "8px" }}></span>
                          <span style={{ fontWeight: "500", flexGrow: "1" }}>{d.label}</span>
                          <span style={{ fontWeight: "700" }}>{d.value}</span>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

                {/* Avg Risk Line Chart SVG */}
                <div className="card">
                  <h3 style={{ fontSize: "1.1rem", marginBottom: "20px" }}>Average Network Risk Trend (Last 12 Hours)</h3>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "180px" }}>
                    <svg width="100%" height="160" viewBox="0 0 300 120" style={{ overflow: "visible" }}>
                      {/* Grid Lines */}
                      <line x1="20" y1="20" x2="290" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="20" y1="50" x2="290" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="20" y1="80" x2="290" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="20" y1="100" x2="290" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />

                      {/* Y axis labels */}
                      <text x="5" y="24" fontSize="6.5" fill="var(--text-muted)" fontWeight="600">80 Risk</text>
                      <text x="5" y="54" fontSize="6.5" fill="var(--text-muted)" fontWeight="600">50 Risk</text>
                      <text x="5" y="84" fontSize="6.5" fill="var(--text-muted)" fontWeight="600">20 Risk</text>

                      {/* Trend path */}
                      {trend.length > 1 && (
                        (() => {
                          const width = 270;
                          const step = width / (trend.length - 1);
                          const points = trend.map((t: any, idx: number) => {
                            const x = 20 + idx * step;
                            // scale risk score (0-100) to SVG y (100 to 20)
                            // 0 risk -> y=100. 100 risk -> y=20.
                            const y = 100 - (t.avg_risk / 100) * 80;
                            return `${x},${y}`;
                          });
                          
                          return (
                            <>
                              {/* Glowing background under the line */}
                              <path
                                d={`M 20 100 L ${points.join(" L ")} L ${20 + (trend.length - 1) * step} 100 Z`}
                                fill="url(#chartGlow)"
                                opacity="0.1"
                              />
                              <polyline
                                fill="none"
                                stroke="var(--brand)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points.join(" ")}
                                style={{ transition: "all 0.5s ease" }}
                              />
                              {/* Data circles */}
                              {trend.map((t: any, idx: number) => {
                                const x = 20 + idx * step;
                                const y = 100 - (t.avg_risk / 100) * 80;
                                return (
                                  <g key={idx}>
                                    <circle cx={x} cy={y} r="3" fill="var(--brand)" stroke="#ffffff" strokeWidth="1" />
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()
                      )}

                      {/* X axis hours labels */}
                      {trend.map((t: any, idx: number) => {
                        if (idx % 2 !== 0) return null; // Show every alternate hours label
                        const step = 270 / (trend.length - 1);
                        const x = 20 + idx * step;
                        return (
                          <text key={idx} x={x} y="112" fontSize="6.5" fill="var(--text-muted)" textAnchor="middle" fontWeight="500">
                            {t.hour}
                          </text>
                        );
                      })}

                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--brand)" />
                          <stop offset="100%" stopColor="#ffffff" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

              </div>

              {/* Row: Live Alerts ticker and session list summary */}
              <div className="dashboard-split-grid">
                
                {/* Live Sessions list */}
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "1.1rem" }}>Active Employee Sessions</h3>
                    <button onClick={() => setActiveTab("sessions")} style={{ fontSize: "0.8rem", color: "var(--brand)", border: "none", backgroundColor: "transparent", fontWeight: "600", cursor: "pointer" }}>
                      Manage Sessions →
                    </button>
                  </div>

                  <div className="data-table-container" style={{ margin: "0" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Session Risk</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSessions.slice(0, 5).map(s => (
                          <tr key={s.id}>
                            <td>
                              <div style={{ fontWeight: "600" }}>{s.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.email}</div>
                            </td>
                            <td style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>{s.role}</td>
                            <td>
                              <span className={`badge ${getRiskLabelColor(s.risk_score)}`}>
                                {s.risk_score.toFixed(0)} Risk
                              </span>
                            </td>
                            <td>
                              <span style={{ 
                                display: "inline-block", 
                                width: "8px", 
                                height: "8px", 
                                borderRadius: "50%", 
                                backgroundColor: s.status === "Active" ? "hsl(var(--risk-low))" : s.status === "Blocked" ? "hsl(var(--risk-critical))" : "hsl(var(--risk-medium))",
                                marginRight: "6px"
                              }}></span>
                              <span style={{ fontSize: "0.85rem" }}>{s.status.replace("_", " ")}</span>
                            </td>
                            <td>
                              <button 
                                onClick={() => handleTerminateSession(s.id)}
                                style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", color: "var(--text-muted)" }}
                              >
                                <Trash2 size={16} hover-color="hsl(var(--risk-critical))" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {activeSessions.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                              No active network sessions detected.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Threat Events Log Ticker */}
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "1.1rem" }}>Continuous Security Warnings</h3>
                    <button onClick={() => setActiveTab("threats")} style={{ fontSize: "0.8rem", color: "var(--brand)", border: "none", backgroundColor: "transparent", fontWeight: "600", cursor: "pointer" }}>
                      Alert Center →
                    </button>
                  </div>

                  <div className="ticker-container">
                    {securityEvents.slice(0, 6).map((evt) => (
                      <div key={evt.id} className={`ticker-item ${evt.severity === "Critical" ? "critical" : evt.severity === "High" ? "high" : ""}`}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ 
                              display: "inline-block", 
                              width: "6px", 
                              height: "6px", 
                              borderRadius: "50%", 
                              backgroundColor: evt.severity === "Critical" ? "hsl(var(--risk-critical))" : evt.severity === "High" ? "hsl(var(--risk-high))" : "hsl(var(--risk-medium))"
                            }}></span>
                            <span style={{ fontSize: "0.8rem", fontWeight: "700" }}>{evt.event_type}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>({evt.user_name})</span>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--primary-light)" }}>{evt.description}</span>
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {securityEvents.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No security threats raised.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE SESSIONS */}
          {activeTab === "sessions" && (
            <div className="card">
              <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Active Network Connections</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                Administratively inspect and disconnect active employee workspace sessions.
              </p>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Session ID</th>
                      <th>User Name</th>
                      <th>Work Email</th>
                      <th>Role</th>
                      <th>Login Time</th>
                      <th>Risk Score</th>
                      <th>Session Status</th>
                      <th>Disconnect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map(s => (
                      <tr key={s.id}>
                        <td>#{s.id}</td>
                        <td style={{ fontWeight: "600" }}>{s.name}</td>
                        <td>{s.email}</td>
                        <td style={{ textTransform: "capitalize" }}>{s.role}</td>
                        <td>{new Date(s.login_time).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${getRiskLabelColor(s.risk_score)}`}>
                            {s.risk_score.toFixed(0)} Risk
                          </span>
                        </td>
                        <td>
                          <span style={{ 
                            display: "inline-block", 
                            width: "8px", 
                            height: "8px", 
                            borderRadius: "50%", 
                            backgroundColor: s.status === "Active" ? "hsl(var(--risk-low))" : s.status === "Blocked" ? "hsl(var(--risk-critical))" : "hsl(var(--risk-medium))",
                            marginRight: "6px"
                          }}></span>
                          <span>{s.status.replace("_", " ")}</span>
                        </td>
                        <td>
                          <button 
                            onClick={() => handleTerminateSession(s.id)}
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "4px", 
                              border: "1px solid var(--border-color)", 
                              borderRadius: "6px", 
                              padding: "4px 8px", 
                              fontSize: "0.8rem", 
                              color: "hsl(var(--risk-critical))",
                              cursor: "pointer",
                              backgroundColor: "transparent"
                            }}
                          >
                            <UserMinus size={12} />
                            <span>Revoke</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {activeSessions.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                          No active user sessions online.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT RECORDS */}
          {activeTab === "audit" && (
            <div className="card">
              <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Historical Security Audits</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                Relational search audit log indexing all transactions, security challenges, and device verifications.
              </p>

              {/* Filtering Controls */}
              <div style={{ 
                display: "flex", 
                gap: "12px", 
                marginBottom: "20px", 
                backgroundColor: "var(--bg-tertiary)", 
                padding: "12px", 
                borderRadius: "8px",
                flexWrap: "wrap"
              }}>
                <div style={{ position: "relative", flexGrow: 1, minWidth: "200px" }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type="text"
                    placeholder="Search logs by name, action, details..."
                    className="form-input"
                    style={{ paddingLeft: "36px" }}
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                  />
                </div>

                <div style={{ width: "160px" }}>
                  <select 
                    className="form-select"
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                  >
                    <option value="">All Actions</option>
                    <option value="Login">Login</option>
                    <option value="Logout">Logout</option>
                    <option value="MFA">MFA Challenge</option>
                    <option value="Profile">Customer Profile</option>
                    <option value="Export">Data Export</option>
                    <option value="Restart">Core Restart</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: "500", color: "var(--text-muted)" }}>Min Risk:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={auditMinRisk}
                    onChange={(e) => setAuditMinRisk(Number(e.target.value))}
                    style={{ width: "100px", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: "700", width: "30px" }}>{auditMinRisk}+</span>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Log Description</th>
                      <th>Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontSize: "0.85rem" }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td>
                          <div style={{ fontWeight: "600" }}>{log.user_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{log.user_email}</div>
                        </td>
                        <td style={{ fontWeight: "500" }}>{log.event_type}</td>
                        <td style={{ fontSize: "0.85rem" }}>{log.event_description}</td>
                        <td>
                          <span className={`badge ${getRiskLabelColor(log.risk_score)}`}>
                            {log.risk_score.toFixed(0)} Score
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                          No audit trails match your search filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: THREAT ALERTS */}
          {activeTab === "threats" && (
            <div className="card">
              <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Insider Threat & Anomaly logs</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "20px" }}>
                Isolation Forest predictions flagging abnormal access speeds, device changes, or off-hours actions.
              </p>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time Raised</th>
                      <th>User Context</th>
                      <th>Security Threat</th>
                      <th>Severity</th>
                      <th>Diagnostics Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityEvents.map(evt => (
                      <tr key={evt.id} style={{ backgroundColor: evt.severity === "Critical" ? "hsla(0, 84.2%, 60.2%, 0.02)" : "" }}>
                        <td>{new Date(evt.created_at).toLocaleString()}</td>
                        <td>
                          <div style={{ fontWeight: "600" }}>{evt.user_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{evt.email}</div>
                        </td>
                        <td style={{ fontWeight: "600" }}>{evt.event_type}</td>
                        <td>
                          <span className={`badge ${
                            evt.severity === "Critical" ? "risk-critical-bg risk-critical-text" :
                            evt.severity === "High" ? "risk-high-bg risk-high-text" : "risk-medium-bg risk-medium-text"
                          }`}>
                            {evt.severity}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>{evt.description}</td>
                      </tr>
                    ))}
                    {securityEvents.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                          No threat events flagged. Internal framework reports complete trust.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: REPORTS & COMPLIANCE */}
          {activeTab === "reports" && (
            <div className="card">
              <h3 style={{ fontSize: "1.2rem", marginBottom: "8px" }}>Regulatory & Audit Reports</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "24px" }}>
                Generate and download compliance records compiling privileged access logs and anomalies.
              </p>

              <div className="dashboard-reports-grid">
                
                <div style={{ border: "1px solid var(--border-color)", padding: "20px", borderRadius: "10px", backgroundColor: "var(--bg-tertiary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <FileText size={20} color="var(--brand)" />
                    <h4 style={{ fontWeight: "600" }}>User Active Sessions Report</h4>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                    Summary of current online connection durations, device fingerprints, and active risk ratings.
                  </p>
                  <button 
                    onClick={() => downloadReport("user_activity")}
                    style={{ 
                      padding: "8px 16px", 
                      backgroundColor: "var(--brand)", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "6px", 
                      fontWeight: "600", 
                      fontSize: "0.8rem", 
                      cursor: "pointer" 
                    }}
                  >
                    Export Session CSV
                  </button>
                </div>

                <div style={{ border: "1px solid var(--border-color)", padding: "20px", borderRadius: "10px", backgroundColor: "var(--bg-tertiary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <AlertTriangle size={20} color="hsl(var(--risk-high))" />
                    <h4 style={{ fontWeight: "600" }}>Security Threats Report</h4>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                    Complete list of adaptive challenges (MFA, password checks) and critical locked sessions.
                  </p>
                  <button 
                    onClick={() => downloadReport("security")}
                    style={{ 
                      padding: "8px 16px", 
                      backgroundColor: "var(--brand)", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "6px", 
                      fontWeight: "600", 
                      fontSize: "0.8rem", 
                      cursor: "pointer" 
                    }}
                  >
                    Export Security CSV
                  </button>
                </div>

                <div style={{ border: "1px solid var(--border-color)", padding: "20px", borderRadius: "10px", backgroundColor: "var(--bg-tertiary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <Database size={20} color="hsl(var(--risk-low))" />
                    <h4 style={{ fontWeight: "600" }}>Transaction Audit Trails Log</h4>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                    Comprehensive trace logs representing every privileged actions logged inside database.
                  </p>
                  <button 
                    onClick={() => downloadReport("audit")}
                    style={{ 
                      padding: "8px 16px", 
                      backgroundColor: "var(--brand)", 
                      color: "white", 
                      border: "none", 
                      borderRadius: "6px", 
                      fontWeight: "600", 
                      fontSize: "0.8rem", 
                      cursor: "pointer" 
                    }}
                  >
                    Export Audit CSV
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
