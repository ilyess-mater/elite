import React, { useState, useEffect, useRef } from "react";
import "../styles/messaging.css";
import "../styles/emoji-picker.css";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import EmojiPicker from "emoji-picker-react";
import {
  openGoFileUploadPage,
  getDirectGoFileUrl,
  isGoFileUrl,
} from "../utils/goFileUtils";

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
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  const [messageToEdit, setMessageToEdit] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState("");
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] =
    useState(false);

  // Search functionality
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Fetch contacts from API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("/api/contacts");

        // Get IDs of removed chats from localStorage
        const removedChats = JSON.parse(
          localStorage.getItem("removedChats") || "[]"
        );

        // Get muted contacts from localStorage
        const mutedContacts = JSON.parse(
          localStorage.getItem("mutedContacts") || "[]"
        );

        // Filter out contacts with removed chats
        const filteredContacts = response.data.filter(
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
          showNotification(newMessage);

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
          // For received messages, set fileData to the full URL
          const baseUrl = window.location.origin;
          newMessage.fileData = newMessage.fileUrl.startsWith("http")
            ? newMessage.fileUrl
            : `${baseUrl}${newMessage.fileUrl}`;

          console.log("File URL processed:", {
            original: newMessage.fileUrl,
            processed: newMessage.fileData,
          });
        }

        // For debugging
        if (newMessage.fileUrl || newMessage.fileData) {
          console.log("Message contains file:", {
            fileUrl: newMessage.fileUrl ? "Yes" : "No",
            fileData: newMessage.fileData ? "Yes" : "No",
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

      // Find sender
      const sender = contacts.find((contact) => contact.id === message.sender);

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

        const notification = new Notification(
          "New message from " + senderName,
          {
            body: message.text || "Sent you a file",
            icon: "/logo192.png",
            badge: "/logo192.png",
            tag: `message-${sender?.id || "unknown"}-${Date.now()}`,
            requireInteraction: true,
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

  // Search messages functionality
  const handleSearchMessages = (searchText) => {
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

      if (searchNav) searchNav.classList.remove("active");
      if (searchCount) searchCount.textContent = "0";
      if (searchTotal) searchTotal.textContent = "0";
      if (prevButton) prevButton.disabled = true;
      if (nextButton) nextButton.disabled = true;

      // Remove all highlights
      document.querySelectorAll(".search-highlight").forEach((el) => {
        el.classList.remove("search-highlight");
        el.classList.remove("current-highlight");
      });

      return;
    }

    // Find all messages that contain the search text
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

    if (searchNav) searchNav.classList.add("active");
    if (searchCount) searchCount.textContent = results.length > 0 ? "1" : "0";
    if (searchTotal) searchTotal.textContent = results.length.toString();
    if (prevButton) prevButton.disabled = results.length <= 1;
    if (nextButton) nextButton.disabled = results.length <= 1;

    // Reset current index and highlight first result
    if (results.length > 0) {
      setCurrentSearchIndex(0);
      // Use a small delay to ensure the DOM is updated
      setTimeout(() => {
        highlightSearchResult(0, results);
      }, 300);
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

    // Create a map of message IDs to DOM elements for faster lookup
    const messageElementsMap = {};
    messageElements.forEach((el, idx) => {
      // Store both by index and by ID if available
      messageElementsMap[idx] = el;
      const msgId = el.getAttribute("data-message-id");
      if (msgId) {
        messageElementsMap[msgId] = el;
      }
    });

    // First, add highlight to all matching messages
    results.forEach((result, i) => {
      // Try to find the element by index first
      let messageEl = messageElementsMap[result.index];

      // If not found by index, try by ID
      if (!messageEl && result.messageId) {
        messageEl = messageElementsMap[result.messageId];
      }

      if (messageEl) {
        messageEl.classList.add("search-highlight");
      }
    });

    // Then, highlight and scroll to the current result
    const currentResult = results[index];
    if (currentResult) {
      // Try to find the element by index first
      let currentMessageEl = messageElementsMap[currentResult.index];

      // If not found by index, try by ID
      if (!currentMessageEl && currentResult.messageId) {
        currentMessageEl = messageElementsMap[currentResult.messageId];
      }

      if (currentMessageEl) {
        currentMessageEl.classList.add("current-highlight");

        // Scroll the message into view with smooth animation
        setTimeout(() => {
          currentMessageEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 300);
      } else {
        console.log("Current message element not found, retrying in 500ms");
        setTimeout(() => highlightSearchResult(index, results), 500);
      }
    }
  };

  const handleAttachmentClick = () => {
    // Open GoFile.io directly instead of opening file selector
    openGoFileUploadPage();
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
    let fileSource = msg.fileData || msg.fileUrl;

    if (!fileSource) {
      console.error("Missing file source for message:", msg.id);
      return <div className="file-error">File could not be displayed</div>;
    }

    // Check if it's a GoFile.io URL and get direct download URL
    if (isGoFileUrl(fileSource)) {
      fileSource = getDirectGoFileUrl(fileSource);
    }

    try {
      if (
        msg.messageType === "image" ||
        (msg.fileType && msg.fileType.startsWith("image/"))
      ) {
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
            {isGoFileUrl(fileSource) && (
              <div className="gofile-badge">
                <i className="fas fa-cloud-download-alt"></i> GoFile
              </div>
            )}
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
                console.error("Video failed to load:", e);
                e.target.parentNode.innerHTML =
                  '<div class="video-error">Video could not be played</div>';
              }}
            />
            {isGoFileUrl(fileSource) && (
              <div className="gofile-badge">
                <i className="fas fa-cloud-download-alt"></i> GoFile
              </div>
            )}
          </div>
        );
      } else if (msg.messageType === "file" || fileSource || msg.fileName) {
        // For other file types
        return (
          <div
            className="message-file-container"
            onClick={() => fileSource && window.open(fileSource, "_blank")}
          >
            {isGoFileUrl(fileSource) ? (
              <i className="fas fa-cloud-download-alt"></i>
            ) : (
              <i className="far fa-file-alt"></i>
            )}
            <span className="file-name">{msg.fileName || "File"}</span>
            {isGoFileUrl(fileSource) && (
              <span className="gofile-label">GoFile</span>
            )}
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
      <div
        className={`contacts-list ${
          isMobileView && selectedContact ? "mobile-hidden" : ""
        }`}
      >
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
                  <div className="unread-badge">
                    {contact.unreadCount > 9 ? "9+" : contact.unreadCount}
                  </div>
                )}
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
                  }`}
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
                    msg.text && <div className="message-text">{msg.text}</div>
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
                <button
                  type="button"
                  className="attachment-button"
                  onClick={handleAttachmentClick}
                  disabled={isUploading}
                  title="Share file via GoFile.io"
                >
                  <i className="fas fa-cloud-upload-alt"></i>
                </button>
                <button
                  type="button"
                  className="emoji-button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={isUploading}
                >
                  <i className="far fa-grin-alt"></i>
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
    </div>
  );
}

export default MessagingPage;
