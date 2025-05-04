import React, { useState } from "react";
import axios from "axios";
import "../styles/security.css";

function SecurityPage({ user }) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "Weak",
  });

  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value,
    });

    if (name === "newPassword") {
      const score = calculatePasswordStrength(value);
      setPasswordStrength(score);
    }

    // Clear error when user types
    setError("");
  };

  const validatePasswordForm = () => {
    // Clear previous errors
    setError("");

    // Check if current password is provided
    if (!passwordForm.currentPassword) {
      setError("Current password is required");
      return false;
    }

    // Check if new password is provided
    if (!passwordForm.newPassword) {
      setError("New password is required");
      return false;
    }

    // Check if new password is strong enough
    if (passwordStrength.score < 2) {
      setError("New password is too weak");
      return false;
    }

    // Check if passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handlePasswordFormSubmit = async (e) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    try {
      await axios.post(
        "/api/auth/change-password",
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Clear form
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Show success message
      setSuccessMessage("Password changed successfully");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      if (error.response) {
        switch (error.response.status) {
          case 401:
            setError("Current password is incorrect");
            break;
          default:
            setError("Failed to change password. Please try again.");
        }
      } else {
        setError("Failed to change password. Please check your connection.");
      }
    }
  };

  const calculatePasswordStrength = (password) => {
    // This is a simple password strength calculator
    // In a real app, you might want to use a more sophisticated algorithm

    if (!password) {
      return { score: 0, label: "Weak" };
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Complexity checks
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Determine label based on score
    let label = "Weak";
    if (score >= 5) label = "Strong";
    else if (score >= 3) label = "Good";
    else if (score >= 2) label = "Fair";

    return { score, label };
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength.label) {
      case "Strong":
        return "#28a745";
      case "Good":
        return "#4a6cf7";
      case "Fair":
        return "#ffc107";
      default:
        return "#dc3545";
    }
  };

  return (
    <div className="security-container">
      <div className="security-header">
        <h1>Security Settings</h1>
        <p>Change your password to keep your account secure</p>
      </div>

      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {successMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div className="security-card">
        <div className="security-card-header">
          <div className="security-card-title">
            <i className="fas fa-key"></i> Password
          </div>
        </div>
        <div className="security-card-content">
          <form className="password-form" onSubmit={handlePasswordFormSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your current password"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your new password"
              />
              {passwordForm.newPassword && (
                <div className="password-strength">
                  <div className="strength-bar-container">
                    <div
                      className="strength-bar"
                      style={{
                        width: `${(passwordStrength.score / 6) * 100}%`,
                        backgroundColor: getPasswordStrengthColor(),
                      }}
                    ></div>
                  </div>
                  <div
                    className="strength-text"
                    style={{ color: getPasswordStrengthColor() }}
                  >
                    {passwordStrength.label}
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm your new password"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SecurityPage;
