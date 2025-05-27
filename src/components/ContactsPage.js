import React, { useState, useEffect } from "react";
import "../styles/contacts.css";
import axios from "axios";

function ContactsPage({ user }) {
  const [contacts, setContacts] = useState([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    department: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");
        setContacts(response.data);

        // Extract unique departments from contacts
        const uniqueDepartments = [
          ...new Set(
            response.data
              .map((contact) => contact.department)
              .filter((dept) => dept && dept.trim() !== "")
          ),
        ].sort();

        setDepartments(uniqueDepartments);
      } catch (error) {
        console.error("Error fetching contacts:", error);
        setError("Failed to load contacts. Please try again.");
      }
    };

    fetchContacts();
  }, []);

  // Generate random avatar color based on user name
  function generateAvatar(name) {
    const colors = [
      "#FF5733", // Orange/Red
      "#33FF57", // Green
      "#3357FF", // Blue
      "#F333FF", // Purple
      "#FF33F3", // Pink
      "#33FFF3", // Cyan
      "#FFD700", // Gold
      "#9370DB", // Medium Purple
      "#20B2AA", // Light Sea Green
      "#FF6347", // Tomato
      "#4682B4", // Steel Blue
      "#32CD32", // Lime Green
      "#E91E63", // Pink
      "#9C27B0", // Purple
      "#673AB7", // Deep Purple
      "#3F51B5", // Indigo
      "#2196F3", // Blue
      "#03A9F4", // Light Blue
      "#00BCD4", // Cyan
      "#009688", // Teal
      "#4CAF50", // Green
      "#8BC34A", // Light Green
      "#CDDC39", // Lime
      "#FFEB3B", // Yellow
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewContact({ ...newContact, [name]: value });
    setError("");
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleAddContact = async () => {
    // Basic validation
    if (!newContact.email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(newContact.email)) {
      setError("Please enter a valid email");
      return;
    }

    setIsLoading(true);

    try {
      // Send request to add contact
      const response = await axios.post("/api/contacts", {
        email: newContact.email,
      });

      // Add new contact to the state
      setContacts([...contacts, response.data]);

      // Clear form and show success message
      setNewContact({ name: "", email: "", department: "" });
      setShowAddContact(false);
      setSuccessMessage("Contact added successfully!");

      // Refresh categories to ensure department categories are created
      try {
        // This will trigger the backend to create department categories
        await axios.get("/api/categories", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        console.log("Categories refreshed after adding contact");
      } catch (error) {
        console.error("Error refreshing categories:", error);
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError("This user is not registered on the platform");
      } else if (err.response && err.response.status === 409) {
        setError("This email is already in your contacts");
      } else {
        setError("Failed to add contact. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete contact
  const handleDeleteClick = (e, contact) => {
    e.stopPropagation();
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  // Cancel delete contact
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setContactToDelete(null);
  };

  // Confirm delete contact
  const confirmDelete = async () => {
    if (contactToDelete) {
      try {
        await axios.delete(`/api/contacts/${contactToDelete.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        // Remove contact from state
        setContacts(contacts.filter((c) => c.id !== contactToDelete.id));
        setSuccessMessage("Contact deleted successfully!");

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage("");
        }, 3000);
      } catch (error) {
        console.error("Error deleting contact:", error);
        setError("Failed to delete contact. Please try again.");
      }

      setShowDeleteConfirm(false);
      setContactToDelete(null);
    }
  };

  // Start conversation with a contact
  const startConversation = (contact) => {
    // Check if this contact was previously removed from chats
    const removedChats = JSON.parse(
      localStorage.getItem("removedChats") || "[]"
    );

    // If it was removed, re-enable it by removing from the removed chats list
    if (removedChats.includes(contact.id)) {
      const updatedRemovedChats = removedChats.filter(
        (id) => id !== contact.id
      );
      localStorage.setItem("removedChats", JSON.stringify(updatedRemovedChats));

      // Trigger department categories update by setting a flag in localStorage
      // This flag will be checked by MessagingPage to update department categories
      localStorage.setItem("updateDepartmentCategories", "true");
    }

    // Redirect to messaging page
    window.location.href = "/messaging";
  };

  const filteredContacts = contacts.filter((contact) => {
    // First filter by department if a department filter is selected
    if (departmentFilter && contact.department !== departmentFilter) {
      return false;
    }

    // Then filter by search term
    return (
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.department &&
        contact.department.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="contacts-page-container">
      <h2 className="contacts-title fade-in">Contacts</h2>

      <div className="contacts-header slide-up stagger-1">
        <div className="contacts-actions">
          <div className="search-bar">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="department-filter">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="department-select"
            >
              <option value="">All Departments</option>
              {departments.map((dept, index) => (
                <option key={index} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <button
            className="add-contact-btn"
            onClick={() => setShowAddContact(true)}
          >
            <i className="fas fa-plus"></i> Add Contact
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i> {successMessage}
        </div>
      )}

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div className="contacts-list-container slide-up stagger-2">
        <table className="contacts-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact, index) => (
              <tr
                key={contact.id}
                className={`slide-in-left stagger-${Math.min(index + 1, 6)}`}
              >
                <td>
                  <div className="contact-name-cell">
                    <div
                      className="contact-avatar"
                      style={{ backgroundColor: generateAvatar(contact.name) }}
                    >
                      {contact.name.charAt(0)}
                    </div>
                    <span>{contact.name}</span>
                  </div>
                </td>
                <td>{contact.email}</td>
                <td>
                  {contact.department ? (
                    <span
                      className={`department-badge ${contact.department
                        .toLowerCase()
                        .replace(/[&\s]+/g, "-")}`}
                    >
                      {contact.department}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <span
                    className={`status-indicator ${
                      contact.isActive ? "active" : "inactive"
                    }`}
                  >
                    {contact.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="contact-actions">
                    <button
                      className="action-btn message-btn"
                      onClick={() => startConversation(contact)}
                      title="Start conversation"
                    >
                      <i className="fas fa-message fa-fw"></i>
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={(e) => handleDeleteClick(e, contact)}
                      title="Delete contact"
                    >
                      <i className="fas fa-trash-can fa-fw"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddContact && (
        <div className="modal-overlay">
          <div className="add-contact-modal">
            <div className="modal-header">
              <h3>Add New Contact</h3>
              <button
                className="close-modal-btn"
                onClick={() => {
                  setShowAddContact(false);
                  setError("");
                  setNewContact({ name: "", email: "", department: "" });
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
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={newContact.email}
                  onChange={handleInputChange}
                  placeholder="Enter contact email"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowAddContact(false);
                  setError("");
                  setNewContact({ name: "", email: "", department: "" });
                }}
              >
                Cancel
              </button>
              <button
                className="add-btn"
                onClick={handleAddContact}
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h4>Supprimer le contact</h4>
            <p>
              Êtes-vous sûr de vouloir supprimer {contactToDelete?.name} de vos
              contacts ? Cette action ne peut pas être annulée.
            </p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Annuler
              </button>
              <button className="btn-confirm" onClick={confirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactsPage;
