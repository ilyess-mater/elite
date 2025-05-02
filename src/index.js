import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import logo from "./logo.png";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./utils/axiosConfig"; // Import axios configuration

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
