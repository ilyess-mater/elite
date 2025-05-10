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
    assignedTo: [],
    deadline: "",
    status: "To Do", // Status is automatically set to 'To Do' by default
    assignToAll: false,
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
    const { name, value, type, checked } = e.target;

    if (name === "assignToAll" && checked) {
      // If "Assign to All" is checked, set assignedTo to all member IDs
      const allMemberIds = members.map((member) => member.id);
      setNewTask((prev) => ({
        ...prev,
        assignToAll: checked,
        assignedTo: allMemberIds,
      }));
    } else if (name === "assignToAll" && !checked) {
      // If "Assign to All" is unchecked, clear assignedTo
      setNewTask((prev) => ({
        ...prev,
        assignToAll: checked,
        assignedTo: [],
      }));
    } else if (name === "assignedTo") {
      // Handle multi-select for assignedTo
      if (type === "select-multiple") {
        const selectedOptions = Array.from(e.target.selectedOptions).map(
          (option) => option.value
        );
        setNewTask((prev) => ({
          ...prev,
          assignedTo: selectedOptions,
          // If we're selecting specific members, turn off assignToAll
          assignToAll: false,
        }));
      } else {
        // Single select (backward compatibility)
        setNewTask((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    } else {
      // Handle all other inputs normally
      setNewTask((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
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
    const { name, value, type, checked } = e.target;

    if (name === "assignToAll" && checked) {
      // If "Assign to All" is checked, set assignedTo to all member IDs
      const allMemberIds = members.map((member) => member.id);
      setEditingTask((prev) => ({
        ...prev,
        assignToAll: checked,
        assignedTo: allMemberIds,
      }));
    } else if (name === "assignToAll" && !checked) {
      // If "Assign to All" is unchecked, clear assignedTo
      setEditingTask((prev) => ({
        ...prev,
        assignToAll: checked,
        assignedTo: [],
      }));
    } else if (name === "assignedTo") {
      // Handle multi-select for assignedTo
      if (type === "select-multiple") {
        const selectedOptions = Array.from(e.target.selectedOptions).map(
          (option) => option.value
        );
        setEditingTask((prev) => ({
          ...prev,
          assignedTo: selectedOptions,
          // If we're selecting specific members, turn off assignToAll
          assignToAll: false,
        }));
      } else {
        // Single select (backward compatibility)
        setEditingTask((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    } else {
      // Handle all other inputs normally
      setEditingTask((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Create a new task
  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (
      !newTask.title ||
      newTask.assignedTo.length === 0 ||
      !newTask.deadline
    ) {
      setError(
        "Please fill in all required fields and assign to at least one member"
      );
      return;
    }

    try {
      const taskData = {
        ...newTask,
        groupId: groupId,
        assignedBy: user.id,
      };

      // If we're assigning to multiple people, create multiple tasks
      if (Array.isArray(newTask.assignedTo) && newTask.assignedTo.length > 1) {
        // Create a task for each assigned member
        const taskPromises = newTask.assignedTo.map((memberId) => {
          const individualTask = {
            ...taskData,
            assignedTo: memberId,
          };
          return axios.post("/api/tasks", individualTask);
        });

        const responses = await Promise.all(taskPromises);
        const newTasks = responses.map((response) => response.data);

        setTasks((prev) => [...prev, ...newTasks]);
      } else {
        // Single assignment (backward compatibility)
        const singleAssignee = Array.isArray(newTask.assignedTo)
          ? newTask.assignedTo[0]
          : newTask.assignedTo;

        const singleTaskData = {
          ...taskData,
          assignedTo: singleAssignee,
        };

        const response = await axios.post("/api/tasks", singleTaskData);
        setTasks((prev) => [...prev, response.data]);
      }

      // Reset form
      setNewTask({
        title: "",
        description: "",
        assignedTo: [],
        deadline: "",
        status: "To Do",
        assignToAll: false,
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
      (Array.isArray(editingTask.assignedTo) &&
        editingTask.assignedTo.length === 0) ||
      !editingTask.assignedTo ||
      !editingTask.deadline
    ) {
      setError(
        "Please fill in all required fields and assign to at least one member"
      );
      return;
    }

    try {
      // If we're assigning to multiple people, handle multiple assignments
      if (
        Array.isArray(editingTask.assignedTo) &&
        editingTask.assignedTo.length > 1
      ) {
        // First delete the existing task
        await axios.delete(`/api/tasks/${editingTask._id}`);

        // Create a task for each assigned member
        const taskPromises = editingTask.assignedTo.map((memberId) => {
          const individualTask = {
            ...editingTask,
            _id: undefined, // Remove the _id so a new one is created
            assignedTo: memberId,
          };
          return axios.post("/api/tasks", individualTask);
        });

        const responses = await Promise.all(taskPromises);
        const newTasks = responses.map((response) => response.data);

        // Replace the old task with the new ones
        setTasks((prev) => {
          const filtered = prev.filter((task) => task._id !== editingTask._id);
          return [...filtered, ...newTasks];
        });

        // If we're updating the currently selected task, close the details view
        if (selectedTask && selectedTask._id === editingTask._id) {
          setSelectedTask(null);
          setShowTaskDetails(false);
        }
      } else {
        // Single assignment - update the existing task
        const singleAssignee = Array.isArray(editingTask.assignedTo)
          ? editingTask.assignedTo[0]
          : editingTask.assignedTo;

        const updatedTask = {
          ...editingTask,
          assignedTo: singleAssignee,
        };

        const response = await axios.put(
          `/api/tasks/${editingTask._id}`,
          updatedTask
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

  // Get member names for multiple IDs
  const getMemberNames = (memberIds) => {
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0)
      return "None";

    return memberIds
      .map((id) => {
        const member = members.find((m) => m.id === id);
        return member ? member.name : "Unknown";
      })
      .join(", ");
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
                    {task.status === "To Do"
                      ? "To Do"
                      : task.status === "Doing"
                      ? "In Progress"
                      : "Completed"}
                  </span>
                </div>
              </div>
              <div className="task-info">
                <p>
                  <i className="fas fa-user-circle"></i>
                  <span>
                    <strong>Assigned to:</strong>{" "}
                    {Array.isArray(task.assignedTo)
                      ? getMemberNames(task.assignedTo)
                      : getMemberName(task.assignedTo)}
                  </span>
                </p>
                <p>
                  <i className="fas fa-calendar-alt"></i>
                  <span>
                    <strong>Deadline:</strong> {formatDate(task.deadline)}
                    {isOverdue && (
                      <span className="overdue-indicator"> (Overdue)</span>
                    )}
                  </span>
                </p>
              </div>
              <div className="task-actions">
                {task.assignedBy === user.id && (
                  <button
                    onClick={() => handleEditTask(task)}
                    className="edit-btn"
                  >
                    <i className="fas fa-edit"></i> Edit
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="delete-btn"
                >
                  <i className="fas fa-trash-alt"></i> Delete
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

    const isOverdue = isTaskOverdue(selectedTask);

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

          <div
            className={`task-status-badge ${getStatusClass(
              selectedTask.status
            )}`}
          >
            {selectedTask.status}
            {isOverdue && <span className="overdue-indicator"> (Overdue)</span>}
          </div>

          <div className="task-detail-info">
            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-align-left"></i>
              </div>
              <div className="detail-content">
                <h4>Description</h4>
                <p>{selectedTask.description || "No description provided"}</p>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-user-check"></i>
              </div>
              <div className="detail-content">
                <h4>Assigned to</h4>
                <p>
                  {Array.isArray(selectedTask.assignedTo)
                    ? getMemberNames(selectedTask.assignedTo)
                    : getMemberName(selectedTask.assignedTo)}
                </p>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-user"></i>
              </div>
              <div className="detail-content">
                <h4>Assigned by</h4>
                <p>{getMemberName(selectedTask.assignedBy)}</p>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-calendar-alt"></i>
              </div>
              <div className="detail-content">
                <h4>Deadline</h4>
                <p>{formatDate(selectedTask.deadline)}</p>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-clock"></i>
              </div>
              <div className="detail-content">
                <h4>Created</h4>
                <p>{formatDate(selectedTask.createdAt)}</p>
              </div>
            </div>

            <div className="detail-row">
              <div className="detail-icon">
                <i className="fas fa-edit"></i>
              </div>
              <div className="detail-content">
                <h4>Last updated</h4>
                <p>{formatDate(selectedTask.updatedAt)}</p>
              </div>
            </div>
          </div>

          <div className="status-update">
            <h3>Update Status</h3>
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
            {selectedTask.assignedBy === user.id && (
              <button
                onClick={() => handleEditTask(selectedTask)}
                className="edit-btn"
              >
                <i className="fas fa-edit"></i> Edit Task
              </button>
            )}
            <button
              onClick={() => handleDeleteTask(selectedTask._id)}
              className="delete-btn"
            >
              <i className="fas fa-trash-alt"></i> Delete Task
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
            <label>Assign To *</label>
            <div className="assign-dropdown-container">
              <div
                className="assign-dropdown-trigger"
                onClick={() => {
                  const memberList = document.getElementById(
                    "new-member-list-container"
                  );
                  if (memberList) {
                    memberList.classList.toggle("active");
                  }
                }}
              >
                <span>
                  {newTask.assignToAll
                    ? "All members"
                    : newTask.assignedTo.length > 0
                    ? `${newTask.assignedTo.length} member(s) selected`
                    : "Select members"}
                </span>
                <i className="fas fa-chevron-down"></i>
              </div>
              <div
                id="new-member-list-container"
                className="member-list-container"
              >
                <div className="member-checkbox-list">
                  {members &&
                    Array.isArray(members) &&
                    members.map((member) => (
                      <div key={member.id} className="member-checkbox-item">
                        <label className="member-checkbox-label">
                          <input
                            type="checkbox"
                            name={`member-${member.id}`}
                            checked={newTask.assignedTo.includes(member.id)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setNewTask((prev) => ({
                                ...prev,
                                assignedTo: isChecked
                                  ? [...prev.assignedTo, member.id]
                                  : prev.assignedTo.filter(
                                      (id) => id !== member.id
                                    ),
                                assignToAll: false,
                              }));
                            }}
                          />
                          <span className="member-name">{member.name}</span>
                        </label>
                      </div>
                    ))}
                </div>
              </div>
              <div className="assign-all-option">
                <label className="member-checkbox-label">
                  <input
                    type="checkbox"
                    name="assignToAll"
                    checked={newTask.assignToAll}
                    onChange={handleInputChange}
                  />
                  <span className="member-name">Assign to all members</span>
                </label>
              </div>
            </div>
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
            <label>Assign To *</label>
            <div className="assign-dropdown-container">
              <div
                className="assign-dropdown-trigger"
                onClick={() => {
                  const memberList = document.getElementById(
                    "edit-member-list-container"
                  );
                  if (memberList) {
                    memberList.classList.toggle("active");
                  }
                }}
              >
                <span>
                  {editingTask.assignToAll
                    ? "All members"
                    : Array.isArray(editingTask.assignedTo) &&
                      editingTask.assignedTo.length > 0
                    ? `${editingTask.assignedTo.length} member(s) selected`
                    : "Select members"}
                </span>
                <i className="fas fa-chevron-down"></i>
              </div>
              <div
                id="edit-member-list-container"
                className="member-list-container"
              >
                <div className="member-checkbox-list">
                  {members &&
                    Array.isArray(members) &&
                    members.map((member) => (
                      <div key={member.id} className="member-checkbox-item">
                        <label className="member-checkbox-label">
                          <input
                            type="checkbox"
                            name={`edit-member-${member.id}`}
                            checked={
                              Array.isArray(editingTask.assignedTo)
                                ? editingTask.assignedTo.includes(member.id)
                                : editingTask.assignedTo === member.id
                            }
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const currentAssigned = Array.isArray(
                                editingTask.assignedTo
                              )
                                ? editingTask.assignedTo
                                : [editingTask.assignedTo].filter(Boolean);

                              setEditingTask((prev) => ({
                                ...prev,
                                assignedTo: isChecked
                                  ? [...currentAssigned, member.id]
                                  : currentAssigned.filter(
                                      (id) => id !== member.id
                                    ),
                                assignToAll: false,
                              }));
                            }}
                          />
                          <span className="member-name">{member.name}</span>
                        </label>
                      </div>
                    ))}
                </div>
              </div>
              <div className="assign-all-option">
                <label className="member-checkbox-label">
                  <input
                    type="checkbox"
                    name="assignToAll"
                    checked={editingTask.assignToAll}
                    onChange={handleEditInputChange}
                  />
                  <span className="member-name">Assign to all members</span>
                </label>
              </div>
            </div>
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
