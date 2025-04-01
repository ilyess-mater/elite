import React, { useState } from "react";
import "../styles/forms.css";
import { useAuth } from "../contexts/AuthContext";

function SignUpForm({ onSignUp }) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    isAdmin: false,
    adminPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, error: authError } = useAuth();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    // Clear admin password if checkbox is unchecked
    if (name === "isAdmin" && !checked) {
      setFormData((prev) => ({
        ...prev,
        adminPassword: "",
      }));
    }

    // Clear errors when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.isAdmin && !formData.adminPassword.trim()) {
      newErrors.adminPassword = "Admin password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);

      try {
        const user = await signUp(formData);

        // Call the onSignUp prop with the user data if provided
        if (onSignUp) {
          onSignUp(user);
        } else {
          // If onSignUp not provided, just show success message
          setSuccessMessage(
            `Account created successfully! ${user.isAdmin ? "(Admin)" : ""}`
          );

          // Clear form
          setFormData({
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
            isAdmin: false,
            adminPassword: "",
          });

          // Clear success message after 3 seconds
          setTimeout(() => {
            setSuccessMessage("");
          }, 3000);
        }
      } catch (error) {
        console.error("Signup error:", error);
        setErrors({
          ...errors,
          general: authError || "Registration failed. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sign-up-form">
      <h2 className="title">Sign up</h2>

      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {successMessage}
        </div>
      )}

      {(errors.general || authError) && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>{" "}
          {errors.general || authError}
        </div>
      )}

      <div className={`input-field ${errors.username ? "input-error" : ""}`}>
        <i className="fas fa-user"></i>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
        />
      </div>
      {errors.username && (
        <div className="error-message">{errors.username}</div>
      )}

      <div className={`input-field ${errors.email ? "input-error" : ""}`}>
        <i className="fas fa-envelope"></i>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
        />
      </div>
      {errors.email && <div className="error-message">{errors.email}</div>}

      <div className={`input-field ${errors.password ? "input-error" : ""}`}>
        <i className="fas fa-lock"></i>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
        />
      </div>
      {errors.password && (
        <div className="error-message">{errors.password}</div>
      )}

      <div
        className={`input-field ${errors.confirmPassword ? "input-error" : ""}`}
      >
        <i className="fas fa-lock"></i>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm Password"
        />
      </div>
      {errors.confirmPassword && (
        <div className="error-message">{errors.confirmPassword}</div>
      )}

      <div className="admin-option">
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="isAdmin"
            checked={formData.isAdmin}
            onChange={handleChange}
          />
          <span className="checkbox-text">Register as Admin</span>
        </label>
      </div>

      {formData.isAdmin && (
        <>
          <div
            className={`input-field ${
              errors.adminPassword ? "input-error" : ""
            }`}
          >
            <i className="fas fa-key"></i>
            <input
              type="password"
              name="adminPassword"
              value={formData.adminPassword}
              onChange={handleChange}
              placeholder="Admin Password"
            />
          </div>
          {errors.adminPassword && (
            <div className="error-message">{errors.adminPassword}</div>
          )}
        </>
      )}

      <button
        type="submit"
        className={`btn ${isLoading ? "loading" : ""}`}
        disabled={isLoading}
      >
        {isLoading ? "Creating account..." : "Sign up"}
      </button>

      <p className="social-text">Or Sign up with social platforms</p>
      <div className="social-media">
        <a href="#" className="social-icon">
          <i className="fab fa-facebook-f"></i>
        </a>
        <a href="#" className="social-icon">
          <i className="fab fa-twitter"></i>
        </a>
        <a href="#" className="social-icon">
          <i className="fab fa-google"></i>
        </a>
        <a href="#" className="social-icon">
          <i className="fab fa-linkedin-in"></i>
        </a>
      </div>
    </form>
  );
}

export default SignUpForm;
