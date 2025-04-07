import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import "../styles/settings.css";

function SettingsPage({ user, darkMode, textSize, applySettings }) {
  const [selectedColor, setSelectedColor] = useState(
    localStorage.getItem("avatarColor") || "#4a6cf7"
  );
  const [settings, setSettings] = useState({
    theme: darkMode ? "dark" : "light",
    fontSize: textSize || "medium",
  });

  // Predefined avatar colors
  const avatarColors = [
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
  ];

  // Apply font size changes in real-time
  useEffect(() => {
    document.body.classList.remove("text-small", "text-medium", "text-large");
    document.body.classList.add(`text-${settings.fontSize}`);
  }, [settings.fontSize]);

  const handleThemeChange = (theme) => {
    setSettings({ ...settings, theme });
    applySettings({ darkMode: theme === "dark" });
    localStorage.setItem("theme", theme);
  };

  const handleFontSizeChange = (fontSize) => {
    setSettings({ ...settings, fontSize });
    applySettings({ textSize: fontSize });
    localStorage.setItem("fontSize", fontSize);
  };

  const handleAvatarColorChange = (color) => {
    setSelectedColor(color);
    localStorage.setItem("avatarColor", color);
    document.dispatchEvent(
      new CustomEvent("avatarColorChanged", { detail: { color } })
    );
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-header">
            <h2>Display Settings</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-group">
              <h3>Theme</h3>
              <div className="theme-options">
                <div
                  className={`theme-option ${
                    settings.theme === "light" ? "active" : ""
                  }`}
                  onClick={() => handleThemeChange("light")}
                >
                  <div className="theme-preview light-theme"></div>
                  <div className="theme-label">Light</div>
                </div>
                <div
                  className={`theme-option ${
                    settings.theme === "dark" ? "active" : ""
                  }`}
                  onClick={() => handleThemeChange("dark")}
                >
                  <div className="theme-preview dark-theme"></div>
                  <div className="theme-label">Dark</div>
                </div>
              </div>
            </div>

            <div className="setting-group">
              <h3>Text Size</h3>
              <div className="font-size-options">
                <div
                  className={`font-size-option ${
                    settings.fontSize === "small" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("small")}
                >
                  <div className="font-size-preview small">Aa</div>
                  <div className="font-size-label">Small</div>
                </div>
                <div
                  className={`font-size-option ${
                    settings.fontSize === "medium" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("medium")}
                >
                  <div className="font-size-preview medium">Aa</div>
                  <div className="font-size-label">Medium</div>
                </div>
                <div
                  className={`font-size-option ${
                    settings.fontSize === "large" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("large")}
                >
                  <div className="font-size-preview large">Aa</div>
                  <div className="font-size-label">Large</div>
                </div>
              </div>
            </div>

            <div className="setting-group">
              <h3>Avatar Color</h3>
              <div className="avatar-color-options">
                {avatarColors.map((color, index) => (
                  <div
                    key={index}
                    className={`avatar-color-option ${
                      selectedColor === color ? "active" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleAvatarColorChange(color)}
                  >
                    {selectedColor === color && (
                      <i className="fas fa-check"></i>
                    )}
                  </div>
                ))}
              </div>
              <div className="avatar-preview">
                <div
                  className="user-avatar-preview"
                  style={{ backgroundColor: selectedColor }}
                >
                  {user && user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="avatar-preview-label">Preview</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
