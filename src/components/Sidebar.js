import React from "react";
import "../styles/sidebar.css";

function Sidebar({ activePage, setActivePage, isAdmin, onLogout, userName }) {
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  // Generate avatar color based on username
  const generateAvatarColor = (name) => {
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
  };

  return (
    <div className="sidebar">
      <div className="logo-container">
        <img
          src="/logo192.png"
          alt="Elite Messaging"
          className="sidebar-logo"
        />
        <h3>Elite Messaging</h3>
      </div>

      <div className="user-profile">
        <div
          className="user-avatar"
          style={{ backgroundColor: generateAvatarColor(userName) }}
        >
          {userName ? userName.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="user-name">{userName || "User"}</div>
      </div>

      <nav className="sidebar-nav">
        <ul>
          <li
            className={activePage === "messaging" ? "active" : ""}
            onClick={() => setActivePage("messaging")}
          >
            <i className="fas fa-comment"></i>
            <span>Messages</span>
          </li>

          <li
            className={activePage === "contacts" ? "active" : ""}
            onClick={() => setActivePage("contacts")}
          >
            <i className="fas fa-address-book"></i>
            <span>Contacts</span>
          </li>

          <li
            className={activePage === "groups" ? "active" : ""}
            onClick={() => setActivePage("groups")}
          >
            <i className="fas fa-users"></i>
            <span>Group Chats</span>
          </li>

          <li
            className={activePage === "settings" ? "active" : ""}
            onClick={() => setActivePage("settings")}
          >
            <i className="fas fa-cog"></i>
            <span>Settings</span>
          </li>

          <li
            className={activePage === "security" ? "active" : ""}
            onClick={() => setActivePage("security")}
          >
            <i className="fas fa-shield-alt"></i>
            <span>Security</span>
          </li>

          {isAdmin && (
            <>
              <li
                className={activePage === "admin" ? "active" : ""}
                onClick={() => setActivePage("admin")}
              >
                <i className="fas fa-user-shield"></i>
                <span>Admin Panel</span>
              </li>

              <li
                className={activePage === "realtime" ? "active" : ""}
                onClick={() => setActivePage("realtime")}
              >
                <i className="fas fa-chart-line"></i>
                <span>Realtime</span>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button className="logout-button" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
