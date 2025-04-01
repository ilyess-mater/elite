import React, { useState } from "react";
import "../styles/dashboard.css";
import Sidebar from "./Sidebar";
import MessagingPage from "./MessagingPage";
import ContactsPage from "./ContactsPage";
import SettingsPage from "./SettingsPage";
import SecurityPage from "./SecurityPage";
import GroupChatPage from "./GroupChatPage";
import AdminPanel from "./AdminPanel";
import RealtimePage from "./RealtimePage";

function MainDashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("messaging");
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState("medium"); // small, medium, large

  // Function to apply settings across the app
  const applySettings = (settings) => {
    if (settings.darkMode !== undefined) setDarkMode(settings.darkMode);
    if (settings.textSize !== undefined) setTextSize(settings.textSize);
  };

  // Apply dark mode class to body
  React.useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    // Apply text size class
    document.body.classList.remove("text-small", "text-medium", "text-large");
    document.body.classList.add(`text-${textSize}`);
  }, [darkMode, textSize]);

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
      case "realtime":
        return <RealtimePage user={user} />;
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
