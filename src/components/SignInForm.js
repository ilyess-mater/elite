import React, { useState } from "react";
import "../styles/forms.css";

function SignInForm({ onSignIn }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

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

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);

      // Simulate API call for login
      setTimeout(() => {
        // For demo purposes, let's consider any login valid
        // In a real app, this would check credentials with the backend
        const user = {
          id: 1,
          name: formData.email.split("@")[0],
          email: formData.email,
          isAdmin: Math.random() > 0.7, // 30% chance of being an admin for demo
        };

        // Call the onSignIn prop function with the user data
        if (onSignIn) {
          onSignIn(user);
        }

        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sign-in-form">
      <h2 className="title">Sign in</h2>

      <div className={`input-field ${errors.email ? "input-error" : ""}`}>
        <i className="fas fa-user"></i>
        <input
          type="text"
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

      <button
        type="submit"
        className={`btn solid ${isLoading ? "loading" : ""}`}
        disabled={isLoading}
      >
        {isLoading ? "Signing in..." : "Login"}
      </button>

      <p className="social-text">Or Sign in with social platforms</p>
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

export default SignInForm;
