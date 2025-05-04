import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from bson import ObjectId

# Create a blueprint for file upload routes
file_upload_bp = Blueprint('file_upload', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'pdf', 'doc', 'docx', 'txt', 'zip'}

# File size limits in bytes
FILE_SIZE_LIMITS = {
    "image": 5 * 1024 * 1024,  # 5MB
    "video": 25 * 1024 * 1024,  # 25MB
    "file": 25 * 1024 * 1024,   # 25MB
}

def allowed_file(filename):
    """Check if the file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type_category(filename):
    """Determine the file type category based on extension"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    if ext in ['png', 'jpg', 'jpeg', 'gif']:
        return 'image'
    elif ext in ['mp4', 'mov', 'avi', 'webm']:
        return 'video'
    else:
        return 'file'

@file_upload_bp.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file uploads"""
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']

    # If the user does not select a file, the browser submits an empty file without a filename
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Check if the file type is allowed
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    # Get conversation or group ID from the request
    conversation_id = request.form.get('conversation_id')

    # Determine file category
    category = get_file_type_category(file.filename)

    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer to beginning

    if file_size > FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']):
        max_mb = FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']) / (1024 * 1024)
        return jsonify({"error": f"File exceeds maximum size of {max_mb}MB for {category} files"}), 400

    try:
        # Create secure filename
        filename = secure_filename(file.filename)

        # Generate unique filename
        unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}_{filename}"

        # Determine target directory
        upload_folder = current_app.config['UPLOAD_FOLDER']

        if category == 'image':
            target_dir = os.path.join(upload_folder, 'images')
        elif category == 'video':
            target_dir = os.path.join(upload_folder, 'videos')
        else:
            target_dir = os.path.join(upload_folder, 'files')

        # Create conversation subdirectory if provided
        if conversation_id:
            target_dir = os.path.join(target_dir, str(conversation_id))

        # Create directories if they don't exist
        os.makedirs(target_dir, exist_ok=True)

        # Save the file
        file_path = os.path.join(target_dir, unique_filename)
        file.save(file_path)

        # Generate relative URL path - make sure it's consistent with the serve_file function
        # We want to create a URL path that starts with /api/files/images/ or /api/files/videos/ etc.
        # Extract the part of the path after 'uploads/'
        rel_path = file_path.split('uploads' + os.sep)[1]
        url_path = f"/api/files/{rel_path.replace(os.sep, '/')}"

        print(f"Generated URL path: {url_path} for file: {file_path}")

        # Return file information
        return jsonify({
            "success": True,
            "fileUrl": url_path,
            "fileName": filename,
            "fileType": category,
            "fileSize": file_size
        }), 200

    except Exception as e:
        return jsonify({"error": f"Error uploading file: {str(e)}"}), 500

@file_upload_bp.route('/api/files/<path:filename>', methods=['GET'])
def serve_file(filename):
    """Serve uploaded files"""
    try:
        # The base directory is the directory containing this file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        upload_folder = os.path.join(base_dir, 'uploads')

        # Print debug information
        print(f"[serve_file] Requested file: {filename}")
        print(f"[serve_file] Base directory: {base_dir}")
        print(f"[serve_file] Upload folder: {upload_folder}")
        print(f"[serve_file] Current working directory: {os.getcwd()}")

        # Normalize path separators to match the OS
        filename = filename.replace('/', os.sep)
        print(f"[serve_file] Normalized filename: {filename}")

        # Remove any 'uploads' prefix if present
        if filename.startswith('uploads' + os.sep):
            filename = filename[len('uploads' + os.sep):]
            print(f"[serve_file] Removed 'uploads' prefix: {filename}")

        # Construct the full path
        full_path = os.path.join(upload_folder, filename)
        print(f"[serve_file] Full path: {full_path}")

        # Get the directory and filename
        directory = os.path.dirname(full_path)
        actual_filename = os.path.basename(full_path)

        print(f"[serve_file] Directory: {directory}")
        print(f"[serve_file] Actual filename: {actual_filename}")

        # Check if the directory exists
        if not os.path.exists(directory):
            print(f"[serve_file] Directory not found: {directory}")
            # Try to create the directory structure
            try:
                os.makedirs(directory, exist_ok=True)
                print(f"[serve_file] Created directory: {directory}")
            except Exception as dir_err:
                print(f"[serve_file] Failed to create directory: {str(dir_err)}")
                return jsonify({"error": f"Directory not found: {directory}"}), 404

        # Check if the file exists
        if not os.path.exists(full_path):
            print(f"[serve_file] File not found: {full_path}")

            # List files in the directory to help debugging
            try:
                if os.path.exists(directory):
                    files_in_dir = os.listdir(directory)
                    print(f"[serve_file] Files in directory: {files_in_dir}")

                    # Check for case-insensitive match
                    for file in files_in_dir:
                        if file.lower() == actual_filename.lower():
                            print(f"[serve_file] Found case-insensitive match: {file}")
                            actual_filename = file
                            full_path = os.path.join(directory, file)
                            print(f"[serve_file] Updated full path: {full_path}")
                            break
            except Exception as list_err:
                print(f"[serve_file] Error listing directory: {str(list_err)}")

            # If still not found after case-insensitive check
            if not os.path.exists(full_path):
                return jsonify({"error": f"File not found: {filename}"}), 404

        # Use send_from_directory with the correct parameters
        try:
            print(f"[serve_file] Sending file from directory: {directory}, filename: {actual_filename}")
            response = send_from_directory(directory, actual_filename)

            # Set cache control headers to prevent caching issues
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'

            print(f"[serve_file] File sent successfully")
            return response
        except Exception as send_err:
            print(f"[serve_file] Error in send_from_directory: {str(send_err)}")
            import traceback
            traceback.print_exc()

            # Try alternative method as fallback
            try:
                print(f"[serve_file] Trying alternative method to serve file")
                with open(full_path, 'rb') as f:
                    file_data = f.read()

                from flask import Response
                response = Response(file_data)

                # Set content type based on file extension
                import mimetypes
                content_type, _ = mimetypes.guess_type(full_path)
                if content_type:
                    response.headers['Content-Type'] = content_type

                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'

                print(f"[serve_file] File served using alternative method")
                return response
            except Exception as alt_err:
                print(f"[serve_file] Alternative method failed: {str(alt_err)}")
                traceback.print_exc()
                return jsonify({"error": f"Failed to serve file using alternative method: {str(alt_err)}"}), 500

    except Exception as e:
        print(f"[serve_file] Error serving file: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error serving file: {str(e)}"}), 500
