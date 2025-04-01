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
    if (!socket) return;

    socket.on("receive_group_message", (newMessage) => {
      setMessages((prevMessages) => {
        const groupId = newMessage.groupId;
        return {
          ...prevMessages,
          [groupId]: [...(prevMessages[groupId] || []), newMessage],
        };
      });
    });

    socket.on("group_user_joined", (data) => {
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

    return () => {
      socket.off("receive_group_message");
      socket.off("group_user_joined");
      socket.off("group_user_left");
    };
  }, [socket]);

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedGroup || !socket) return;

    // Send message via Socket.IO
    socket.emit("send_group_message", {
      token: localStorage.getItem("token"),
      groupId: selectedGroup.id,
      text: message,
    });

    setMessage("");
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
                  {group.lastMessage || "No messages yet"}
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
              {messages[selectedGroup.id]?.map((msg, index, array) => {
                const messageDate = new Date(msg.timestamp).toDateString();
                const prevMessageDate =
                  index > 0
                    ? new Date(array[index - 1].timestamp).toDateString()
                    : null;
                const showDateDivider =
                  index === 0 || messageDate !== prevMessageDate;

                if (msg.isSystem) {
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <div className="date-divider">
                          <span>{formatDate(msg.timestamp)}</span>
                        </div>
                      )}
                      <div className="system-message">{msg.text}</div>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={msg.id}>
                    {showDateDivider && (
                      <div className="date-divider">
                        <span>{formatDate(msg.timestamp)}</span>
                      </div>
                    )}
                    <div
                      className={`message ${
                        msg.sender === user.id ? "outgoing" : "incoming"
                      }`}
                    >
                      {msg.sender !== user.id && (
                        <div className="message-sender">{msg.senderName}</div>
                      )}
                      <div className="message-text">{msg.text}</div>
                      <div className="message-time">
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage}>
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
            <h3>Group Info</h3>
            <button
              className="close-details-button"
              onClick={() => setShowGroupDetails(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="group-details-content">
            <div className="group-description">
              <h4>Description</h4>
              <p>{selectedGroup.description || "No description available"}</p>
            </div>
            <div className="group-members-section">
              <h4>
                Members{" "}
                <span className="members-count">
                  {selectedGroup.memberCount}
                </span>
              </h4>
              <div className="member-list">
                {/* In a real app, this would show actual group members */}
                <div className="member-item">
                  <div
                    className="member-avatar"
                    style={{ backgroundColor: generateAvatar(user.name) }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div className="member-details">
                    <div className="member-name">{user.name} (You)</div>
                    <div className="member-role">Admin</div>
                  </div>
                  <div className="member-status">
                    <span className="status-online"></span>
                  </div>
                </div>
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
                  <div className="members-search">
                    <i className="fas fa-search"></i>
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                {selectedMembers.length > 0 && (
                  <div className="selected-members">
                    {selectedMembers.map((member) => (
                      <div key={member.id} className="selected-member">
                        {member.name}
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
                      key={contact.id}
                      className="suggested-member"
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
                className="btn btn-secondary"
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroup({ name: "", description: "" });
                  setSelectedMembers([]);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateGroup}>
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupChatPage;
