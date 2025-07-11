import React, { useState, useEffect } from "react";
import "../styles/admin.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import SearchBar from "./SearchBar";

function AdminPanel({ user }) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    dailyMessages: [],
    newUsers: 0,
  });
  const [timeRange, setTimeRange] = useState("7days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [confirmAction, setConfirmAction] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const [groupMessageSearchTerm, setGroupMessageSearchTerm] = useState("");
  const { getSocket } = useAuth();
  const socket = getSocket();

  // Add safety check to prevent unauthorized operations
  useEffect(() => {
    if (!user || !user.isAdmin) {
      setError("You don't have permission to access this page");
      setLoading(false);
      return;
    }

    // Set window.user for admin role checks
    window.user = user;

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    // Configure axios
    axios.defaults.baseURL = "http://localhost:5000";
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          usersResponse,
          messagesResponse,
          groupMessagesResponse,
          statsResponse,
        ] = await Promise.all([
          axios.get("/api/admin/users"),
          axios.get("/api/admin/messages"),
          axios.get("/api/admin/group-messages"),
          axios.get("/api/stats"),
        ]);

        setUsers(usersResponse.data);
        setAllMessages(messagesResponse.data);
        setGroupMessages(groupMessagesResponse.data);
        setStats(statsResponse.data);

        setLoading(false);
      } catch (error) {
        console.error(
          "Error fetching admin data:",
          error.response?.data || error.message
        );
        setError("Failed to load admin data. Please try again.");
        setLoading(false);
      }
    };

    fetchData();
  }, [user, timeRange]);

  // Function to fetch daily messages data
  const fetchDailyMessages = async (range) => {
    try {
      const dailyMessagesResponse = await axios.get(
        `/api/admin/messages/daily?range=${range}`
      );
      if (
        dailyMessagesResponse.data &&
        Array.isArray(dailyMessagesResponse.data)
      ) {
        // Update the stats object with real daily messages data
        setStats((prevStats) => ({
          ...prevStats,
          dailyMessages: dailyMessagesResponse.data,
        }));
      }
    } catch (error) {
      console.error("Error fetching daily messages:", error);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    fetchDailyMessages(range);
  };

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

    // Listen for new messages to update stats in real-time
    socket.on("new_message", (messageData) => {
      // Update total messages count
      setStats((prevStats) => ({
        ...prevStats,
        totalMessages: prevStats.totalMessages + 1,
      }));

      // Update daily messages for the current day
      const today = new Date().toISOString().split("T")[0];
      setStats((prevStats) => {
        const updatedDailyMessages = [...prevStats.dailyMessages];
        const todayIndex = updatedDailyMessages.findIndex(
          (day) => day.date === today
        );

        if (todayIndex >= 0) {
          updatedDailyMessages[todayIndex] = {
            ...updatedDailyMessages[todayIndex],
            count: updatedDailyMessages[todayIndex].count + 1,
          };
        }

        return {
          ...prevStats,
          dailyMessages: updatedDailyMessages,
        };
      });
    });

    return () => {
      socket.off("user_status");
      socket.off("new_message");
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

  // Filtrer les utilisateurs en fonction du terme de recherche
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (user.isAdmin ? "admin" : "user").includes(userSearchTerm.toLowerCase())
  );

  // Filtrer les messages en fonction du terme de recherche
  const filteredMessages = allMessages.filter(
    (message) =>
      message.senderName
        .toLowerCase()
        .includes(messageSearchTerm.toLowerCase()) ||
      message.receiverName
        .toLowerCase()
        .includes(messageSearchTerm.toLowerCase()) ||
      message.text.toLowerCase().includes(messageSearchTerm.toLowerCase())
  );

  // Filtrer les messages de groupe en fonction du terme de recherche
  const filteredGroupMessages = groupMessages.filter(
    (message) =>
      message.senderName
        .toLowerCase()
        .includes(groupMessageSearchTerm.toLowerCase()) ||
      message.groupName
        .toLowerCase()
        .includes(groupMessageSearchTerm.toLowerCase()) ||
      message.text.toLowerCase().includes(groupMessageSearchTerm.toLowerCase())
  );

  // Get current users for pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  // Generate avatar color based on name
  function generateAvatar(name) {
    if (!name) return "#777";

    const colors = [
      "#FF5733", // Orange/Red
      "#33FF57", // Green
      "#3357FF", // Blue
      "#F333FF", // Purple
      "#FF33F3", // Pink
      "#33FFF3", // Cyan
      "#FFD700", // Gold
      "#9370DB", // Medium Purple
      "#20B2AA", // Light Sea Green
      "#FF6347", // Tomato
      "#4682B4", // Steel Blue
      "#32CD32", // Lime Green
      "#E91E63", // Pink
      "#9C27B0", // Purple
      "#673AB7", // Deep Purple
      "#3F51B5", // Indigo
      "#2196F3", // Blue
      "#03A9F4", // Light Blue
      "#00BCD4", // Cyan
      "#009688", // Teal
      "#4CAF50", // Green
      "#8BC34A", // Light Green
      "#CDDC39", // Lime
      "#FFEB3B", // Yellow
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  const handleUserAction = (action, userData) => {
    // Regular admins cannot demote any users (only Admin Masters can demote)
    if (action === "demote" && window.user?.adminRole !== "admin_master") {
      setError("Only Admin Masters can demote users");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    // Regular admins can only promote normal users (not admins) to regular admin role
    if (action === "promote") {
      if (userData.isAdmin) {
        setError("Regular admins cannot modify other admin roles");
        setTimeout(() => {
          setError("");
        }, 3000);
        return;
      }

      setConfirmAction({
        action: "promote",
        user: userData,
      });
      return;
    }

    // Regular admins cannot ban admin masters or other admins
    if (action === "ban" && userData.isAdmin) {
      setError("Regular admins cannot ban other admins or admin masters");
      setTimeout(() => {
        setError("");
      }, 3000);
      return;
    }

    // For other actions like ban (for non-admin users)
    setConfirmAction({
      action,
      user: userData,
    });
  };

  const confirmUserAction = async () => {
    if (!confirmAction) return;

    const { action, user: userData, adminRoleType } = confirmAction;

    try {
      if (action === "ban") {
        const response = await axios.delete(`/api/admin/users/${userData.id}`);

        if (response.status === 200) {
          // Update local state
          setUsers(users.filter((u) => u.id !== userData.id));
          // Show success message
          setSuccessMessage(`${userData.name} has been successfully banned`);
          // Clear success message after 3 seconds
          setTimeout(() => {
            setSuccessMessage("");
          }, 3000);
          setError("");
        }
      } else if (action === "promote") {
        await axios.post(`/api/admin/users/${userData.id}/promote`);
        setUsers(
          users.map((u) =>
            u.id === userData.id
              ? { ...u, isAdmin: true, adminRole: "admin" }
              : u
          )
        );
        setSuccessMessage(`${userData.name} has been promoted to admin`);
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else if (action === "promote_admin_master") {
        await axios.post(`/api/admin/users/${userData.id}/promote-master`);
        setUsers(
          users.map((u) =>
            u.id === userData.id
              ? { ...u, isAdmin: true, adminRole: "admin_master" }
              : u
          )
        );
        setSuccessMessage(`${userData.name} has been promoted to admin master`);
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else if (action === "demote") {
        await axios.post(`/api/admin/users/${userData.id}/demote`);
        setUsers(
          users.map((u) =>
            u.id === userData.id ? { ...u, isAdmin: false, adminRole: null } : u
          )
        );
        setSuccessMessage(`${userData.name} has been made a regular user`);
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } else if (action === "promote_options") {
        // This is handled in the render function with a different dialog
        // No API call needed here
      }
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      const errorMessage =
        error.response?.data?.error ||
        `Failed to ${action} user. Please try again.`;
      setError(errorMessage);
      setSuccessMessage("");
    } finally {
      setConfirmAction(null);
    }
  };

  const cancelConfirmation = () => {
    setConfirmAction(null);
  };

  // Format date for chart labels
  const formatChartDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading-message">
          <div className="loader"></div>
          <span>Loading admin panel...</span>
        </div>
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
    <div className="admin-panel-container">
      {confirmAction && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h3>Confirm Action</h3>
            {confirmAction.action === "promote_options" ? (
              <div className="promote-options">
                <p>Select admin role for {confirmAction.user.name}:</p>
                <div className="admin-role-buttons">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setConfirmAction({
                        ...confirmAction,
                        action: "promote",
                      });
                      confirmUserAction();
                    }}
                  >
                    Regular Admin
                  </button>
                  <button
                    className="btn btn-primary admin-master-btn"
                    onClick={() => {
                      setConfirmAction({
                        ...confirmAction,
                        action: "promote_admin_master",
                      });
                      confirmUserAction();
                    }}
                  >
                    Admin Master
                  </button>
                </div>
                <div className="confirm-dialog-actions">
                  <button className="btn-cancel" onClick={cancelConfirmation}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  {confirmAction.action === "ban"
                    ? `Are you sure you want to ban user ${confirmAction.user.name}? This action cannot be undone.`
                    : confirmAction.action === "promote"
                    ? `Are you sure you want to make ${confirmAction.user.name} a regular admin?`
                    : confirmAction.action === "promote_admin_master"
                    ? `Are you sure you want to make ${confirmAction.user.name} an admin master?`
                    : confirmAction.action === "demote"
                    ? `Are you sure you want to make ${confirmAction.user.name} a regular user?`
                    : `Are you sure you want to ${confirmAction.action} ${confirmAction.user.name}?`}
                </p>
                <div className="confirm-dialog-actions">
                  <button className="btn-cancel" onClick={cancelConfirmation}>
                    Cancel
                  </button>
                  <button
                    className={`btn-confirm ${
                      confirmAction.action === "ban" ? "btn-danger" : ""
                    }`}
                    onClick={confirmUserAction}
                  >
                    {confirmAction.action === "ban" ? "Ban" : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="admin-panel-header">
        <div className="header-content">
          <h1>Admin Panel</h1>
          <p>Manage users and monitor system activity</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="btn-modern refresh-button"
            onClick={() => {
              setLoading(true);
              const token = localStorage.getItem("token");
              if (!token) {
                setError("Authentication required");
                setLoading(false);
                return;
              }

              const fetchData = async () => {
                try {
                  setError("");
                  const [
                    usersResponse,
                    messagesResponse,
                    groupMessagesResponse,
                    statsResponse,
                  ] = await Promise.all([
                    axios.get("/api/admin/users"),
                    axios.get("/api/admin/messages"),
                    axios.get("/api/admin/group-messages"),
                    axios.get("/api/stats"),
                  ]);

                  setUsers(usersResponse.data);
                  setAllMessages(messagesResponse.data);
                  setGroupMessages(groupMessagesResponse.data);
                  setStats(statsResponse.data);

                  setLoading(false);
                  setSuccessMessage("Data refreshed successfully");
                  setTimeout(() => {
                    setSuccessMessage("");
                  }, 3000);
                } catch (error) {
                  console.error(
                    "Error fetching admin data:",
                    error.response?.data || error.message
                  );
                  setError("Failed to refresh data. Please try again.");
                  setLoading(false);
                }
              };

              fetchData();
            }}
            title="Refresh data"
          >
            <i className="fas fa-sync-alt"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {successMessage}
        </div>
      )}

      {error && (
        <div className="admin-error">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div className="admin-tabs-container">
        <div className="admin-tabs">
          <button
            className={`admin-tab-button ${
              activeTab === "users" ? "active" : ""
            }`}
            onClick={() => setActiveTab("users")}
          >
            <div className="glow-effect"></div>
            <i className="fas fa-users"></i>
            <span>Users</span>
          </button>
          <button
            className={`admin-tab-button ${
              activeTab === "messages" ? "active" : ""
            }`}
            onClick={() => setActiveTab("messages")}
          >
            <div className="glow-effect"></div>
            <i className="fas fa-comments"></i>
            <span>Messages</span>
          </button>
          <button
            className={`admin-tab-button ${
              activeTab === "group-messages" ? "active" : ""
            }`}
            onClick={() => setActiveTab("group-messages")}
          >
            <div className="glow-effect"></div>
            <i className="fas fa-users-rectangle"></i>
            <span>Group Messages</span>
          </button>
          <button
            className={`admin-tab-button ${
              activeTab === "analytics" ? "active" : ""
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            <div className="glow-effect"></div>
            <i className="fas fa-chart-bar"></i>
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div key={activeTab} className="admin-tab-content">
        {activeTab === "users" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value">{stats.totalUsers}</div>
                  <div className="stat-change stat-increase">
                    +{stats.newUsers} new in last 7 days
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-user-check"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">Active Users</div>
                  <div className="stat-value">{stats.activeUsers}</div>
                  <div className="stat-change stat-increase">
                    {Math.round((stats.activeUsers / stats.totalUsers) * 100)}%
                    of total
                  </div>
                </div>
              </div>
            </div>

            <div className="user-filters">
              <SearchBar
                placeholder="Search users..."
                value={userSearchTerm}
                onChange={setUserSearchTerm}
                className="admin-search"
                autoFocus={activeTab === "users"}
              />
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
                    <th>Department</th>
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
                          className="user-department"
                          data-department={user.department || ""}
                        >
                          {user.department || "Not Assigned"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`user-role ${
                            user.isAdmin
                              ? user.adminRole === "admin_master"
                                ? "role-admin-master"
                                : "role-admin"
                              : "role-user"
                          }`}
                        >
                          {user.isAdmin
                            ? user.adminRole === "admin_master"
                              ? "Admin Master"
                              : "Admin"
                            : "User"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-indicator ${
                            user.isActive ? "status-active" : "status-inactive"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{getTimeSince(user.lastActive)}</td>
                      <td>
                        {" "}
                        <div className="user-actions">
                          {user.isAdmin ? (
                            // Show demote button only if:
                            // 1. Not the current user AND
                            // 2. Current user is admin_master
                            // (Regular admins should NOT see the demote button for other admins)
                            user.id !== window.user?.id &&
                            window.user?.adminRole === "admin_master" ? (
                              <button
                                className="user-action-button"
                                title="Make User"
                                onClick={() => handleUserAction("demote", user)}
                              >
                                <i className="fas fa-level-down-alt"></i>
                              </button>
                            ) : null
                          ) : (
                            <button
                              className="user-action-button"
                              title="Make Admin"
                              onClick={() => handleUserAction("promote", user)}
                            >
                              <i className="fas fa-level-up-alt"></i>
                            </button>
                          )}
                          {/* Only show ban button for non-admin users or if current user is admin master */}
                          {!user.isAdmin ||
                          window.user?.adminRole === "admin_master" ? (
                            <button
                              className="user-action-button delete"
                              title="Ban User"
                              onClick={() => handleUserAction("ban", user)}
                            >
                              <i className="fas fa-ban"></i>
                            </button>
                          ) : null}
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
            <div className="messages-header">
              <h3>Recent Messages</h3>
              <SearchBar
                placeholder="Search messages..."
                value={messageSearchTerm}
                onChange={setMessageSearchTerm}
                className="admin-search"
                autoFocus={activeTab === "messages"}
              />
            </div>
            <div className="messages-table-container">
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
                  {filteredMessages.map((message) => (
                    <tr key={message.id}>
                      <td>
                        <div className="message-user">
                          <div
                            className="user-avatar small"
                            style={{
                              backgroundColor: generateAvatar(
                                message.senderName
                              ),
                            }}
                          >
                            {message.senderName.charAt(0)}
                          </div>
                          <span>{message.senderName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="message-user">
                          <div
                            className="user-avatar small"
                            style={{
                              backgroundColor: generateAvatar(
                                message.receiverName
                              ),
                            }}
                          >
                            {message.receiverName.charAt(0)}
                          </div>
                          <span>{message.receiverName}</span>
                        </div>
                      </td>
                      <td
                        className={`message-content ${
                          message.encrypted ? "encrypted-message" : ""
                        }`}
                      >
                        {message.encrypted ? (
                          <>
                            <i
                              className="fas fa-lock encrypted-icon"
                              title="End-to-End Encrypted Message"
                            ></i>
                            End-to-End Encrypted Message
                          </>
                        ) : (
                          message.text
                        )}
                      </td>
                      <td>{formatDate(message.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "group-messages" && (
          <div className="messages-container">
            <div className="messages-header">
              <h3>
                <i className="fas fa-users"></i> Group Messages
              </h3>
              <SearchBar
                placeholder="Search group messages..."
                value={groupMessageSearchTerm}
                onChange={setGroupMessageSearchTerm}
                className="admin-search"
                autoFocus={activeTab === "group-messages"}
              />
            </div>
            <div className="messages-table-container">
              <table className="messages-table">
                <thead>
                  <tr>
                    <th>
                      <i className="fas fa-user"></i> From
                    </th>
                    <th>
                      <i className="fas fa-users"></i> Group Name
                    </th>
                    <th>
                      <i className="fas fa-comment"></i> Message
                    </th>
                    <th>
                      <i className="fas fa-clock"></i> Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupMessages.map((message) => (
                    <tr key={message.id}>
                      <td>
                        <div className="message-user">
                          <div
                            className="user-avatar small"
                            style={{
                              backgroundColor: generateAvatar(
                                message.senderName
                              ),
                            }}
                          >
                            {message.senderName.charAt(0)}
                          </div>
                          <span>{message.senderName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="group-name">
                          <i className="fas fa-users"></i>
                          <span>{message.groupName}</span>
                        </div>
                      </td>
                      <td
                        className={`message-content ${
                          message.encrypted ? "encrypted-message" : ""
                        }`}
                      >
                        {message.encrypted ? (
                          <>
                            <i
                              className="fas fa-lock encrypted-icon"
                              title="End-to-End Encrypted Message"
                            ></i>
                            End-to-End Encrypted Message
                          </>
                        ) : (
                          message.text
                        )}
                      </td>
                      <td>{formatDate(message.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="analytics-container">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-comment-dots"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">Private Messages</div>
                  <div className="stat-value">{stats.privateMessages}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">Group Messages</div>
                  <div className="stat-value">{stats.groupMessages}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-chart-line"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">Total Messages</div>
                  <div className="stat-value">{stats.totalMessages}</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-user-plus"></i>
                </div>
                <div className="stat-details">
                  <div className="stat-label">New Users (7 days)</div>
                  <div className="stat-value">{stats.newUsers}</div>
                </div>
              </div>
            </div>

            {/* Daily Messages Chart */}
            <div className="chart-container">
              <div className="chart-header">
                <div className="chart-title">
                  <i className="fas fa-chart-bar"></i> Daily Messages
                </div>
                <div className="chart-actions">
                  <button
                    className={`chart-action-button ${
                      timeRange === "7days" ? "active" : ""
                    }`}
                    onClick={() => handleTimeRangeChange("7days")}
                  >
                    7 Days
                  </button>
                  <button
                    className={`chart-action-button ${
                      timeRange === "30days" ? "active" : ""
                    }`}
                    onClick={() => handleTimeRangeChange("30days")}
                  >
                    30 Days
                  </button>
                  <button
                    className={`chart-action-button ${
                      timeRange === "90days" ? "active" : ""
                    }`}
                    onClick={() => handleTimeRangeChange("90days")}
                  >
                    3 Months
                  </button>
                </div>
              </div>
              <div className="chart-body">
                <div className="modern-chart">
                  <div className="chart-legend">
                    <div className="legend-item">
                      <div
                        className="legend-color"
                        style={{ backgroundColor: "#4A90E2" }}
                      ></div>
                      <span>Private Messages</span>
                    </div>
                    <div className="legend-item">
                      <div
                        className="legend-color"
                        style={{ backgroundColor: "#37BC9B" }}
                      ></div>
                      <span>Group Messages</span>
                    </div>
                  </div>
                  <div className="chart-bars">
                    {stats.dailyMessages.map((day, index) => (
                      <div key={index} className="chart-bar-container">
                        <div className="chart-bar-value">
                          {day.count}
                          <div className="chart-bar-tooltip">
                            <div>Total: {day.count} messages</div>
                            <div>Private: {day.privateCount}</div>
                            <div>Group: {day.groupCount}</div>
                          </div>
                        </div>
                        <div className="chart-bar-stack">
                          <div
                            className="chart-bar private"
                            style={{
                              height: `${Math.max(
                                5,
                                (day.privateCount /
                                  Math.max(
                                    ...stats.dailyMessages.map((d) => d.count),
                                    1
                                  )) *
                                  150
                              )}px`,
                            }}
                          ></div>
                          <div
                            className="chart-bar group"
                            style={{
                              height: `${Math.max(
                                5,
                                (day.groupCount /
                                  Math.max(
                                    ...stats.dailyMessages.map((d) => d.count),
                                    1
                                  )) *
                                  150
                              )}px`,
                            }}
                          ></div>
                        </div>
                        <div className="chart-label">
                          {formatChartDate(day.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* User Growth Section */}
            <div className="analytics-cards">
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h3>
                    <i className="fas fa-user-chart"></i> User Growth
                  </h3>
                </div>
                <div className="analytics-card-content">
                  <div className="analytics-stat">
                    <div className="analytics-stat-value">
                      {stats.totalUsers}
                    </div>
                    <div className="analytics-stat-label">Total Users</div>
                    <div className="analytics-trend">
                      <div className="analytics-trend-value positive">
                        <i className="fas fa-arrow-up"></i>
                        {stats.userGrowthRate}%
                      </div>
                      <div className="analytics-trend-label">vs last month</div>
                    </div>
                  </div>
                  <div className="analytics-stat">
                    <div className="analytics-stat-value">
                      {stats.activeUsers}
                    </div>
                    <div className="analytics-stat-label">Active Users</div>
                    <div className="analytics-stat-secondary">
                      {Math.round((stats.activeUsers / stats.totalUsers) * 100)}
                      % of total
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Activity Section */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h3>
                    <i className="fas fa-chart-line"></i> Message Activity
                  </h3>
                </div>
                <div className="analytics-card-content">
                  <div className="analytics-stat">
                    <div className="analytics-stat-value">
                      {stats.totalMessages}
                    </div>
                    <div className="analytics-stat-label">Total Messages</div>
                    <div className="analytics-stat-secondary">
                      {stats.averageMessagesPerDay} avg/day
                    </div>
                  </div>
                  <div className="analytics-breakdown">
                    <div className="breakdown-item">
                      <div className="breakdown-label">Private</div>
                      <div className="breakdown-value">
                        {stats.privateMessages}
                      </div>
                      <div className="breakdown-percentage">
                        {Math.round(
                          (stats.privateMessages / stats.totalMessages) * 100
                        )}
                        %
                      </div>
                    </div>
                    <div className="breakdown-item">
                      <div className="breakdown-label">Group</div>
                      <div className="breakdown-value">
                        {stats.groupMessages}
                      </div>
                      <div className="breakdown-percentage">
                        {Math.round(
                          (stats.groupMessages / stats.totalMessages) * 100
                        )}
                        %
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
