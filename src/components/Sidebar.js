import React, { useState, useEffect } from "react";
import "../styles/sidebar.css";

function Sidebar({ activePage, setActivePage, isAdmin, onLogout, userName }) {
  const [avatarColor, setAvatarColor] = useState(
    localStorage.getItem("avatarColor") || "#4a6cf7"
  );
  const [expanded, setExpanded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(
    localStorage.getItem("sidebarHoverExpand") === "true"
  );

  // Listen for avatar color changes
  useEffect(() => {
    const handleAvatarColorChange = (event) => {
      setAvatarColor(event.detail.color);
      // Force update the avatar color in the DOM
      const userAvatar = document.querySelector(".user-avatar");
      if (userAvatar) {
        userAvatar.style.background = event.detail.color;
        userAvatar.style.backgroundImage = "none";
      }
    };

    const handleSidebarHoverSetting = (event) => {
      setHoverEnabled(event.detail.enabled);
    };

    // Add event listeners
    document.addEventListener("avatarColorChanged", handleAvatarColorChange);
    document.addEventListener(
      "sidebarHoverSettingChanged",
      handleSidebarHoverSetting
    );

    // Update avatar color from localStorage on mount
    const storedColor = localStorage.getItem("avatarColor");
    if (storedColor) {
      setAvatarColor(storedColor);
      // Force update the avatar color in the DOM on mount
      const userAvatar = document.querySelector(".user-avatar");
      if (userAvatar) {
        userAvatar.style.background = storedColor;
        userAvatar.style.backgroundImage = "none";
      }
    }

    // Setup storage event listener to detect changes from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === "avatarColor" && e.newValue) {
        setAvatarColor(e.newValue);
        // Force update the avatar color in the DOM when changed from another tab
        const userAvatar = document.querySelector(".user-avatar");
        if (userAvatar) {
          userAvatar.style.background = e.newValue;
          userAvatar.style.backgroundImage = "none";
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      document.removeEventListener(
        "avatarColorChanged",
        handleAvatarColorChange
      );
      document.removeEventListener(
        "sidebarHoverSettingChanged",
        handleSidebarHoverSetting
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setShowLogoutConfirm(false);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Generate avatar color based on username (fallback)
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

  const handleMouseEnter = () => {
    if (hoverEnabled) {
      setExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverEnabled) {
      setExpanded(false);
    }
  };

  return (
    <>
      <div
        className={`sidebar ${expanded ? "expanded" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="logo-container">
          <img
            src="/shield.png"
            alt="Secure Messages"
            className="sidebar-logo"
          />
          <h3 className="logo-text">Secure Messages</h3>
        </div>

        <div className="user-profile">
          <div
            className="user-avatar"
            style={{
              background: avatarColor || generateAvatarColor(userName),
              backgroundImage: "none",
            }}
          >
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="user-name">{userName || "User"}</div>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li
              className={`sidebar-icon ${
                activePage === "messaging" ? "active" : ""
              }`}
              onClick={() => setActivePage("messaging")}
              title="Messages"
            >
              <i className="fas fa-comment-alt"></i>
              <span className="sidebar-text">Messages</span>
            </li>

            <li
              className={`sidebar-icon ${
                activePage === "contacts" ? "active" : ""
              }`}
              onClick={() => setActivePage("contacts")}
              title="Contacts"
            >
              <i className="fas fa-address-book"></i>
              <span className="sidebar-text">Contacts</span>
            </li>

            <li
              className={`sidebar-icon ${
                activePage === "groups" ? "active" : ""
              }`}
              onClick={() => setActivePage("groups")}
              title="Group Chats"
            >
              <i className="fas fa-users"></i>
              <span className="sidebar-text">Group Chats</span>
            </li>

            <li
              className={`sidebar-icon ${
                activePage === "settings" ? "active" : ""
              }`}
              onClick={() => setActivePage("settings")}
              title="Settings"
            >
              <i className="fas fa-sliders-h"></i>
              <span className="sidebar-text">Settings</span>
            </li>

            <li
              className={`sidebar-icon ${
                activePage === "security" ? "active" : ""
              }`}
              onClick={() => setActivePage("security")}
              title="Security"
            >
              <i className="fas fa-shield-alt"></i>
              <span className="sidebar-text">Security</span>
            </li>

            {isAdmin && (
              <li
                className={`sidebar-icon ${
                  activePage === "admin" ? "active" : ""
                }`}
                onClick={() => setActivePage("admin")}
                title={
                  userName &&
                  window.user &&
                  window.user.adminRole === "admin_master"
                    ? "Admin Master"
                    : "Admin Panel"
                }
              >
                <i className="fas fa-user-shield"></i>
                <span className="sidebar-text">
                  {userName &&
                  window.user &&
                  window.user.adminRole === "admin_master"
                    ? "Admin Master"
                    : "Admin Panel"}
                </span>
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="sidebar-text">Logout</span>
          </button>
        </div>
      </div>

      {/* Centered logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <h4>Confirm Logout</h4>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelLogout}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
