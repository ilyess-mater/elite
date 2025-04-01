import React, { useState } from "react";
import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import MainDashboard from "./MainDashboard";
import "../styles/auth.css";
import "../styles/panels.css";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function AuthContainerContent() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const { user, loading, logout } = useAuth();

  const toggleSignUpMode = (mode) => {
    setIsSignUpMode(mode);
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (user) {
    return <MainDashboard user={user} onLogout={logout} />;
  }

  return (
    <div className={`container ${isSignUpMode ? "sign-up-mode" : ""}`}>
      <div className="forms-container">
        <div className="signin-signup">
          <SignInForm />
          <SignUpForm />
        </div>
      </div>

      <div className="panels-container">
        <div className="panel left-panel">
          <div className="content">
            <h1>New here ?</h1>
            <p>
              Join our <span className="highlight">secure</span> and{" "}
              <span className="highlight">professional</span> messaging
              platform.
            </p>
            <button
              className="btn transparent"
              onClick={() => toggleSignUpMode(true)}
            >
              Sign up
            </button>
          </div>
          <img
            src="/security.png"
            className="image"
            alt="signin illustration"
          />
        </div>
        <div className="panel right-panel">
          <div className="content">
            <h1>One of us ?</h1>
            <p>
              Log in to your <span className="highlight">secure workspace</span>{" "}
              and continue where you left off.
            </p>
            <button
              className="btn transparent"
              onClick={() => toggleSignUpMode(false)}
            >
              Sign in
            </button>
          </div>
          <img
            src="/business.png"
            className="image"
            alt="signup illustration"
          />
        </div>
      </div>
    </div>
  );
}

function AuthContainer() {
  return (
    <AuthProvider>
      <AuthContainerContent />
    </AuthProvider>
  );
}

export default AuthContainer;
