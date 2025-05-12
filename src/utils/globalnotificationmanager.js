/**
 * Global Notification Manager
 *
 * This utility manages browser tab notifications across different pages.
 * It ensures notifications appear even when users are in different conversations
 * or pages, and properly resets the title when messages are viewed.
 */

// Store the original title to reset to
const originalTitle = document.title;

// Interval reference for title flashing
let titleIntervalRef = null;

// Track unread messages by group/sender
const unreadMessagesBySender = new Map();

// Track which messages have been counted
const countedMessages = new Set();

// Flag to track if notifications have been seen
let notificationsSeen = true;

// Initialize from localStorage
const storedNotificationsSeen = localStorage.getItem("notificationsSeen");
if (storedNotificationsSeen === "false") {
  notificationsSeen = false;
}

/**
 * Update the page title to show a notification
 *
 * @param {Object} options - Notification options
 * @param {string} options.message - The message to show in the title
 * @param {boolean} options.flash - Whether to flash the title
 * @param {number} options.count - Count to increment by (default 1)
 * @param {string} options.senderId - ID of the message sender
 * @param {string} options.groupId - ID of the group (for group messages)
 * @param {string} options.messageId - Unique ID of the message
 * @param {string} options.urgency - Message urgency level ("urgent", "high", "normal", "low")
 */
export const updateTitle = (options) => {
  const {
    message,
    flash = true,
    count = 1,
    senderId = null,
    groupId = null,
    messageId = null,
    urgency = "normal",
  } = options;

  // Only show notifications for urgent/high priority messages when in a different tab
  if (document.hidden) {
    // Check if this is a new message (not just a tab change)
    const isNewMessage = messageId && !countedMessages.has(messageId);

    // If this is a new message, mark notifications as not seen
    if (isNewMessage) {
      notificationsSeen = false;
      localStorage.setItem("notificationsSeen", "false");
      console.log("New message received, starting new notification session");
    }

    // If we have a message ID, check if it's already been counted
    if (messageId) {
      // If this message has already been counted, don't count it again
      if (countedMessages.has(messageId)) {
        console.log(
          `Message ${messageId} already counted for notifications, skipping`
        );
        return;
      }

      // Only proceed for urgent or high priority messages when not in the same conversation
      if (urgency !== "urgent" && urgency !== "high") {
        console.log(
          `Message ${messageId} is not urgent or high priority, skipping notification`
        );
        return;
      }

      // Mark this message as counted
      countedMessages.add(messageId);
    }

    // Clear any existing interval
    if (titleIntervalRef) {
      clearInterval(titleIntervalRef);
      titleIntervalRef = null;
    }

    // If we have a sender ID, update their unread count
    const key = groupId ? `group-${groupId}-${senderId}` : `direct-${senderId}`;
    if (senderId) {
      // Get current count for this sender
      const currentCount = unreadMessagesBySender.get(key) || 0;

      // Update the count
      const newCount = Math.max(0, currentCount + count);

      // Store the updated count
      if (newCount > 0) {
        unreadMessagesBySender.set(key, newCount);
      } else {
        unreadMessagesBySender.delete(key);
      }
    }

    // Calculate total unread count
    const totalUnreadCount = Array.from(unreadMessagesBySender.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // Only update title if we have a message or unread count
    if (message && totalUnreadCount > 0) {
      // Create the new title with unread count
      const newTitle = `(${totalUnreadCount}) ${message}`;

      // Set the title immediately
      document.title = newTitle;

      // If flash is true and we have unread messages, alternate between the new title and original title
      if (flash) {
        let isOriginal = false;
        titleIntervalRef = setInterval(() => {
          document.title = isOriginal ? newTitle : originalTitle;
          isOriginal = !isOriginal;
        }, 1000);
      }
    } else if (totalUnreadCount === 0) {
      // Reset to original title if no unread messages
      document.title = originalTitle;
    }
  }
};

/**
 * Reset the page title to the original title
 */
export const resetTitle = () => {
  // Clear any existing interval
  if (titleIntervalRef) {
    clearInterval(titleIntervalRef);
    titleIntervalRef = null;
  }

  // Clear all unread messages
  unreadMessagesBySender.clear();

  // Clear the counted messages set
  countedMessages.clear();

  // Reset the title to the original title (EliteApp)
  document.title = originalTitle;

  // Mark notifications as seen
  notificationsSeen = true;
  localStorage.setItem("notificationsSeen", "true");

  // Force a second title reset after a short delay to ensure it takes effect
  setTimeout(() => {
    document.title = originalTitle;
  }, 50);
};

/**
 * Setup visibility change listener to reset title when page becomes visible
 */
export const setupVisibilityChangeListener = () => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // When the user clicks on the tab, completely reset all notifications
      resetTitle();

      // Explicitly set the title back to the original title (EliteApp)
      document.title = originalTitle;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Return a cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    // Clear any interval when component unmounts
    if (titleIntervalRef) {
      clearInterval(titleIntervalRef);
      titleIntervalRef = null;
    }

    // Ensure title is reset when component unmounts
    document.title = originalTitle;
  };
};

/**
 * Setup storage event listener to sync notification state across tabs
 */
export const setupStorageEventListener = () => {
  const handleStorageChange = (e) => {
    if (e.key === "notificationsSeen") {
      console.log(
        "Notification seen state changed in another tab:",
        e.newValue
      );
      notificationsSeen = e.newValue === "true";

      // If notifications were marked as seen, reset the title
      if (e.newValue === "true") {
        resetTitle();
      }
    }
  };

  window.addEventListener("storage", handleStorageChange);

  // Return a cleanup function
  return () => {
    window.removeEventListener("storage", handleStorageChange);
  };
};
