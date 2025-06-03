import React, { useState } from "react";
import "../styles/forms.css";
import { useAuth } from "../contexts/AuthContext";

function SignInForm({ onSignIn }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, error: authError } = useAuth();

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);

      try {
        // Use the auth context to sign in
        const user = await signIn(formData.email, formData.password);

        // If there's a callback function, call it with the user data
        if (onSignIn) {
          onSignIn(user);
        }
      } catch (error) {
        console.error("Sign in error:", error);
        setErrors({
          ...errors,
          general: authError || "Invalid email or password",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sign-in-form">
      <h2 className="title">Sign in</h2>

      {(errors.general || authError) && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>{" "}
          {errors.general || authError}
        </div>
      )}

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
        <a
          href="https://www.facebook.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
        >
          <i className="fab fa-facebook-f"></i>
        </a>
        <a
          href="https://twitter.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
        >
          <i className="fa-brands fa-x-twitter"></i>
        </a>
        <a
          href="https://accounts.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
        >
          <i className="fab fa-google"></i>
        </a>
        <a
          href="https://www.linkedin.com/login"
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon"
        >
          <i className="fab fa-linkedin-in"></i>
        </a>
      </div>
    </form>
  );
}

export default SignInForm;
