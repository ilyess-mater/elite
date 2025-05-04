import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/tasks.css";
import { useAuth } from "../contexts/AuthContext";

function TaskManagement({ groupId, user, members }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    deadline: "",
    status: "To Do", // Status is automatically set to 'To Do' by default
  });
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Fetch tasks for the current group
  useEffect(() => {
    if (!groupId) return;

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/groups/${groupId}/tasks`);
        setTasks(response.data);
        setError("");
      } catch (err) {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [groupId]);

  // Handle input change for new task form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Check if a task is overdue
  const isTaskOverdue = (task) => {
    if (!task.deadline) return false;
    const now = new Date();
    const deadline = new Date(task.deadline);
    return now > deadline && task.status !== "Done";
  };

  // Handle input change for editing task
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditingTask((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Create a new task
  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (!newTask.title || !newTask.assignedTo || !newTask.deadline) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const taskData = {
        ...newTask,
        groupId: groupId,
        assignedBy: user.id,
      };

      const response = await axios.post("/api/tasks", taskData);
      setTasks((prev) => [...prev, response.data]);
      setNewTask({
        title: "",
        description: "",
        assignedTo: "",
        deadline: "",
        status: "To Do",
      });
      setShowAddTask(false);
      setError("");
    } catch (err) {
      console.error("Error creating task:", err);
      setError("Failed to create task. Please try again.");
    }
  };

  // Update task status
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const response = await axios.put(`/api/tasks/${taskId}`, {
        status: newStatus,
      });
      setTasks((prev) =>
        prev.map((task) => (task._id === taskId ? response.data : task))
      );

      // If we're updating the currently selected task, update that too
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(response.data);
      }

      // If we're editing this task, update the editing state
      if (editingTask && editingTask._id === taskId) {
        setEditingTask(response.data);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
      setError("Failed to update task status. Please try again.");
    }
  };

  // Save edited task
  const handleSaveTask = async (e) => {
    e.preventDefault();

    if (
      !editingTask.title ||
      !editingTask.assignedTo ||
      !editingTask.deadline
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const response = await axios.put(
        `/api/tasks/${editingTask._id}`,
        editingTask
      );
      setTasks((prev) =>
        prev.map((task) =>
          task._id === editingTask._id ? response.data : task
        )
      );

      // If we're updating the currently selected task, update that too
      if (selectedTask && selectedTask._id === editingTask._id) {
        setSelectedTask(response.data);
      }

      setEditingTask(null);
      setError("");
    } catch (err) {
      console.error("Error updating task:", err);
      setError("Failed to update task. Please try again.");
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));

      // If we're deleting the currently selected task, close the details view
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(null);
        setShowTaskDetails(false);
      }

      // If we're editing this task, cancel the edit
      if (editingTask && editingTask._id === taskId) {
        setEditingTask(null);
      }
    } catch (err) {
      console.error("Error deleting task:", err);
      setError("Failed to delete task. Please try again.");
    }
  };

  // View task details
  const handleViewTask = (task) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };

  // Start editing a task
  const handleEditTask = (task) => {
    setEditingTask({ ...task });
    setShowTaskDetails(false);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get member name by ID
  const getMemberName = (memberId) => {
    if (!members || !Array.isArray(members)) return "Unknown";
    const member = members.find((m) => m.id === memberId);
    return member ? member.name : "Unknown";
  };

  // Get status class for styling
  const getStatusClass = (status) => {
    switch (status) {
      case "To Do":
        return "status-todo";
      case "Doing":
        return "status-doing";
      case "Done":
        return "status-done";
      default:
        return "";
    }
  };

  // Toggle task status between To Do and Done
  const toggleTaskStatus = (task) => {
    const newStatus = task.status === "Done" ? "To Do" : "Done";
    handleUpdateStatus(task._id, newStatus);
  };

  // Render task list
  const renderTaskList = () => {
    if (loading) return <div className="task-loading">Loading tasks...</div>;
    if (error) return <div className="task-error">{error}</div>;
    if (tasks.length === 0)
      return (
        <div className="no-tasks">
          No tasks found. Create a new task to get started!
        </div>
      );

    return (
      <div className="task-list">
        {tasks.map((task) => {
          const isOverdue = isTaskOverdue(task);
          return (
            <div
              key={task._id}
              className={`task-item ${getStatusClass(task.status)} ${
                isOverdue ? "overdue" : ""
              }`}
            >
              <div className="task-header">
                <h3 className="task-title" onClick={() => handleViewTask(task)}>
                  {task.title}
                </h3>
                <div className="task-status-container">
                  <input
                    type="checkbox"
                    checked={task.status === "Done"}
                    onChange={() => toggleTaskStatus(task)}
                    className="task-checkbox"
                  />
                  <span
                    className={`task-status ${getStatusClass(task.status)}`}
                  >
                    {task.status}
                  </span>
                </div>
              </div>
              <div className="task-info">
                <p>
                  <strong>Assigned to:</strong> {getMemberName(task.assignedTo)}
                </p>
                <p>
                  <strong>Deadline:</strong> {formatDate(task.deadline)}
                  {isOverdue && (
                    <span className="overdue-indicator"> (Overdue)</span>
                  )}
                </p>
              </div>
              <div className="task-actions">
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render task details modal
  const renderTaskDetails = () => {
    if (!selectedTask) return null;

    return (
      <div className="task-details-modal">
        <div className="task-details-content">
          <button
            className="close-btn"
            onClick={() => setShowTaskDetails(false)}
          >
            ×
          </button>
          <h2>{selectedTask.title}</h2>
          <div className="task-detail-info">
            <p>
              <strong>Description:</strong>{" "}
              {selectedTask.description || "No description provided"}
            </p>
            <p>
              <strong>Assigned to:</strong>{" "}
              {getMemberName(selectedTask.assignedTo)}
            </p>
            <p>
              <strong>Assigned by:</strong>{" "}
              {getMemberName(selectedTask.assignedBy)}
            </p>
            <p>
              <strong>Deadline:</strong> {formatDate(selectedTask.deadline)}
            </p>
            <p>
              <strong>Created:</strong> {formatDate(selectedTask.createdAt)}
            </p>
            <p>
              <strong>Last updated:</strong>{" "}
              {formatDate(selectedTask.updatedAt)}
            </p>
          </div>
          <div className="status-update">
            <p>
              <strong>Status:</strong>
            </p>
            <div className="status-toggle">
              <label className="status-toggle-label">
                <input
                  type="checkbox"
                  checked={selectedTask.status === "Done"}
                  onChange={() => toggleTaskStatus(selectedTask)}
                  className="status-toggle-checkbox"
                />
                <span className="status-toggle-text">
                  {selectedTask.status === "Done"
                    ? "Completed"
                    : "Mark as complete"}
                </span>
              </label>
            </div>
          </div>
          <div className="task-detail-actions">
            <button
              onClick={() => handleEditTask(selectedTask)}
              className="edit-btn"
            >
              Edit Task
            </button>
            <button
              onClick={() => handleDeleteTask(selectedTask._id)}
              className="delete-btn"
            >
              Delete Task
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render new task form
  const renderAddTaskForm = () => {
    return (
      <div className="add-task-form">
        <h3>Create New Task</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleCreateTask}>
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={newTask.title}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={newTask.description}
              onChange={handleInputChange}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label htmlFor="assignedTo">Assign To *</label>
            <select
              id="assignedTo"
              name="assignedTo"
              value={newTask.assignedTo}
              onChange={handleInputChange}
              required
            >
              <option value="">Select a member</option>
              {members &&
                Array.isArray(members) &&
                members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="deadline">Deadline *</label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              value={newTask.deadline}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => setShowAddTask(false)}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Create Task
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Render edit task form
  const renderEditTaskForm = () => {
    if (!editingTask) return null;

    return (
      <div className="edit-task-form">
        <h3>Edit Task</h3>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSaveTask}>
          <div className="form-group">
            <label htmlFor="edit-title">Title *</label>
            <input
              type="text"
              id="edit-title"
              name="title"
              value={editingTask.title}
              onChange={handleEditInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              name="description"
              value={editingTask.description || ""}
              onChange={handleEditInputChange}
              rows="3"
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-assignedTo">Assign To *</label>
            <select
              id="edit-assignedTo"
              name="assignedTo"
              value={editingTask.assignedTo}
              onChange={handleEditInputChange}
              required
            >
              <option value="">Select a member</option>
              {members &&
                Array.isArray(members) &&
                members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="edit-deadline">Deadline *</label>
            <input
              type="datetime-local"
              id="edit-deadline"
              name="deadline"
              value={
                editingTask.deadline
                  ? editingTask.deadline.substring(0, 16)
                  : ""
              }
              onChange={handleEditInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-status">Status</label>
            <select
              id="edit-status"
              name="status"
              value={editingTask.status}
              onChange={handleEditInputChange}
            >
              <option value="To Do">To Do</option>
              <option value="Doing">Doing</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => setEditingTask(null)}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="task-management">
      <div className="task-header-container">
        <h2>Tasks</h2>
        <button
          className="add-task-btn"
          onClick={() => setShowAddTask(true)}
          disabled={showAddTask}
        >
          + New Task
        </button>
      </div>

      {showAddTask ? renderAddTaskForm() : null}
      {editingTask ? renderEditTaskForm() : null}
      {!showAddTask && !editingTask ? renderTaskList() : null}
      {showTaskDetails && renderTaskDetails()}
    </div>
  );
}

export default TaskManagement;
