import os
import base64
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename

# File size limits in bytes
FILE_SIZE_LIMITS = {
    "image": 5 * 1024 * 1024,  # 5MB
    "video": 25 * 1024 * 1024,  # 25MB
    "file": 25 * 1024 * 1024,   # 25MB
}

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Create subdirectories for different file types
IMAGES_FOLDER = os.path.join(UPLOAD_FOLDER, 'images')
VIDEOS_FOLDER = os.path.join(UPLOAD_FOLDER, 'videos')
FILES_FOLDER = os.path.join(UPLOAD_FOLDER, 'files')

os.makedirs(IMAGES_FOLDER, exist_ok=True)
os.makedirs(VIDEOS_FOLDER, exist_ok=True)
os.makedirs(FILES_FOLDER, exist_ok=True)

def get_file_type_category(mime_type):
    """Determine the file type category based on MIME type"""
    if mime_type.startswith('image/'):
        return 'image'
    elif mime_type.startswith('video/'):
        return 'video'
    else:
        return 'file'

def get_file_size_from_base64(base64_data):
    """Calculate the size of a file from its base64 representation"""
    # Remove the data URL prefix if present
    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]
    
    # Calculate size: base64 encodes 3 bytes into 4 characters
    padding = base64_data.count('=')
    return (len(base64_data) * 3 // 4) - padding

def validate_file_size(file_data, file_type):
    """Validate file size against limits"""
    if not file_data:
        return False, "No file data provided"
    
    # Get file category
    category = get_file_type_category(file_type)
    
    # Calculate file size
    file_size = get_file_size_from_base64(file_data)
    
    # Check against limits
    if file_size > FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']):
        max_mb = FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']) / (1024 * 1024)
        return False, f"File exceeds maximum size of {max_mb}MB for {category} files"
    
    return True, None

def save_file(file_data, file_type, file_name, conversation_id=None):
    """
    Save a file to the appropriate directory
    
    Args:
        file_data (str): Base64 encoded file data
        file_type (str): MIME type of the file
        file_name (str): Original filename
        conversation_id (str, optional): ID of the conversation/group
        
    Returns:
        str: URL path to the saved file
    """
    try:
        # Validate file size
        is_valid, error_message = validate_file_size(file_data, file_type)
        if not is_valid:
            print(f"File validation error: {error_message}")
            return None
        
        # Determine file category and target directory
        category = get_file_type_category(file_type)
        if category == 'image':
            target_dir = IMAGES_FOLDER
        elif category == 'video':
            target_dir = VIDEOS_FOLDER
        else:
            target_dir = FILES_FOLDER
            
        # Create conversation subdirectory if provided
        if conversation_id:
            target_dir = os.path.join(target_dir, str(conversation_id))
            os.makedirs(target_dir, exist_ok=True)
        
        # Generate a unique filename
        secure_name = secure_filename(file_name)
        unique_filename = f"{uuid.uuid4()}_{secure_name}"
        file_path = os.path.join(target_dir, unique_filename)
        
        # Extract the base64 data (remove data URL prefix if present)
        if ',' in file_data:
            file_data = file_data.split(',', 1)[1]
            
        # Decode and save the file
        with open(file_path, 'wb') as f:
            f.write(base64.b64decode(file_data))
            
        # Return the relative URL path
        rel_path = os.path.relpath(file_path, os.path.dirname(os.path.abspath(__file__)))
        return f"/api/files/{rel_path.replace(os.sep, '/')}"
        
    except Exception as e:
        print(f"Error saving file: {str(e)}")
        return None
