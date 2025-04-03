import React, { useState, useEffect, useRef } from "react";
import "../styles/groupchat.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

function GroupChatPage({ user, textSize }) {
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const { getSocket } = useAuth();
  const socket = getSocket();
  const [messageIdCounter, setMessageIdCounter] = useState(1000);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);

  // Fetch groups from API
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get("/api/groups");
        // Generate avatars for groups
        const groupsWithAvatars = response.data.map((group) => ({
          ...group,
          avatar: generateGroupAvatar(group.name),
        }));
        setGroups(groupsWithAvatars);
      } catch (error) {
        console.error("Error fetching groups:", error);
        setError("Failed to load groups");
      }
    };

    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");
        setContacts(response.data);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };

    fetchGroups();
    fetchContacts();
  }, []);

  // Socket.io event listeners for group messages
  useEffect(() => {
    if (!socket) {
      console.error(
        "Socket is not initialized. Group messages cannot be sent or received."
      );
      return;
    }

    console.log("Setting up group message listeners in GroupChatPage");

    socket.on("receive_group_message", (newMessage) => {
      console.log("Received group message:", newMessage); // Debug log

      setMessages((prevMessages) => {
        const groupId = newMessage.groupId;

        // Skip if this is our own message that we've already added optimistically
        if (newMessage.sender === user.id) {
          const existingMessages = prevMessages[groupId] || [];
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
              [groupId]: existingMessages.map((msg) =>
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

        // Show notification if message is not from current user
        if (newMessage.sender !== user.id) {
          showNotification(newMessage);
        }

        // Create a new array with the updated messages
        const updatedMessages = [...(prevMessages[groupId] || [])];

        // Ensure fileData is properly set for received messages
        if (newMessage.fileUrl && !newMessage.fileData) {
          console.log(
            "Group message file URL detected without fileData, setting fileData from URL"
          );
          newMessage.fileData = newMessage.fileUrl;
        }

        // Debug file data
        if (newMessage.fileUrl || newMessage.fileData) {
          console.log("Group message contains file:", {
            groupId: newMessage.groupId,
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
          [groupId]: updatedMessages,
        };
      });
    });

    socket.on("group_user_joined", (data) => {
      console.log("User joined group:", data);
      // Add a system message when a user joins
      const systemMessage = {
        id: `system-${Date.now()}`,
        groupId: data.groupId,
        text: `${data.userName} has joined the group`,
        isSystem: true,
        timestamp: new Date().toISOString(),
      };

      setMessages((prevMessages) => ({
        ...prevMessages,
        [data.groupId]: [...(prevMessages[data.groupId] || []), systemMessage],
      }));
    });

    socket.on("group_user_left", (data) => {
      console.log("User left group:", data);
      // Add a system message when a user leaves
      const systemMessage = {
        id: `system-${Date.now()}`,
        groupId: data.groupId,
        text: `${data.userName} has left the group`,
        isSystem: true,
        timestamp: new Date().toISOString(),
      };

      setMessages((prevMessages) => ({
        ...prevMessages,
        [data.groupId]: [...(prevMessages[data.groupId] || []), systemMessage],
      }));
    });

    // Handle connect/disconnect events
    socket.on("connect", () => {
      console.log("Socket connected in GroupChatPage");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error in GroupChatPage:", err);
    });

    return () => {
      console.log("Cleaning up group message listeners in GroupChatPage");
      socket.off("receive_group_message");
      socket.off("group_user_joined");
      socket.off("group_user_left");
      socket.off("connect");
      socket.off("connect_error");
    };
  }, [socket, user.id]);

  // Show browser notification
  const showNotification = (message) => {
    try {
      if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
      }

      if (Notification.permission === "granted") {
        // Get group name and sender name
        const group = groups.find((g) => g.id === message.groupId);
        const groupName = group ? group.name : "Group";
        const senderName = message.senderName || "Someone";

        const notification = new Notification(
          `New message in ${groupName} from ${senderName}`,
          {
            body: message.text || "Sent an attachment",
            icon: "/logo192.png",
          }
        );

        notification.onclick = function () {
          window.focus();
          if (group) {
            setSelectedGroup(group);
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

  // Generate avatar color based on name
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

  // Generate a different color palette for group avatars
  function generateGroupAvatar(name) {
    const colors = [
      "#4A6CF7",
      "#6C5CE7",
      "#00B894",
      "#FF9F43",
      "#EE5253",
      "#10AC84",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  // Fetch messages when group is selected
  useEffect(() => {
    if (selectedGroup) {
      const fetchGroupMessages = async () => {
        try {
          // Join the group room via Socket.IO
          if (socket) {
            socket.emit("join_group", {
              token: localStorage.getItem("token"),
              groupId: selectedGroup.id,
            });
          }

          // Fetch messages for the group
          const response = await axios.get(
            `/api/groups/${selectedGroup.id}/messages`
          );
          setMessages((prev) => ({
            ...prev,
            [selectedGroup.id]: response.data,
          }));
        } catch (error) {
          console.error("Error fetching group messages:", error);
        }
      };

      fetchGroupMessages();

      // Leave group room when switching groups
      return () => {
        if (socket) {
          socket.emit("leave_group", {
            token: localStorage.getItem("token"),
            groupId: selectedGroup.id,
          });
        }
      };
    }
  }, [selectedGroup, socket]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedGroup]);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setShowGroupDetails(false);
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

  // Handle file uploads and conversion with better error handling
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
          `Group file converted to base64: ${file.name} (${file.type}), length: ${reader.result.length}`
        );
        resolve(reader.result);
      };

      reader.onerror = (error) => {
        console.error("Error reading group file:", error);
        reject(error);
      };
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (
      (!message.trim() && !selectedFile) ||
      !selectedGroup ||
      !socket ||
      isUploading
    ) {
      console.log("Cannot send group message:", {
        hasMessageText: !!message.trim(),
        hasSelectedFile: !!selectedFile,
        hasSelectedGroup: !!selectedGroup,
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
            "Processing file for group message:",
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

          console.log("Group file prepared for sending:", {
            fileName,
            fileType,
            fileDataLength: fileData ? fileData.length : 0,
            groupId: selectedGroup.id,
          });

          // Reset file selection
          setSelectedFile(null);
          setFilePreview(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        } catch (error) {
          console.error("Error processing file for group:", error);
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
        senderName: user.name,
        groupId: selectedGroup.id,
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
        [selectedGroup.id]: [
          ...(prev[selectedGroup.id] || []),
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
          "Sending group message to:",
          selectedGroup.id,
          "with text:",
          message ? message.substring(0, 30) : "No text"
        );

        socket.emit("send_group_message", {
          token: localStorage.getItem("token"),
          groupId: selectedGroup.id,
          text: message,
          fileUrl: fileUrl,
          fileType: fileType,
          fileName: fileName,
          fileData: fileData, // Send the base64 data to server
        });

        console.log("Group message sent successfully:", {
          hasFile: fileData ? true : false,
          textLength: message ? message.length : 0,
          groupId: selectedGroup.id,
        });
      } catch (error) {
        console.error("Error sending group message:", error);
        alert(
          "Failed to send group message: " +
            (error.message || "Please try again.")
        );
        // Update the UI to show that the message failed
        setMessages((prev) => ({
          ...prev,
          [selectedGroup.id]: prev[selectedGroup.id].map((msg) =>
            msg.id === tempId ? { ...msg, _sendFailed: true } : msg
          ),
        }));
      }

      setMessage("");
      setIsUploading(false);
    } catch (error) {
      console.error("Unexpected error in handleSendMessage for group:", error);
      alert("An unexpected error occurred. Please try again.");
      setIsUploading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      setError("Group name is required");
      return;
    }

    if (selectedMembers.length === 0) {
      setError("Select at least one member for the group");
      return;
    }

    try {
      const response = await axios.post("/api/groups", {
        name: newGroup.name,
        description: newGroup.description,
        members: selectedMembers.map((member) => member.id),
      });

      const newGroupWithAvatar = {
        ...response.data,
        avatar: generateGroupAvatar(response.data.name),
      };

      // Add new group to the state
      setGroups([...groups, newGroupWithAvatar]);

      // Clear form and close modal
      setNewGroup({ name: "", description: "" });
      setSelectedMembers([]);
      setShowCreateGroup(false);

      // Select the new group
      setSelectedGroup(newGroupWithAvatar);
    } catch (error) {
      console.error("Error creating group:", error);
      setError("Failed to create group. Please try again.");
    }
  };

  const toggleMemberSelection = (member) => {
    if (selectedMembers.some((m) => m.id === member.id)) {
      setSelectedMembers(selectedMembers.filter((m) => m.id !== member.id));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Format date for message groups
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current.click();
  };

  // Filter groups based on search term
  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description &&
        group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter contacts for group creation
  const filteredContacts = contacts.filter(
    (contact) =>
      !selectedMembers.some((m) => m.id === contact.id) &&
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render file content based on type with better error handling
  const renderFileContent = (msg) => {
    if (!msg.fileUrl && !msg.fileData) return null;

    // Use fileData (base64) if available, otherwise fall back to fileUrl
    const fileSource = msg.fileData || msg.fileUrl;

    if (!fileSource) {
      console.error("Missing file source for group message:", msg.id);
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
                console.error("Group image failed to load:", e);
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
                console.error("Group video failed to load:", e);
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
      console.error("Error rendering group file content:", error, msg);
      return (
        <div className="file-error">Error displaying file: {error.message}</div>
      );
    }
  };

  // Handle delete group chat
  const handleDeleteGroup = (e, group) => {
    e.stopPropagation(); // Prevent group selection when clicking delete
    setGroupToDelete(group);
    setShowDeleteConfirm(true);
  };

  // Confirm delete group chat
  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      // Logic to remove the group from state
      setGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== groupToDelete.id)
      );

      // Optionally, you can also remove it from the server
      // await axios.delete(`/api/groups/${groupToDelete.id}`);

      setGroupToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  // Cancel delete group chat
  const cancelDeleteGroup = () => {
    setShowDeleteConfirm(false);
    setGroupToDelete(null);
  };

  return (
    <div className="group-chat-container">
      <div className="groups-sidebar">
        <div className="groups-header">
          <h2>Group Chats</h2>
          <button
            className="create-group-btn"
            onClick={() => setShowCreateGroup(true)}
          >
            <i className="fas fa-plus"></i> Create Group
          </button>
        </div>
        <div className="groups-search">
          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="groups-list">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`group-item ${
                selectedGroup && selectedGroup.id === group.id ? "active" : ""
              }`}
              onClick={() => handleGroupSelect(group)}
            >
              <div
                className="group-avatar"
                style={{ backgroundColor: group.avatar }}
              >
                {group.name.charAt(0)}
              </div>
              <div className="group-info">
                <div className="group-name">{group.name}</div>
                <div className="group-last-message">
                  {messages[group.id]?.length > 0
                    ? messages[group.id][messages[group.id].length - 1].text ||
                      (messages[group.id][messages[group.id].length - 1]
                        .fileUrl ||
                      messages[group.id][messages[group.id].length - 1].fileData
                        ? "Sent a file"
                        : "No messages yet")
                    : "No messages yet"}
                </div>
              </div>
              <div className="group-meta">
                {group.lastMessageTime && (
                  <div className="group-time">
                    {formatTime(group.lastMessageTime)}
                  </div>
                )}
                {group.unreadCount > 0 && (
                  <div className="unread-count">{group.unreadCount}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedGroup ? (
          <>
            <div className="chat-header">
              <div className="chat-group-info">
                <div
                  className="group-avatar"
                  style={{ backgroundColor: selectedGroup.avatar }}
                >
                  {selectedGroup.name.charAt(0)}
                </div>
                <div className="chat-group-details">
                  <div className="chat-group-name">{selectedGroup.name}</div>
                  <div className="chat-group-members">
                    {selectedGroup.memberCount} members
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button
                  className="chat-action-button"
                  onClick={() => setShowGroupDetails(!showGroupDetails)}
                >
                  <i className="fas fa-info-circle"></i>
                </button>
              </div>
            </div>
            <div className="chat-messages">
              {messages[selectedGroup.id]?.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${
                    msg.isSystem
                      ? "system-message"
                      : msg.sender === user.id
                      ? "outgoing"
                      : "incoming"
                  } ${msg._isOptimistic ? "optimistic" : ""}`}
                >
                  {!msg.isSystem && (
                    <>
                      {renderFileContent(msg)}
                      {msg.text && (
                        <div className="message-text">{msg.text}</div>
                      )}
                      <div className="message-time">
                        {formatTime(msg.timestamp)}
                        {msg._isOptimistic && (
                          <span className="message-status">
                            <i className="fas fa-check"></i>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {msg.isSystem && <div>{msg.text}</div>}
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
              <i className="fas fa-users"></i>
            </div>
            <h3>Select a Group</h3>
            <p>Choose a group to start messaging or create a new one</p>
          </div>
        )}
      </div>

      {showGroupDetails && selectedGroup && (
        <div className="group-details-sidebar">
          <div className="group-details-header">
            <h3>Group Information</h3>
            <button
              className="close-details-button"
              onClick={() => setShowGroupDetails(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="group-details-content">
            <div className="group-description">
              <h4>About</h4>
              <p>{selectedGroup.description || "No description"}</p>
            </div>

            <div className="group-members-section">
              <h4>
                Members{" "}
                <span className="members-count">
                  {selectedGroup.members?.length || 0}
                </span>
              </h4>
              <div className="member-list">
                {selectedGroup.members?.map((member) => (
                  <div className="member-item" key={member.id}>
                    <div
                      className="member-avatar"
                      style={{
                        backgroundColor: generateAvatar(member.name),
                      }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div className="member-details">
                      <div className="member-name">{member.name}</div>
                      <div className="member-role">
                        {member.id === selectedGroup.createdBy
                          ? "Admin"
                          : "Member"}
                      </div>
                    </div>
                    <div className="member-status">
                      <span
                        className={
                          member.isActive ? "status-online" : "status-offline"
                        }
                      ></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="group-actions">
              <button className="group-action-button">
                <i className="fas fa-bell-slash"></i> Mute Notifications
              </button>
              <button className="group-action-button danger">
                <i className="fas fa-sign-out-alt"></i> Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-title">Create New Group</div>
              <button
                className="modal-close"
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroup({ name: "", description: "" });
                  setSelectedMembers([]);
                  setError("");
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="error-message">
                  <i className="fas fa-exclamation-circle"></i> {error}
                </div>
              )}
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  name="name"
                  value={newGroup.name}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, name: e.target.value })
                  }
                  placeholder="Enter group name"
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  name="description"
                  value={newGroup.description}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, description: e.target.value })
                  }
                  placeholder="Enter group description"
                  rows="3"
                ></textarea>
              </div>

              <div className="add-members-section">
                <div className="add-members-header">
                  <h4>Add Members</h4>
                </div>
                <div className="members-search">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {selectedMembers.length > 0 && (
                  <div className="selected-members">
                    {selectedMembers.map((member) => (
                      <div className="selected-member" key={member.id}>
                        <span>{member.name}</span>
                        <button
                          className="remove-member"
                          onClick={() => toggleMemberSelection(member)}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="suggested-members">
                  {filteredContacts.map((contact) => (
                    <div
                      className="suggested-member"
                      key={contact.id}
                      onClick={() => toggleMemberSelection(contact)}
                    >
                      <div
                        className="suggested-member-avatar"
                        style={{
                          backgroundColor: generateAvatar(contact.name),
                        }}
                      >
                        {contact.name.charAt(0)}
                      </div>
                      <div className="suggested-member-name">
                        {contact.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={handleCreateGroup}
                disabled={!newGroup.name || selectedMembers.length === 0}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h3>Delete Group Chat</h3>
            </div>
            <div className="confirm-dialog-content">
              <p>
                Are you sure you want to delete the group chat with{" "}
                {groupToDelete?.name}?
                <br />
                This action cannot be undone.
              </p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="btn-cancel" onClick={cancelDeleteGroup}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDeleteGroup}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupChatPage;
