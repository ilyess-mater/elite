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

  // Handle successful authentication from sign in form
  const handleSignIn = (user) => {
    // No need to navigate - the component will re-render with the user
    // and show the MainDashboard component
    console.log("User authenticated:", user);
  };

  // Handle sign up success or toggle mode
  const handleSignUp = (param) => {
    // If param is a boolean, it's a toggle mode request
    if (typeof param === "boolean") {
      toggleSignUpMode(param);
    }
    // If param is an object, it's a user object after authentication
    else if (param && typeof param === "object") {
      console.log("User registered:", param);
      // We don't need to do anything else since the updated AuthContext
      // no longer automatically logs in users after registration
    }
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
          <SignInForm onSignIn={handleSignIn} />
          <SignUpForm onSignUp={handleSignUp} />
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
