import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "../utils/axiosConfig";
import { io } from "socket.io-client";

// Create the context
const AuthContext = createContext();

// Socket.io connection
let socket;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from localStorage on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("token");

        if (storedUser && storedToken) {
          // Set axios default header
          axios.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${storedToken}`;
          setUser(JSON.parse(storedUser));

          // Initialize socket connection with token for authentication
          socket = io({
            query: { token: storedToken },
            path: "/socket.io",
          });

          // Set up socket event listeners
          setupSocketListeners();
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Cleanup socket connection on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const setupSocketListeners = () => {
    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      // Handle socket connection error (possibly token expired)
      if (err.message === "jwt expired") {
        logout();
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  };

  const signIn = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post("/api/auth/signin", {
        email,
        password,
      });
      const { user, token } = response.data;

      // Save user data and token
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);

      // Set axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Set user in state
      setUser(user);

      // Initialize socket connection
      socket = io({
        query: { token },
        path: "/socket.io",
      });

      // Set up socket event listeners
      setupSocketListeners();

      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to sign in";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signUp = async (userData) => {
    try {
      setError(null);

      // Prepare the data to send to the backend
      const signupData = {
        ...userData,
        // If user selected admin_master role, include it in the request
        adminRole: userData.isAdmin ? userData.adminRole : undefined,
      };

      const response = await axios.post("/api/auth/signup", signupData);
      const { user } = response.data;

      // Don't save user data and token
      // Don't set axios default header
      // Don't set user in state
      // Don't initialize socket connection

      return user;
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to sign up";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    // Clear local storage
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    // Clear axios default header
    delete axios.defaults.headers.common["Authorization"];

    // Disconnect socket
    if (socket) {
      socket.disconnect();
    }

    // Clear user from state
    setUser(null);
  };

  const getSocket = () => {
    return socket;
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    logout,
    getSocket,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
