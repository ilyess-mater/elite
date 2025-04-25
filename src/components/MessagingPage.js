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
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 769);

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
    if (!socket) return;

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

        // Update the contact's lastMessageTime to move it to the top
        setContacts((prevContacts) => {
          return prevContacts.map((contact) => {
            if (contact.id === contactId) {
              return {
                ...contact,
                lastMessageTime: newMessage.timestamp,
              };
            }
            return contact;
          });
        });

        // Create a new array with the updated messages
        const updatedMessages = [...(prevMessages[contactId] || [])];

        // Ensure fileData is properly set
        if (newMessage.fileUrl && !newMessage.fileData) {
          newMessage.fileData = newMessage.fileUrl;
        }

        // For debugging
        if (newMessage.fileUrl || newMessage.fileData) {
          console.log("Message contains file:", {
            fileUrl: newMessage.fileUrl ? "Yes" : "No",
            fileData: newMessage.fileData ? "Yes" : "No",
            fileType: newMessage.fileType,
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

  // Handle window resize to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 769);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  // Handle file uploads and conversion
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (
      (!message.trim() && !selectedFile) ||
      !selectedContact ||
      !socket ||
      isUploading
    )
      return;

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
        console.error("Error uploading file:", error);
        alert(
          "Failed to upload file. Please try again with a smaller file or different format."
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

    // Update the contact's lastMessageTime to move it to the top
    setContacts((prevContacts) => {
      return prevContacts.map((contact) => {
        if (contact.id === selectedContact.id) {
          return {
            ...contact,
            lastMessageTime: optimisticMessage.timestamp,
          };
        }
        return contact;
      });
    });

    // Send message via Socket.IO
    try {
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
        textLength: message.length,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }

    setMessage("");
    setIsUploading(false);
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

  // Sort contacts by most recent message timestamp
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    // Get the latest message timestamp for each contact
    const aLastMessage =
      messages[a.id]?.length > 0
        ? messages[a.id][messages[a.id].length - 1]
        : null;
    const bLastMessage =
      messages[b.id]?.length > 0
        ? messages[b.id][messages[b.id].length - 1]
        : null;

    // Get timestamps or use fallback values
    const aTimestamp = aLastMessage?.timestamp
      ? new Date(aLastMessage.timestamp).getTime()
      : 0;
    const bTimestamp = bLastMessage?.timestamp
      ? new Date(bLastMessage.timestamp).getTime()
      : 0;

    // Sort in descending order (newest first)
    return bTimestamp - aTimestamp;
  });

  // Render file content based on type
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
              alt="Sent"
              className="message-image"
              onClick={() => window.open(fileSource, "_blank")}
              onError={(e) => {
                console.error("Image failed to load:", e);
                e.target.src = "/placeholder-image.png"; // Fallback image
                e.target.alt = "Image failed to load";
              }}
            />
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
                e.target.parentNode.innerHTML =
                  '<div class="video-error">Video could not be played</div>';
              }}
            />
          </div>
        );
      } else if (fileSource || msg.fileName) {
        // For other file types
        return (
          <div
            className="message-file-container"
            onClick={() => fileSource && window.open(fileSource, "_blank")}
          >
            <i className="fas fa-file"></i>
            <span className="file-name">{msg.fileName || "File"}</span>
          </div>
        );
      }
    } catch (error) {
      console.error("Error rendering file:", error);
      return <div className="file-error">File could not be displayed</div>;
    }

    return null;
  };

  // State for chat details sidebar
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [showDeleteMessagesConfirm, setShowDeleteMessagesConfirm] =
    useState(false);

  // Handle delete messages
  const handleDeleteMessages = async () => {
    if (!selectedContact) return;

    try {
      // Clear messages for current contact
      setMessages((prev) => ({
        ...prev,
        [selectedContact.id]: [],
      }));

      // You would typically make an API call here to delete messages on the server
      // await axios.delete(`/api/messages/${selectedContact.id}`, {
      //   headers: {
      //     Authorization: `Bearer ${localStorage.getItem("token")}`,
      //   },
      // });

      setShowDeleteMessagesConfirm(false);
    } catch (error) {
      console.error("Error deleting messages:", error);
      alert("Error deleting messages. Please try again.");
    }
  };

  return (
    <div className="messaging-container">
      <div className={`contacts-list ${isMobileView && selectedContact ? 'mobile-hidden' : ''}`}>
        <div className="contacts-header">
          <h2>Conversations</h2>
        </div>
        <div className="contacts-search">
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
          {sortedContacts.map((contact) => (
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
              <div className="contact-meta">
                {contact.lastMessageTime && (
                  <div className="contact-time">
                    {formatTime(contact.lastMessageTime)}
                  </div>
                )}
                {contact.unreadCount > 0 && (
                  <div className="unread-count">{contact.unreadCount}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`chat-area ${isMobileView && selectedContact ? 'mobile-visible' : ''}`}>
        {selectedContact ? (
          <>
            <div className="chat-header">
              {isMobileView && (
                <button 
                  className="back-button" 
                  onClick={() => setSelectedContact(null)}
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
              )}
              <div className="chat-contact-info">
                <div
                  className="contact-avatar"
                  style={{ backgroundColor: selectedContact.avatar }}
                >
                  {selectedContact.name.charAt(0)}
                </div>
                <div className="chat-contact-details">
                  <div className="chat-contact-name">
                    {selectedContact.name}
                  </div>
                  <div className="chat-contact-status">
                    {selectedContact.isActive ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button
                  className="chat-action-button"
                  onClick={() => setShowChatDetails(!showChatDetails)}
                >
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

      {showChatDetails && selectedContact && (
        <div className="chat-details-sidebar">
          <div className="chat-details-header">
            <h3>Chat Information</h3>
            <button
              className="close-details-button"
              onClick={() => setShowChatDetails(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="chat-details-content">
            <div className="contact-profile">
              <div
                className="contact-avatar large"
                style={{ backgroundColor: selectedContact.avatar }}
              >
                {selectedContact.name.charAt(0)}
              </div>
              <h4 className="contact-name">{selectedContact.name}</h4>
              <div className="contact-status-text">
                {selectedContact.isActive ? "Online" : "Offline"}
              </div>
            </div>

            <div className="chat-details-section">
              <h5 className="section-title">Chat Options</h5>
              <div className="chat-actions centered-actions">
                <div className="search-conversation-container">
                  <button className="chat-action-button centered-button">
                    <i className="fas fa-search"></i> Search in Conversation
                  </button>
                  <div className="search-bar chat-search-bar">
                    <i className="fas fa-search"></i>
                    <input type="text" placeholder="Search messages..." />
                  </div>
                </div>
                <button className="group-action-button">
                  <i className="fas fa-bell-slash"></i> Mute Notifications
                </button>
                <button
                  className="delete-messages-button"
                  onClick={() => setShowDeleteMessagesConfirm(true)}
                >
                  <i className="fas fa-trash-alt"></i> Delete Messages
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {showDeleteMessagesConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h4>Delete Messages</h4>
            <p>
              Are you sure you want to delete all messages in this chat?
              Messages will only be deleted for you, the other person will still
              be able to see them.
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowDeleteMessagesConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteMessages}>
                Delete Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagingPage;
