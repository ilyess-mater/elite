import React, { useState, useEffect, useRef } from "react";
import "../styles/messaging.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

function MessagingPage({ user, textSize }) {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);
  const { getSocket } = useAuth();
  const socket = getSocket();

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");
        // Generate avatar colors for the contacts
        const contactsWithAvatars = response.data.map((contact) => ({
          ...contact,
          avatar: generateAvatar(contact.name),
        }));
        setContacts(contactsWithAvatars);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };

    fetchContacts();
  }, []);

  // Listen for new messages and online status updates
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on("receive_message", (newMessage) => {
      setMessages((prevMessages) => {
        const contactId =
          newMessage.sender === user.id
            ? newMessage.receiver
            : newMessage.sender;
        return {
          ...prevMessages,
          [contactId]: [...(prevMessages[contactId] || []), newMessage],
        };
      });
    });

    // Listen for user status updates
    socket.on("user_status", (statusData) => {
      const { userId, status } = statusData;
      setContacts((prevContacts) =>
        prevContacts.map((contact) =>
          contact.id === userId
            ? { ...contact, isActive: status === "online" }
            : contact
        )
      );
    });

    // Clean up listeners on unmount
    return () => {
      socket.off("receive_message");
      socket.off("user_status");
    };
  }, [socket, user]);

  // Generate random avatar color based on user name
  function generateAvatar(name) {
    const colors = [
      "#FF5733",
      "#33FF57",
      "#3357FF",
      "#F333FF",
      "#FF33F3",
      "#33FFF3",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  // Fetch messages when contact is selected
  useEffect(() => {
    if (selectedContact) {
      const fetchMessages = async () => {
        try {
          const response = await axios.get(
            `/api/messages/${selectedContact.id}`
          );
          setMessages((prev) => ({
            ...prev,
            [selectedContact.id]: response.data,
          }));
        } catch (error) {
          console.error("Error fetching messages:", error);
        }
      };

      fetchMessages();
    }
  }, [selectedContact]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedContact]);

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedContact || !socket) return;

    // Send message via Socket.IO
    socket.emit("send_message", {
      token: localStorage.getItem("token"),
      receiverId: selectedContact.id,
      text: message,
    });

    setMessage("");
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.email &&
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="messaging-container">
      <div className="contacts-list">
        <div className="contacts-header">
          <h2>Conversations</h2>
        </div>
        <div className="search-bar-container">
          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="contacts-items">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className={`contact-item ${
                selectedContact && selectedContact.id === contact.id
                  ? "active"
                  : ""
              }`}
              onClick={() => handleContactSelect(contact)}
            >
              <div
                className="contact-avatar"
                style={{ backgroundColor: contact.avatar }}
              >
                {contact.name.charAt(0)}
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-last-message">
                  {messages[contact.id]?.length > 0
                    ? messages[contact.id][messages[contact.id].length - 1].text
                    : "No messages yet"}
                </div>
              </div>
              <div className="contact-status">
                {contact.isActive && <span className="status-dot"></span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedContact ? (
          <>
            <div className="chat-header">
              <div className="chat-contact-info">
                <div
                  className="contact-avatar"
                  style={{ backgroundColor: selectedContact.avatar }}
                >
                  {selectedContact.name.charAt(0)}
                </div>
                <div className="contact-name">
                  {selectedContact.name}
                  {selectedContact.isActive && (
                    <span className="status-text">Online</span>
                  )}
                </div>
              </div>
              <div className="chat-actions">
                <button className="chat-action-button">
                  <i className="fas fa-phone"></i>
                </button>
                <button className="chat-action-button">
                  <i className="fas fa-video"></i>
                </button>
                <button className="chat-action-button">
                  <i className="fas fa-info-circle"></i>
                </button>
              </div>
            </div>
            <div className="chat-messages">
              {messages[selectedContact.id]?.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${
                    msg.sender === user.id ? "outgoing" : "incoming"
                  }`}
                >
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <div className="input-container">
                <button type="button" className="attachment-button">
                  <i className="fas fa-paperclip"></i>
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className={`text-${textSize}`}
                />
                <button type="submit" className="send-button">
                  <i className="fas fa-paper-plane"></i>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon">
              <i className="fas fa-comments"></i>
            </div>
            <h3>Select a conversation</h3>
            <p>Choose a contact to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessagingPage;
