// Original title of the page
const originalTitle = document.title;
let titleInterval = null;
let unreadCount = 0;

/**
 * Update the page title to show a notification
 * @param {string} message - The message to show in the title
 * @param {boolean} flash - Whether to flash the title (alternate between original and new title)
 * @param {number} count - Optional count to increment by (default is 1)
 */
export const updateTitle = (message, flash = true, count = 1) => {
  // Only update title if the page is not visible
  if (document.hidden) {
    // Clear any existing interval
    if (titleInterval) {
      clearInterval(titleInterval);
    }
    
    // Increment unread count by the specified amount (default 1)
    unreadCount += count;
    
    // Create the new title with unread count
    const newTitle = `(${unreadCount}) ${message}`;
    
    // Set the title immediately
    document.title = newTitle;
    
    // If flash is true, alternate between the new title and original title
    if (flash) {
      let isOriginal = false;
      titleInterval = setInterval(() => {
        document.title = isOriginal ? newTitle : originalTitle;
        isOriginal = !isOriginal;
      }, 1000);
    }
  }
};

/**
 * Reset the page title to the original title
 */
export const resetTitle = () => {
  // Clear any existing interval
  if (titleInterval) {
    clearInterval(titleInterval);
    titleInterval = null;
  }
  
  // Reset unread count
  unreadCount = 0;
  
  // Reset the title
  document.title = originalTitle;
};

/**
 * Setup visibility change listener to reset title when page becomes visible
 */
export const setupTitleManager = () => {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resetTitle();
    }
  });
};
