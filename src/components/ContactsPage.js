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
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");
        setContacts(response.data);
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
        department: newContact.department,
      });

      // Add new contact to the state
      setContacts([...contacts, response.data]);

      // Clear form and show success message
      setNewContact({ name: "", email: "", department: "" });
      setShowAddContact(false);
      setSuccessMessage("Contact added successfully!");

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
    }

    // Redirect to messaging page
    window.location.href = "/messaging";
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.department &&
        contact.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="contacts-page-container">
      <h2 className="contacts-title">Contacts</h2>

      <div className="contacts-header">
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

      <div className="contacts-list-container">
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
            {filteredContacts.map((contact) => (
              <tr key={contact.id}>
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
                <td>{contact.department || "-"}</td>
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
                      <i className="fas fa-paper-plane fa-fw"></i>
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={(e) => handleDeleteClick(e, contact)}
                      title="Delete contact"
                    >
                      <i className="fas fa-trash-alt fa-fw"></i>
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

              <div className="form-group">
                <label>Department (Optional)</label>
                <input
                  type="text"
                  name="department"
                  value={newContact.department}
                  onChange={handleInputChange}
                  placeholder="Enter department"
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
