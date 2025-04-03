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
  const [messageIdCounter, setMessageIdCounter] = useState(1000);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");

        // Get IDs of removed chats from localStorage
        const removedChats = JSON.parse(
          localStorage.getItem("removedChats") || "[]"
        );

        // Filter out contacts with removed chats
        const filteredContacts = response.data.filter(
          (contact) => !removedChats.includes(contact.id)
        );

        // Generate avatar colors for the contacts
        const contactsWithAvatars = filteredContacts.map((contact) => ({
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
    if (!socket) {
      console.error(
        "Socket is not initialized. Messages cannot be sent or received."
      );
      return;
    }

    console.log("Setting up message listeners in MessagingPage");

    // Listen for new messages
    socket.on("receive_message", (newMessage) => {
      console.log("Received message:", newMessage); // Debug log

      setMessages((prevMessages) => {
        const contactId =
          newMessage.sender === user.id
            ? newMessage.receiver
            : newMessage.sender;

        // Skip if this is our own message that we've already added optimistically
        if (newMessage.sender === user.id) {
          const existingMessages = prevMessages[contactId] || [];
          // Check if we already have this message (by comparing text and timestamp)
          const messageExists = existingMessages.some(
            (msg) =>
              msg.text === newMessage.text &&
              Math.abs(
                new Date(msg.timestamp) - new Date(newMessage.timestamp)
              ) < 5000 &&
              msg._isOptimistic
          );

          if (messageExists) {
            // Replace the optimistic message with the confirmed one
            return {
              ...prevMessages,
              [contactId]: existingMessages.map((msg) =>
                msg._isOptimistic &&
                msg.text === newMessage.text &&
                Math.abs(
                  new Date(msg.timestamp) - new Date(newMessage.timestamp)
                ) < 5000
                  ? { ...newMessage, id: newMessage.id || msg.id }
                  : msg
              ),
            };
          }
        }

        // Show notification if message is new and from someone else
        if (newMessage.sender !== user.id) {
          showNotification(newMessage);
        }

        // Create a new array with the updated messages
        const updatedMessages = [...(prevMessages[contactId] || [])];

        // Ensure fileData is properly set for received messages
        if (newMessage.fileUrl && !newMessage.fileData) {
          console.log(
            "File URL detected without fileData, setting fileData from URL"
          );
          newMessage.fileData = newMessage.fileUrl;
        }

        // Debug file data
        if (newMessage.fileUrl || newMessage.fileData) {
          console.log("Message contains file:", {
            messageId: newMessage.id,
            fileUrl: newMessage.fileUrl ? "Yes" : "No",
            fileData: newMessage.fileData
              ? newMessage.fileData.substring(0, 50) + "..."
              : "No",
            fileType: newMessage.fileType,
            fileName: newMessage.fileName,
          });
        }

        updatedMessages.push(newMessage);

        return {
          ...prevMessages,
          [contactId]: updatedMessages,
        };
      });
    });

    // Listen for user status updates
    socket.on("user_status", (statusData) => {
      const { userId, status } = statusData;
      console.log("User status update:", userId, status);
      setContacts((prevContacts) =>
        prevContacts.map((contact) =>
          contact.id === userId
            ? { ...contact, isActive: status === "online" }
            : contact
        )
      );
    });

    // Handle connect/disconnect events
    socket.on("connect", () => {
      console.log("Socket connected in MessagingPage");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error in MessagingPage:", err);
    });

    // Clean up listeners on unmount
    return () => {
      console.log("Cleaning up message listeners in MessagingPage");
      socket.off("receive_message");
      socket.off("user_status");
      socket.off("connect");
      socket.off("connect_error");
    };
  }, [socket, user]);

  // Handle delete chat
  const handleDeleteChat = (e, contact) => {
    e.stopPropagation(); // Prevent contact selection when clicking delete
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  // Confirm delete chat
  const confirmDeleteChat = () => {
    if (contactToDelete) {
      // Delete messages for this contact
      setMessages((prevMessages) => {
        const updatedMessages = { ...prevMessages };
        delete updatedMessages[contactToDelete.id];
        return updatedMessages;
      });

      // If the deleted contact is the selected contact, clear selection
      if (selectedContact && selectedContact.id === contactToDelete.id) {
        setSelectedContact(null);
      }

      // Remove the contact from the contacts list
      setContacts((prevContacts) =>
        prevContacts.filter((contact) => contact.id !== contactToDelete.id)
      );

      // Store the removed chat ID in localStorage
      const removedChats = JSON.parse(
        localStorage.getItem("removedChats") || "[]"
      );
      if (!removedChats.includes(contactToDelete.id)) {
        removedChats.push(contactToDelete.id);
        localStorage.setItem("removedChats", JSON.stringify(removedChats));
      }
    }

    setShowDeleteConfirm(false);
    setContactToDelete(null);
  };

  // Cancel delete chat
  const cancelDeleteChat = () => {
    setShowDeleteConfirm(false);
    setContactToDelete(null);
  };

  // Show browser notification
  const showNotification = (message) => {
    try {
      if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
      }

      if (Notification.permission === "granted") {
        // Find sender's name
        const sender = contacts.find(
          (contact) => contact.id === message.sender
        );
        const senderName = sender ? sender.name : "Someone";

        const notification = new Notification(
          "New message from " + senderName,
          {
            body: message.text || "Sent you a file",
            icon: "/logo192.png",
          }
        );

        notification.onclick = function () {
          window.focus();
          if (sender) {
            setSelectedContact(sender);
          }
        };
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            showNotification(message);
          }
        });
      }
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

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

  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    // Generate preview for images and videos
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview({
          url: e.target.result,
          type: file.type,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // For other file types, just show the filename
      setFilePreview({
        url: null,
        type: file.type,
        name: file.name,
      });
    }
  };

  const cancelFileUpload = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file uploads and conversion with improved error handling
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"));
        return;
      }

      // Check file size - 5MB limit is a good practice for socket transfers
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error("File size exceeds 5MB limit"));
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = () => {
        console.log(
          `File converted to base64: ${file.name} (${file.type}), length: ${reader.result.length}`
        );
        resolve(reader.result);
      };

      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(error);
      };
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (
      (!message.trim() && !selectedFile) ||
      !selectedContact ||
      !socket ||
      isUploading
    ) {
      console.log("Cannot send message:", {
        hasMessageText: !!message.trim(),
        hasSelectedFile: !!selectedFile,
        hasSelectedContact: !!selectedContact,
        hasSocket: !!socket,
        isUploading,
      });
      return;
    }

    try {
      // Create a temporary ID for optimistic update
      const tempId = `temp-${messageIdCounter}`;
      setMessageIdCounter((prev) => prev + 1);

      let fileUrl = null;
      let fileType = null;
      let fileName = null;
      let fileData = null;

      // Handle file upload if a file is selected
      if (selectedFile) {
        try {
          setIsUploading(true);
          console.log(
            "Processing file for sending:",
            selectedFile.name,
            selectedFile.type,
            selectedFile.size
          );

          // Convert file to base64 for transmission via socket
          fileData = await fileToBase64(selectedFile);

          if (!fileData) {
            throw new Error("Failed to convert file to base64");
          }

          // Show optimistic preview with local URL
          fileUrl = filePreview.url;
          fileType = selectedFile.type;
          fileName = selectedFile.name;

          console.log("File prepared for sending:", {
            fileName,
            fileType,
            fileDataLength: fileData ? fileData.length : 0,
          });

          // Reset file selection
          setSelectedFile(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error("Error processing file:", error);
          alert(
            `Failed to upload file: ${
              error.message ||
              "Please try again with a smaller file or different format."
            }`
          );
          setIsUploading(false);
          return;
        }
      }

      // Create optimistic message
      const optimisticMessage = {
        id: tempId,
        sender: user.id,
        receiver: selectedContact.id,
        text: message,
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
        fileData: fileData,
        _isOptimistic: true, // Flag to identify optimistic messages
      };

      // Optimistically add message to UI immediately
      setMessages((prev) => ({
        ...prev,
        [selectedContact.id]: [
          ...(prev[selectedContact.id] || []),
          optimisticMessage,
        ],
      }));

      // Send message via Socket.IO
      try {
        // Ensure socket is connected
        if (!socket.connected) {
          console.error("Socket is disconnected. Reconnecting...");
          socket.connect();
        }

        console.log(
          "Sending message to:",
          selectedContact.id,
          "with text:",
          message ? message.substring(0, 30) : "No text"
        );

        socket.emit("send_message", {
          token: localStorage.getItem("token"),
          receiverId: selectedContact.id,
          text: message,
          fileUrl: fileUrl,
          fileType: fileType,
          fileName: fileName,
          fileData: fileData, // Send the base64 data to server
        });

        console.log("Message sent successfully:", {
          hasFile: fileData ? true : false,
          textLength: message ? message.length : 0,
          receiverId: selectedContact.id,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        alert(
          "Failed to send message: " + (error.message || "Please try again.")
        );
        // You might want to update the UI to show that the message failed
        setMessages((prev) => ({
          ...prev,
          [selectedContact.id]: prev[selectedContact.id].map((msg) =>
            msg.id === tempId ? { ...msg, _sendFailed: true } : msg
          ),
        }));
      }

      setMessage("");
      setIsUploading(false);
    } catch (error) {
      console.error("Unexpected error in handleSendMessage:", error);
      alert("An unexpected error occurred. Please try again.");
      setIsUploading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current.click();
  };

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.email &&
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Render file content based on type with better error handling
  const renderFileContent = (msg) => {
    if (!msg.fileUrl && !msg.fileData) return null;

    // Use fileData (base64) if available, otherwise fall back to fileUrl
    const fileSource = msg.fileData || msg.fileUrl;

    if (!fileSource) {
      console.error("Missing file source for message:", msg.id);
      return <div className="file-error">File could not be displayed</div>;
    }

    try {
      if (msg.fileType && msg.fileType.startsWith("image/")) {
        return (
          <div className="message-image-container">
            <img
              src={fileSource}
              alt={msg.fileName || "Image"}
              className="message-image"
              onClick={() => window.open(fileSource, "_blank")}
              onError={(e) => {
                console.error("Image failed to load:", e);
                e.target.src = "/placeholder-image.png"; // Fallback image
                e.target.alt = "Image failed to load";
              }}
            />
            {msg.fileName && <div className="file-name">{msg.fileName}</div>}
          </div>
        );
      } else if (msg.fileType && msg.fileType.startsWith("video/")) {
        return (
          <div className="message-video-container">
            <video
              src={fileSource}
              controls
              className="message-video"
              onError={(e) => {
                console.error("Video failed to load:", e);
                e.target.innerHTML = "Video could not be played";
              }}
            />
            {msg.fileName && <div className="file-name">{msg.fileName}</div>}
          </div>
        );
      } else {
        // For other file types (documents, etc.)
        return (
          <div className="message-file-container">
            <div className="file-icon">
              <i className="fas fa-file"></i>
            </div>
            <div className="file-info">
              <div className="file-name">{msg.fileName || "Unnamed file"}</div>
              <a
                href={fileSource}
                download={msg.fileName || "download"}
                className="download-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download
              </a>
            </div>
          </div>
        );
      }
    } catch (error) {
      console.error("Error rendering file content:", error, msg);
      return (
        <div className="file-error">Error displaying file: {error.message}</div>
      );
    }
  };

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
                <div
                  className={`contact-status ${
                    contact.isActive ? "active" : ""
                  }`}
                ></div>
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-last-message">
                  {messages[contact.id]?.length > 0
                    ? messages[contact.id][messages[contact.id].length - 1]
                        .text ||
                      (messages[contact.id][messages[contact.id].length - 1]
                        .fileUrl ||
                      messages[contact.id][messages[contact.id].length - 1]
                        .fileData
                        ? "Sent a file"
                        : "No messages yet")
                    : "No messages yet"}
                </div>
              </div>
              <button
                className="delete-chat-button"
                onClick={(e) => handleDeleteChat(e, contact)}
                title="Delete conversation"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
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
                  } ${msg._isOptimistic ? "optimistic" : ""}`}
                >
                  {renderFileContent(msg)}
                  {msg.text && <div className="message-text">{msg.text}</div>}
                  <div className="message-time">
                    {formatTime(msg.timestamp)}
                    {msg._isOptimistic && (
                      <span className="message-status">
                        <i className="fas fa-check"></i>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {filePreview && (
              <div className="file-preview-container">
                {filePreview.type.startsWith("image/") ? (
                  <div className="image-preview">
                    <img src={filePreview.url} alt="Preview" />
                  </div>
                ) : filePreview.type.startsWith("video/") ? (
                  <div className="video-preview">
                    <video src={filePreview.url} controls />
                  </div>
                ) : (
                  <div className="file-icon-preview">
                    <i className="fas fa-file"></i>
                    <span>{filePreview.name}</span>
                  </div>
                )}
                <button
                  className="cancel-file-button"
                  onClick={cancelFileUpload}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input
                type="file"
                ref={fileInputRef}
                className="file-input"
                onChange={handleFileSelection}
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              <div className="input-container">
                <button
                  type="button"
                  className="attachment-button"
                  onClick={handleAttachmentClick}
                  disabled={isUploading}
                >
                  <i className="fas fa-paperclip"></i>
                </button>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isUploading ? "Uploading..." : "Type a message..."
                  }
                  className={`text-${textSize}`}
                  disabled={isUploading}
                />
                <button
                  type="submit"
                  className="send-button"
                  disabled={isUploading}
                >
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

      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h3>Delete Conversation</h3>
            </div>
            <div className="confirm-dialog-content">
              <p>
                Are you sure you want to delete your conversation with{" "}
                {contactToDelete?.name}?
                <br />
                This action cannot be undone.
              </p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="btn-cancel" onClick={cancelDeleteChat}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDeleteChat}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagingPage;
