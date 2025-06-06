import React, { useState, useEffect } from "react";
import "../styles/sidebar.css";

function Sidebar({ activePage, setActivePage, isAdmin, onLogout, userName }) {
  const [avatarColor, setAvatarColor] = useState(
    localStorage.getItem("avatarColor") || "#4a6cf7"
  );

  // Initialize expanded state to false, and ensure it's always false on mobile
  const [expanded, setExpanded] = useState(
    window.innerWidth <= 576 ? false : false
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(
    localStorage.getItem("sidebarHoverExpand") === "true"
  );

  // Listen for avatar color and profile picture changes
  useEffect(() => {
    const handleAvatarColorChange = (event) => {
      setAvatarColor(event.detail.color);
      // Force update the avatar color in the DOM
      const userAvatar = document.querySelector(".user-avatar");
      if (userAvatar) {
        userAvatar.style.background = event.detail.color;
        userAvatar.style.backgroundImage = "none";
      }
    };    const handleSidebarHoverSetting = (event) => {
      setHoverEnabled(event.detail.enabled);
      // When hover is disabled, ensure the sidebar is collapsed
      if (!event.detail.enabled) {
        setExpanded(false);
      }
    };

    // Add event listeners
    document.addEventListener("avatarColorChanged", handleAvatarColorChange);
    document.addEventListener(
      "sidebarHoverSettingChanged",
      handleSidebarHoverSetting
    );

    // Update avatar color from localStorage on mount
    const storedColor = localStorage.getItem("avatarColor");

    // Force update the avatar in the DOM on mount
    const userAvatar = document.querySelector(".user-avatar");
    if (userAvatar && storedColor) {
      userAvatar.style.backgroundColor = storedColor;
      userAvatar.style.backgroundImage = "none";
      userAvatar.innerHTML = userName ? userName.charAt(0).toUpperCase() : "U";
    }    // Setup storage event listener to detect changes from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === "avatarColor" && e.newValue) {
        setAvatarColor(e.newValue);
        // Force update the avatar color in the DOM when changed from another tab
        const userAvatar = document.querySelector(".user-avatar");
        if (userAvatar) {
          userAvatar.style.backgroundColor = e.newValue;
          userAvatar.style.backgroundImage = "none";
          userAvatar.innerHTML = userName
            ? userName.charAt(0).toUpperCase()
            : "U";
        }
      } else if (e.key === "sidebarHoverExpand") {
        const enabled = e.newValue === "true";
        setHoverEnabled(enabled);
        // When hover is disabled, ensure the sidebar is collapsed
        if (!enabled) {
          setExpanded(false);
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
  }, [avatarColor, userName]);

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
    // Only enable hover expansion if hover is enabled AND not on mobile
    if (hoverEnabled && window.innerWidth > 576) {
      setExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    // Always collapse when mouse leaves, regardless of hover setting
    setExpanded(false);
  };

  // Check if we're on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 576);

  // Update isMobile state when window is resized
  useEffect(() => {
    const handleResize = () => {
      const isMobileView = window.innerWidth <= 576;
      setIsMobile(isMobileView);

      // Always collapse sidebar on mobile regardless of hover setting
      if (isMobileView) {
        setExpanded(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      {/* Clean header bar for mobile */}
      {isMobile && (
        <div className="header-bar">
          <div className="logo-container">
            <div className="logo-text">
              <span className="logo-word" data-text="Nex">
                Nex
              </span>
              <span className="logo-word" data-text="Message">
                Message
              </span>
            </div>
            <div className="logo-short">
              <span className="logo-word" data-text="N">
                N
              </span>
              <span className="logo-word" data-text="M">
                M
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        className={`sidebar ${expanded ? "expanded" : ""} ${hoverEnabled ? "hover-enabled" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Only show logo in sidebar on desktop */}
        {!isMobile && (
          <div className="logo-container">
            <div className="logo-text">
              <span className="logo-word" data-text="Nex">
                Nex
              </span>
              <span className="logo-word" data-text="Message">
                Message
              </span>
            </div>
            <div className="logo-short">
              <span className="logo-word" data-text="N">
                N
              </span>
              <span className="logo-word" data-text="M">
                M
              </span>
            </div>
          </div>
        )}

        <div className="user-profile">
          <div
            className="user-avatar"
            style={{
              backgroundColor: avatarColor || generateAvatarColor(userName),
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            onClick={() => setActivePage("settings")}
            title="Profile Settings"
          >
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="user-name">{userName || "User"}</div>
        </div>

        <nav className="sidebar-nav">
          {/* Messaging group */}
          <div className="nav-group">
            <div className="nav-group-title">Messaging</div>
            <ul>
              <li
                className={`sidebar-icon ${
                  activePage === "messaging" ? "active" : ""
                }`}
                onClick={() => setActivePage("messaging")}
                title="Messages"
              >
                <i className="far fa-comment-dots"></i>
                <span className="sidebar-text">Messages</span>
              </li>

              <li
                className={`sidebar-icon ${
                  activePage === "contacts" ? "active" : ""
                }`}
                onClick={() => setActivePage("contacts")}
                title="Contacts"
              >
                <i className="far fa-address-card"></i>
                <span className="sidebar-text">Contacts</span>
              </li>

              <li
                className={`sidebar-icon ${
                  activePage === "groups" ? "active" : ""
                }`}
                onClick={() => setActivePage("groups")}
                title="Group Chats"
              >
                <i className="fas fa-user-friends"></i>
                <span className="sidebar-text">Group Chats</span>
              </li>
            </ul>
          </div>

          {/* Settings group */}
          <div className="nav-group">
            <div className="nav-group-title">Settings</div>
            <ul>
              <li
                className={`sidebar-icon ${
                  activePage === "settings" ? "active" : ""
                }`}
                onClick={() => setActivePage("settings")}
                title="Preferences"
              >
                <i className="fas fa-cog"></i>
                <span className="sidebar-text">Preferences</span>
              </li>

              <li
                className={`sidebar-icon ${
                  activePage === "security" ? "active" : ""
                }`}
                onClick={() => setActivePage("security")}
                title="Security"
              >
                <i className="fas fa-lock"></i>
                <span className="sidebar-text">Security</span>
              </li>
            </ul>
          </div>

          {/* Admin group - only shown if user is admin */}
          {isAdmin && (
            <div className="nav-group admin-group">
              <div className="nav-group-title">Administration</div>
              <ul>
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
                  <i className="fas fa-user-cog"></i>
                  <span className="sidebar-text">
                    {userName &&
                    window.user &&
                    window.user.adminRole === "admin_master"
                      ? "Admin Master"
                      : "Admin Panel"}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
          >
            <i className="fas fa-power-off"></i>
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
