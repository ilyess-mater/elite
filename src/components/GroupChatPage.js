import React, { useState, useEffect, useRef, useCallback } from "react";
import "../styles/groupchat.css";
import "../styles/emoji-picker.css";
import "../styles/search-results-list.css";
import "../styles/urgency-selector.css";

import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import TaskManagement from "./TaskManagement";
import EmojiPicker from "emoji-picker-react";
import UrgencySelector from "./UrgencySelector";

function GroupChatPage({ user, textSize }) {
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState({});
  const [repliedMessages, setRepliedMessages] = useState(() => {
    // Load replied messages from localStorage on component mount
    const savedReplies = localStorage.getItem("repliedMessages");
    return savedReplies ? JSON.parse(savedReplies) : [];
  });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    isDepartmentGroup: false,
    department: "",
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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [groupMemberCounts, setGroupMemberCounts] = useState({});
  const [showInviteMembers, setShowInviteMembers] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [showRenameGroup, setShowRenameGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [activeTab, setActiveTab] = useState("chat"); // Added for task management
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 769);
  const [showMessageOptions, setShowMessageOptions] = useState(null);
  const [messageToEdit, setMessageToEdit] = useState(null);
  const [editedMessageText, setEditedMessageText] = useState("");
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] =
    useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageUrgency, setMessageUrgency] = useState("normal"); // Default to normal priority
  const urgencySelectorRef = useRef(null);

  // Search functionality
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Department options (same as in SignUpForm)
  const departments = [
    "Human Resources",
    "Marketing",
    "Finance",
    "IT",
    "Operations",
    "Sales",
    "Customer Service",
    "Research & Development",
    "Development",
    "Legal",
    "Executive",
  ];

  // Fetch groups, contacts, and all messages when component mounts
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get("/api/groups");
        // Generate avatars for groups and ensure members array exists
        const groupsWithAvatars = response.data.map((group) => {
          return {
            ...group,
            avatar: generateGroupAvatar(group.name),
            members: Array.isArray(group.members) ? group.members : [],
            // unreadCount is now provided by the backend
          };
        });
        setGroups(groupsWithAvatars);

        // Initialize member counts safely
        const counts = {};
        groupsWithAvatars.forEach((group) => {
          counts[group.id] = Array.isArray(group.members)
            ? group.members.length
            : 0;
        });
        setGroupMemberCounts(counts);

        // Fetch all messages for all groups to ensure proper sorting
        const allMessagesPromises = groupsWithAvatars.map(async (group) => {
          try {
            const response = await axios.get(
              `/api/groups/${group.id}/messages`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              }
            );
            return { groupId: group.id, messages: response.data };
          } catch (error) {
            console.error(
              `Error fetching messages for group ${group.id}:`,
              error
            );
            return { groupId: group.id, messages: [] };
          }
        });

        // Wait for all message requests to complete
        const allMessagesResults = await Promise.all(allMessagesPromises);

        // Create a new messages object with all fetched messages
        const allMessages = {};
        allMessagesResults.forEach((result) => {
          allMessages[result.groupId] = result.messages;
        });

        // Update the messages state with all fetched messages
        setMessages(allMessages);

        // Update groups with lastMessageTime based on the latest message
        const updatedGroups = groupsWithAvatars.map((group) => {
          const groupMessages = allMessages[group.id] || [];
          if (groupMessages.length > 0) {
            const lastMessage = groupMessages[groupMessages.length - 1];
            return {
              ...group,
              lastMessageTime: lastMessage.timestamp,
            };
          }
          return group;
        });

        setGroups(updatedGroups);
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

  // Show browser notification
  const showNotification = useCallback(
    (message) => {
      try {
        if (!("Notification" in window)) {
          console.log("This browser does not support desktop notification");
          return;
        }

        // Get group name and sender name
        const group = groups.find((g) => g.id === message.groupId);

        // Check if group is muted
        if (group) {
          // Get muted groups from localStorage
          const mutedGroups = JSON.parse(
            localStorage.getItem("mutedGroups") || "[]"
          );
          if (mutedGroups.includes(group.id)) {
            console.log(`Notification from group ${group.name} muted`);
            return; // Skip notification for muted group
          }
        }

        if (Notification.permission === "granted") {
          const groupName = group ? group.name : "Group";
          const senderName = message.senderName || "Someone";

          // Create notification title based on urgency level - only for urgent and high priority
          let notificationTitle = `New message in ${groupName} from ${senderName}`;
          if (message.urgencyLevel === "high") {
            notificationTitle = `🔶 HIGH PRIORITY: Message in ${groupName} from ${senderName}`;
          } else if (message.urgencyLevel === "urgent") {
            notificationTitle = `🔴 URGENT: Message in ${groupName} from ${senderName}`;
          }

          const notification = new Notification(notificationTitle, {
            body: message.text || "Sent an attachment",
            icon: "/logo192.png",
          });

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
    },
    [groups, setSelectedGroup]
  );

  // Define title management functions before they're used in socket listeners
  // Title management functions
  const originalTitle = document.title;
  const titleIntervalRef = useRef(null);

  // Create a map to track unread messages per sender and group
  const unreadMessagesBySenderRef = useRef(new Map());

  // Create a map to track which messages have been counted for notifications
  const countedMessagesRef = useRef(new Set());

  // Flag to track if notifications have been seen
  const notificationsSeenRef = useRef(true);

  // Ref to track the selected group
  const selectedGroupRef = useRef(null);

  // Keep selectedGroupRef in sync with selectedGroup
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // Update the page title to show a notification
  const updateTitle = useCallback(
    (
      message,
      flash = true,
      count = 1,
      senderId = null,
      groupId = null,
      messageId = null
    ) => {
      // Only update title if the page is not visible
      if (document.hidden) {
        // Check if the group is muted
        if (groupId) {
          const mutedGroups = JSON.parse(
            localStorage.getItem("mutedGroups") || "[]"
          );
          if (mutedGroups.includes(groupId)) {
            console.log(`Tab notification from group ${groupId} muted`);
            return; // Skip title update for muted group
          }
        }

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

        // If we have a sender ID and group ID, update their unread count
        if (senderId && groupId) {
          const key = `${groupId}-${senderId}`;
          // Get current count for this sender in this group
          const currentCount = unreadMessagesBySenderRef.current.get(key) || 0;

          // Update the count
          const newCount = Math.max(0, currentCount + count);

          // Store the updated count
          if (newCount > 0) {
            unreadMessagesBySenderRef.current.set(key, newCount);
          } else {
            unreadMessagesBySenderRef.current.delete(key);
          }
        }

        // Calculate total unread count
        const totalUnreadCount = Array.from(
          unreadMessagesBySenderRef.current.values()
        ).reduce((sum, count) => sum + count, 0);

        // Only update title if we have a message or unread count
        if (message && totalUnreadCount > 0) {
          // Check if the message contains priority information
          let priorityPrefix = "";
          if (message.includes("URGENT:")) {
            priorityPrefix = "🔴 ";
          } else if (message.includes("HIGH PRIORITY:")) {
            priorityPrefix = "🔶 ";
          }

          // Create the new title with unread count and priority prefix
          const newTitle = `(${totalUnreadCount}) ${priorityPrefix}${message}`;

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

  // Socket.io event listeners for group messages
  useEffect(() => {
    if (!socket) return;

    // Create a function to check if a group is currently selected
    const isGroupSelected = (groupId) => {
      return (
        selectedGroupRef.current && selectedGroupRef.current.id === groupId
      );
    };

    // Listen for message edits
    socket.on("message_edited", (editedMessage) => {
      if (!editedMessage?.groupId) return;

      setMessages((prevMessages) => {
        const groupId = editedMessage.groupId;
        const existingMessages = Array.isArray(prevMessages[groupId])
          ? [...prevMessages[groupId]]
          : [];

        const updatedMessages = existingMessages.map((msg) => {
          if (msg.id === editedMessage.messageId) {
            return {
              ...msg,
              text: editedMessage.newText,
              isEdited: true,
            };
          }
          return msg;
        });

        return {
          ...prevMessages,
          [groupId]: updatedMessages,
        };
      });
    });

    // Listen for message deletions
    socket.on("message_deleted", (deletedMessage) => {
      if (!deletedMessage?.groupId) return;

      setMessages((prevMessages) => {
        const groupId = deletedMessage.groupId;
        const existingMessages = Array.isArray(prevMessages[groupId])
          ? [...prevMessages[groupId]]
          : [];

        const updatedMessages = existingMessages.map((msg) => {
          if (msg.id === deletedMessage.messageId) {
            return {
              ...msg,
              text: "This message was deleted",
              isDeleted: true,
              fileUrl: null,
              fileData: null,
              fileName: null,
            };
          }
          return msg;
        });

        return {
          ...prevMessages,
          [groupId]: updatedMessages,
        };
      });
    });

    socket.on("receive_group_message", (newMessage) => {
      if (!newMessage?.groupId) return;

      setMessages((prevMessages) => {
        const groupId = newMessage.groupId;
        const existingMessages = Array.isArray(prevMessages[groupId])
          ? prevMessages[groupId]
          : [];

        // Enhanced duplicate detection
        const isDuplicate = existingMessages.some(
          (msg) =>
            // Check by ID (most reliable)
            msg?.id === newMessage.id ||
            // Check by content and sender with timestamp proximity
            (msg?.text === newMessage.text &&
              msg?.sender === newMessage.sender &&
              Math.abs(
                new Date(msg?.timestamp || 0) -
                  new Date(newMessage.timestamp || 0)
              ) < 2000)
        );

        if (isDuplicate) {
          console.log(
            "Duplicate message detected and prevented",
            newMessage.id
          );
          return prevMessages;
        }

        // Handle optimistic messages (our own messages)
        if (newMessage.sender === user?.id) {
          // Check if we already have an optimistic version of this message
          const optimisticIndex = existingMessages.findIndex(
            (msg) =>
              msg?._isOptimistic &&
              msg?.text === newMessage.text &&
              Math.abs(
                new Date(msg?.timestamp || 0) -
                  new Date(newMessage.timestamp || 0)
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
              [groupId]: updatedMessages,
            };
          }

          // If we get here and it's our own message but no optimistic version found,
          // it might be a duplicate, so return without adding
          return prevMessages;
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

          console.log("Group file URL processed:", {
            original: newMessage.fileUrl,
            processed: newMessage.fileData,
          });
        }

        return {
          ...prevMessages,
          [groupId]: [...existingMessages, newMessage],
        };
      });

      // Show notification if message is from another user
      if (newMessage.sender !== user?.id) {
        // Get group name and sender name for notification
        const group = groups.find((g) => g.id === newMessage.groupId);
        const groupName = group ? group.name : "Group";
        const senderName = newMessage.senderName || "Someone";

        // Check if group is muted
        let isGroupMuted = false;
        if (group) {
          // Get muted groups from localStorage
          const mutedGroups = JSON.parse(
            localStorage.getItem("mutedGroups") || "[]"
          );
          isGroupMuted = mutedGroups.includes(group.id);
        }

        // Only show notification and update title if group is not muted
        if (!isGroupMuted) {
          // Show browser notification
          showNotification(newMessage);

          // Update page title with sender and group name
          if (document.hidden) {
            // Add priority prefix for tab notification
            let priorityPrefix = "";
            if (newMessage.urgencyLevel === "urgent") {
              priorityPrefix = "URGENT: ";
            } else if (newMessage.urgencyLevel === "high") {
              priorityPrefix = "HIGH PRIORITY: ";
            }

            // Use the priority prefix in the title
            const notificationTitle = `${priorityPrefix}New message in ${groupName} from ${senderName}`;

            updateTitle(
              notificationTitle,
              true,
              1,
              newMessage.sender,
              newMessage.groupId,
              newMessage.id
            );
          }
        }
      }

      // Update the group's last message timestamp and unread count
      setGroups((prevGroups) => {
        return prevGroups.map((group) => {
          if (group.id === newMessage.groupId) {
            // Increment unread count if the message is from someone else
            // Always increment if not viewing this specific group, even if on the group chats page
            console.log("New message received:", {
              sender: newMessage.sender,
              userId: user?.id,
              selectedGroup: selectedGroupRef.current?.id,
              messageGroupId: newMessage.groupId,
              currentGroupId: group.id,
              currentUnreadCount: group.unreadCount || 0,
              isGroupSelected: isGroupSelected(newMessage.groupId),
            });

            // Only increment unread count if the message is from someone else
            // AND the user is not currently viewing this specific group
            if (newMessage.sender !== user?.id) {
              // Check if this specific group is currently selected and visible
              const isCurrentlyViewingThisGroup =
                selectedGroupRef.current &&
                selectedGroupRef.current.id === newMessage.groupId;

              if (!isCurrentlyViewingThisGroup) {
                // Increment the unread count in the local state
                // The backend will track the actual unread count based on lastRead timestamp
                const newUnreadCount = (group.unreadCount || 0) + 1;

                console.log(
                  `Incrementing unread count for group ${group.id} to ${newUnreadCount}`
                );

                return {
                  ...group,
                  lastMessageTime: newMessage.timestamp,
                  unreadCount: newUnreadCount,
                };
              }
            }
            return {
              ...group,
              lastMessageTime: newMessage.timestamp,
            };
          }
          return group;
        });
      });

      // Sort groups by most recent message timestamp
      setGroups((prevGroups) => {
        return [...prevGroups].sort((a, b) => {
          // Use the updated lastMessageTime property for sorting
          const aTime =
            a.id === newMessage.groupId
              ? new Date(newMessage.timestamp).getTime()
              : a.lastMessageTime
              ? new Date(a.lastMessageTime).getTime()
              : 0;

          const bTime =
            b.id === newMessage.groupId
              ? new Date(newMessage.timestamp).getTime()
              : b.lastMessageTime
              ? new Date(b.lastMessageTime).getTime()
              : 0;

          // Sort in descending order (newest first)
          return bTime - aTime;
        });
      });
    });

    socket.on("group_user_joined", (data) => {
      if (!data?.groupId || !data?.userName) return;

      // Check if we already have this join message to prevent duplicates
      const joinMessageText = `${data.userName} has joined the group`;

      setMessages((prevMessages) => {
        const existingMessages = Array.isArray(prevMessages[data.groupId])
          ? prevMessages[data.groupId]
          : [];

        // Check if this join message already exists
        const hasJoinMessage = existingMessages.some(
          (msg) => msg.isSystem && msg.text === joinMessageText
        );

        // Only add the system message if it doesn't already exist
        if (!hasJoinMessage) {
          const systemMessage = {
            id: `system-${Date.now()}`,
            groupId: data.groupId,
            text: joinMessageText,
            isSystem: true,
            timestamp: new Date().toISOString(),
          };

          return {
            ...prevMessages,
            [data.groupId]: [...existingMessages, systemMessage],
          };
        }

        // If the message already exists, don't add it again
        return prevMessages;
      });

      // Update groups and member counts safely
      setGroups((prevGroups) => {
        return prevGroups.map((group) => {
          if (group?.id === data.groupId) {
            const currentMembers = Array.isArray(group.members)
              ? group.members
              : [];
            // Check if user is already a member
            const isExistingMember = currentMembers.some(
              (m) => m?.id === data.user?.id
            );
            if (!isExistingMember && data.user) {
              // Update member count
              setGroupMemberCounts((prev) => ({
                ...prev,
                [data.groupId]: (prev[data.groupId] || 0) + 1,
              }));
              // Add new member
              return {
                ...group,
                members: [...currentMembers, data.user],
              };
            }
          }
          return group;
        });
      });
    });

    socket.on("group_user_left", (data) => {
      // Add system message
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

      // Update groups and member counts
      setGroups((prevGroups) => {
        return prevGroups.map((group) => {
          if (group.id === data.groupId) {
            const updatedMembers = (group.members || []).filter(
              (m) => m.id !== data.userId
            );
            if (updatedMembers.length < (group.members || []).length) {
              // Only update count if member was actually removed
              setGroupMemberCounts((prev) => ({
                ...prev,
                [data.groupId]: Math.max((prev[data.groupId] || 0) - 1, 0),
              }));
              return {
                ...group,
                members: updatedMembers,
              };
            }
          }
          return group;
        });
      });

      // Update selected group if it's the current one
      setSelectedGroup((prevGroup) => {
        if (prevGroup?.id === data.groupId) {
          const updatedMembers = (prevGroup.members || []).filter(
            (m) => m.id !== data.userId
          );
          return {
            ...prevGroup,
            members: updatedMembers,
          };
        }
        return prevGroup;
      });
    });

    return () => {
      socket.off("receive_group_message");
      socket.off("group_user_joined");
      socket.off("group_user_left");
      socket.off("message_edited");
      socket.off("message_deleted");
    };
  }, [socket, user?.id, showNotification, groups, updateTitle]);

  // Add socket listener for user status updates
  useEffect(() => {
    if (!socket) return;

    socket.on("user_status", (statusData) => {
      const { userId, status } = statusData;

      // Update user status in groups
      setGroups((prevGroups) => {
        return prevGroups.map((group) => ({
          ...group,
          members: (group.members || []).map((member) =>
            member.id === userId
              ? { ...member, isActive: status === "online" }
              : member
          ),
        }));
      });

      // Update selected group if needed
      setSelectedGroup((prevGroup) => {
        if (!prevGroup) return prevGroup;
        return {
          ...prevGroup,
          members: (prevGroup.members || []).map((member) =>
            member.id === userId
              ? { ...member, isActive: status === "online" }
              : member
          ),
        };
      });
    });

    return () => {
      socket.off("user_status");
    };
  }, [socket]);

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
  }, [resetTitle, originalTitle, selectedGroup]);

  // Handle window resize to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 769);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Generate avatar color based on name
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
    for (let i = 0; name && i < name.length; i++) {
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
    for (let i = 0; name && i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash % colors.length);
    return colors[colorIndex];
  }

  // Update selectedGroupRef when selectedGroup changes
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

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

          // Process messages to ensure we don't have duplicate join messages
          const processedMessages = response.data;

          // Create a Map to track unique join messages by username
          const joinMessagesByUser = new Map();

          // Filter out duplicate join messages, keeping only the most recent one for each user
          const filteredMessages = processedMessages.filter((msg) => {
            if (msg.isSystem && msg.text.includes("has joined the group")) {
              // Extract username from the message
              const username = msg.text.replace(" has joined the group", "");

              // If we've seen this user's join message before, skip this one
              if (joinMessagesByUser.has(username)) {
                return false;
              }

              // Otherwise, record this as the first join message for this user
              joinMessagesByUser.set(username, true);
            }
            return true;
          });

          setMessages((prev) => ({
            ...prev,
            [selectedGroup.id]: filteredMessages,
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
    setActiveTab("chat"); // Reset to chat tab when selecting a group

    // For mobile view, add a class to hide groups sidebar and show chat area
    if (window.innerWidth < 576) {
      const groupsSidebar = document.querySelector(".groups-sidebar");
      const chatArea = document.querySelector(".chat-area");

      if (groupsSidebar && chatArea) {
        groupsSidebar.classList.add("mobile-hidden");
        chatArea.classList.add("mobile-visible");
      }
    }

    // Reset unread count when selecting a group
    if (group.unreadCount) {
      // Reset the unread count in the local state
      // The backend will update the lastRead timestamp when fetching messages
      setGroups((prevGroups) => {
        return prevGroups.map((g) => {
          if (g.id === group.id) {
            return {
              ...g,
              unreadCount: 0,
            };
          }
          return g;
        });
      });
    }

    // Reset the page title when a group is selected
    resetTitle();
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

      // Add group ID if we have a selected group
      if (selectedGroup) {
        formData.append("conversation_id", selectedGroup.id);
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
      !selectedGroup ||
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
      senderName: user.name,
      groupId: selectedGroup.id,
      text: message,
      timestamp: new Date().toISOString(),
      fileUrl: fileUrl,
      fileType: fileType,
      fileName: fileName,
      urgencyLevel: messageUrgency,
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

    // Update the group's lastMessageTime to move it to the top
    setGroups((prevGroups) => {
      return prevGroups.map((group) => {
        if (group.id === selectedGroup.id) {
          return {
            ...group,
            lastMessageTime: optimisticMessage.timestamp,
          };
        }
        return group;
      });
    });

    // Send message via Socket.IO
    try {
      socket.emit("send_group_message", {
        token: localStorage.getItem("token"),
        groupId: selectedGroup.id,
        text: message,
        fileUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
        urgencyLevel: messageUrgency,
      });

      // No need to decrement the counter anymore since we're tracking per sender

      console.log("Group message sent successfully:", {
        hasFile: fileUrl ? true : false,
        textLength: message.length,
        groupId: selectedGroup.id,
      });
    } catch (error) {
      console.error("Error sending group message:", error);
      alert("Failed to send message. Please try again.");
    }

    setMessage("");
    setIsUploading(false);

    // Close any open UI elements
    setShowEmojiPicker(false);

    // Don't reset messageUrgency to keep the selected priority for the next message
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      setError("Group name is required");
      return;
    }

    // For regular group creation, require members
    if (!newGroup.isDepartmentGroup && selectedMembers.length === 0) {
      setError("Select at least one member for the group");
      return;
    }

    // For department group creation, require department selection
    if (newGroup.isDepartmentGroup && !newGroup.department) {
      setError("Please select a department");
      return;
    }

    try {
      // Prepare request data
      const requestData = {
        name: newGroup.name,
        description: newGroup.description,
      };

      // If it's a department group, send the department info
      if (newGroup.isDepartmentGroup) {
        requestData.isDepartmentGroup = true;
        requestData.department = newGroup.department;
      } else {
        // Otherwise, send the selected members
        requestData.members = selectedMembers.map((member) => member.id);
      }

      const response = await axios.post("/api/groups", requestData);

      const newGroupWithAvatar = {
        ...response.data,
        avatar: generateGroupAvatar(response.data.name),
      };

      // Add new group to the state
      setGroups([...groups, newGroupWithAvatar]);

      // Clear form and close modal
      setNewGroup({
        name: "",
        description: "",
        isDepartmentGroup: false,
        department: "",
      });
      setSelectedMembers([]);
      setShowCreateGroup(false);

      // Select the new group
      setSelectedGroup(newGroupWithAvatar);
    } catch (error) {
      console.error("Error creating group:", error);
      setError("Failed to create group. Please try again.");
    }
  };

  const handleInviteMembers = async (membersToInvite) => {
    if (!selectedGroup || membersToInvite.length === 0) {
      setInviteError("Please select at least one member to invite");
      return;
    }

    try {
      const response = await axios.post(
        `/api/groups/${selectedGroup.id}/invite`,
        {
          members: membersToInvite.map((member) => member.id),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        // Update the group members locally
        setGroups((prevGroups) =>
          prevGroups.map((group) => {
            if (group.id === selectedGroup.id) {
              return {
                ...group,
                members: [...group.members, ...membersToInvite],
              };
            }
            return group;
          })
        );

        // Update selected group if it's the current one
        setSelectedGroup((prev) => ({
          ...prev,
          members: [...prev.members, ...membersToInvite],
        }));

        // Update member count
        setGroupMemberCounts((prev) => ({
          ...prev,
          [selectedGroup.id]:
            (prev[selectedGroup.id] || 0) + membersToInvite.length,
        }));

        // Add system messages for each invited member
        membersToInvite.forEach((member) => {
          const joinMessageText = `${member.name} has joined the group`;
          const systemMessage = {
            id: `system-${Date.now()}-${member.id}`,
            groupId: selectedGroup.id,
            text: joinMessageText,
            isSystem: true,
            timestamp: new Date().toISOString(),
          };

          // Add the system message to the messages state
          setMessages((prevMessages) => {
            const existingMessages = Array.isArray(
              prevMessages[selectedGroup.id]
            )
              ? prevMessages[selectedGroup.id]
              : [];

            // Check if this join message already exists
            const hasJoinMessage = existingMessages.some(
              (msg) => msg.isSystem && msg.text === joinMessageText
            );

            // Only add if it doesn't exist
            if (!hasJoinMessage) {
              return {
                ...prevMessages,
                [selectedGroup.id]: [...existingMessages, systemMessage],
              };
            }
            return prevMessages;
          });
        });

        setShowInviteMembers(false);
        setSelectedMembers([]);
        setInviteError("");
      } else {
        setInviteError("Failed to invite members. Please try again.");
      }
    } catch (error) {
      console.error("Error inviting members:", error);
      setInviteError(
        error.response?.data?.message ||
          "Failed to invite members. Please try again."
      );
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

  // Search messages functionality
  const handleSearchMessages = async (searchText) => {
    setSearchQuery(searchText);

    if (!searchText.trim() || !selectedGroup || !messages[selectedGroup.id]) {
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
          `/api/groups/${
            selectedGroup.id
          }/messages/search?query=${encodeURIComponent(searchText)}`,
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
          senderName: msg.senderName,
        }));
      } else {
        // Fallback to client-side search
        const groupMessages = messages[selectedGroup.id];
        groupMessages.forEach((msg, index) => {
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
              senderName: msg.senderName,
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
      const groupMessages = messages[selectedGroup.id];

      groupMessages.forEach((msg, index) => {
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
            senderName: msg.senderName || "Unknown",
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

  // Handle edit message
  const handleEditMessage = (msg) => {
    setMessageToEdit(msg);
    setEditedMessageText(msg.text);
    setShowMessageOptions(null);
  };

  // Save edited message
  const saveEditedMessage = () => {
    if (!messageToEdit || !editedMessageText.trim()) return;

    // Update message locally first (optimistic update)
    setMessages((prev) => {
      const groupMessages = [...(prev[selectedGroup.id] || [])];
      const messageIndex = groupMessages.findIndex(
        (msg) => msg.id === messageToEdit.id
      );

      if (messageIndex !== -1) {
        groupMessages[messageIndex] = {
          ...groupMessages[messageIndex],
          text: editedMessageText,
          isEdited: true,
        };
      }

      return {
        ...prev,
        [selectedGroup.id]: groupMessages,
      };
    });

    // Send update to server via socket
    if (socket) {
      socket.emit("edit_group_message", {
        token: localStorage.getItem("token"),
        messageId: messageToEdit.id,
        groupId: selectedGroup.id,
        newText: editedMessageText,
      });
    }

    // Reset edit state
    setMessageToEdit(null);
    setEditedMessageText("");
  };

  // Handle delete message click
  const handleDeleteMessageClick = (msg) => {
    setMessageToDelete(msg);
    setShowDeleteMessageConfirm(true);
    setShowMessageOptions(null);
  };

  // Cancel delete message
  const cancelDeleteMessage = () => {
    setShowDeleteMessageConfirm(false);
    setMessageToDelete(null);
  };

  // Delete message
  const deleteMessage = () => {
    if (!messageToDelete) return;

    // Update messages locally first (optimistic update)
    setMessages((prev) => {
      const groupMessages = [...(prev[selectedGroup.id] || [])];
      const messageIndex = groupMessages.findIndex(
        (msg) => msg.id === messageToDelete.id
      );

      if (messageIndex !== -1) {
        groupMessages[messageIndex] = {
          ...groupMessages[messageIndex],
          text: "This message was deleted",
          isDeleted: true,
          fileUrl: null,
          fileData: null,
          fileName: null,
        };
      }

      return {
        ...prev,
        [selectedGroup.id]: groupMessages,
      };
    });

    // Send delete to server via socket
    if (socket) {
      socket.emit("delete_group_message", {
        token: localStorage.getItem("token"),
        messageId: messageToDelete.id,
        groupId: selectedGroup.id,
      });
    }

    // Reset delete state
    setShowDeleteMessageConfirm(false);
    setMessageToDelete(null);
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    try {
      await axios.post(
        `/api/groups/${selectedGroup.id}/leave`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Remove group from state
      setGroups(groups.filter((g) => g.id !== selectedGroup.id));
      setSelectedGroup(null);
      setShowGroupDetails(false);
      setShowLeaveConfirm(false);
    } catch (error) {
      console.error("Error leaving group:", error);
      alert("Error leaving group. Please try again.");
    }
  };

  const handleDeleteMessages = async () => {
    if (!selectedGroup) return;

    try {
      await axios.delete(`/api/groups/${selectedGroup.id}/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Clear messages for current user
      setMessages((prev) => ({
        ...prev,
        [selectedGroup.id]: [],
      }));

      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting messages:", error);
      alert("Error deleting messages. Please try again.");
    }
  };

  // First filter groups based on search term
  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (group.description &&
        group.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort groups by urgency level first, then by most recent message timestamp
  const sortedGroups = [...filteredGroups].sort((a, b) => {
    // Get the latest message for each group
    const aLastMessage =
      messages[a.id]?.length > 0
        ? messages[a.id][messages[a.id].length - 1]
        : null;
    const bLastMessage =
      messages[b.id]?.length > 0
        ? messages[b.id][messages[b.id].length - 1]
        : null;

    // Check if there are any urgent or high priority messages in these groups
    const aMessages = messages[a.id] || [];
    const bMessages = messages[b.id] || [];

    const aHasUrgent = aMessages.some(
      (msg) =>
        msg.urgencyLevel === "urgent" &&
        msg.sender !== user?.id &&
        !msg.isDeleted
    );
    const bHasUrgent = bMessages.some(
      (msg) =>
        msg.urgencyLevel === "urgent" &&
        msg.sender !== user?.id &&
        !msg.isDeleted
    );

    const aHasHigh = aMessages.some(
      (msg) =>
        msg.urgencyLevel === "high" && msg.sender !== user?.id && !msg.isDeleted
    );
    const bHasHigh = bMessages.some(
      (msg) =>
        msg.urgencyLevel === "high" && msg.sender !== user?.id && !msg.isDeleted
    );

    // Define urgency priority (higher number = higher priority)
    const getUrgencyPriority = (hasUrgent, hasHigh) => {
      if (hasUrgent) return 2;
      if (hasHigh) return 1;
      return 0;
    };

    const aUrgencyPriority = getUrgencyPriority(aHasUrgent, aHasHigh);
    const bUrgencyPriority = getUrgencyPriority(bHasUrgent, bHasHigh);

    // First sort by urgency level
    const urgencyDiff = bUrgencyPriority - aUrgencyPriority;
    if (urgencyDiff !== 0) {
      return urgencyDiff; // Sort by urgency level first
    }

    // If urgency levels are the same, sort by timestamp
    const aTimestamp = aLastMessage?.timestamp
      ? new Date(aLastMessage.timestamp).getTime()
      : 0;
    const bTimestamp = bLastMessage?.timestamp
      ? new Date(bLastMessage.timestamp).getTime()
      : 0;

    // Sort in descending order (newest first)
    return bTimestamp - aTimestamp;
  });

  // Filter contacts for group creation
  const filteredContacts = contacts.filter(
    (contact) =>
      !selectedMembers.some((m) => m.id === contact.id) &&
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      console.error("Missing file source for group message:", msg.id);
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
      "Rendering group file with source:",
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
        return (
          <div className="message-image-container">
            <div className="image-loading">Loading image...</div>
            <img
              src={fileSource}
              alt="Sent"
              className="message-image"
              onClick={() => window.open(fileSource, "_blank")}
              onLoad={(e) => {
                console.log("Group image loaded successfully:", fileSource);
                // Hide the loading indicator when image loads
                const loadingEl =
                  e.target.parentNode.querySelector(".image-loading");
                if (loadingEl) loadingEl.style.display = "none";
                // Show the image
                e.target.style.display = "block";
              }}
              onError={(e) => {
                console.error("Group image failed to load:", e, fileSource);
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
            <div className="video-loading">Loading video...</div>
            <video
              src={fileSource}
              controls
              className="message-video"
              onLoadedData={(e) => {
                console.log("Group video loaded successfully:", fileSource);
                // Hide the loading indicator when video loads
                const loadingEl =
                  e.target.parentNode.querySelector(".video-loading");
                if (loadingEl) loadingEl.style.display = "none";
                // Show the video
                e.target.style.display = "block";
              }}
              onError={(e) => {
                console.error("Group video failed to load:", e, fileSource);
                // Update the loading indicator to show error
                const loadingEl =
                  e.target.parentNode.querySelector(".video-loading");
                if (loadingEl) {
                  loadingEl.className = "video-error";
                  loadingEl.textContent = "Video could not be played";
                }
              }}
              style={{ display: "none" }} // Initially hidden until loaded
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
            <i className="fas fa-file-alt"></i>
            <span className="file-name">{msg.fileName || "File"}</span>
          </div>
        );
      }
    } catch (error) {
      console.error("Error rendering group file:", error);
      return <div className="file-error">File could not be displayed</div>;
    }

    return null;
  };

  const renderMembersDialog = () => {
    if (!showMembersDialog || !selectedGroup) return null;

    const members = selectedGroup.members || [];

    return (
      <div className="confirm-dialog-overlay">
        <div className="confirm-dialog members-dialog">
          <div className="members-dialog-header">
            <div className="members-dialog-title">
              <i className="fas fa-users"></i>
              Group Members ({members.length})
            </div>
            <button
              className="dialog-close-btn"
              onClick={() => setShowMembersDialog(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="members-list">
            {members.map((member) => {
              if (!member?.name) return null;
              return (
                <div
                  className={`member-item ${
                    member.id === selectedGroup.createdBy ? "admin" : ""
                  }`}
                  key={member.id}
                >
                  <div
                    className="member-avatar"
                    style={{ backgroundColor: generateAvatar(member.name) }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div className="member-info">
                    <div className="member-name">{member.name}</div>
                    <div
                      className={`member-role ${
                        member.id === selectedGroup.createdBy ? "admin" : ""
                      }`}
                    >
                      {member.id === selectedGroup.createdBy ? (
                        <>
                          <i className="fas fa-shield-alt"></i> Admin
                        </>
                      ) : (
                        <>
                          <i className="fas fa-user"></i> Member
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`member-status ${
                      member.isActive ? "status-online" : "status-offline"
                    }`}
                  >
                    <div className="status-indicator"></div>
                    <span className="status-text">
                      {member.isActive ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="group-chat-container">
      <div
        className={`groups-sidebar ${
          isMobileView && selectedGroup ? "mobile-hidden" : ""
        }`}
      >
        <div className="groups-header">
          <h2>Group Chats</h2>
          <button
            className="create-group-btn"
            onClick={() => setShowCreateGroup(true)}
          >
            <i className="fas fa-user-plus"></i> Create New Group
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
          {sortedGroups.map((group) => {
            // Check if there are any priority messages in this group
            const groupMessages = messages[group.id] || [];
            const hasUrgentMessage = groupMessages.some(
              (msg) =>
                msg.urgencyLevel === "urgent" &&
                msg.sender !== user.id &&
                !msg.isDeleted
            );
            const hasHighPriorityMessage = groupMessages.some(
              (msg) =>
                msg.urgencyLevel === "high" &&
                msg.sender !== user.id &&
                !msg.isDeleted
            );

            // Determine priority class - always apply the class regardless of whether
            // the user is viewing the conversation or not
            let priorityClass = "";
            if (hasUrgentMessage) {
              priorityClass = "priority-urgent";
            } else if (hasHighPriorityMessage) {
              priorityClass = "priority-high";
            }

            return (
              <div
                key={group.id}
                className={`group-item ${
                  selectedGroup && selectedGroup.id === group.id ? "active" : ""
                } ${priorityClass}`}
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
                      ? (() => {
                          const lastMessage =
                            messages[group.id][messages[group.id].length - 1];

                          return (
                            <>
                              {/* Show urgency prefix for non-normal urgency levels, but only for receivers */}
                              {lastMessage.urgencyLevel === "urgent" &&
                                lastMessage.sender !== user?.id && (
                                  <span className="urgency-prefix urgent">
                                    URGENT:{" "}
                                  </span>
                                )}
                              {lastMessage.urgencyLevel === "high" &&
                                lastMessage.sender !== user?.id && (
                                  <span className="urgency-prefix high">
                                    HIGH PRIORITY:{" "}
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
                        })()
                      : "No messages yet"}
                  </div>
                </div>
                <div className="group-meta">
                  {group.lastMessageTime && (
                    <div className="group-time">
                      {formatTime(group.lastMessageTime)}
                    </div>
                  )}
                  <div className="group-info-meta">
                    {group.unreadCount > 0 && (
                      <div className="unread-count-bubble">
                        {group.unreadCount > 9 ? "9+" : group.unreadCount}
                      </div>
                    )}
                    <div className="group-members-count">
                      <i className="fas fa-users"></i>
                      <span>{groupMemberCounts[group.id] || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`chat-area ${
          isMobileView && selectedGroup ? "mobile-visible" : ""
        }`}
      >
        {selectedGroup ? (
          <>
            <div className="chat-header">
              <div className="chat-group-info">
                {isMobileView && (
                  <button
                    className="back-button"
                    onClick={() => {
                      setSelectedGroup(null);
                      // For mobile view, remove classes to show groups sidebar and hide chat area
                      if (window.innerWidth < 576) {
                        const groupsSidebar =
                          document.querySelector(".groups-sidebar");
                        const chatArea = document.querySelector(".chat-area");

                        if (groupsSidebar && chatArea) {
                          groupsSidebar.classList.remove("mobile-hidden");
                          chatArea.classList.remove("mobile-visible");
                        }
                      }
                    }}
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                )}
                <div
                  className="group-avatar"
                  style={{ backgroundColor: selectedGroup.avatar }}
                >
                  {selectedGroup.name.charAt(0)}
                </div>
                <div className="chat-group-details">
                  <div className="chat-group-name">{selectedGroup.name}</div>
                  <div
                    className="chat-group-members"
                    onClick={() => setShowMembersDialog(true)}
                  >
                    {groupMemberCounts[selectedGroup.id] ||
                      (selectedGroup.members || []).length}{" "}
                    members
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button
                  className="chat-action-button"
                  onClick={() => setShowGroupDetails(!showGroupDetails)}
                >
                  <i className="fas fa-ellipsis-h"></i>
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="group-tabs">
              <button
                className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
                onClick={() => setActiveTab("chat")}
              >
                <i className="far fa-comment-dots"></i> Chat
              </button>
              <button
                className={`tab-btn ${activeTab === "tasks" ? "active" : ""}`}
                onClick={() => setActiveTab("tasks")}
              >
                <i className="fas fa-clipboard-list"></i> Tasks
              </button>
            </div>

            {activeTab === "chat" ? (
              <>
                <div className="chat-messages">
                  {messages[selectedGroup?.id]?.map((msg) => (
                    <div
                      key={msg.id}
                      data-message-id={msg.id}
                      className={`message ${
                        msg.isSystem
                          ? "system-message"
                          : msg.sender === user.id
                          ? "outgoing"
                          : "incoming"
                      } ${msg._isOptimistic ? "optimistic" : ""} ${
                        msg.isDeleted ? "deleted" : ""
                      } ${
                        msg.urgencyLevel ? `urgency-${msg.urgencyLevel}` : ""
                      }`}
                    >
                      {!msg.isSystem && msg.sender !== user.id && (
                        <div className="sender-name">{msg.senderName}</div>
                      )}
                      {renderFileContent(msg)}
                      {messageToEdit && messageToEdit.id === msg.id ? (
                        <div className="edit-message-container">
                          <input
                            type="text"
                            className="edit-message-input"
                            value={editedMessageText}
                            onChange={(e) =>
                              setEditedMessageText(e.target.value)
                            }
                            autoFocus
                          />
                          <div className="edit-message-actions">
                            <button
                              className="edit-cancel-btn"
                              onClick={() => {
                                setMessageToEdit(null);
                                setEditedMessageText("");
                              }}
                            >
                              <i className="fas fa-times"></i> Cancel
                            </button>
                            <button
                              className="edit-save-btn"
                              onClick={() => saveEditedMessage()}
                            >
                              <i className="fas fa-check"></i> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        msg.text && (
                          <div className="message-text">{msg.text}</div>
                        )
                      )}
                      {msg.sender === user.id &&
                        !msg.isSystem &&
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
                            <i className="fas fa-ellipsis-v"></i>
                          </div>
                        )}
                      {showMessageOptions === msg.id && (
                        <div className="message-options message-options-vertical">
                          <button
                            className="message-option-btn"
                            onClick={() => handleEditMessage(msg)}
                          >
                            <i className="fas fa-edit"></i>
                            <span>Edit</span>
                          </button>
                          <button
                            className="message-option-btn delete"
                            onClick={() => handleDeleteMessageClick(msg)}
                          >
                            <i className="fas fa-trash-alt"></i>
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                      {msg.text &&
                        msg.sender !== user.id &&
                        (msg.text.trim().endsWith("?") ||
                          msg.text.trim().endsWith("!")) &&
                        !repliedMessages.includes(msg.id) && (
                          <div className="quick-reply-buttons">
                            {[
                              "✅ Sounds good to me!.",
                              "🤔 Could you clarify that?.",
                              "❌ I don't think that will work.",
                              "🙌 Great job, team!.",
                              "🕒 Let's revisit this later.",
                            ].map((suggestion, index) => (
                              <button
                                key={index}
                                className="quick-reply-btn"
                                onClick={() => {
                                  // Format the reply to mention the original sender
                                  const mentionReply = `@${msg.senderName} ${suggestion}`;

                                  // Create a temporary ID for optimistic update
                                  const tempId = `temp-${messageIdCounter}`;
                                  setMessageIdCounter((prev) => prev + 1);

                                  // Create optimistic message
                                  const optimisticMessage = {
                                    id: tempId,
                                    sender: user.id,
                                    senderName: user.name,
                                    groupId: selectedGroup.id,
                                    text: mentionReply,
                                    timestamp: new Date().toISOString(),
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
                                  socket.emit("send_group_message", {
                                    token: localStorage.getItem("token"),
                                    groupId: selectedGroup.id,
                                    text: mentionReply,
                                  });

                                  // Decrement the notification counter by 1 to counteract the duplicate counting
                                  if (document.hidden) {
                                    // Use negative count to subtract from the counter
                                    updateTitle("", false, -1);
                                  }

                                  // Mark this message as replied to
                                  setRepliedMessages((prev) => {
                                    const updatedReplies = [...prev, msg.id];
                                    // Save to localStorage for persistence
                                    localStorage.setItem(
                                      "repliedMessages",
                                      JSON.stringify(updatedReplies)
                                    );
                                    return updatedReplies;
                                  });
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      <div className="message-time">
                        {formatTime(msg.timestamp)}
                      </div>
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
                    id="group-file-input"
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
                      htmlFor="group-file-input"
                      className="attachment-button"
                      title="Upload a file from your device"
                      style={{
                        cursor: isUploading ? "not-allowed" : "pointer",
                      }}
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
              <TaskManagement
                groupId={selectedGroup.id}
                user={user}
                members={selectedGroup.members || []}
              />
            )}
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

            <div className="group-actions">
              {/* Search and Group Management Section */}
              <div className="group-actions-section">
                <div className="search-conversation-container">
                  <button
                    className="chat-action-button centered-button"
                    onClick={() => {
                      const searchBar =
                        document.querySelector(".chat-search-bar");
                      if (searchBar) {
                        searchBar.classList.toggle("active");
                        if (searchBar.classList.contains("active")) {
                          searchBar.querySelector("input").focus();
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
                          : result.senderName || "Unknown";

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
                              !messages[selectedGroup.id] ||
                              messages[selectedGroup.id].length === 0
                            ) {
                              console.log(
                                "Messages not loaded, loading now..."
                              );
                              axios
                                .get(`/api/groups/${selectedGroup.id}/messages`)
                                .then((response) => {
                                  setMessages((prev) => ({
                                    ...prev,
                                    [selectedGroup.id]: response.data,
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
                  className="group-action-button"
                  onClick={() => {
                    setNewGroupName(selectedGroup.name);
                    setShowRenameGroup(true);
                  }}
                >
                  <i className="fas fa-edit"></i> Rename Group
                </button>
              </div>

              {/* Notification and Member Management Section */}
              <div className="group-actions-section">
                <button
                  className="group-action-button"
                  onClick={() => {
                    // Get current muted groups
                    const mutedGroups = JSON.parse(
                      localStorage.getItem("mutedGroups") || "[]"
                    );

                    // Check if this group is already muted
                    const isCurrentlyMuted = mutedGroups.includes(
                      selectedGroup.id
                    );

                    if (isCurrentlyMuted) {
                      // Unmute: Remove from muted list
                      localStorage.setItem(
                        "mutedGroups",
                        JSON.stringify(
                          mutedGroups.filter((id) => id !== selectedGroup.id)
                        )
                      );
                    } else {
                      // Mute: Add to muted list
                      mutedGroups.push(selectedGroup.id);
                      localStorage.setItem(
                        "mutedGroups",
                        JSON.stringify(mutedGroups)
                      );
                    }

                    // Force re-render
                    setGroups((prevGroups) => [...prevGroups]);
                  }}
                >
                  {JSON.parse(
                    localStorage.getItem("mutedGroups") || "[]"
                  ).includes(selectedGroup?.id) ? (
                    <>
                      <i className="fas fa-bell-slash bell-animation"></i>
                      Unmute Notifications
                    </>
                  ) : (
                    <>
                      <i className="fas fa-bell bell-animation"></i>
                      Mute Notifications
                    </>
                  )}
                </button>
                <button
                  className="group-action-button"
                  onClick={() => setShowInviteMembers(true)}
                >
                  <i className="fas fa-user-plus"></i> Invite Members
                </button>
              </div>

              {/* Danger Zone Section */}
              <div className="group-actions-section">
                <button
                  className="group-action-button danger"
                  onClick={() => setShowLeaveConfirm(true)}
                >
                  <i className="fas fa-sign-out-alt"></i> Leave Group
                </button>
                <button
                  className="delete-messages-button"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <i className="fas fa-trash-alt"></i> Delete Messages
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRenameGroup && selectedGroup && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-title">Rename Group</div>
              <button
                className="modal-close"
                onClick={() => setShowRenameGroup(false)}
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
                <label>New Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter new group name"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowRenameGroup(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-button"
                onClick={async () => {
                  if (!newGroupName.trim()) {
                    setError("Group name cannot be empty");
                    return;
                  }

                  try {
                    // Call API to rename the group
                    const response = await axios.put(
                      `/api/groups/${selectedGroup.id}/rename`,
                      { name: newGroupName.trim() },
                      {
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${localStorage.getItem(
                            "token"
                          )}`,
                        },
                      }
                    );

                    if (response.data && response.data.success) {
                      // Update the group in state
                      setGroups((prevGroups) =>
                        prevGroups.map((group) =>
                          group.id === selectedGroup.id
                            ? { ...group, name: newGroupName.trim() }
                            : group
                        )
                      );

                      // Update selected group
                      setSelectedGroup((prev) => ({
                        ...prev,
                        name: newGroupName.trim(),
                      }));

                      // Close the modal
                      setShowRenameGroup(false);
                      setError("");
                    } else {
                      setError("Failed to rename group. Please try again.");
                    }
                  } catch (error) {
                    console.error("Error renaming group:", error);
                    setError("Failed to rename group. Please try again.");
                  }
                }}
              >
                Rename
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
                  setNewGroup({
                    name: "",
                    description: "",
                    isDepartmentGroup: false,
                    department: "",
                  });
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

              {/* Admin-only department group option */}
              {user && user.isAdmin && (
                <div className="form-group">
                  <label className="department-group-option">
                    <input
                      type="checkbox"
                      checked={newGroup.isDepartmentGroup}
                      onChange={(e) =>
                        setNewGroup({
                          ...newGroup,
                          isDepartmentGroup: e.target.checked,
                          department: e.target.checked
                            ? newGroup.department
                            : "",
                        })
                      }
                    />
                    <span>Auto-create group chat for a department</span>
                  </label>
                </div>
              )}

              {/* Department selection for department groups */}
              {newGroup.isDepartmentGroup && (
                <div className="form-group">
                  <label>Select Department</label>
                  <select
                    value={newGroup.department}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, department: e.target.value })
                    }
                    className="department-select"
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept, index) => (
                      <option key={index} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual member selection (only shown if not a department group) */}
              {!newGroup.isDepartmentGroup && (
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
              )}
            </div>
            <div className="modal-footer">
              <button
                className={`btn-primary ${
                  newGroup.isDepartmentGroup && newGroup.department
                    ? "department-group-btn"
                    : ""
                }`}
                onClick={handleCreateGroup}
                disabled={
                  !newGroup.name ||
                  (!newGroup.isDepartmentGroup &&
                    selectedMembers.length === 0) ||
                  (newGroup.isDepartmentGroup && !newGroup.department)
                }
              >
                {newGroup.isDepartmentGroup
                  ? "Create Department Group"
                  : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteMembers && selectedGroup && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-title">
                Invite Members to {selectedGroup.name}
              </div>
              <button
                className="modal-close"
                onClick={() => {
                  setShowInviteMembers(false);
                  setSelectedMembers([]);
                  setInviteError("");
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {inviteError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-circle"></i> {inviteError}
                </div>
              )}

              <div className="add-members-section">
                <div className="add-members-header">
                  <h4>Select Members to Invite</h4>
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

                <div className="available-contacts">
                  {contacts
                    .filter(
                      (contact) =>
                        !selectedGroup.members.some(
                          (member) => member.id === contact.id
                        )
                    )
                    .map((contact) => (
                      <div
                        className={`contact-item ${
                          selectedMembers.some((m) => m.id === contact.id)
                            ? "selected"
                            : ""
                        }`}
                        key={contact.id}
                        onClick={() => toggleMemberSelection(contact)}
                      >
                        <div
                          className="contact-avatar"
                          style={{
                            backgroundColor: generateAvatar(contact.name),
                          }}
                        >
                          {contact.name.charAt(0)}
                        </div>
                        <div className="contact-name">{contact.name}</div>
                        {selectedMembers.some((m) => m.id === contact.id) && (
                          <div className="selected-indicator">
                            <i className="fas fa-check"></i>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => handleInviteMembers(selectedMembers)}
                disabled={selectedMembers.length === 0}
              >
                Invite Selected Members ({selectedMembers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h4>Leave Group</h4>
            <p>
              Are you sure you want to leave this group? You won't receive any
              future messages.
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn-danger" onClick={handleLeaveGroup}>
                Leave Group
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h4>Delete Messages</h4>
            <p>
              Are you sure you want to delete all messages in this chat?
              Messages will only be deleted for you, other members will still be
              able to see them.
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
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

      {renderMembersDialog()}
    </div>
  );
}

export default GroupChatPage;
