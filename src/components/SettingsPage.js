import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import "../styles/settings.css";

function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [settings, setSettings] = useState({
    theme: "light",
    fontSize: "medium",
    notifications: {
      newMessages: true,
      newContacts: true,
      groupMessages: true,
      system: true,
    },
    privacy: {
      showStatus: true,
      showLastSeen: true,
      readReceipts: true,
    },
    language: "en",
    autoReply: {
      enabled: false,
      message: "I'm currently away. I'll respond as soon as possible.",
    },
  });
  const [profileSettings, setProfileSettings] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await axios.get("/api/settings");

        // If successful, update state with fetched settings
        setSettings(response.data.settings);
        setProfileSettings({
          name: response.data.profile.name || "",
          email: response.data.profile.email || "",
          phone: response.data.profile.phone || "",
          department: response.data.profile.department || "",
          position: response.data.profile.position || "",
          bio: response.data.profile.bio || "",
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching settings:", error);

        // Fallback to user data if available
        if (user) {
          setProfileSettings((prev) => ({
            ...prev,
            name: user.name || "",
            email: user.email || "",
          }));
        }

        // Use default settings
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  // Apply current theme to document
  useEffect(() => {
    if (settings.theme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }

    // Apply font size to body
    document.body.className =
      document.body.className.replace(/font-size-\w+/g, "").trim() +
      ` font-size-${settings.fontSize}`;
  }, [settings.theme, settings.fontSize]);

  const handleThemeChange = (theme) => {
    setSettings({ ...settings, theme });
  };

  const handleFontSizeChange = (fontSize) => {
    setSettings({ ...settings, fontSize });
  };

  const handleNotificationChange = (key) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    });
  };

  const handlePrivacyChange = (key) => {
    setSettings({
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: !settings.privacy[key],
      },
    });
  };

  const handleAutoReplyChange = (isEnabled) => {
    setSettings({
      ...settings,
      autoReply: {
        ...settings.autoReply,
        enabled: isEnabled,
      },
    });
  };

  const handleAutoReplyMessageChange = (e) => {
    setSettings({
      ...settings,
      autoReply: {
        ...settings.autoReply,
        message: e.target.value,
      },
    });
  };

  const handleLanguageChange = (e) => {
    setSettings({
      ...settings,
      language: e.target.value,
    });
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileSettings({
      ...profileSettings,
      [name]: value,
    });
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Save settings to the backend
      await axios.post("/api/settings", {
        settings,
        profile: profileSettings,
      });

      // Update user in auth context with new profile data
      updateUser({
        ...user,
        name: profileSettings.name,
        email: profileSettings.email,
      });

      setSuccess("Settings saved successfully!");
      setSaving(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setError("Failed to save settings. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="loading-message">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {success && (
        <div className="alert alert-success">
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

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
              <h3>Font Size</h3>
              <div className="font-size-options">
                <button
                  className={`font-size-btn ${
                    settings.fontSize === "small" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("small")}
                >
                  <span className="text-small">Small</span>
                </button>
                <button
                  className={`font-size-btn ${
                    settings.fontSize === "medium" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("medium")}
                >
                  <span className="text-medium">Medium</span>
                </button>
                <button
                  className={`font-size-btn ${
                    settings.fontSize === "large" ? "active" : ""
                  }`}
                  onClick={() => handleFontSizeChange("large")}
                >
                  <span className="text-large">Large</span>
                </button>
              </div>
            </div>

            <div className="setting-group">
              <h3>Language</h3>
              <select
                value={settings.language}
                onChange={handleLanguageChange}
                className="language-select"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h2>Profile Settings</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-group">
              <div className="profile-field">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={profileSettings.name}
                  onChange={handleProfileChange}
                  placeholder="Your name"
                />
              </div>
              <div className="profile-field">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={profileSettings.email}
                  onChange={handleProfileChange}
                  placeholder="Your email"
                  disabled
                />
                <div className="field-info">Email cannot be changed</div>
              </div>
              <div className="profile-field">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={profileSettings.phone}
                  onChange={handleProfileChange}
                  placeholder="Your phone number"
                />
              </div>
              <div className="profile-field">
                <label>Department</label>
                <input
                  type="text"
                  name="department"
                  value={profileSettings.department}
                  onChange={handleProfileChange}
                  placeholder="Your department"
                />
              </div>
              <div className="profile-field">
                <label>Position</label>
                <input
                  type="text"
                  name="position"
                  value={profileSettings.position}
                  onChange={handleProfileChange}
                  placeholder="Your position"
                />
              </div>
              <div className="profile-field">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={profileSettings.bio}
                  onChange={handleProfileChange}
                  placeholder="Tell others about yourself"
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h2>Notification Settings</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-group">
              <div className="notification-option">
                <div className="notification-option-label">New Messages</div>
                <div className="notification-option-info">
                  Get notified when you receive a new message
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="new-messages"
                    checked={settings.notifications.newMessages}
                    onChange={() => handleNotificationChange("newMessages")}
                  />
                  <label className="slider" htmlFor="new-messages"></label>
                </div>
              </div>
              <div className="notification-option">
                <div className="notification-option-label">New Contacts</div>
                <div className="notification-option-info">
                  Get notified when someone adds you as a contact
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="new-contacts"
                    checked={settings.notifications.newContacts}
                    onChange={() => handleNotificationChange("newContacts")}
                  />
                  <label className="slider" htmlFor="new-contacts"></label>
                </div>
              </div>
              <div className="notification-option">
                <div className="notification-option-label">Group Messages</div>
                <div className="notification-option-info">
                  Get notified for new messages in group chats
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="group-messages"
                    checked={settings.notifications.groupMessages}
                    onChange={() => handleNotificationChange("groupMessages")}
                  />
                  <label className="slider" htmlFor="group-messages"></label>
                </div>
              </div>
              <div className="notification-option">
                <div className="notification-option-label">
                  System Notifications
                </div>
                <div className="notification-option-info">
                  Get notified about system updates and maintenance
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="system-notifications"
                    checked={settings.notifications.system}
                    onChange={() => handleNotificationChange("system")}
                  />
                  <label
                    className="slider"
                    htmlFor="system-notifications"
                  ></label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h2>Privacy Settings</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-group">
              <div className="privacy-option">
                <div className="privacy-option-label">Show Online Status</div>
                <div className="privacy-option-info">
                  Let others see when you're online
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="show-status"
                    checked={settings.privacy.showStatus}
                    onChange={() => handlePrivacyChange("showStatus")}
                  />
                  <label className="slider" htmlFor="show-status"></label>
                </div>
              </div>
              <div className="privacy-option">
                <div className="privacy-option-label">Show Last Seen</div>
                <div className="privacy-option-info">
                  Let others see when you were last active
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="show-last-seen"
                    checked={settings.privacy.showLastSeen}
                    onChange={() => handlePrivacyChange("showLastSeen")}
                  />
                  <label className="slider" htmlFor="show-last-seen"></label>
                </div>
              </div>
              <div className="privacy-option">
                <div className="privacy-option-label">Read Receipts</div>
                <div className="privacy-option-info">
                  Let others know when you've read their messages
                </div>
                <div className="switch">
                  <input
                    type="checkbox"
                    id="read-receipts"
                    checked={settings.privacy.readReceipts}
                    onChange={() => handlePrivacyChange("readReceipts")}
                  />
                  <label className="slider" htmlFor="read-receipts"></label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <h2>Auto-Reply</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-group">
              <div className="auto-reply-option">
                <div className="auto-reply-header">
                  <div className="auto-reply-label">Enable Auto-Reply</div>
                  <div className="switch">
                    <input
                      type="checkbox"
                      id="auto-reply"
                      checked={settings.autoReply.enabled}
                      onChange={() =>
                        handleAutoReplyChange(!settings.autoReply.enabled)
                      }
                    />
                    <label className="slider" htmlFor="auto-reply"></label>
                  </div>
                </div>
                <div className="auto-reply-message">
                  <textarea
                    placeholder="Enter your auto-reply message"
                    value={settings.autoReply.message}
                    onChange={handleAutoReplyMessageChange}
                    disabled={!settings.autoReply.enabled}
                    rows="3"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
