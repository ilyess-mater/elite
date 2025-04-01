import React, { useState, useEffect } from "react";
import "../styles/admin.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

function AdminPanel({ user }) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    dailyMessages: [],
    newUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [confirmAction, setConfirmAction] = useState(null);
  const { getSocket } = useAuth();
  const socket = getSocket();

  // Fetch admin data
  useEffect(() => {
    if (!user || !user.isAdmin) {
      setError("You don't have permission to access this page");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const usersResponse = await axios.get("/api/admin/users");
        setUsers(usersResponse.data);

        const messagesResponse = await axios.get("/api/admin/messages");
        setAllMessages(messagesResponse.data);

        const statsResponse = await axios.get("/api/stats");
        setStats(statsResponse.data);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching admin data:", error);
        setError("Failed to load admin data. Please try again.");
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.on("user_status", (statusData) => {
      const { userId, status } = statusData;
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, isActive: status === "online" } : user
        )
      );
    });

    return () => {
      socket.off("user_status");
    };
  }, [socket]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeSince = (dateString) => {
    if (!dateString) return "N/A";

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
    if (diffDays < 30) return `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} months ago`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} years ago`;
  };

  // Get current users for pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  // Generate avatar color based on name
  function generateAvatar(name) {
    if (!name) return "#777";

    const colors = [
      "#FF5733",
      "#33FF57",
      "#3357FF",
      "#F333FF",
      "#FF33F3",
      "#33FFF3",
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  const handleUserAction = (action, userData) => {
    setConfirmAction({
      action,
      user: userData,
    });
  };

  const confirmUserAction = async () => {
    if (!confirmAction) return;

    const { action, user: userData } = confirmAction;

    try {
      if (action === "delete") {
        // In a real app, you would send this to the backend
        // await axios.delete(`/api/admin/users/${userData.id}`);

        // Update local state
        setUsers(users.filter((user) => user.id !== userData.id));
      } else if (action === "suspend") {
        // In a real app, you would send this to the backend
        // await axios.post(`/api/admin/users/${userData.id}/suspend`);

        // Update local state
        setUsers(
          users.map((user) =>
            user.id === userData.id ? { ...user, suspended: true } : user
          )
        );
      } else if (action === "unsuspend") {
        // In a real app, you would send this to the backend
        // await axios.post(`/api/admin/users/${userData.id}/unsuspend`);

        // Update local state
        setUsers(
          users.map((user) =>
            user.id === userData.id ? { ...user, suspended: false } : user
          )
        );
      } else if (action === "promote") {
        // In a real app, you would send this to the backend
        // await axios.post(`/api/admin/users/${userData.id}/promote`);

        // Update local state
        setUsers(
          users.map((user) =>
            user.id === userData.id ? { ...user, isAdmin: true } : user
          )
        );
      } else if (action === "demote") {
        // In a real app, you would send this to the backend
        // await axios.post(`/api/admin/users/${userData.id}/demote`);

        // Update local state
        setUsers(
          users.map((user) =>
            user.id === userData.id ? { ...user, isAdmin: false } : user
          )
        );
      }
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      setError(`Failed to ${action} user. Please try again.`);
    } finally {
      setConfirmAction(null);
    }
  };

  const cancelConfirmation = () => {
    setConfirmAction(null);
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading-message">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-container">
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-actions">
          <button className="btn btn-primary">
            <i className="fas fa-cog"></i> System Settings
          </button>
        </div>
      </div>

      <div className="admin-tab-container">
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <i className="fas fa-users"></i> Users
          </button>
          <button
            className={`admin-tab ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => setActiveTab("messages")}
          >
            <i className="fas fa-comments"></i> Messages
          </button>
          <button
            className={`admin-tab ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <i className="fas fa-chart-line"></i> Analytics
          </button>
          <button
            className={`admin-tab ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <i className="fas fa-cog"></i> System Settings
          </button>
        </div>

        <div className="admin-tab-content">
          {activeTab === "users" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value">{stats.totalUsers}</div>
                  <div className="stat-change stat-increase">
                    +{stats.newUsers} new in last 7 days
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active Users</div>
                  <div className="stat-value">{stats.activeUsers}</div>
                  <div className="stat-change stat-increase">
                    {Math.round((stats.activeUsers / stats.totalUsers) * 100)}%
                    of total
                  </div>
                </div>
              </div>

              <div className="user-filters">
                <div className="search-users">
                  <i className="fas fa-search"></i>
                  <input type="text" placeholder="Search users..." />
                </div>
                <div className="filter-options">
                  <button className="filter-button">
                    <i className="fas fa-filter filter-icon"></i> Filter
                  </button>
                </div>
              </div>

              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-info">
                            <div
                              className="user-avatar"
                              style={{
                                backgroundColor: generateAvatar(user.name),
                              }}
                            >
                              {user.name
                                ? user.name.charAt(0).toUpperCase()
                                : "?"}
                            </div>
                            <span>{user.name}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className={`user-role ${
                              user.isAdmin ? "role-admin" : "role-user"
                            }`}
                          >
                            {user.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-indicator ${
                              user.isActive
                                ? "status-active"
                                : "status-inactive"
                            }`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>{getTimeSince(user.lastActive)}</td>
                        <td>
                          <div className="user-actions">
                            <button
                              className="user-action-button edit"
                              title="Edit User"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            {user.isAdmin ? (
                              <button
                                className="user-action-button"
                                title="Remove Admin Rights"
                                onClick={() => handleUserAction("demote", user)}
                              >
                                <i className="fas fa-level-down-alt"></i>
                              </button>
                            ) : (
                              <button
                                className="user-action-button"
                                title="Make Admin"
                                onClick={() =>
                                  handleUserAction("promote", user)
                                }
                              >
                                <i className="fas fa-level-up-alt"></i>
                              </button>
                            )}
                            <button
                              className="user-action-button delete"
                              title="Delete User"
                              onClick={() => handleUserAction("delete", user)}
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing {indexOfFirstUser + 1}-
                  {Math.min(indexOfLastUser, users.length)} of {users.length}{" "}
                  users
                </div>
                <div className="pagination-controls">
                  <button
                    className="pagination-button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  {[...Array(totalPages).keys()].map((number) => (
                    <button
                      key={number + 1}
                      className={`pagination-button ${
                        currentPage === number + 1 ? "active" : ""
                      }`}
                      onClick={() => setCurrentPage(number + 1)}
                    >
                      {number + 1}
                    </button>
                  ))}
                  <button
                    className="pagination-button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "messages" && (
            <div className="messages-container">
              <h3>Recent Messages</h3>
              <table className="messages-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Message</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {allMessages.map((message) => (
                    <tr key={message.id}>
                      <td>{message.senderName}</td>
                      <td>{message.receiverName}</td>
                      <td className="message-content">{message.text}</td>
                      <td>{formatDate(message.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="analytics-container">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value">{stats.totalUsers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active Users</div>
                  <div className="stat-value">{stats.activeUsers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Messages</div>
                  <div className="stat-value">{stats.totalMessages}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">New Users (7 days)</div>
                  <div className="stat-value">{stats.newUsers}</div>
                </div>
              </div>

              <div className="chart-container">
                <div className="chart-header">
                  <div className="chart-title">
                    <i className="fas fa-chart-bar"></i> Daily Messages
                  </div>
                  <div className="chart-actions">
                    <button className="chart-action-button active">
                      7 Days
                    </button>
                    <button className="chart-action-button">30 Days</button>
                    <button className="chart-action-button">3 Months</button>
                  </div>
                </div>
                <div className="chart-body">
                  {/* In a real app, you would use a charting library like Chart.js or Recharts */}
                  <div className="dummy-chart">
                    <div className="chart-bars">
                      {stats.dailyMessages.map((day, index) => (
                        <div key={index} className="chart-bar-container">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${Math.max(
                                5,
                                (day.count /
                                  Math.max(
                                    ...stats.dailyMessages.map((d) => d.count)
                                  )) *
                                  150
                              )}px`,
                            }}
                          ></div>
                          <div className="chart-label">
                            {day.date.split("-")[2]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="settings-container">
              <div className="settings-grid">
                <div className="setting-card">
                  <div className="setting-card-header">
                    <div className="setting-card-title">System Settings</div>
                  </div>
                  <div className="setting-card-body">
                    <div className="setting-group">
                      <div className="setting-group-label">
                        User Registration
                      </div>
                      <div className="setting-option">
                        <div className="setting-option-label">
                          Allow New Registrations
                        </div>
                        <div className="setting-option-info">
                          Allow new users to register on the platform
                        </div>
                        <div className="switch">
                          <input
                            type="checkbox"
                            id="allow-registration"
                            checked
                          />
                          <label
                            className="slider"
                            htmlFor="allow-registration"
                          ></label>
                        </div>
                      </div>
                      <div className="setting-option">
                        <div className="setting-option-label">
                          Email Verification
                        </div>
                        <div className="setting-option-info">
                          Require email verification for new accounts
                        </div>
                        <div className="switch">
                          <input
                            type="checkbox"
                            id="email-verification"
                            checked
                          />
                          <label
                            className="slider"
                            htmlFor="email-verification"
                          ></label>
                        </div>
                      </div>
                    </div>

                    <div className="setting-group">
                      <div className="setting-group-label">Security</div>
                      <div className="setting-option">
                        <div className="setting-option-label">
                          Two-Factor Authentication
                        </div>
                        <div className="setting-option-info">
                          Require two-factor authentication for all users
                        </div>
                        <div className="switch">
                          <input type="checkbox" id="require-2fa" />
                          <label
                            className="slider"
                            htmlFor="require-2fa"
                          ></label>
                        </div>
                      </div>
                      <div className="setting-option">
                        <div className="setting-option-label">
                          Password Requirements
                        </div>
                        <div className="setting-option-info">
                          Set minimum complexity for passwords
                        </div>
                        <select className="setting-select">
                          <option>Low - 6 characters minimum</option>
                          <option selected>
                            Medium - 8 characters with numbers
                          </option>
                          <option>
                            High - 10 characters with special characters
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="setting-card">
                  <div className="setting-card-header">
                    <div className="setting-card-title">Message Settings</div>
                  </div>
                  <div className="setting-card-body">
                    <div className="setting-group">
                      <div className="setting-option">
                        <div className="setting-option-label">
                          File Attachments
                        </div>
                        <div className="setting-option-info">
                          Allow users to send file attachments
                        </div>
                        <div className="switch">
                          <input
                            type="checkbox"
                            id="allow-attachments"
                            checked
                          />
                          <label
                            className="slider"
                            htmlFor="allow-attachments"
                          ></label>
                        </div>
                      </div>
                      <div className="setting-option">
                        <div className="setting-option-label">
                          Max File Size
                        </div>
                        <div className="setting-option-info">
                          Maximum size for attachments
                        </div>
                        <select className="setting-select">
                          <option>5 MB</option>
                          <option selected>10 MB</option>
                          <option>20 MB</option>
                          <option>50 MB</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button className="btn btn-secondary">Reset to Defaults</button>
                <button className="btn btn-primary">Save Settings</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmAction && (
        <div className="modal-overlay">
          <div className="user-modal">
            <div className="user-modal-header">
              <div className="user-modal-title">Confirm Action</div>
              <button className="user-modal-close" onClick={cancelConfirmation}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="user-modal-body">
              <p>
                Are you sure you want to{" "}
                <strong>
                  {confirmAction.action === "delete"
                    ? "delete"
                    : confirmAction.action === "suspend"
                    ? "suspend"
                    : confirmAction.action === "unsuspend"
                    ? "unsuspend"
                    : confirmAction.action === "promote"
                    ? "promote to admin"
                    : "remove admin privileges from"}
                </strong>{" "}
                the user <strong>{confirmAction.user.name}</strong>?
              </p>
              <p>
                This action{" "}
                {confirmAction.action === "delete" ? "cannot" : "can"} be
                undone.
              </p>
            </div>
            <div className="user-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={cancelConfirmation}
              >
                Cancel
              </button>
              <button
                className={`btn ${
                  confirmAction.action === "delete"
                    ? "btn-danger"
                    : "btn-primary"
                }`}
                onClick={confirmUserAction}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
