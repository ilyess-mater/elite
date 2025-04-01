import React, { useState, useEffect } from "react";
import "../styles/realtime.css";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

function RealtimePage() {
  const { user, getSocket } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = getSocket();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real app, these would be actual API calls
        // Mocking data for demonstration

        // Mock online users
        setOnlineUsers([
          {
            id: 1,
            name: "Alice Smith",
            status: "online",
            lastActive: new Date().toISOString(),
          },
          {
            id: 2,
            name: "Bob Johnson",
            status: "away",
            lastActive: new Date().toISOString(),
          },
          {
            id: 3,
            name: "Carol Williams",
            status: "busy",
            lastActive: new Date().toISOString(),
          },
          {
            id: 4,
            name: "Dave Brown",
            status: "online",
            lastActive: new Date().toISOString(),
          },
        ]);

        // Mock recent activities
        setRecentActivities([
          {
            id: 1,
            type: "message",
            user: "Alice Smith",
            action: "sent a message",
            target: "Marketing Team",
            time: "5 minutes ago",
          },
          {
            id: 2,
            type: "user",
            user: "Bob Johnson",
            action: "changed status to",
            target: "Away",
            time: "10 minutes ago",
          },
          {
            id: 3,
            type: "notification",
            user: "System",
            action: "scheduled maintenance",
            target: "",
            time: "1 hour ago",
          },
          {
            id: 4,
            type: "message",
            user: "Carol Williams",
            action: "sent a file",
            target: "Project Documents",
            time: "3 hours ago",
          },
          {
            id: 5,
            type: "system",
            user: "System",
            action: "updated security settings",
            target: "",
            time: "Yesterday",
          },
        ]);

        // Mock notifications
        setNotifications([
          { id: 1, text: "New message from Alice Smith", time: "Just now" },
          {
            id: 2,
            text: "Bob Johnson added you to Project Team",
            time: "5 minutes ago",
          },
          {
            id: 3,
            text: "Meeting reminder: Team standup at 10:00 AM",
            time: "30 minutes ago",
          },
          {
            id: 4,
            text: "System update scheduled for tonight",
            time: "2 hours ago",
          },
        ]);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching realtime data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;

    // Listen for user status changes
    socket.on("user_status", (data) => {
      setOnlineUsers((prev) => {
        return prev.map((user) => {
          if (user.id === data.userId) {
            return {
              ...user,
              status: data.status,
              lastActive: new Date().toISOString(),
            };
          }
          return user;
        });
      });

      // Add to recent activities
      setRecentActivities((prev) => [
        {
          id: Date.now(),
          type: "user",
          user: data.userName || "A user",
          action: "changed status to",
          target: data.status,
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);
    });

    // Listen for new messages
    socket.on("new_message", (data) => {
      // Add to recent activities
      setRecentActivities((prev) => [
        {
          id: Date.now(),
          type: "message",
          user: data.senderName || "Someone",
          action: "sent a message",
          target: data.receiverName || "you",
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);

      // Add to notifications
      setNotifications((prev) => [
        {
          id: Date.now(),
          text: `New message from ${data.senderName || "Someone"}`,
          time: "Just now",
        },
        ...prev.slice(0, 3),
      ]);
    });

    // Listen for system notifications
    socket.on("system_notification", (data) => {
      // Add to recent activities
      setRecentActivities((prev) => [
        {
          id: Date.now(),
          type: "system",
          user: "System",
          action: data.action || "notification",
          target: data.target || "",
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);

      // Add to notifications
      setNotifications((prev) => [
        {
          id: Date.now(),
          text: data.message || "System notification",
          time: "Just now",
        },
        ...prev.slice(0, 3),
      ]);
    });

    return () => {
      socket.off("user_status");
      socket.off("new_message");
      socket.off("system_notification");
    };
  }, [socket]);

  const getStatusClass = (status) => {
    switch (status) {
      case "online":
        return "status-online";
      case "away":
        return "status-away";
      case "busy":
        return "status-busy";
      default:
        return "status-offline";
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "message":
        return "fas fa-comment";
      case "user":
        return "fas fa-user";
      case "notification":
        return "fas fa-bell";
      case "system":
        return "fas fa-cog";
      default:
        return "fas fa-info-circle";
    }
  };

  if (loading) {
    return (
      <div className="realtime-container">
        <div className="loading-message">Loading realtime data...</div>
      </div>
    );
  }

  return (
    <div className="realtime-container">
      <div className="realtime-header">
        <h1>Realtime Status</h1>
      </div>

      <div className="realtime-cards">
        <div className="realtime-card">
          <div className="realtime-card-header">
            <div className="realtime-card-title">
              <i className="fas fa-user-circle"></i> Online Users
            </div>
          </div>
          <div className="realtime-card-body">
            <div className="status-list">
              {onlineUsers.map((user) => (
                <div className="status-item" key={user.id}>
                  <div
                    className={`status-indicator ${getStatusClass(
                      user.status
                    )}`}
                  ></div>
                  <div className="status-name">{user.name}</div>
                  <div className="status-time">{user.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="realtime-card">
          <div className="realtime-card-header">
            <div className="realtime-card-title">
              <i className="fas fa-bell"></i> Notifications
            </div>
          </div>
          <div className="realtime-card-body">
            <div className="notification-list">
              {notifications.map((notification) => (
                <div className="notification-item" key={notification.id}>
                  <div className="notification-icon">
                    <i className="fas fa-bell"></i>
                  </div>
                  <div className="notification-content">
                    <div className="notification-text">{notification.text}</div>
                    <div className="notification-time">{notification.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="activity-feed">
        <div className="activity-feed-header">
          <div className="activity-feed-title">
            <i className="fas fa-stream"></i> Recent Activity
          </div>
          <div className="activity-feed-actions">
            <button title="Refresh">
              <i className="fas fa-sync-alt"></i>
            </button>
            <button title="Filter">
              <i className="fas fa-filter"></i>
            </button>
          </div>
        </div>
        <div className="activity-feed-body">
          <div className="activity-list">
            {recentActivities.map((activity) => (
              <div className="activity-item" key={activity.id}>
                <div className={`activity-icon ${activity.type}`}>
                  <i className={getActivityIcon(activity.type)}></i>
                </div>
                <div className="activity-content">
                  <div className="activity-title">
                    {activity.user} {activity.action} {activity.target}
                  </div>
                  <div className="activity-time">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RealtimePage;
