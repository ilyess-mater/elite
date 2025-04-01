import React, { useState, useEffect } from "react";
import "../styles/security.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

function SecurityPage({ user }) {
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    twoFactorMethod: "app", // app, sms, email
    loginAlerts: true,
    sessionTimeout: 30, // minutes
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "Weak",
  });

  const [activeSessions, setActiveSessions] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const { getSocket } = useAuth();

  // Fetch security settings and data
  useEffect(() => {
    // In a real application, you would fetch this data from the backend
    // For now, we're using mock data

    // Simulated active sessions
    setActiveSessions([
      {
        id: 1,
        device: "Windows PC - Chrome",
        location: "Paris, France",
        ip: "192.168.1.1",
        lastActive: new Date().toISOString(),
        current: true,
      },
      {
        id: 2,
        device: "iPhone - Safari",
        location: "London, UK",
        ip: "192.168.1.2",
        lastActive: new Date(Date.now() - 3600000).toISOString(),
        current: false,
      },
    ]);

    // Simulated security logs
    setSecurityLogs([
      {
        id: 1,
        action: "Login",
        status: "success",
        device: "Windows PC - Chrome",
        location: "Paris, France",
        ip: "192.168.1.1",
        timestamp: new Date().toISOString(),
      },
      {
        id: 2,
        action: "Password Changed",
        status: "success",
        device: "Windows PC - Chrome",
        location: "Paris, France",
        ip: "192.168.1.1",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 3,
        action: "Login Attempt",
        status: "warning",
        device: "Android - Chrome",
        location: "Unknown",
        ip: "192.168.1.3",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 4,
        action: "Login Attempt",
        status: "danger",
        device: "Unknown",
        location: "Moscow, Russia",
        ip: "192.168.1.4",
        timestamp: new Date(Date.now() - 259200000).toISOString(),
      },
    ]);
  }, []);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value,
    });

    if (name === "newPassword") {
      const score = calculatePasswordStrength(value);
      setPasswordStrength(score);
    }

    // Clear error when user types
    setError("");
  };

  const handleSecuritySettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSecuritySettings({
      ...securitySettings,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const validatePasswordForm = () => {
    // Clear previous errors
    setError("");

    // Check if current password is provided
    if (!passwordForm.currentPassword) {
      setError("Current password is required");
      return false;
    }

    // Check if new password is provided
    if (!passwordForm.newPassword) {
      setError("New password is required");
      return false;
    }

    // Check if new password is strong enough
    if (passwordStrength.score < 2) {
      setError("New password is too weak");
      return false;
    }

    // Check if passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handlePasswordFormSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    try {
      // In a real app, you would send this to the backend
      // const response = await axios.post('/api/auth/change-password', passwordForm);

      // Simulate API call
      setTimeout(() => {
        // Show success message
        setSuccessMessage("Password changed successfully");

        // Clear form
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      }, 1000);
    } catch (error) {
      setError("Failed to change password. Please try again.");
    }
  };

  const handleSaveSecuritySettings = async () => {
    try {
      // In a real app, you would send this to the backend
      // const response = await axios.post('/api/user/security-settings', securitySettings);

      // Simulate API call
      setTimeout(() => {
        // Show success message
        setSuccessMessage("Security settings saved successfully");

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      }, 1000);
    } catch (error) {
      setError("Failed to save security settings. Please try again.");
    }
  };

  const handleRevokeSession = (sessionId) => {
    // In a real app, you would send this to the backend
    // Then update the local state after success
    setActiveSessions(
      activeSessions.filter((session) => session.id !== sessionId)
    );
  };

  const calculatePasswordStrength = (password) => {
    // This is a simple password strength calculator
    // In a real app, you might want to use a more sophisticated algorithm

    if (!password) {
      return { score: 0, label: "Weak" };
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Complexity checks
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Determine label based on score
    let label = "Weak";
    if (score >= 5) label = "Strong";
    else if (score >= 3) label = "Good";
    else if (score >= 2) label = "Fair";

    return { score, label };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeSince = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec} seconds ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minutes ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  return (
    <div className="security-container">
      <div className="security-header">
        <h1>Security Settings</h1>
        <p>Manage your account security settings and active sessions</p>
      </div>

      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {successMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-shield-alt"></i> Two-Factor Authentication
          </div>
          <div className="security-status">
            {securitySettings.twoFactorAuth ? (
              <span className="security-status enabled">Enabled</span>
            ) : (
              <span className="security-status disabled">Disabled</span>
            )}
          </div>
        </div>
        <div className="security-card-content">
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-name">
                Enable Two-Factor Authentication
              </span>
              <span className="setting-description">
                Add an extra layer of security to your account
              </span>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  name="twoFactorAuth"
                  checked={securitySettings.twoFactorAuth}
                  onChange={handleSecuritySettingChange}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {securitySettings.twoFactorAuth && (
            <div className="tfa-options">
              <div
                className={`tfa-option ${
                  securitySettings.twoFactorMethod === "app" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="twoFactorMethod"
                  value="app"
                  checked={securitySettings.twoFactorMethod === "app"}
                  onChange={handleSecuritySettingChange}
                  className="tfa-radio"
                />
                <div className="tfa-option-content">
                  <div className="tfa-option-title">Authenticator App</div>
                  <div className="tfa-option-description">
                    Use an authenticator app like Google Authenticator or Authy
                  </div>
                </div>
              </div>

              <div
                className={`tfa-option ${
                  securitySettings.twoFactorMethod === "sms" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="twoFactorMethod"
                  value="sms"
                  checked={securitySettings.twoFactorMethod === "sms"}
                  onChange={handleSecuritySettingChange}
                  className="tfa-radio"
                />
                <div className="tfa-option-content">
                  <div className="tfa-option-title">SMS</div>
                  <div className="tfa-option-description">
                    Receive a code via SMS to your registered phone number
                  </div>
                </div>
              </div>

              <div
                className={`tfa-option ${
                  securitySettings.twoFactorMethod === "email" ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="twoFactorMethod"
                  value="email"
                  checked={securitySettings.twoFactorMethod === "email"}
                  onChange={handleSecuritySettingChange}
                  className="tfa-radio"
                />
                <div className="tfa-option-content">
                  <div className="tfa-option-title">Email</div>
                  <div className="tfa-option-description">
                    Receive a code via email to your registered email address
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-name">Login Alerts</span>
              <span className="setting-description">
                Get notified of new logins to your account
              </span>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  name="loginAlerts"
                  checked={securitySettings.loginAlerts}
                  onChange={handleSecuritySettingChange}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-name">Session Timeout</span>
              <span className="setting-description">
                Automatically log out after a period of inactivity
              </span>
            </div>
            <div className="setting-control">
              <select
                name="sessionTimeout"
                value={securitySettings.sessionTimeout}
                onChange={handleSecuritySettingChange}
                className="form-select"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSaveSecuritySettings}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-key"></i> Password
          </div>
        </div>
        <div className="security-card-content">
          <form className="password-form" onSubmit={handlePasswordFormSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your current password"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your new password"
              />
            </div>

            {passwordForm.newPassword && (
              <div className="password-strength">
                <div className="password-strength-label">
                  Password Strength:
                </div>
                <div
                  className={`password-strength-text ${
                    passwordStrength.score >= 5
                      ? "score-strong"
                      : passwordStrength.score >= 3
                      ? "score-good"
                      : passwordStrength.score >= 2
                      ? "score-fair"
                      : "score-weak"
                  }`}
                >
                  {passwordStrength.label}
                </div>
                <div className="password-strength-bar">
                  <div
                    className={`password-strength-progress ${
                      passwordStrength.score >= 5
                        ? "progress-strong"
                        : passwordStrength.score >= 3
                        ? "progress-good"
                        : passwordStrength.score >= 2
                        ? "progress-fair"
                        : "progress-weak"
                    }`}
                    style={{
                      width: `${Math.min(100, passwordStrength.score * 20)}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm your new password"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-laptop"></i> Active Sessions
          </div>
        </div>
        <div className="security-card-content">
          <div className="session-list">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${session.current ? "current" : ""}`}
              >
                <div className="session-info">
                  <div className="session-device">
                    <i
                      className={`fas ${
                        session.device.includes("Windows")
                          ? "fa-desktop"
                          : session.device.includes("iPhone")
                          ? "fa-mobile-alt"
                          : session.device.includes("Android")
                          ? "fa-mobile-alt"
                          : "fa-globe"
                      }`}
                    ></i>
                    {session.device}
                  </div>
                  <div className="session-details">
                    <div>
                      {session.location} • {session.ip}
                    </div>
                    <div>Last active: {getTimeSince(session.lastActive)}</div>
                    {session.current && (
                      <div className="current-session-badge">
                        Current Session
                      </div>
                    )}
                  </div>
                </div>
                {!session.current && (
                  <div className="session-actions">
                    <button
                      className="btn-sm btn-danger"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-lock"></i> Data Encryption
          </div>
        </div>
        <div className="security-card-content">
          <div className="encryption-info">
            <div className="encryption-detail">
              <div className="encryption-icon">
                <i className="fas fa-exchange-alt"></i>
              </div>
              <div className="encryption-text">
                <div className="encryption-title">End-to-End Encryption</div>
                <div className="encryption-description">
                  Your messages are encrypted end-to-end and can only be read by
                  you and the intended recipients.
                </div>
              </div>
            </div>
            <div className="encryption-detail">
              <div className="encryption-icon">
                <i className="fas fa-server"></i>
              </div>
              <div className="encryption-text">
                <div className="encryption-title">Data at Rest</div>
                <div className="encryption-description">
                  All data stored on our servers is encrypted using
                  industry-standard AES-256 encryption.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-history"></i> Security Logs
          </div>
        </div>
        <div className="security-card-content">
          <div className="log-filters">
            <div className="filter-group">
              <label className="filter-label">Filter by:</label>
              <select className="filter-select">
                <option value="all">All Activities</option>
                <option value="login">Login</option>
                <option value="password">Password</option>
                <option value="settings">Settings</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Status:</label>
              <select className="filter-select">
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
              </select>
            </div>
          </div>

          <table className="logs-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Status</th>
                <th>Device</th>
                <th>Location</th>
                <th>IP</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {securityLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td>
                    <span className={`log-status log-${log.status}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>{log.device}</td>
                  <td>{log.location}</td>
                  <td>{log.ip}</td>
                  <td className="log-time">{formatDate(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="security-card">
        <div className="security-card-content">
          <div className="security-info-text">
            For security reasons, if you forget your password, you will need to
            verify your identity through multiple methods. Please ensure your
            contact information is up to date in your{" "}
            <a href="#" className="security-link">
              profile settings
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecurityPage;
