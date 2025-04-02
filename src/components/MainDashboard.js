import React, { useState, useEffect } from "react";
import "../styles/dashboard.css";
import Sidebar from "./Sidebar";
import MessagingPage from "./MessagingPage";
import ContactsPage from "./ContactsPage";
import SettingsPage from "./SettingsPage";
import SecurityPage from "./SecurityPage";
import GroupChatPage from "./GroupChatPage";
import AdminPanel from "./AdminPanel";

function MainDashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("messaging");
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark" || false
  );
  const [textSize, setTextSize] = useState(
    localStorage.getItem("fontSize") || "medium"
  ); // small, medium, large

  // Function to apply settings across the app
  const applySettings = (settings) => {
    if (settings.darkMode !== undefined) {
      setDarkMode(settings.darkMode);
      localStorage.setItem("theme", settings.darkMode ? "dark" : "light");
    }

    if (settings.textSize !== undefined) {
      setTextSize(settings.textSize);
      localStorage.setItem("fontSize", settings.textSize);
    }
  };

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // Apply text size class to body
  useEffect(() => {
    document.body.classList.remove("text-small", "text-medium", "text-large");
    document.body.classList.add(`text-${textSize}`);
  }, [textSize]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case "messaging":
        return <MessagingPage user={user} textSize={textSize} />;
      case "contacts":
        return <ContactsPage user={user} />;
      case "settings":
        return (
          <SettingsPage
            user={user}
            darkMode={darkMode}
            textSize={textSize}
            applySettings={applySettings}
          />
        );
      case "security":
        return <SecurityPage user={user} />;
      case "groups":
        return <GroupChatPage user={user} textSize={textSize} />;
      case "admin":
        return <AdminPanel user={user} />;
      default:
        return <MessagingPage user={user} textSize={textSize} />;
    }
  };

  return (
    <div className={`dashboard-container ${darkMode ? "dark-mode" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isAdmin={user && user.isAdmin}
        onLogout={handleLogout}
        userName={user ? user.name : ""}
      />
      <div className="dashboard-content">{renderContent()}</div>
    </div>
  );
}

export default MainDashboard;
