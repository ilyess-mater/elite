import React, { useState, useEffect, useRef, useCallback } from "react";
import "../styles/messaging.css";
import "../styles/emoji-picker.css";
import "../styles/search-results-list.css";
import "../styles/category-manager.css";
import "../styles/urgency-selector.css";

import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useEncryption } from "../contexts/EncryptionContext";
import EmojiPicker from "emoji-picker-react";
import CategoryManager from "./CategoryManager";
import UrgencySelector from "./UrgencySelector";

function MessagingPage({ user, textSize }) {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [messageUrgency, setMessageUrgency] = useState("normal");
  const messagesEndRef = useRef(null);
  const urgencySelectorRef = useRef(null);
  const { getSocket } = useAuth();
  const socket = getSocket();
  const { encrypt, decrypt, encryptionEnabled } = useEncryption();
  const [messageIdCounter, setMessageIdCounter] = useState(1000);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 769);
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  const [messageToEdit, setMessageToEdit] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState("");
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] =
    useState(false);

  // Title management functions
  const originalTitle = document.title;
  const titleIntervalRef = useRef(null);

  // Create a map to track unread messages per sender
  const unreadMessagesBySenderRef = useRef(new Map());

  // Create a map to track which messages have been counted for notifications
  const countedMessagesRef = useRef(new Set());

  // Flag to track if notifications have been seen
  const notificationsSeenRef = useRef(true);

  // Update the page title to show a notification
  const updateTitle = useCallback(
    (message, flash = true, count = 1, senderId = null, messageId = null) => {
      // Only update title if the page is not visible
      if (document.hidden) {
        // Check if this is a new message (not just a tab change)
        const isNewMessage =
          messageId && !countedMessagesRef.current.has(messageId);

        // Check if notifications have been seen
        const storedNotificationsSeen =
          localStorage.getItem("notificationsSeen");

        // If this is not a new message and notifications were marked as seen, don't update title
        if (!isNewMessage && storedNotificationsSeen === "true") {
          console.log(
            "Not a new message and notifications were seen, keeping original title"
          );
          return;
        }

        // If this is a new message, mark notifications as not seen
        if (isNewMessage) {
          notificationsSeenRef.current = false;
          localStorage.setItem("notificationsSeen", "false");
          console.log(
            "New message received, starting new notification session"
          );
        }

        // If we have a message ID, check if it's already been counted
        if (messageId) {
          // If this message has already been counted, don't count it again
          if (countedMessagesRef.current.has(messageId)) {
            console.log(
              `Message ${messageId} already counted for notifications, skipping`
            );
            return;
          }

          // Mark this message as counted
          countedMessagesRef.current.add(messageId);
        }

        // Clear any existing interval
        if (titleIntervalRef.current) {
          clearInterval(titleIntervalRef.current);
          titleIntervalRef.current = null;
        }

        // If we have a sender ID, update their unread count
        if (senderId) {
          // Get current count for this sender
          const currentCount =
            unreadMessagesBySenderRef.current.get(senderId) || 0;

          // Update the count
          const newCount = Math.max(0, currentCount + count);

          // Store the updated count
          if (newCount > 0) {
            unreadMessagesBySenderRef.current.set(senderId, newCount);
          } else {
            unreadMessagesBySenderRef.current.delete(senderId);
          }
        }

        // Calculate total unread count
        const totalUnreadCount = Array.from(
          unreadMessagesBySenderRef.current.values()
        ).reduce((sum, count) => sum + count, 0);

        // Only update title if we have a message or unread count
        if (message && totalUnreadCount > 0) {
          // Create the new title with unread count
          const newTitle = `(${totalUnreadCount}) ${message}`;

          // Set the title immediately
          document.title = newTitle;

          // If flash is true and we have unread messages, alternate between the new title and original title
          if (flash) {
            let isOriginal = false;
            titleIntervalRef.current = setInterval(() => {
              document.title = isOriginal ? newTitle : originalTitle;
              isOriginal = !isOriginal;
            }, 1000);
          }
        } else if (totalUnreadCount === 0) {
          // Reset to original title if no unread messages
          document.title = originalTitle;
        }
      }
    },
    [originalTitle]
  );

  // Reset the page title to the original title
  const resetTitle = useCallback(() => {
    // Clear any existing interval
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }

    // Clear all unread messages
    unreadMessagesBySenderRef.current.clear();

    // Clear the counted messages set
    countedMessagesRef.current.clear();

    // Reset the title
    document.title = originalTitle;
  }, [originalTitle]);

  // Show browser notification
  const showNotification = useCallback(
    (message) => {
      try {
        if (!("Notification" in window)) {
          console.log("This browser does not support desktop notification");
          return;
        }

        // Find sender
        const sender = contacts.find(
          (contact) => contact.id === message.sender
        );

        // Check if sender is muted
        if (sender) {
          // Get muted contacts from localStorage
          const mutedContacts = JSON.parse(
            localStorage.getItem("mutedContacts") || "[]"
          );
          if (mutedContacts.includes(sender.id)) {
            console.log(`Notification from ${sender.name} muted`);
            return; // Skip notification for muted contact
          }
        }

        if (Notification.permission === "granted") {
          const senderName = sender ? sender.name : "Someone";

          // Create notification title based on urgency level
          let notificationTitle = "New message from " + senderName;
          if (message.urgencyLevel === "high") {
            notificationTitle = "🔶 HIGH PRIORITY: Message from " + senderName;
          } else if (message.urgencyLevel === "urgent") {
            notificationTitle = "🔴 URGENT: Message from " + senderName;
          } else if (message.urgencyLevel === "low") {
            notificationTitle = "🟢 Low priority: Message from " + senderName;
          }

          const notification = new Notification(notificationTitle, {
            body: message.text || "Sent you a file",
            icon: "/logo192.png",
            badge: "/logo192.png",
            tag: `message-${sender?.id || "unknown"}-${Date.now()}`,
            requireInteraction: true,
          });

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
    },
    [contacts, setSelectedContact]
  );

  // Search functionality
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Category management
  const [categories, setCategories] = useState([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryDropdownPosition, setCategoryDropdownPosition] = useState({
    top: 0,
    left: 0,
  });

  // Function to update department categories based on current contacts in conversations
  const updateDepartmentCategories = () => {
    try {
      // Get all contacts (including those removed from conversations)
      axios
        .get("/api/contacts", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        .then((response) => {
          const allContacts = response.data;

          // Get IDs of removed chats from localStorage
          const removedChats = JSON.parse(
            localStorage.getItem("removedChats") || "[]"
          );

          // Get contacts that are in conversations (not removed)
          const activeContacts = allContacts.filter(
            (contact) => !removedChats.includes(contact.id)
          );

          // Get all departments from active contacts
          const activeDepartments = new Set();
          activeContacts.forEach((contact) => {
            if (contact.department) {
              activeDepartments.add(contact.department);
            }
          });

          console.log("Active departments:", Array.from(activeDepartments));

          // Fetch updated categories from server
          axios
            .get("/api/categories", {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            })
            .then((categoriesResponse) => {
              // Filter out department categories that don't have active contacts
              const filteredCategories = categoriesResponse.data.filter(
                (category) => {
                  // Keep non-department categories
                  if (!category.isDepartmentCategory) return true;

                  // Only keep department categories that have active contacts
                  return activeDepartments.has(category.name);
                }
              );

              console.log("Filtered categories:", filteredCategories);
              setCategories(filteredCategories);
            });
        });
    } catch (error) {
      console.error("Error updating department categories:", error);
    }
  };

  // Call updateDepartmentCategories when contacts change
  useEffect(() => {
    updateDepartmentCategories();
  }, [contacts]);

  // Fetch categories, contacts, and all messages when component mounts
  useEffect(() => {
    // Check if we need to update department categories (flag set by ContactsPage)
    const needsUpdate =
      localStorage.getItem("updateDepartmentCategories") === "true";
    if (needsUpdate) {
      // Clear the flag
      localStorage.removeItem("updateDepartmentCategories");
    }

    const fetchData = async () => {
      try {
        // First fetch contacts
        const contactsResponse = await axios.get("/api/contacts", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        // Get IDs of removed chats from localStorage
        const removedChats = JSON.parse(
          localStorage.getItem("removedChats") || "[]"
        );

        // Get muted contacts from localStorage
        const mutedContacts = JSON.parse(
          localStorage.getItem("mutedContacts") || "[]"
        );

        // Filter out contacts with removed chats
        const filteredContacts = contactsResponse.data.filter(
          (contact) => !removedChats.includes(contact.id)
        );

        // Generate avatar colors for the contacts and load unread counts from localStorage
        const contactsWithAvatars = filteredContacts.map((contact) => {
          // Get unread count from localStorage
          const unreadKey = `unread_${contact.id}`;
          const unreadCount = parseInt(localStorage.getItem(unreadKey) || "0");

          return {
            ...contact,
            avatar: generateAvatar(contact.name),
            unreadCount: unreadCount,
            isMuted: mutedContacts.includes(contact.id),
          };
        });

        // Get all departments from active contacts
        const activeDepartments = new Set();
        filteredContacts.forEach((contact) => {
          if (contact.department) {
            activeDepartments.add(contact.department);
          }
        });

        console.log(
          "Active departments on mount:",
          Array.from(activeDepartments)
        );

        // Then fetch categories and filter them immediately
        const categoriesResponse = await axios.get("/api/categories", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        // Filter out department categories that don't have active contacts
        const filteredCategories = categoriesResponse.data.filter(
          (category) => {
            // Keep non-department categories
            if (!category.isDepartmentCategory) return true;

            // Only keep department categories that have active contacts
            return activeDepartments.has(category.name);
          }
        );

        console.log("Filtered categories on mount:", filteredCategories);
        setCategories(filteredCategories);

        // Set contacts after filtering categories
        setContacts(contactsWithAvatars);

        // Fetch all messages for all contacts to ensure proper sorting
        const allMessagesPromises = contactsWithAvatars.map(async (contact) => {
          try {
            const response = await axios.get(`/api/messages/${contact.id}`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            });
            return { contactId: contact.id, messages: response.data };
          } catch (error) {
            console.error(
              `Error fetching messages for contact ${contact.id}:`,
              error
            );
            return { contactId: contact.id, messages: [] };
          }
        });

        // Wait for all message requests to complete
        const allMessagesResults = await Promise.all(allMessagesPromises);

        // Create a new messages object with all fetched messages
        const allMessages = {};
        allMessagesResults.forEach((result) => {
          allMessages[result.contactId] = result.messages;
        });

        // Update the messages state with all fetched messages
        setMessages(allMessages);

        // Update contacts with lastMessageTime based on the latest message
        const updatedContacts = contactsWithAvatars.map((contact) => {
          const contactMessages = allMessages[contact.id] || [];
          if (contactMessages.length > 0) {
            const lastMessage = contactMessages[contactMessages.length - 1];
            return {
              ...contact,
              lastMessageTime: lastMessage.timestamp,
            };
          }
          return contact;
        });

        setContacts(updatedContacts);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Function to handle category changes
  const handleCategoryChange = async () => {
    try {
      const response = await axios.get("/api/categories", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Function to set a contact's category
  const setContactCategory = async (contactId, categoryId) => {
    try {
      console.log(
        "Setting category for contact:",
        contactId,
        "to category:",
        categoryId
      );

      const response = await axios.put(
        `/api/contacts/${contactId}/category`,
        { categoryId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      console.log("Category update response:", response.data);

      // Update the contact in the local state
      setContacts((prevContacts) => {
        const updatedContacts = prevContacts.map((contact) =>
          contact.id === contactId ? { ...contact, categoryId } : contact
        );

        console.log("Updated contacts:", updatedContacts);
        return updatedContacts;
      });

      // Close the dropdown
      setShowCategoryDropdown(null);

      // Force a refresh of the contacts list to ensure the category filter works
      setTimeout(() => {
        const fetchCategories = async () => {
          try {
            const response = await axios.get("/api/categories", {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            });
            setCategories(response.data);
          } catch (error) {
            console.error("Error refreshing categories:", error);
          }
        };

        fetchCategories();
      }, 500);
    } catch (error) {
      console.error("Error setting contact category:", error);
      alert("Failed to set category. Please try again.");
    }
  };

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

        const existingMessages = prevMessages[contactId] || [];

        // Enhanced duplicate detection for all messages
        const isDuplicate = existingMessages.some(
          (msg) =>
            // Check by ID (most reliable)
            msg.id === newMessage.id ||
            // Check by content, sender and timestamp proximity
            (msg.text === newMessage.text &&
              msg.sender === newMessage.sender &&
              Math.abs(
                new Date(msg.timestamp || 0) -
                  new Date(newMessage.timestamp || 0)
              ) < 1000)
        );

        if (isDuplicate) {
          console.log(
            "Duplicate message detected and prevented",
            newMessage.id
          );
          return prevMessages;
        }

        // Handle optimistic messages (our own messages)
        if (newMessage.sender === user.id) {
          // Check if we already have an optimistic version of this message
          const optimisticIndex = existingMessages.findIndex(
            (msg) =>
              msg._isOptimistic &&
              msg.text === newMessage.text &&
              Math.abs(
                new Date(msg.timestamp) - new Date(newMessage.timestamp)
              ) < 5000
          );

          if (optimisticIndex !== -1) {
            // Replace the optimistic message with the confirmed one
            const updatedMessages = [...existingMessages];
            updatedMessages[optimisticIndex] = {
              ...newMessage,
              id: newMessage.id || updatedMessages[optimisticIndex].id,
            };

            return {
              ...prevMessages,
              [contactId]: updatedMessages,
            };
          }

          // If we get here and it's our own message but no optimistic version found,
          // it might be a duplicate, so return without adding
          return prevMessages;
        }

        // Show notification if message is new and from someone else
        if (newMessage.sender !== user.id) {
          // Find sender info for notification
          const sender = contacts.find(
            (contact) => contact.id === newMessage.sender
          );
          const senderName = sender ? sender.name : "Someone";

          // Check if sender is muted
          const mutedContacts = JSON.parse(
            localStorage.getItem("mutedContacts") || "[]"
          );
          const isSenderMuted = sender && mutedContacts.includes(sender.id);

          // Only show notification and update title if sender is not muted
          if (!isSenderMuted) {
            // Show browser notification
            showNotification(newMessage);

            // Update page title with sender name and urgency level
            if (document.hidden) {
              let titleMessage = `New message from ${senderName}`;

              // Add urgency level to title
              if (newMessage.urgencyLevel === "high") {
                titleMessage = `HIGH PRIORITY: Message from ${senderName}`;
              } else if (newMessage.urgencyLevel === "urgent") {
                titleMessage = `URGENT: Message from ${senderName}`;
              } else if (newMessage.urgencyLevel === "low") {
                titleMessage = `Low priority: Message from ${senderName}`;
              }

              updateTitle(
                titleMessage,
                true,
                1,
                newMessage.sender,
                newMessage.id
              );
            }
          }

          // Increment unread count if the message is from someone else and not the selected contact
          // Use a flag to prevent double counting
          if (!newMessage._counted) {
            setContacts((prevContacts) => {
              return prevContacts.map((contact) => {
                if (
                  contact.id === contactId &&
                  (!selectedContact || selectedContact.id !== contactId)
                ) {
                  // Store unread count in localStorage to persist across page changes
                  const unreadKey = `unread_${contactId}`;
                  const currentUnread = parseInt(
                    localStorage.getItem(unreadKey) || "0"
                  );
                  localStorage.setItem(
                    unreadKey,
                    (currentUnread + 1).toString()
                  );

                  return {
                    ...contact,
                    lastMessageTime: newMessage.timestamp,
                    unreadCount: currentUnread + 1,
                  };
                } else if (contact.id === contactId) {
                  return {
                    ...contact,
                    lastMessageTime: newMessage.timestamp,
                  };
                }
                return contact;
              });
            });
            // Mark this message as counted to prevent double counting
            newMessage._counted = true;
          }
        } else {
          // Update the contact's lastMessageTime to move it to the top for our own messages
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
        }

        // For messages from other users, add them to the state
        // Ensure fileData is properly set for rendering
        if (newMessage.fileUrl) {
          // For received messages, ensure the URL is absolute
          const baseUrl = window.location.origin;

          // If the URL is relative (starts with /), make it absolute
          if (newMessage.fileUrl.startsWith("/")) {
            newMessage.fileUrl = `${baseUrl}${newMessage.fileUrl}`;
          }

          // Set fileData to the same URL for rendering
          newMessage.fileData = newMessage.fileUrl;

          console.log("File URL processed:", {
            original: newMessage.fileUrl,
            processed: newMessage.fileData,
          });
        }

        // For debugging
        if (newMessage.fileUrl || newMessage.fileData) {
          console.log("Message contains file:", {
            fileUrl: newMessage.fileUrl ? newMessage.fileUrl : "No",
            fileData: newMessage.fileData ? newMessage.fileData : "No",
            fileType: newMessage.fileType,
          });
        }

        // Create a new array with the updated messages
        return {
          ...prevMessages,
          [contactId]: [...(prevMessages[contactId] || []), newMessage],
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

    // Listen for message edits
    socket.on("message_edited", (editedMessage) => {
      if (!editedMessage?.id) return;

      setMessages((prevMessages) => {
        const contactId =
          editedMessage.sender === user.id
            ? editedMessage.receiver
            : editedMessage.sender;

        const contactMessages = prevMessages[contactId] || [];

        return {
          ...prevMessages,
          [contactId]: contactMessages.map((msg) =>
            msg.id === editedMessage.id
              ? { ...msg, text: editedMessage.text, isEdited: true }
              : msg
          ),
        };
      });
    });

    // Listen for message deletions
    socket.on("message_deleted", (deletedMessage) => {
      if (!deletedMessage?.id) return;

      setMessages((prevMessages) => {
        const contactId =
          deletedMessage.sender === user.id
            ? deletedMessage.receiver
            : deletedMessage.sender;

        const contactMessages = prevMessages[contactId] || [];

        return {
          ...prevMessages,
          [contactId]: contactMessages.map((msg) =>
            msg.id === deletedMessage.id
              ? { ...msg, isDeleted: true, text: "This message was deleted" }
              : msg
          ),
        };
      });
    });

    // Clean up listeners on unmount
    return () => {
      socket.off("receive_message");
      socket.off("user_status");
      socket.off("message_edited");
      socket.off("message_deleted");
    };
  }, [socket, user, contacts, selectedContact, showNotification, updateTitle]);

  // Handle delete chat
  const handleDeleteChat = (e, contact) => {
    e.stopPropagation(); // Prevent contact selection when clicking delete
    setContactToDelete(contact);
    setShowDeleteConfirm(true);
  };

  // Confirm delete chat
  const confirmDeleteChat = async () => {
    if (contactToDelete) {
      try {
        // We're not deleting the contact from the database anymore, just removing from conversations

        // Delete messages for this contact locally
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

          // Check if we need to remove any department categories
          updateDepartmentCategories();
        }
      } catch (error) {
        console.error("Error removing conversation:", error);
        alert("Failed to remove conversation. Please try again.");
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

  // Initialize notification state from localStorage and listen for changes
  useEffect(() => {
    // Check if we have a stored notification state
    const storedNotificationsSeen = localStorage.getItem("notificationsSeen");
    if (storedNotificationsSeen === "true") {
      notificationsSeenRef.current = true;
    } else {
      notificationsSeenRef.current = false;
    }

    console.log(
      "Initial notifications seen state:",
      notificationsSeenRef.current
    );

    // Listen for storage events from other tabs
    const handleStorageChange = (e) => {
      if (e.key === "notificationsSeen") {
        console.log(
          "Notification seen state changed in another tab:",
          e.newValue
        );
        notificationsSeenRef.current = e.newValue === "true";

        // If notifications were marked as seen, reset the title
        if (e.newValue === "true") {
          // Clear all unread messages
          unreadMessagesBySenderRef.current.clear();

          // Clear the counted messages set
          countedMessagesRef.current.clear();

          // Reset the title to original
          document.title = originalTitle;

          // Clear any existing interval
          if (titleIntervalRef.current) {
            clearInterval(titleIntervalRef.current);
            titleIntervalRef.current = null;
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [originalTitle]);

  // Request notification permission on component mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }

    // Setup visibility change listener to reset title when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When the user clicks on the tab, completely reset all notifications

        // Clear all unread messages
        unreadMessagesBySenderRef.current.clear();

        // Clear the counted messages set
        countedMessagesRef.current.clear();

        // Mark notifications as seen
        notificationsSeenRef.current = true;

        // Reset the title to original
        document.title = originalTitle;

        // Clear any existing interval
        if (titleIntervalRef.current) {
          clearInterval(titleIntervalRef.current);
          titleIntervalRef.current = null;
        }

        // Store the seen state in localStorage to persist across tabs
        localStorage.setItem("notificationsSeen", "true");

        console.log("Notifications marked as seen");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Clear any interval when component unmounts
      if (titleIntervalRef.current) {
        clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
      }
    };
  }, [resetTitle, originalTitle, selectedContact]);

  // Handle window resize to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 769);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle department categories scrolling and hover effects
  useEffect(() => {
    // Create a reference to the ResizeObserver that we can access in the cleanup function
    let resizeObserver;

    // Wait for DOM to be fully rendered
    setTimeout(() => {
      // Get scroll buttons and containers
      const deptScrollLeftBtn = document.querySelector(
        ".department-categories-scroll-container .scroll-left-btn"
      );
      const deptScrollRightBtn = document.querySelector(
        ".department-categories-scroll-container .scroll-right-btn"
      );
      const deptScrollContainer = document.querySelector(
        ".department-categories-scroll-content"
      );

      const userScrollLeftBtn = document.querySelector(
        ".user-categories-scroll-container .scroll-left-btn"
      );
      const userScrollRightBtn = document.querySelector(
        ".user-categories-scroll-container .scroll-right-btn"
      );
      const userScrollContainer = document.querySelector(
        ".user-categories-scroll-content"
      );

      // Function to check if scrolling is needed
      function checkScrollNeeded(container, leftBtn, rightBtn) {
        if (!container || !leftBtn || !rightBtn) return;

        // Check if content width is greater than container width
        const isScrollNeeded = container.scrollWidth > container.clientWidth;

        // Add or remove the 'scrollable' class based on whether scrolling is needed
        if (isScrollNeeded) {
          container.parentNode.classList.add("scrollable");
        } else {
          container.parentNode.classList.remove("scrollable");
        }
      }

      // Define scroll functions
      function scrollLeftDept() {
        if (deptScrollContainer) {
          deptScrollContainer.scrollBy({ left: -80, behavior: "smooth" });
        }
      }

      function scrollRightDept() {
        if (deptScrollContainer) {
          deptScrollContainer.scrollBy({ left: 80, behavior: "smooth" });
        }
      }

      function scrollLeftUser() {
        if (userScrollContainer) {
          userScrollContainer.scrollBy({ left: -80, behavior: "smooth" });
        }
      }

      function scrollRightUser() {
        if (userScrollContainer) {
          userScrollContainer.scrollBy({ left: 80, behavior: "smooth" });
        }
      }

      // Add event listeners for department categories
      if (deptScrollLeftBtn && deptScrollContainer) {
        deptScrollLeftBtn.onclick = scrollLeftDept;
      }

      if (deptScrollRightBtn && deptScrollContainer) {
        deptScrollRightBtn.onclick = scrollRightDept;
      }

      // Add event listeners for user categories
      if (userScrollLeftBtn && userScrollContainer) {
        userScrollLeftBtn.onclick = scrollLeftUser;
      }

      if (userScrollRightBtn && userScrollContainer) {
        userScrollRightBtn.onclick = scrollRightUser;
      }

      // Check if scrolling is needed initially
      checkScrollNeeded(
        deptScrollContainer,
        deptScrollLeftBtn,
        deptScrollRightBtn
      );
      checkScrollNeeded(
        userScrollContainer,
        userScrollLeftBtn,
        userScrollRightBtn
      );

      // Add resize observer to check when content changes
      resizeObserver = new ResizeObserver(() => {
        checkScrollNeeded(
          deptScrollContainer,
          deptScrollLeftBtn,
          deptScrollRightBtn
        );
        checkScrollNeeded(
          userScrollContainer,
          userScrollLeftBtn,
          userScrollRightBtn
        );
      });

      if (deptScrollContainer) resizeObserver.observe(deptScrollContainer);
      if (userScrollContainer) resizeObserver.observe(userScrollContainer);

      // Add hover effect with category color for all category items
      const allCategoryItems = document.querySelectorAll(
        ".department-category, .user-categories-scroll-content .category-filter-item"
      );

      allCategoryItems.forEach((category) => {
        const colorElement = category.querySelector(".category-filter-color");
        if (colorElement) {
          const color = window.getComputedStyle(colorElement).backgroundColor;

          // Add mouseenter event to set the glow color
          category.addEventListener("mouseenter", () => {
            // Extract RGB values and create a more vibrant glow color
            const rgbValues = color.match(/\d+/g);
            if (rgbValues && rgbValues.length >= 3) {
              const glowColor = `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, 0.7)`;
              category.style.setProperty("--hover-glow-color", glowColor);
            } else {
              category.style.setProperty("--hover-glow-color", color);
            }
          });
        }
      });

      // Set glow color for "All" button
      const allButton = document.querySelector(".all-filter-item");
      if (allButton) {
        allButton.addEventListener("mouseenter", () => {
          allButton.style.setProperty(
            "--hover-glow-color",
            "rgba(74, 118, 168, 0.7)"
          );
        });
      }

      // Log for debugging
      console.log("Scroll buttons initialized:", {
        deptLeft: deptScrollLeftBtn,
        deptRight: deptScrollRightBtn,
        userLeft: userScrollLeftBtn,
        userRight: userScrollRightBtn,
      });
    }, 500); // Wait 500ms for DOM to be ready

    // Clean up
    return () => {
      const deptScrollLeftBtn = document.querySelector(
        ".department-categories-scroll-container .scroll-left-btn"
      );
      const deptScrollRightBtn = document.querySelector(
        ".department-categories-scroll-container .scroll-right-btn"
      );
      const userScrollLeftBtn = document.querySelector(
        ".user-categories-scroll-container .scroll-left-btn"
      );
      const userScrollRightBtn = document.querySelector(
        ".user-categories-scroll-container .scroll-right-btn"
      );

      // Remove event listeners
      if (deptScrollLeftBtn) deptScrollLeftBtn.onclick = null;
      if (deptScrollRightBtn) deptScrollRightBtn.onclick = null;
      if (userScrollLeftBtn) userScrollLeftBtn.onclick = null;
      if (userScrollRightBtn) userScrollRightBtn.onclick = null;

      // Disconnect resize observer if it exists
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      // Remove hover event listeners
      const allCategoryItems = document.querySelectorAll(
        ".department-category, .user-categories-scroll-content .category-filter-item"
      );
      allCategoryItems.forEach((category) => {
        category.removeEventListener("mouseenter", () => {});
      });

      // Remove All button event listener
      const allButton = document.querySelector(".all-filter-item");
      if (allButton) {
        allButton.removeEventListener("mouseenter", () => {});
      }
    };
  }, [categories]); // Re-run when categories change

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

    // For mobile view, add a class to hide contacts list and show chat area
    if (window.innerWidth < 576) {
      const contactsList = document.querySelector(".contacts-list");
      const chatArea = document.querySelector(".chat-area");

      if (contactsList && chatArea) {
        contactsList.classList.add("mobile-hidden");
        chatArea.classList.add("mobile-visible");
      }
    }

    // Reset unread count when selecting a contact
    if (contact.unreadCount) {
      // Clear the unread count in localStorage as well
      const unreadKey = `unread_${contact.id}`;
      localStorage.setItem(unreadKey, "0");

      setContacts((prevContacts) => {
        return prevContacts.map((c) => {
          if (c.id === contact.id) {
            return {
              ...c,
              unreadCount: 0,
            };
          }
          return c;
        });
      });
    }
  };

  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size before uploading
    const maxSize = file.type.startsWith("image/")
      ? 5 * 1024 * 1024 // 5MB for images
      : 25 * 1024 * 1024; // 25MB for other files

    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      alert(`File size exceeds the maximum allowed size of ${maxSizeMB}MB.`);
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);

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

    // Upload the file immediately to the server
    uploadFile(file);
  };

  const uploadFile = async (file) => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", file);

      // Add conversation ID if we have a selected contact
      if (selectedContact) {
        const conversationId = `dm_${Math.min(
          user.id,
          selectedContact.id
        )}_${Math.max(user.id, selectedContact.id)}`;
        formData.append("conversation_id", conversationId);
      }

      // Upload the file
      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Update the file preview with the server URL
      if (response.data && response.data.fileUrl) {
        setSelectedFile({
          ...file,
          url: response.data.fileUrl,
          uploaded: true,
        });
      }

      setIsUploading(false);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
      cancelFileUpload();
      setIsUploading(false);
    }
  };

  const cancelFileUpload = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

    // Check if we have an uploaded file
    if (selectedFile && selectedFile.uploaded) {
      fileUrl = selectedFile.url;
      fileType = selectedFile.type;
      fileName = selectedFile.name;
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
      _isOptimistic: true, // Flag to identify optimistic messages
      encrypted: encryptionEnabled,
      urgencyLevel: messageUrgency,
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

    try {
      // Encrypt the message if encryption is enabled
      let messageData = {
        token: localStorage.getItem("token"),
        receiverId: selectedContact.id,
        text: message,
        fileUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
        urgencyLevel: messageUrgency,
      };

      if (encryptionEnabled) {
        // Encrypt the message
        const encryptedMessage = await encrypt(message, selectedContact.id);

        if (encryptedMessage.encrypted) {
          // Add encryption data to the message
          messageData = {
            ...messageData,
            encrypted: true,
            encryptedData: encryptedMessage.encryptedData,
            iv: encryptedMessage.iv,
          };
        }
      }

      // Send message via Socket.IO
      socket.emit("send_message", messageData);

      console.log("Message sent successfully:", {
        hasFile: fileUrl ? true : false,
        textLength: message.length,
        encrypted: messageData.encrypted || false,
      });

      // Reset file selection
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }

    setMessage("");
    setIsUploading(false);
    setMessageUrgency("normal");

    // Close any open UI elements
    setShowEmojiPicker(false);

    // Close urgency selector dropdown if it's open
    if (urgencySelectorRef.current) {
      urgencySelectorRef.current.closeDropdown();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Search messages functionality
  const handleSearchMessages = async (searchText) => {
    setSearchQuery(searchText);

    if (
      !searchText.trim() ||
      !selectedContact ||
      !messages[selectedContact.id]
    ) {
      // Clear search results if search text is empty or no messages
      setSearchResults([]);
      setCurrentSearchIndex(0);

      // Update UI elements
      const searchNav = document.getElementById("search-navigation");
      const searchCount = document.getElementById("search-current");
      const searchTotal = document.getElementById("search-total");
      const prevButton = document.getElementById("search-prev");
      const nextButton = document.getElementById("search-next");
      const searchResultsList = document.getElementById("search-results-list");

      if (searchNav) searchNav.classList.remove("active");
      if (searchCount) searchCount.textContent = "0";
      if (searchTotal) searchTotal.textContent = "0";
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = true;
      if (searchResultsList) searchResultsList.classList.remove("active");

      // Remove all highlights
      document.querySelectorAll(".search-highlight").forEach((el) => {
        el.classList.remove("search-highlight");
        el.classList.remove("current-highlight");
      });

      return;
    }

    try {
      // Try to use the backend search API first
      const response = await axios
        .get(
          `/api/messages/${
            selectedContact.id
          }/search?query=${encodeURIComponent(searchText)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        )
        .catch(() => ({ data: { results: [] } })); // Fallback if API fails

      let results = [];

      // If backend search returned results, use them
      if (
        response.data &&
        response.data.results &&
        response.data.results.length > 0
      ) {
        results = response.data.results.map((msg, index) => ({
          index,
          messageId: msg.id,
          text: msg.text,
          timestamp: msg.timestamp,
          sender: msg.sender,
        }));
      } else {
        // Fallback to client-side search
        const contactMessages = messages[selectedContact.id];
        contactMessages.forEach((msg, index) => {
          if (
            msg.text &&
            msg.text.toLowerCase().includes(searchText.toLowerCase())
          ) {
            results.push({
              index,
              messageId: msg.id,
              text: msg.text,
              timestamp: msg.timestamp,
              sender: msg.sender,
            });
          }
        });
      }

      setSearchResults(results);

      // Update UI elements
      const searchNav = document.getElementById("search-navigation");
      const searchCount = document.getElementById("search-current");
      const searchTotal = document.getElementById("search-total");
      const prevButton = document.getElementById("search-prev");
      const nextButton = document.getElementById("search-next");
      const searchResultsList = document.getElementById("search-results-list");

      if (searchNav) searchNav.classList.add("active");
      if (searchCount) searchCount.textContent = results.length > 0 ? "1" : "0";
      if (searchTotal) searchTotal.textContent = results.length.toString();
      if (prevButton) prevButton.disabled = results.length <= 1;
      if (nextButton) nextButton.disabled = results.length <= 1;
      if (searchResultsList) searchResultsList.classList.add("active");

      // Reset current index and highlight first result
      if (results.length > 0) {
        setCurrentSearchIndex(0);
        // Use a small delay to ensure the DOM is updated
        setTimeout(() => {
          highlightSearchResult(0, results);
        }, 300);
      }
    } catch (error) {
      console.error("Error searching messages:", error);

      // Fallback to client-side search if API fails
      const results = [];
      const contactMessages = messages[selectedContact.id];

      contactMessages.forEach((msg, index) => {
        if (
          msg.text &&
          msg.text.toLowerCase().includes(searchText.toLowerCase())
        ) {
          results.push({
            index,
            messageId: msg.id,
            text: msg.text,
            timestamp: msg.timestamp,
            sender: msg.sender || user.id,
          });
        }
      });

      setSearchResults(results);

      // Update UI elements
      const searchNav = document.getElementById("search-navigation");
      const searchCount = document.getElementById("search-current");
      const searchTotal = document.getElementById("search-total");
      const prevButton = document.getElementById("search-prev");
      const nextButton = document.getElementById("search-next");
      const searchResultsList = document.getElementById("search-results-list");

      if (searchNav) searchNav.classList.add("active");
      if (searchCount) searchCount.textContent = results.length > 0 ? "1" : "0";
      if (searchTotal) searchTotal.textContent = results.length.toString();
      if (prevButton) prevButton.disabled = results.length <= 1;
      if (nextButton) nextButton.disabled = results.length <= 1;
      if (searchResultsList) searchResultsList.classList.add("active");

      // Reset current index and highlight first result
      if (results.length > 0) {
        setCurrentSearchIndex(0);
        // Use a small delay to ensure the DOM is updated
        setTimeout(() => {
          highlightSearchResult(0, results);
        }, 300);
      }
    }
  };

  // Navigate between search results
  const navigateSearchResults = (direction) => {
    if (searchResults.length === 0) return;

    let newIndex;
    if (direction === "next") {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex =
        (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }

    setCurrentSearchIndex(newIndex);
    highlightSearchResult(newIndex, searchResults);

    // Update current result counter
    const searchCount = document.getElementById("search-current");
    if (searchCount) searchCount.textContent = (newIndex + 1).toString();
  };

  // Highlight a specific search result and scroll to it
  const highlightSearchResult = (index, results) => {
    if (
      !results ||
      results.length === 0 ||
      index < 0 ||
      index >= results.length
    )
      return;

    // Remove all highlights first
    document.querySelectorAll(".search-highlight").forEach((el) => {
      el.classList.remove("search-highlight");
      el.classList.remove("current-highlight");
    });

    // Find all message elements
    const messageElements = document.querySelectorAll(".message");

    if (messageElements.length === 0) {
      console.log("No message elements found, retrying in 500ms");
      setTimeout(() => highlightSearchResult(index, results), 500);
      return;
    }

    // Get the current result we want to highlight
    const currentResult = results[index];
    if (!currentResult || !currentResult.messageId) {
      console.log("Invalid search result", currentResult);
      return;
    }

    // Find the specific message element by ID
    let targetMessageEl = null;

    console.log("Looking for message with ID:", currentResult.messageId);
    console.log("Message text to find:", currentResult.text);

    // First try to find by exact message ID match
    messageElements.forEach((el) => {
      const msgId = el.getAttribute("data-message-id");
      if (msgId === currentResult.messageId) {
        console.log("Found message by ID match:", msgId);
        targetMessageEl = el;
      }
    });

    // If not found by ID, try to find by exact text content match
    if (!targetMessageEl) {
      messageElements.forEach((el) => {
        const messageText = el.querySelector(".message-text")?.textContent;
        if (messageText && messageText === currentResult.text) {
          console.log("Found message by exact text match");
          targetMessageEl = el;
        }
      });
    }

    // If not found by exact text, try to find by partial text content match
    if (!targetMessageEl) {
      messageElements.forEach((el) => {
        const messageText = el.querySelector(".message-text")?.textContent;
        if (messageText && messageText.includes(currentResult.text)) {
          console.log("Found message by partial text match");
          targetMessageEl = el;
        }
      });
    }

    // If still not found, try to find by index as last resort
    if (!targetMessageEl && typeof currentResult.index === "number") {
      if (messageElements[currentResult.index]) {
        console.log("Found message by index:", currentResult.index);
        targetMessageEl = messageElements[currentResult.index];
      }
    }

    if (targetMessageEl) {
      // Add highlight class to the found message
      targetMessageEl.classList.add("search-highlight");
      targetMessageEl.classList.add("current-highlight");

      // Scroll the message into view with smooth animation
      setTimeout(() => {
        targetMessageEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
    } else {
      console.log("Target message element not found, retrying in 500ms");
      setTimeout(() => highlightSearchResult(index, results), 500);
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage((prevMessage) => prevMessage + emojiObject.emoji);
    // Don't close the emoji picker after selecting an emoji
    // This allows selecting multiple emojis without reopening the picker
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showEmojiPicker &&
        !event.target.closest(".emoji-picker-container") &&
        !event.target.closest(".emoji-button")
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.email &&
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort contacts by urgency level first, then by most recent message timestamp
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    // First check if contacts have lastMessageTime property (from new messages)
    const aLastMessageTime = a.lastMessageTime
      ? new Date(a.lastMessageTime).getTime()
      : 0;
    const bLastMessageTime = b.lastMessageTime
      ? new Date(b.lastMessageTime).getTime()
      : 0;

    // Get the latest message for each contact
    const aLastMessage =
      messages[a.id]?.length > 0
        ? messages[a.id][messages[a.id].length - 1]
        : null;
    const bLastMessage =
      messages[b.id]?.length > 0
        ? messages[b.id][messages[b.id].length - 1]
        : null;

    // Get urgency levels (if any)
    const aUrgencyLevel = aLastMessage?.urgencyLevel || "normal";
    const bUrgencyLevel = bLastMessage?.urgencyLevel || "normal";

    // Define urgency priority (higher number = higher priority)
    const urgencyPriority = {
      urgent: 3,
      high: 2,
      normal: 1,
      low: 0,
    };

    // First sort by urgency level
    const urgencyDiff =
      urgencyPriority[bUrgencyLevel] - urgencyPriority[aUrgencyLevel];
    if (urgencyDiff !== 0) {
      return urgencyDiff; // Sort by urgency level first
    }

    // If urgency levels are the same, sort by timestamp
    // Use lastMessageTime if available, otherwise use message timestamp
    const aTimestamp =
      aLastMessageTime ||
      (aLastMessage?.timestamp
        ? new Date(aLastMessage.timestamp).getTime()
        : 0);
    const bTimestamp =
      bLastMessageTime ||
      (bLastMessage?.timestamp
        ? new Date(bLastMessage.timestamp).getTime()
        : 0);

    // Sort in descending order (newest first)
    return bTimestamp - aTimestamp;
  });

  // Render file content based on type
  const renderFileContent = (msg) => {
    if (!msg.fileUrl && !msg.fileData) return null;

    // Use fileUrl as the primary source
    let fileSource = msg.fileUrl;

    // If fileUrl is not available, fall back to fileData
    if (!fileSource) {
      fileSource = msg.fileData;
    }

    if (!fileSource) {
      console.error("Missing file source for message:", msg.id);
      return <div className="file-error">File could not be displayed</div>;
    }

    // Ensure the URL is absolute
    if (fileSource.startsWith("/")) {
      const baseUrl = window.location.origin;
      fileSource = `${baseUrl}${fileSource}`;
      console.log("Converted relative URL to absolute:", fileSource);
    }

    // Add a cache-busting parameter to prevent browser caching issues
    if (!fileSource.includes("?")) {
      fileSource = `${fileSource}?t=${new Date().getTime()}`;
      console.log("Added cache-busting parameter:", fileSource);
    }

    console.log(
      "Rendering file with source:",
      fileSource,
      "type:",
      msg.fileType,
      "message:",
      msg
    );

    try {
      if (
        msg.messageType === "image" ||
        (msg.fileType && msg.fileType.startsWith("image/"))
      ) {
        // For images, we can't use useState here since this isn't a component
        // Instead, use a simpler approach
        return (
          <div className="message-image-container">
            <div className="image-loading">Loading image...</div>
            <img
              src={fileSource}
              alt="Sent image"
              className="message-image"
              onClick={() => window.open(fileSource, "_blank")}
              onLoad={(e) => {
                console.log("Image loaded successfully:", fileSource);
                // Hide the loading indicator when image loads
                const loadingEl =
                  e.target.parentNode.querySelector(".image-loading");
                if (loadingEl) loadingEl.style.display = "none";
                // Show the image
                e.target.style.display = "block";
              }}
              onError={(e) => {
                console.error("Image failed to load:", e, fileSource);
                // Hide the loading indicator
                const loadingEl =
                  e.target.parentNode.querySelector(".image-loading");
                if (loadingEl) loadingEl.textContent = "Image failed to load";

                // Try to reload the image with a different URL format
                if (!e.target.retryAttempted) {
                  e.target.retryAttempted = true;

                  // Try with a different cache-busting approach
                  const retryUrl =
                    fileSource.split("?")[0] + "?nocache=" + Math.random();
                  console.log("Retrying with URL:", retryUrl);
                  e.target.src = retryUrl;
                } else {
                  // If retry failed, show placeholder
                  e.target.src = "/placeholder-image.png";
                  e.target.alt = "Image failed to load";
                  e.target.style.display = "block";
                }
              }}
              style={{ display: "none" }} // Initially hidden until loaded
            />
          </div>
        );
      } else if (
        msg.messageType === "video" ||
        (msg.fileType && msg.fileType.startsWith("video/"))
      ) {
        return (
          <div className="message-video-container">
            <video
              src={fileSource}
              controls
              className="message-video"
              onError={(e) => {
                console.error("Video failed to load:", e, fileSource);
                e.target.parentNode.innerHTML =
                  '<div class="video-error">Video could not be played</div>';
              }}
            />
          </div>
        );
      } else if (msg.messageType === "file" || fileSource || msg.fileName) {
        // For other file types
        return (
          <div
            className="message-file-container"
            onClick={() => fileSource && window.open(fileSource, "_blank")}
          >
            <i className="far fa-file-alt"></i>
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

  // Handle message options menu
  const handleMessageOptions = (e, msg) => {
    e.stopPropagation();
    // Close any other open options first
    setShowMessageOptions(null);
    // Use setTimeout to ensure state is updated before opening new options
    setTimeout(() => {
      setShowMessageOptions(msg.id);
    }, 10);
  };

  // Close message options when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMessageOptions(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Handle edit message
  const handleEditMessage = (msg) => {
    // First close the options menu
    setShowMessageOptions(null);

    // Use setTimeout to ensure state updates in the correct order
    setTimeout(() => {
      setMessageToEdit(msg);
      setEditedMessageText(msg.text);
    }, 10);
  };

  // Save edited message
  const saveEditedMessage = () => {
    if (!messageToEdit || !editedMessageText.trim()) return;

    // Update message locally first (optimistic update)
    setMessages((prevMessages) => {
      const contactId = messageToEdit.receiver;
      const contactMessages = prevMessages[contactId] || [];

      return {
        ...prevMessages,
        [contactId]: contactMessages.map((msg) =>
          msg.id === messageToEdit.id
            ? { ...msg, text: editedMessageText, isEdited: true }
            : msg
        ),
      };
    });

    // Send update to server via socket
    if (socket) {
      socket.emit("edit_message", {
        token: localStorage.getItem("token"),
        messageId: messageToEdit.id,
        text: editedMessageText,
      });
    }

    // Reset edit state
    setMessageToEdit(null);
    setEditedMessageText("");
  };

  // Cancel edit
  const cancelEdit = () => {
    setMessageToEdit(null);
    setEditedMessageText("");
  };

  // Handle delete message confirmation
  const handleDeleteMessageConfirm = (msg) => {
    // First close the options menu
    setShowMessageOptions(null);

    // Use setTimeout to ensure state updates in the correct order
    setTimeout(() => {
      setMessageToDelete(msg);
      setShowDeleteMessageConfirm(true);
    }, 10);
  };

  // Delete message
  const deleteMessage = () => {
    if (!messageToDelete) return;

    // Update message locally first (optimistic update)
    setMessages((prevMessages) => {
      const contactId = messageToDelete.receiver;
      const contactMessages = prevMessages[contactId] || [];

      return {
        ...prevMessages,
        [contactId]: contactMessages.map((msg) =>
          msg.id === messageToDelete.id
            ? { ...msg, isDeleted: true, text: "This message was deleted" }
            : msg
        ),
      };
    });

    // Send delete to server via socket
    if (socket) {
      socket.emit("delete_message", {
        token: localStorage.getItem("token"),
        messageId: messageToDelete.id,
      });
    }

    // Reset delete state
    setShowDeleteMessageConfirm(false);
    setMessageToDelete(null);
  };

  // Cancel delete
  const cancelDeleteMessage = () => {
    setShowDeleteMessageConfirm(false);
    setMessageToDelete(null);
  };

  // Handle delete messages
  const handleDeleteMessages = async () => {
    if (!selectedContact) return;

    try {
      // Make an API call to delete messages on the server
      await axios.delete(`/api/messages/${selectedContact.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Clear messages for current contact locally
      setMessages((prev) => ({
        ...prev,
        [selectedContact.id]: [],
      }));

      setShowDeleteMessagesConfirm(false);
    } catch (error) {
      console.error("Error deleting messages:", error);
      alert("Error deleting messages. Please try again.");
    }
  };

  return (
    <div className="messaging-container">
      <div
        className={`contacts-list ${
          isMobileView && selectedContact ? "mobile-hidden" : ""
        }`}
      >
        <div className="contacts-header">
          <h2>Conversations</h2>
          <div className="category-button-container">
            <button
              className="category-filter-button"
              onClick={() => setShowCategoryManager(true)}
              title="Manage Categories"
            >
              <i className="fas fa-layer-group"></i>
            </button>
          </div>
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

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="category-filter-wrapper">
            <div className="category-filter-sections">
              {/* Department categories section */}
              {categories.some((c) => c.isDepartmentCategory) && (
                <div className="category-filter-section">
                  <div className="category-section-label">Departments</div>
                  <div className="department-categories-scroll-container">
                    <button className="scroll-left-btn dept-scroll-btn">
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <div className="department-categories-scroll-content">
                      {/* All button as first item */}
                      <div
                        className={`category-filter-item all-filter-item ${
                          selectedCategory === null ? "active" : ""
                        }`}
                        style={
                          selectedCategory === null
                            ? {
                                backgroundColor: "#4A76A8",
                                color: "white",
                                minWidth: "fit-content",
                              }
                            : {
                                borderColor: "#4A76A8",
                                minWidth: "fit-content",
                              }
                        }
                        onClick={() => setSelectedCategory(null)}
                        title="Show all conversations"
                      >
                        <span className="category-filter-name">All</span>
                      </div>

                      {/* Department categories */}
                      {categories
                        .filter((category) => category.isDepartmentCategory)
                        .map((category) => (
                          <div
                            key={category.id}
                            className={`category-filter-item department-category ${
                              selectedCategory === category.id ? "active" : ""
                            }`}
                            style={
                              selectedCategory === category.id
                                ? {
                                    backgroundColor: category.color,
                                    color: "white",
                                    minWidth: "fit-content",
                                  }
                                : {
                                    borderColor: category.color,
                                    minWidth: "fit-content",
                                  }
                            }
                            onClick={() => setSelectedCategory(category.id)}
                            title={`${category.name} Department`}
                          >
                            <div
                              className="category-filter-color"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <span className="category-filter-name">
                              {category.name}
                            </span>
                            <span className="category-filter-badge">
                              Department
                            </span>
                          </div>
                        ))}
                    </div>
                    <button className="scroll-right-btn dept-scroll-btn">
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* Real divider line */}
              {categories.some((c) => c.isDepartmentCategory) &&
                categories.some((c) => !c.isDepartmentCategory) && (
                  <hr className="category-filter-hr" />
                )}

              {/* Custom categories section */}
              {categories.some((c) => !c.isDepartmentCategory) && (
                <div className="category-filter-section">
                  <div className="category-section-label">
                    Custom Categories
                  </div>
                  <div className="user-categories-scroll-container">
                    <button className="scroll-left-btn user-scroll-btn">
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <div className="user-categories-scroll-content">
                      {/* All button for custom categories */}
                      <div
                        className={`category-filter-item all-filter-item custom-all-filter-item ${
                          selectedCategory === null ? "active" : ""
                        }`}
                        style={
                          selectedCategory === null
                            ? {
                                backgroundColor: "#4A76A8",
                                color: "white",
                                borderColor: "#4A76A8",
                                minWidth: "fit-content",
                              }
                            : {
                                borderColor: "#4A76A8",
                                minWidth: "fit-content",
                              }
                        }
                        onClick={() => setSelectedCategory(null)}
                        title="Show all conversations"
                      >
                        <span className="category-filter-name">All</span>
                      </div>

                      {categories
                        .filter((category) => !category.isDepartmentCategory)
                        .map((category) => (
                          <div
                            key={category.id}
                            className={`category-filter-item ${
                              selectedCategory === category.id ? "active" : ""
                            }`}
                            style={
                              selectedCategory === category.id
                                ? {
                                    backgroundColor: category.color,
                                    color: "white",
                                  }
                                : { borderColor: category.color }
                            }
                            onClick={() => setSelectedCategory(category.id)}
                          >
                            <div
                              className="category-filter-color"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <span className="category-filter-name">
                              {category.name}
                            </span>
                          </div>
                        ))}
                    </div>
                    <button className="scroll-right-btn user-scroll-btn">
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="contacts-items">
          {sortedContacts
            .filter(
              (contact) =>
                selectedCategory === null ||
                contact.categoryId === selectedCategory
            )
            .map((contact) => (
              <div
                key={contact.id}
                className={`contact-item ${
                  selectedContact && selectedContact.id === contact.id
                    ? "active"
                    : ""
                }`}
                onClick={() => handleContactSelect(contact)}
              >
                <div className="contact-avatar-wrapper">
                  <div
                    className="contact-avatar"
                    style={{ backgroundColor: contact.avatar }}
                  >
                    {contact.name.charAt(0)}
                  </div>
                  <div
                    className={`contact-status ${
                      contact.isActive ? "active" : ""
                    }`}
                  ></div>
                </div>
                <div className="contact-info">
                  <div className="contact-name-row">
                    <div className="contact-name">{contact.name}</div>
                    {contact.categoryId && (
                      <div className="contact-category-badge">
                        <div
                          className="contact-category-indicator"
                          style={{
                            backgroundColor:
                              categories.find(
                                (c) => c.id === contact.categoryId
                              )?.color || "#ccc",
                          }}
                        ></div>
                        <span className="contact-category-name">
                          {categories.find((c) => c.id === contact.categoryId)
                            ?.name || "Category"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="contact-last-message">
                    {messages[contact.id]?.length > 0 ? (
                      <div className="last-message-content">
                        {/* Get the last message */}
                        {(() => {
                          const lastMessage =
                            messages[contact.id][
                              messages[contact.id].length - 1
                            ];

                          // Show urgency prefix for non-normal urgency levels, but only for receivers
                          return (
                            <>
                              {lastMessage.urgencyLevel === "urgent" &&
                                lastMessage.sender !== user?.id && (
                                  <span className="urgency-prefix urgent">
                                    URGENT:{" "}
                                  </span>
                                )}
                              {lastMessage.urgencyLevel === "high" &&
                                lastMessage.sender !== user?.id && (
                                  <span className="urgency-prefix high">
                                    HIGH:{" "}
                                  </span>
                                )}
                              {lastMessage.urgencyLevel === "low" &&
                                lastMessage.sender !== user?.id && (
                                  <span className="urgency-prefix low">
                                    Low:{" "}
                                  </span>
                                )}
                              {/* Show message text or file indicator */}
                              {lastMessage.isDeleted
                                ? "Message was deleted"
                                : lastMessage.text ||
                                  (lastMessage.fileUrl || lastMessage.fileData
                                    ? "Sent a file"
                                    : "")}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      "No messages yet"
                    )}
                  </div>
                </div>
                <div className="contact-meta">
                  {contact.lastMessageTime && (
                    <div className="contact-time">
                      {formatTime(contact.lastMessageTime)}
                    </div>
                  )}
                  {/* Show urgency indicator for the latest message only if it's from the other person */}
                  {messages[contact.id]?.length > 0 &&
                    messages[contact.id][messages[contact.id].length - 1]
                      .urgencyLevel &&
                    messages[contact.id][messages[contact.id].length - 1]
                      .urgencyLevel !== "normal" &&
                    messages[contact.id][messages[contact.id].length - 1]
                      .sender !== user.id && (
                      <div
                        className={`contact-urgency-indicator urgency-${
                          messages[contact.id][messages[contact.id].length - 1]
                            .urgencyLevel
                        }`}
                      >
                        {messages[contact.id][messages[contact.id].length - 1]
                          .urgencyLevel === "urgent" && (
                          <i className="fas fa-exclamation"></i>
                        )}
                        {messages[contact.id][messages[contact.id].length - 1]
                          .urgencyLevel === "high" && (
                          <i className="fas fa-arrow-up"></i>
                        )}
                        {messages[contact.id][messages[contact.id].length - 1]
                          .urgencyLevel === "low" && (
                          <i className="fas fa-arrow-down"></i>
                        )}
                      </div>
                    )}
                  <div className="contact-category-wrapper">
                    {contact.unreadCount > 0 && (
                      <div className="unread-badge">
                        {contact.unreadCount > 9 ? "9+" : contact.unreadCount}
                      </div>
                    )}
                    <div
                      className="contact-category-dropdown"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Calculate position for the dropdown
                        const rect = e.currentTarget.getBoundingClientRect();

                        // Calculate better positioning to ensure dropdown is fully visible
                        const windowWidth = window.innerWidth;
                        const dropdownWidth = 250; // Width of the dropdown

                        // Ensure the dropdown doesn't go off-screen to the left
                        let leftPos = Math.max(10, rect.left - 170);

                        // Ensure the dropdown doesn't go off-screen to the right
                        if (leftPos + dropdownWidth > windowWidth - 10) {
                          leftPos = windowWidth - dropdownWidth - 10;
                        }

                        setCategoryDropdownPosition({
                          top: rect.top - 10, // Position above the icon
                          left: leftPos, // Adjusted left position
                        });
                        setShowCategoryDropdown(
                          showCategoryDropdown === contact.id
                            ? null
                            : contact.id
                        );
                      }}
                      title="Assign to category"
                    >
                      <i className="fas fa-tag"></i>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div
        className={`chat-area ${
          isMobileView && selectedContact ? "mobile-visible" : ""
        }`}
      >
        {selectedContact ? (
          <>
            <div className="chat-header">
              {isMobileView && (
                <button
                  className="back-button"
                  onClick={() => {
                    setSelectedContact(null);
                    // For mobile view, remove classes to show contacts list and hide chat area
                    if (window.innerWidth < 576) {
                      const contactsList =
                        document.querySelector(".contacts-list");
                      const chatArea = document.querySelector(".chat-area");

                      if (contactsList && chatArea) {
                        contactsList.classList.remove("mobile-hidden");
                        chatArea.classList.remove("mobile-visible");
                      }
                    }
                  }}
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
              )}
              <div className="chat-contact-info">
                <div className="contact-avatar-wrapper">
                  <div
                    className="contact-avatar"
                    style={{ backgroundColor: selectedContact.avatar }}
                  >
                    {selectedContact.name.charAt(0)}
                  </div>
                  <div
                    className={`contact-status ${
                      selectedContact.isActive ? "active" : ""
                    }`}
                  ></div>
                </div>
                <div className="chat-contact-details">
                  <div className="chat-contact-name">
                    {selectedContact.name}
                  </div>
                  <div className="chat-contact-info-row">
                    <div className="chat-contact-status">
                      {selectedContact.isActive ? "Online" : "Offline"}
                    </div>
                    {selectedContact.department && (
                      <div className="chat-contact-department">
                        <span className="department-label">Department:</span>
                        <span
                          className="department-value department-glow-effect"
                          style={{
                            backgroundColor:
                              categories.find(
                                (c) =>
                                  c.isDepartmentCategory &&
                                  c.name === selectedContact.department
                              )?.color || "#4A76A8",
                            "--department-color":
                              categories.find(
                                (c) =>
                                  c.isDepartmentCategory &&
                                  c.name === selectedContact.department
                              )?.color || "#4A76A8",
                            boxShadow: `0 0 8px ${
                              categories.find(
                                (c) =>
                                  c.isDepartmentCategory &&
                                  c.name === selectedContact.department
                              )?.color || "#4A76A8"
                            }`,
                          }}
                        >
                          {selectedContact.department}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button
                  className="chat-action-button"
                  onClick={() => setShowChatDetails(!showChatDetails)}
                >
                  <i className="fas fa-ellipsis-h"></i>
                </button>
              </div>
            </div>
            <div className="chat-messages">
              {messages[selectedContact.id]?.map((msg) => (
                <div
                  key={msg.id}
                  data-message-id={msg.id}
                  className={`message ${
                    msg.sender === user.id ? "outgoing" : "incoming"
                  } ${msg._isOptimistic ? "optimistic" : ""} ${
                    msg.isDeleted ? "deleted" : ""
                  } ${msg.urgencyLevel ? `urgency-${msg.urgencyLevel}` : ""}`}
                >
                  {renderFileContent(msg)}
                  {messageToEdit && messageToEdit.id === msg.id ? (
                    <div className="edit-message-container">
                      <input
                        type="text"
                        value={editedMessageText}
                        onChange={(e) => setEditedMessageText(e.target.value)}
                        className="edit-message-input"
                        autoFocus
                      />
                      <div className="edit-message-actions">
                        <button
                          onClick={saveEditedMessage}
                          className="edit-save-btn"
                        >
                          <i className="fas fa-check"></i> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="edit-cancel-btn"
                        >
                          <i className="fas fa-times"></i> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    msg.text && (
                      <div className="message-text">
                        {msg.encrypted && msg.encryptedData && msg.iv ? (
                          <div>
                            {decrypt(
                              msg.encryptedData,
                              msg.iv,
                              msg.sender === user.id ? msg.receiver : msg.sender
                            ) || msg.text}
                            {msg.encrypted && (
                              <span
                                className="encrypted-badge"
                                title="End-to-end encrypted"
                              >
                                <i className="fas fa-lock"></i>
                              </span>
                            )}
                          </div>
                        ) : (
                          msg.text
                        )}
                      </div>
                    )
                  )}
                  <div className="message-time">
                    {formatTime(msg.timestamp)}
                    {msg.isEdited && !msg.isDeleted && (
                      <span className="edited-label">Edited</span>
                    )}
                    {msg._isOptimistic && (
                      <span className="message-status">
                        <i className="fas fa-check"></i>
                      </span>
                    )}
                    {msg.urgencyLevel && msg.urgencyLevel !== "normal" && (
                      <span
                        className={`message-urgency ${msg.urgencyLevel}`}
                        title={`${
                          msg.urgencyLevel.charAt(0).toUpperCase() +
                          msg.urgencyLevel.slice(1)
                        } Priority`}
                      >
                        {msg.urgencyLevel === "low" && (
                          <i className="fas fa-arrow-down"></i>
                        )}
                        {msg.urgencyLevel === "high" && (
                          <i className="fas fa-arrow-up"></i>
                        )}
                        {msg.urgencyLevel === "urgent" && (
                          <i className="fas fa-exclamation"></i>
                        )}
                      </span>
                    )}
                  </div>
                  {msg.sender === user.id &&
                    !msg.isDeleted &&
                    !messageToEdit && (
                      <div
                        className="message-options-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMessageOptions(
                            showMessageOptions === msg.id ? null : msg.id
                          );
                        }}
                      >
                        <i className="fas fa-ellipsis-h"></i>
                      </div>
                    )}
                  {showMessageOptions === msg.id && (
                    <div
                      className="message-options message-options-vertical"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="message-option-btn"
                        onClick={() => handleEditMessage(msg)}
                      >
                        <i className="far fa-edit"></i>
                        <span>Edit</span>
                      </button>
                      <button
                        className="message-option-btn delete"
                        onClick={() => handleDeleteMessageConfirm(msg)}
                      >
                        <i className="far fa-trash-alt"></i>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
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
                    <i className="far fa-file-alt"></i>
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
                id="file-input"
                className="file-input"
                onChange={handleFileSelection}
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              />
              {showEmojiPicker && (
                <div className="emoji-picker-container">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={300}
                    height={400}
                    lazyLoadEmojis={true}
                    previewConfig={{ showPreview: false }}
                    searchDisabled={false}
                    skinTonesDisabled={true}
                  />
                </div>
              )}
              <div className="input-container">
                <label
                  htmlFor="file-input"
                  className="attachment-button"
                  title="Upload a file from your device"
                  style={{ cursor: isUploading ? "not-allowed" : "pointer" }}
                >
                  <i className="fas fa-paperclip"></i>
                </label>

                <button
                  type="button"
                  className="emoji-button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={isUploading}
                >
                  <i className="far fa-grin-alt"></i>
                </button>

                <UrgencySelector
                  ref={urgencySelectorRef}
                  selectedUrgency={messageUrgency}
                  onUrgencyChange={setMessageUrgency}
                />

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
                  <i className="far fa-paper-plane"></i>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-icon">
              <i className="far fa-comment-dots"></i>
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
              <div className="contact-avatar-wrapper">
                <div
                  className="contact-avatar large"
                  style={{ backgroundColor: selectedContact.avatar }}
                >
                  {selectedContact.name.charAt(0)}
                </div>
                <div
                  className={`contact-status ${
                    selectedContact.isActive ? "active" : ""
                  }`}
                ></div>
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
                  <button
                    className="chat-action-button centered-button"
                    onClick={() => {
                      const searchBar =
                        document.querySelector(".chat-search-bar");
                      const searchNav =
                        document.getElementById("search-navigation");
                      if (searchBar) {
                        searchBar.classList.toggle("active");
                        if (searchBar.classList.contains("active")) {
                          searchBar.querySelector("input").focus();
                        } else {
                          // Clear search when closing
                          if (searchNav) searchNav.classList.remove("active");
                          document
                            .querySelectorAll(".search-highlight")
                            .forEach((el) => {
                              el.classList.remove("search-highlight");
                              el.classList.remove("current-highlight");
                            });
                        }
                      }
                    }}
                  >
                    <i className="fas fa-search"></i> Search in Conversation
                  </button>
                  <div className="search-bar chat-search-bar">
                    <i className="fas fa-search"></i>
                    <input
                      type="text"
                      placeholder="Search messages..."
                      onChange={(e) => handleSearchMessages(e.target.value)}
                    />
                  </div>
                  <div className="search-navigation" id="search-navigation">
                    <div className="search-count">
                      <span id="search-current">0</span> of{" "}
                      <span id="search-total">0</span> results
                    </div>
                    <div className="search-navigation-buttons">
                      <button
                        id="search-prev"
                        onClick={() => navigateSearchResults("prev")}
                        disabled
                      >
                        <i className="fas fa-chevron-up"></i>
                      </button>
                      <button
                        id="search-next"
                        onClick={() => navigateSearchResults("next")}
                        disabled
                      >
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>
                  <div className="search-results-list" id="search-results-list">
                    {searchResults.map((result, index) => {
                      // Get sender name
                      const senderName =
                        result.sender === user.id
                          ? "You"
                          : selectedContact.name;

                      // Format timestamp
                      const formattedTime = formatTime(result.timestamp);

                      // Highlight the search query in the text
                      const highlightedText = result.text.replace(
                        new RegExp(searchQuery, "gi"),
                        (match) => `<span class="highlight">${match}</span>`
                      );

                      return (
                        <div
                          key={index}
                          className="search-result-item"
                          onClick={() => {
                            setCurrentSearchIndex(index);

                            // Log which result was clicked
                            console.log(
                              "Clicked on search result:",
                              index,
                              result
                            );

                            // Ensure messages are loaded
                            if (
                              !messages[selectedContact.id] ||
                              messages[selectedContact.id].length === 0
                            ) {
                              console.log(
                                "Messages not loaded, loading now..."
                              );
                              axios
                                .get(`/api/messages/${selectedContact.id}`)
                                .then((response) => {
                                  setMessages((prev) => ({
                                    ...prev,
                                    [selectedContact.id]: response.data,
                                  }));

                                  // After loading messages, highlight with a delay
                                  setTimeout(() => {
                                    highlightSearchResult(index, searchResults);

                                    // Update current result counter
                                    const searchCount =
                                      document.getElementById("search-current");
                                    if (searchCount)
                                      searchCount.textContent = (
                                        index + 1
                                      ).toString();
                                  }, 500);
                                })
                                .catch((err) =>
                                  console.error("Error loading messages:", err)
                                );
                            } else {
                              // Messages already loaded, highlight immediately
                              highlightSearchResult(index, searchResults);

                              // Update current result counter
                              const searchCount =
                                document.getElementById("search-current");
                              if (searchCount)
                                searchCount.textContent = (
                                  index + 1
                                ).toString();
                            }
                          }}
                        >
                          <div
                            className="search-result-text"
                            dangerouslySetInnerHTML={{
                              __html: highlightedText,
                            }}
                          />
                          <div className="search-result-meta">
                            <span className="search-result-sender">
                              {senderName}
                            </span>
                            <span className="search-result-time">
                              {formattedTime}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  className={`group-action-button ${
                    selectedContact.isMuted ? "active" : ""
                  }`}
                  onClick={() => {
                    // Toggle mute status
                    const updatedContacts = contacts.map((c) => {
                      if (c.id === selectedContact.id) {
                        return { ...c, isMuted: !c.isMuted };
                      }
                      return c;
                    });
                    setContacts(updatedContacts);

                    // Update the selected contact
                    setSelectedContact({
                      ...selectedContact,
                      isMuted: !selectedContact.isMuted,
                    });

                    // Store muted status in localStorage
                    const mutedContacts = JSON.parse(
                      localStorage.getItem("mutedContacts") || "[]"
                    );
                    if (selectedContact.isMuted) {
                      // Remove from muted list
                      localStorage.setItem(
                        "mutedContacts",
                        JSON.stringify(
                          mutedContacts.filter(
                            (id) => id !== selectedContact.id
                          )
                        )
                      );
                    } else {
                      // Add to muted list
                      mutedContacts.push(selectedContact.id);
                      localStorage.setItem(
                        "mutedContacts",
                        JSON.stringify(mutedContacts)
                      );
                    }
                  }}
                >
                  <i
                    className={
                      selectedContact.isMuted
                        ? "fas fa-bell-slash"
                        : "fas fa-bell"
                    }
                  ></i>
                  {selectedContact.isMuted
                    ? "Unmute Notifications"
                    : "Mute Notifications"}
                </button>

                <div className="action-divider"></div>

                <button
                  className="delete-messages-button"
                  onClick={() => setShowDeleteMessagesConfirm(true)}
                >
                  <i className="far fa-trash-alt"></i> Delete Messages
                </button>
                <button
                  className="delete-messages-button"
                  onClick={() => {
                    setContactToDelete(selectedContact);
                    setShowDeleteConfirm(true);
                  }}
                >
                  <i className="fas fa-user-slash"></i> Remove from Conversation
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
              <h3>Remove from Conversation</h3>
            </div>
            <div className="confirm-dialog-content">
              <p>
                Are you sure you want to remove {contactToDelete?.name} from
                your conversations?
                <br />
                They will remain in your contacts list but won't appear in the
                messaging sidebar.
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

      {showDeleteMessageConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h4>Delete Message</h4>
            <p>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </p>
            <div className="confirm-dialog-actions">
              <button className="btn-cancel" onClick={cancelDeleteMessage}>
                Cancel
              </button>
              <button className="btn-danger" onClick={deleteMessage}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="category-modal-overlay">
          <CategoryManager
            onClose={() => setShowCategoryManager(false)}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      )}

      {/* Category Dropdown Modal */}
      {showCategoryDropdown && (
        <div
          className="category-dropdown-menu"
          style={{
            top: `${categoryDropdownPosition.top}px`,
            left: `${categoryDropdownPosition.left}px`,
          }}
        >
          <div className="category-dropdown-header">
            <h4>Select Category</h4>
            <button
              className="category-dropdown-close"
              onClick={(e) => {
                e.stopPropagation();
                setShowCategoryDropdown(null);
              }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="category-dropdown-items">
            {/* General options section */}
            {(() => {
              // Get the current contact's category
              const contactId = showCategoryDropdown;
              const contact = contacts.find((c) => c.id === contactId);
              const categoryId = contact?.categoryId;
              const category = categories.find((c) => c.id === categoryId);

              if (categoryId) {
                // If contact has a category and it's not a department category, show remove option
                if (category && !category.isDepartmentCategory) {
                  return (
                    <div
                      className="category-dropdown-item remove-category"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContactCategory(showCategoryDropdown, null);
                      }}
                    >
                      <div
                        className="category-dropdown-color category-remove-indicator"
                        style={{
                          backgroundColor: category
                            ? category.color
                            : "#ff4d4d",
                          boxShadow: `0 0 5px ${
                            category ? category.color : "#ff4d4d"
                          }`,
                        }}
                      ></div>
                      <span className="category-dropdown-name">
                        <div className="remove-category-line">Remove from</div>
                        <div className="remove-category-line">
                          <span style={{ color: category.color }}>
                            {category.name}
                          </span>{" "}
                          Category
                        </div>
                      </span>
                    </div>
                  );
                }
              } else {
                // If contact has no category, show "No Category" as selected
                return (
                  <div className="category-dropdown-item active">
                    <span className="category-dropdown-name">No Category</span>
                    <span className="category-dropdown-selected">
                      <i className="fas fa-check"></i>
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* User categories section */}
            {categories.some((category) => !category.isDepartmentCategory) && (
              <div className="category-dropdown-section-label">
                Your Categories
              </div>
            )}

            {categories
              .filter((category) => !category.isDepartmentCategory)
              .map((category) => (
                <div
                  key={category.id}
                  className="category-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContactCategory(showCategoryDropdown, category.id);
                  }}
                >
                  <div
                    className="category-dropdown-color"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="category-dropdown-name">
                    {category.name}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagingPage;
