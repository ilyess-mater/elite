import React, { useState, useEffect, useRef } from "react";
import "../styles/settings.css";
import { ChromePicker } from "react-color";

function SettingsPage({ user, darkMode, textSize, applySettings }) {
  const [selectedColor, setSelectedColor] = useState(
    localStorage.getItem("avatarColor") || "#4a6cf7"
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef(null);
  const [settings, setSettings] = useState({
    theme: darkMode ? "dark" : "light",
    fontSize: textSize || "medium",
    sidebarHoverExpand:
      localStorage.getItem("sidebarHoverExpand") === "true" || false,
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

  // Apply font size changes in real-time
  useEffect(() => {
    document.body.classList.remove("text-small", "text-medium", "text-large");
    document.body.classList.add(`text-${settings.fontSize}`);
  }, [settings.fontSize]);

  // Handle click outside of color picker to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target)
      ) {
        setShowColorPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [colorPickerRef]);

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

  const handleSidebarHoverChange = (enabled) => {
    setSettings({ ...settings, sidebarHoverExpand: enabled });
    localStorage.setItem("sidebarHoverExpand", enabled);
    // Dispatch an event to notify the sidebar
    document.dispatchEvent(
      new CustomEvent("sidebarHoverSettingChanged", { detail: { enabled } })
    );
  };

  const handleAvatarColorChange = (color) => {
    setSelectedColor(color);
    localStorage.setItem("avatarColor", color);
    // Dispatch event to notify other components about the color change
    document.dispatchEvent(
      new CustomEvent("avatarColorChanged", { detail: { color } })
    );
  };

  // Handle color change from the color picker
  const handleColorPickerChange = (color) => {
    const hexColor = color.hex;
    handleAvatarColorChange(hexColor);
  };

  // Toggle color picker visibility
  const toggleColorPicker = () => {
    setShowColorPicker(!showColorPicker);

    // Add/remove backdrop class to body for mobile
    if (!showColorPicker) {
      document.body.classList.add("color-picker-open");
    } else {
      document.body.classList.remove("color-picker-open");
    }
  };

  // Remove backdrop when component unmounts or color picker closes
  useEffect(() => {
    return () => {
      document.body.classList.remove("color-picker-open");
    };
  }, []);

  // Remove backdrop when color picker closes
  useEffect(() => {
    if (!showColorPicker) {
      document.body.classList.remove("color-picker-open");
    }
  }, [showColorPicker]);

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
              <h3>Sidebar Behavior</h3>
              <div className="setting-option">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.sidebarHoverExpand}
                    onChange={(e) => handleSidebarHoverChange(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
                <span className="setting-label">Expand sidebar on hover</span>
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

              <div className="custom-color-option">
                <button
                  className="custom-color-button"
                  onClick={toggleColorPicker}
                >
                  <i className="fas fa-palette"></i> Custom Color
                </button>
                {showColorPicker && (
                  <div className="color-picker-container" ref={colorPickerRef}>
                    <div className="color-picker-header">
                      <span>Choose a color</span>
                      <button
                        className="color-picker-close"
                        onClick={() => setShowColorPicker(false)}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <ChromePicker
                      color={selectedColor}
                      onChange={handleColorPickerChange}
                      disableAlpha={true}
                    />
                  </div>
                )}
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
