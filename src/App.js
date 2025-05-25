import React from "react";
import AuthContainer from "./components/AuthContainer";
import WebSocketErrorBoundary from "./components/WebSocketErrorBoundary";
import "./styles/global.css";

function App() {
  return (
    <WebSocketErrorBoundary>
      <AuthContainer />
    </WebSocketErrorBoundary>
  );
}

export default App;
