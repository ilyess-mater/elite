/**
 * Utility functions for GoFile.io integration
 */

/**
 * Open GoFile upload page in a new tab for manual file upload
 */
export const openGoFileUploadPage = () => {
  window.open("https://gofile.io", "_blank");
};

/**
 * Check if a URL is a GoFile.io URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is a GoFile.io URL
 */
export const isGoFileUrl = (url) => {
  if (!url) return false;
  return url.includes("gofile.io");
};

/**
 * Get direct download URL from a GoFile.io content URL
 * This transforms a content page URL into a direct download URL
 *
 * @param {string} url - The GoFile.io content URL
 * @returns {string} - The direct download URL or the original URL if not a GoFile URL
 */
export const getDirectGoFileUrl = (url) => {
  if (!isGoFileUrl(url)) return url;

  // If it's already a direct download URL, return it
  if (url.includes("/download/")) return url;

  try {
    // Handle different GoFile URL formats

    // Format 1: https://gofile.io/d/abcdef
    if (url.includes("/d/")) {
      const contentId = url.split("/d/").pop().split("/")[0];
      if (contentId && contentId.length > 3) {
        return `https://gofile.io/d/${contentId}`;
      }
    }

    // Format 2: Just the content ID
    if (!url.includes("/") && url.length > 3) {
      return `https://gofile.io/d/${url}`;
    }

    // Format 3: Full URL with content ID at the end
    const contentId = url.split("/").pop();
    if (contentId && contentId.length > 3) {
      return `https://gofile.io/d/${contentId}`;
    }
  } catch (error) {
    console.error("Error parsing GoFile URL:", error);
  }

  // Return original URL if we couldn't parse it
  return url;
};
