import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import "../styles/dashboard.css";

function DashboardPage() {
  const { user, getSocket } = useAuth();
  const [stats, setStats] = useState({
    totalMessages: 0,
    unreadMessages: 0,
    totalContacts: 0,
    activeContacts: 0,
    totalGroups: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const socket = getSocket();

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsResponse, activityResponse, remindersResponse] =
          await Promise.all([
            axios.get("/api/dashboard/stats"),
            axios.get("/api/dashboard/activity"),
            axios.get("/api/dashboard/reminders"),
          ]);

        setStats(statsResponse.data);
        setRecentActivity(activityResponse.data);
        setUpcomingReminders(remindersResponse.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setError("Failed to load dashboard data");
        setLoading(false);

        // Fallback to sample data for demonstration purposes
        setStats({
          totalMessages: 156,
          unreadMessages: 8,
          totalContacts: 42,
          activeContacts: 12,
          totalGroups: 5,
        });

        setRecentActivity([
          {
            id: 1,
            type: "message",
            content: "New message from Alice",
            time: "10 minutes ago",
          },
          {
            id: 2,
            type: "contact",
            content: "Bob added you as a contact",
            time: "1 hour ago",
          },
          {
            id: 3,
            type: "group",
            content: "You were added to Marketing Team",
            time: "3 hours ago",
          },
          {
            id: 4,
            type: "message",
            content: "New message from Marketing Team",
            time: "5 hours ago",
          },
          {
            id: 5,
            type: "system",
            content: "Security settings updated",
            time: "Yesterday",
          },
        ]);

        setUpcomingReminders([
          {
            id: 1,
            title: "Team Meeting",
            time: "Today, 2:00 PM",
            priority: "high",
          },
          {
            id: 2,
            title: "Project Deadline",
            time: "Tomorrow, 5:00 PM",
            priority: "high",
          },
          {
            id: 3,
            title: "Call with Client",
            time: "Jan 15, 10:00 AM",
            priority: "medium",
          },
        ]);
      }
    };

    fetchDashboardData();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on("new_message", (messageData) => {
      setStats((prev) => ({
        ...prev,
        totalMessages: prev.totalMessages + 1,
        unreadMessages: prev.unreadMessages + 1,
      }));

      setRecentActivity((prev) => [
        {
          id: Date.now(),
          type: "message",
          content: `New message from ${messageData.senderName}`,
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);
    });

    // Listen for new contacts
    socket.on("new_contact", (contactData) => {
      setStats((prev) => ({
        ...prev,
        totalContacts: prev.totalContacts + 1,
      }));

      setRecentActivity((prev) => [
        {
          id: Date.now(),
          type: "contact",
          content: `${contactData.name} added you as a contact`,
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);
    });

    // Listen for group updates
    socket.on("group_update", (groupData) => {
      if (groupData.action === "create") {
        setStats((prev) => ({
          ...prev,
          totalGroups: prev.totalGroups + 1,
        }));
      }

      setRecentActivity((prev) => [
        {
          id: Date.now(),
          type: "group",
          content: `You were added to ${groupData.name}`,
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);
    });

    return () => {
      socket.off("new_message");
      socket.off("new_contact");
      socket.off("group_update");
    };
  }, [socket]);

  const getActivityIcon = (type) => {
    switch (type) {
      case "message":
        return "fas fa-comment";
      case "contact":
        return "fas fa-user-plus";
      case "group":
        return "fas fa-users";
      case "system":
        return "fas fa-cog";
      default:
        return "fas fa-bell";
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case "high":
        return "priority-high";
      case "medium":
        return "priority-medium";
      case "low":
        return "priority-low";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-message">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user?.name || "User"}!</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-comment"></i>
          </div>
          <div className="stat-details">
            <h3>Messages</h3>
            <div className="stat-numbers">
              <span className="stat-total">{stats.totalMessages}</span>
              {stats.unreadMessages > 0 && (
                <span className="stat-unread">
                  {stats.unreadMessages} unread
                </span>
              )}
            </div>
          </div>
          <Link to="/messaging" className="stat-action">
            <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-address-book"></i>
          </div>
          <div className="stat-details">
            <h3>Contacts</h3>
            <div className="stat-numbers">
              <span className="stat-total">{stats.totalContacts}</span>
              <span className="stat-active">{stats.activeContacts} active</span>
            </div>
          </div>
          <Link to="/contacts" className="stat-action">
            <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-details">
            <h3>Groups</h3>
            <div className="stat-numbers">
              <span className="stat-total">{stats.totalGroups}</span>
            </div>
          </div>
          <Link to="/group-chat" className="stat-action">
            <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <div className="stat-details">
            <h3>Security</h3>
            <div className="stat-status">
              <span className="status-secure">Secure</span>
            </div>
          </div>
          <Link to="/security" className="stat-action">
            <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card recent-activity">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <button className="refresh-btn">
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className={`activity-icon ${activity.type}`}>
                    <i className={getActivityIcon(activity.type)}></i>
                  </div>
                  <div className="activity-details">
                    <div className="activity-content">{activity.content}</div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No recent activity</div>
            )}
          </div>
        </div>

        <div className="dashboard-card upcoming-reminders">
          <div className="card-header">
            <h3>Upcoming Reminders</h3>
            <button className="add-reminder-btn">
              <i className="fas fa-plus"></i>
            </button>
          </div>
          <div className="reminders-list">
            {upcomingReminders.length > 0 ? (
              upcomingReminders.map((reminder) => (
                <div key={reminder.id} className="reminder-item">
                  <div
                    className={`reminder-priority ${getPriorityClass(
                      reminder.priority
                    )}`}
                  ></div>
                  <div className="reminder-details">
                    <div className="reminder-title">{reminder.title}</div>
                    <div className="reminder-time">{reminder.time}</div>
                  </div>
                  <div className="reminder-actions">
                    <button className="reminder-action-btn">
                      <i className="fas fa-check"></i>
                    </button>
                    <button className="reminder-action-btn">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No upcoming reminders</div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-footer">
        <div className="quick-actions">
          <button className="quick-action-btn">
            <i className="fas fa-comment"></i>
            <span>New Message</span>
          </button>
          <button className="quick-action-btn">
            <i className="fas fa-user-plus"></i>
            <span>Add Contact</span>
          </button>
          <button className="quick-action-btn">
            <i className="fas fa-users"></i>
            <span>Create Group</span>
          </button>
          <button className="quick-action-btn">
            <i className="fas fa-bell"></i>
            <span>Add Reminder</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
