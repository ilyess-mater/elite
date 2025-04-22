import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/groupchat.css";

const SuggestedReplies = ({ message, onReplyClick }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch suggestions if the message is from someone else (not the current user)
    if (!message || !message.text || message.isOwnMessage) {
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post("/api/suggested-replies", {
          message: message.text,
          groupId: message.groupId,
        });

        if (response.data && response.data.suggestions) {
          setSuggestions(response.data.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Error fetching suggested replies:", err);
        setError("Failed to load suggestions");
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [message]);

  if (loading) {
    return (
      <div className="quick-reply-buttons">
        <div className="quick-reply-btn" style={{ opacity: 0.6 }}>
          Loading suggestions...
        </div>
      </div>
    );
  }

  if (error || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="quick-reply-buttons">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          className="quick-reply-btn"
          onClick={() => onReplyClick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};

export default SuggestedReplies;
