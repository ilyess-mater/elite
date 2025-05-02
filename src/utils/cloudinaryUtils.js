import cloudinary from './cloudinaryConfig';

/**
 * Check if a URL is a Cloudinary URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is a Cloudinary URL
 */
export const isCloudinaryUrl = (url) => {
  if (!url) return false;
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
};

/**
 * Get optimized image URL with transformations
 * @param {string} url - The original Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} - Transformed URL
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!isCloudinaryUrl(url)) return url;
  
  // Default options
  const defaultOptions = {
    width: 800,
    quality: 'auto',
    format: 'auto',
  };
  
  // Merge options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Extract public ID from URL
  // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return url;
  
  const publicIdWithVersion = parts.slice(uploadIndex + 1).join('/');
  const publicId = publicIdWithVersion.replace(/v\d+\//, '');
  
  // Build transformation string
  const transformations = [
    `w_${mergedOptions.width}`,
    `q_${mergedOptions.quality}`,
    `f_${mergedOptions.format}`,
  ];
  
  // Insert transformations into URL
  parts.splice(uploadIndex + 1, 0, transformations.join(','));
  
  return parts.join('/');
};

/**
 * Get optimized video URL with transformations
 * @param {string} url - The original Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} - Transformed URL
 */
export const getOptimizedVideoUrl = (url, options = {}) => {
  if (!isCloudinaryUrl(url)) return url;
  
  // Default options
  const defaultOptions = {
    quality: 'auto',
    format: 'auto',
  };
  
  // Merge options
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Extract public ID from URL
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return url;
  
  // Build transformation string
  const transformations = [
    `q_${mergedOptions.quality}`,
    `f_${mergedOptions.format}`,
  ];
  
  // Insert transformations into URL
  parts.splice(uploadIndex + 1, 0, transformations.join(','));
  
  return parts.join('/');
};

export default {
  isCloudinaryUrl,
  getOptimizedImageUrl,
  getOptimizedVideoUrl,
};
