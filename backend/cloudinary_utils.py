import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
api_key = os.getenv('CLOUDINARY_API_KEY')
api_secret = os.getenv('CLOUDINARY_API_SECRET')

# Check if Cloudinary credentials are set
if not cloud_name or not api_key or not api_secret:
    print("⚠️ WARNING: Cloudinary credentials are not properly set in .env file")
    print("⚠️ File uploads will fall back to local storage")

cloudinary.config(
    cloud_name=cloud_name,
    api_key=api_key,
    api_secret=api_secret,
    secure=True
)

# Print Cloudinary configuration status
print(f"Cloudinary configuration: cloud_name={cloud_name}, API key={'*' * (len(api_key) if api_key else 0)}")

def upload_file(file_data, resource_type="auto", folder="messaging_app"):
    """
    Upload a file to Cloudinary

    Args:
        file_data (str): Base64 encoded file data
        resource_type (str): Type of resource (auto, image, video, raw)
        folder (str): Folder in Cloudinary to store the file

    Returns:
        dict: Cloudinary upload response containing public_id, secure_url, etc.
    """
    # Check if Cloudinary is properly configured
    if not cloud_name or not api_key or not api_secret:
        print("⚠️ Cannot upload to Cloudinary: credentials not set")
        return None

    # Check if file_data is valid
    if not file_data:
        print("⚠️ Cannot upload to Cloudinary: no file data provided")
        return None

    try:
        # If file_data is a base64 string with data URL prefix, remove it
        if isinstance(file_data, str) and ',' in file_data:
            file_data = file_data.split(',', 1)[1]

        # Validate base64 data
        try:
            import base64
            base64.b64decode(file_data)
        except Exception as base64_error:
            print(f"⚠️ Invalid base64 data: {str(base64_error)}")
            return None

        # Upload to Cloudinary with timeout and retries
        upload_options = {
            "resource_type": resource_type,
            "folder": folder,
            "timeout": 60,  # 60 seconds timeout
            "use_filename": True,
            "unique_filename": True,
            "overwrite": False
        }

        print(f"🔄 Uploading file to Cloudinary (resource_type: {resource_type}, folder: {folder})...")

        upload_result = cloudinary.uploader.upload(
            f"data:;base64,{file_data}",
            **upload_options
        )

        # Log successful upload with more details
        print(f"✅ SUCCESS: File uploaded to Cloudinary:")
        print(f"  - Public ID: {upload_result['public_id']}")
        print(f"  - URL: {upload_result['secure_url']}")
        print(f"  - Resource Type: {resource_type}")
        print(f"  - Size: {upload_result.get('bytes', 'unknown')} bytes")
        print(f"  - Format: {upload_result.get('format', 'unknown')}")

        return upload_result
    except cloudinary.exceptions.Error as cloud_error:
        print(f"⚠️ Cloudinary API error: {str(cloud_error)}")
        return None
    except Exception as e:
        print(f"⚠️ Error uploading to Cloudinary: {str(e)}")
        return None

def get_resource_type(file_type):
    """
    Determine the Cloudinary resource type based on file MIME type

    Args:
        file_type (str): MIME type of the file

    Returns:
        str: Cloudinary resource type (image, video, raw)
    """
    if file_type.startswith('image/'):
        return 'image'
    elif file_type.startswith('video/'):
        return 'video'
    else:
        return 'raw'

def delete_file(public_id, resource_type="image"):
    """
    Delete a file from Cloudinary

    Args:
        public_id (str): Public ID of the file to delete
        resource_type (str): Type of resource (image, video, raw)

    Returns:
        dict: Cloudinary deletion response
    """
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        print(f"File deleted from Cloudinary: {public_id}")
        return result
    except Exception as e:
        print(f"Error deleting from Cloudinary: {str(e)}")
        return None
