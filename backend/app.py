from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from pymongo import MongoClient
import os
import json
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from bson import ObjectId
from task_routes import task_routes
from file_upload import file_upload_bp
from category_routes import category_routes
from encryption import encrypt_message, decrypt_message, generate_encryption_key

# Note: We're avoiding monkey patching due to compatibility issues with Python 3.13
# Instead, we'll use a simpler configuration that works with the standard library

# Load environment variables
load_dotenv()

# Custom JSON encoder to handle ObjectId
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret_key')
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',  # Using threading mode for Python 3.13 compatibility
    ping_timeout=120,  # Increased ping timeout to 120 seconds
    ping_interval=25,  # Keep ping interval at 25 seconds
    logger=True,  # Enable logging
    engineio_logger=True  # Enable Engine.IO logging
)

# MongoDB connection
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client.elite_messaging
users_collection = db.users
messages_collection = db.messages
contacts_collection = db.contacts
groups_collection = db.groups
group_messages_collection = db.group_messages
tasks_collection = db.tasks

# No OpenAI integration

# Register blueprints
app.register_blueprint(task_routes)
app.register_blueprint(file_upload_bp)
app.register_blueprint(category_routes)

# Create uploads directory if it doesn't exist
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25MB max file size

# Import file utility functions from file_upload
from file_upload import allowed_file, get_file_type_category

# Helper function to get current UTC time (replacing deprecated datetime.utcnow())
def get_utc_now():
    """Get current UTC time using timezone-aware approach"""
    return datetime.now(timezone.utc)

# Helper function for file validation and saving (for socket.io)
def validate_file_size(file_data, file_type):
    """Validate file size against limits"""
    if not file_data:
        return False, "No file data provided"

    # Get file category
    category = 'image' if file_type.startswith('image/') else 'video' if file_type.startswith('video/') else 'file'

    # Calculate file size (base64 data)
    if ',' in file_data:
        file_data = file_data.split(',', 1)[1]

    # Estimate file size (base64 is ~4/3 the size of binary)
    file_size = len(file_data) * 3 / 4

    # File size limits in bytes
    FILE_SIZE_LIMITS = {
        "image": 5 * 1024 * 1024,  # 5MB
        "video": 25 * 1024 * 1024,  # 25MB
        "file": 25 * 1024 * 1024,   # 25MB
    }

    # Check against limits
    if file_size > FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']):
        max_mb = FILE_SIZE_LIMITS.get(category, FILE_SIZE_LIMITS['file']) / (1024 * 1024)
        return False, f"File exceeds maximum size of {max_mb}MB for {category} files"

    return True, None

def save_file(file_data, file_type, file_name, conversation_id=None):
    """Save a file from base64 data (for socket.io)"""
    import base64
    import uuid
    from werkzeug.utils import secure_filename

    try:
        print(f"Saving file: {file_name}, type: {file_type}, conversation_id: {conversation_id}")

        # Determine file category and target directory
        category = 'image' if file_type.startswith('image/') else 'video' if file_type.startswith('video/') else 'file'
        print(f"File category determined: {category}")

        if category == 'image':
            target_dir = os.path.join(UPLOAD_FOLDER, 'images')
        elif category == 'video':
            target_dir = os.path.join(UPLOAD_FOLDER, 'videos')
        else:
            target_dir = os.path.join(UPLOAD_FOLDER, 'files')

        # Create target directory if it doesn't exist
        os.makedirs(target_dir, exist_ok=True)
        print(f"Base target directory: {target_dir}")

        # Create conversation subdirectory if provided
        if conversation_id:
            target_dir = os.path.join(target_dir, str(conversation_id))
            os.makedirs(target_dir, exist_ok=True)
            print(f"Conversation directory created: {target_dir}")

        # Generate a unique filename
        secure_name = secure_filename(file_name)
        unique_filename = f"{uuid.uuid4()}_{secure_name}"
        file_path = os.path.join(target_dir, unique_filename)
        print(f"File will be saved to: {file_path}")

        # Extract the base64 data (remove data URL prefix if present)
        if ',' in file_data:
            print("Extracting base64 data from data URL")
            file_data = file_data.split(',', 1)[1]

        # Decode and save the file
        try:
            decoded_data = base64.b64decode(file_data)
            print(f"Decoded data length: {len(decoded_data)} bytes")

            with open(file_path, 'wb') as f:
                f.write(decoded_data)

            print(f"File saved successfully to {file_path}")

            # Verify the file was created
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                print(f"Verified file exists, size: {file_size} bytes")
            else:
                print(f"WARNING: File was not created at {file_path}")
                return None
        except Exception as e:
            print(f"Error writing file: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

        # Generate relative URL path - make sure it's consistent with the file_upload.py
        # We want to create a URL path that starts with /api/files/images/ or /api/files/videos/ etc.
        try:
            # Extract the part of the path after 'uploads/'
            rel_path = file_path.split('uploads' + os.sep)[1]
            url_path = f"/api/files/{rel_path.replace(os.sep, '/')}"
            print(f"Generated URL path: {url_path}")
            return url_path
        except Exception as e:
            print(f"Error generating URL path: {str(e)}")
            # Fallback method for path generation
            try:
                rel_path = os.path.relpath(file_path, UPLOAD_FOLDER)
                url_path = f"/api/files/{rel_path.replace(os.sep, '/')}"
                print(f"Generated fallback URL path: {url_path}")
                return url_path
            except Exception as e2:
                print(f"Error generating fallback URL path: {str(e2)}")
                return None

    except Exception as e:
        print(f"Error in save_file: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

# Active users dictionary to track online status
active_users = {}

# Helper functions
def generate_token(user_id):
    """Generate JWT token for authenticated user"""
    now = get_utc_now()
    payload = {
        'exp': now + timedelta(days=1),
        'iat': now,
        'sub': str(user_id)
    }
    return jwt.encode(
        payload,
        app.config.get('SECRET_KEY'),
        algorithm='HS256'
    )

def verify_token(token):
    """Verify JWT token and return user_id if valid"""
    try:
        payload = jwt.decode(
            token,
            app.config.get('SECRET_KEY'),
            algorithms=['HS256']
        )
        return payload['sub']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def delete_group_messages(group_id, user_id=None):
    """Mark all messages in a group as deleted for a specific user

    If user_id is provided, only mark messages as deleted for that user.
    If user_id is None, actually delete the messages (used when deleting the entire group).
    """
    try:
        if user_id:
            # Mark messages as deleted for this user only
            group_messages_collection.update_many(
                {"groupId": ObjectId(group_id)},
                {"$addToSet": {"deletedBy": ObjectId(user_id)}}
            )
        else:
            # Actually delete messages (only used when deleting the entire group)
            group_messages_collection.delete_many({"groupId": ObjectId(group_id)})
        return True
    except Exception as e:
        print(f"Error deleting group messages: {e}")
        return False

# Authentication routes
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    is_admin = data.get('isAdmin', False)
    admin_password = data.get('adminPassword')

    # Basic validation
    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    # Check if email already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 409

    # Validate admin registration
    if is_admin and admin_password != "admin_master":
        return jsonify({"error": "Invalid admin password"}), 401

    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Create user document
    admin_role = data.get('adminRole', 'admin') if is_admin else None
    department = data.get('department', '')
    now = get_utc_now()
    user = {
        "name": username,
        "email": email,
        "password": hashed_password,
        "isAdmin": is_admin,
        "adminRole": admin_role,
        "department": department,
        "createdAt": now,
        "lastActive": now
    }

    # Insert user into database
    result = users_collection.insert_one(user)
    user_id = result.inserted_id

    # Generate token
    token = generate_token(user_id)

    # Return user info and token
    return jsonify({
        "user": {
            "id": str(user_id),
            "name": username,
            "email": email,
            "isAdmin": is_admin,
            "adminRole": admin_role,
            "department": department
        },
        "token": token
    }), 201

@app.route('/api/auth/signin', methods=['POST'])
def signin():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Basic validation
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # Find user by email
    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Check password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
        return jsonify({"error": "Invalid credentials"}), 401

    # Update last active timestamp
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastActive": get_utc_now()}}
    )

    # Generate token
    token = generate_token(user["_id"])

    # Return user info and token
    return jsonify({
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "isAdmin": user.get("isAdmin", False),
            "adminRole": user.get("adminRole", None),
            "department": user.get("department", "")
        },
        "token": token
    }), 200

@app.route('/api/auth/change-password', methods=['POST'])
def change_password():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400

    # Récupérer l'utilisateur
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Vérifier l'ancien mot de passe
    if not bcrypt.checkpw(current_password.encode('utf-8'), user['password']):
        return jsonify({"error": "Current password is incorrect"}), 401

    # Hasher et enregistrer le nouveau mot de passe
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())

    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed_password}}
    )

    return jsonify({"message": "Password changed successfully"}), 200

# Contacts routes
@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Find all contacts for the user
    user_contacts = contacts_collection.find({"userId": ObjectId(user_id)})

    # Get contact details
    contacts_list = []
    for contact in user_contacts:
        contact_user = users_collection.find_one({"_id": contact["contactId"]})
        if contact_user:
            # Include categoryId if it exists
            contact_data = {
                "id": str(contact_user["_id"]),
                "name": contact_user["name"],
                "email": contact_user["email"],
                "department": contact_user.get("department", ""),
                "isActive": str(contact_user["_id"]) in active_users,
                "lastActivity": contact.get("lastActivity", contact.get("createdAt", get_utc_now())).isoformat()
            }

            # Add categoryIds array if it exists
            if "categoryIds" in contact and contact["categoryIds"]:
                contact_data["categoryIds"] = [str(cat_id) for cat_id in contact["categoryIds"]]
                print(f"Contact {contact_data['name']} has categories: {contact_data['categoryIds']}")

                # For backward compatibility, set the first category as the main categoryId
                if contact["categoryIds"]:
                    contact_data["categoryId"] = str(contact["categoryIds"][0])
            # Fall back to single categoryId if categoryIds doesn't exist
            elif "categoryId" in contact:
                contact_data["categoryId"] = str(contact["categoryId"])
                contact_data["categoryIds"] = [str(contact["categoryId"])]
                print(f"Contact {contact_data['name']} has category: {contact_data['categoryId']}")
            else:
                print(f"Contact {contact_data['name']} has no category")
                contact_data["categoryIds"] = []

            contacts_list.append(contact_data)

    # Sort contacts by lastActivity (most recent first)
    contacts_list.sort(key=lambda x: x["lastActivity"], reverse=True)

    print(f"Returning {len(contacts_list)} contacts")
    return jsonify(contacts_list), 200

@app.route('/api/contacts', methods=['POST'])
def add_contact():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Check if the contact exists in the database
    contact_user = users_collection.find_one({"email": email})
    if not contact_user:
        return jsonify({"error": "This user is not registered on the platform"}), 404

    # Check if contact is already added
    existing_contact = contacts_collection.find_one({
        "userId": ObjectId(user_id),
        "contactId": contact_user["_id"]
    })

    if existing_contact:
        return jsonify({"error": "This contact is already added"}), 409

    # Get the department from the contact's user profile
    department = contact_user.get("department", "")

    # Add the contact
    current_time = get_utc_now()
    contact = {
        "userId": ObjectId(user_id),
        "contactId": contact_user["_id"],
        "department": department,
        "createdAt": current_time,
        "lastActivity": current_time,
        "categoryIds": []  # Initialize empty categoryIds array
    }

    # Insert the contact first
    contact_id = contacts_collection.insert_one(contact).inserted_id

    # Now handle department categories
    if department:
        # Import the ensure_department_categories function
        from category_routes import ensure_department_categories, DEPARTMENT_COLORS

        # Create department categories if they don't exist
        ensure_department_categories(user_id)

        # Find the department category or create it if it doesn't exist
        department_category = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": department,
            "isDepartmentCategory": True
        })

        if not department_category:
            # Create the department category
            color = DEPARTMENT_COLORS.get(department, "#4A76A8")
            new_category = {
                "userId": ObjectId(user_id),
                "name": department,
                "color": color,
                "isDepartmentCategory": True,
                "createdAt": get_utc_now()
            }

            category_id = db.categories.insert_one(new_category).inserted_id

            # Update the contact with the new category ID in the categoryIds array
            contacts_collection.update_one(
                {"_id": contact_id},
                {
                    "$set": {"categoryId": category_id},  # For backward compatibility
                    "$push": {"categoryIds": category_id}
                }
            )

            # Update our contact object for the response
            contact["categoryId"] = category_id
            contact["categoryIds"] = [category_id]
        else:
            # Update the contact with the existing category ID in the categoryIds array
            contacts_collection.update_one(
                {"_id": contact_id},
                {
                    "$set": {"categoryId": department_category["_id"]},  # For backward compatibility
                    "$push": {"categoryIds": department_category["_id"]}
                }
            )

            # Update our contact object for the response
            contact["categoryId"] = department_category["_id"]
            contact["categoryIds"] = [department_category["_id"]]

    return jsonify({
        "id": str(contact_user["_id"]),
        "name": contact_user["name"],
        "email": contact_user["email"],
        "department": contact_user.get("department", ""),
        "isActive": str(contact_user["_id"]) in active_users,
        "categoryId": str(contact.get("categoryId")) if "categoryId" in contact else None
    }), 201

@app.route('/api/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Vérifier que le contact existe et appartient à l'utilisateur
        contact = contacts_collection.find_one({
            "userId": ObjectId(user_id),
            "contactId": ObjectId(contact_id)
        })

        if not contact:
            return jsonify({"error": "Contact not found"}), 404

        # Supprimer le contact
        contacts_collection.delete_one({
            "userId": ObjectId(user_id),
            "contactId": ObjectId(contact_id)
        })

        # Supprimer également les messages associés
        messages_collection.delete_many({
            "$or": [
                {"senderId": ObjectId(user_id), "receiverId": ObjectId(contact_id)},
                {"senderId": ObjectId(contact_id), "receiverId": ObjectId(user_id)}
            ]
        })

        return jsonify({"message": "Contact deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting contact: {e}")
        return jsonify({"error": "Failed to delete contact"}), 500

# Messaging routes
@app.route('/api/messages/<contact_id>', methods=['GET', 'DELETE'])
def messages_operations(contact_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == 'GET':
        # Get messages between user and contact, excluding those deleted by the current user
        messages = messages_collection.find({
            "$and": [
                {
                    "$or": [
                        {"senderId": ObjectId(user_id), "receiverId": ObjectId(contact_id)},
                        {"senderId": ObjectId(contact_id), "receiverId": ObjectId(user_id)}
                    ]
                },
                {
                    "$or": [
                        {"deletedBy": {"$exists": False}},
                        {"deletedBy": {"$not": {"$elemMatch": {"$eq": ObjectId(user_id)}}}}
                    ]
                }
            ]
        }).sort("timestamp", 1)

        # Format messages for the frontend
        messages_list = []
        for msg in messages:
            messages_list.append({
                "id": str(msg["_id"]),
                "sender": str(msg["senderId"]),
                "text": msg["text"],
                "timestamp": msg["timestamp"].isoformat(),
                "fileUrl": msg.get("fileUrl"),
                "fileType": msg.get("fileType"),
                "fileName": msg.get("fileName"),
                "isDeleted": msg.get("isDeleted", False)
            })

        # Always update lastActivity for this conversation when messages are viewed
        # This ensures conversations move to the top when messages are received, not just when sent
        current_time = get_utc_now()

        # Update lastActivity in contacts collection for both users
        contacts_collection.update_one(
            {"userId": ObjectId(user_id), "contactId": ObjectId(contact_id)},
            {"$set": {"lastActivity": current_time}}
        )

        # Also update the contact in the other user's contact list
        contacts_collection.update_one(
            {"userId": ObjectId(contact_id), "contactId": ObjectId(user_id)},
            {"$set": {"lastActivity": current_time}}
        )

        return jsonify(messages_list), 200

    elif request.method == 'DELETE':
        try:
            # Mark all messages between user and contact as deleted for this user only
            result = messages_collection.update_many(
                {
                    "$or": [
                        {"senderId": ObjectId(user_id), "receiverId": ObjectId(contact_id)},
                        {"senderId": ObjectId(contact_id), "receiverId": ObjectId(user_id)}
                    ]
                },
                {"$addToSet": {"deletedBy": ObjectId(user_id)}}
            )

            return jsonify({
                "message": "Messages deleted successfully",
                "count": result.modified_count
            }), 200
        except Exception as e:
            print(f"Error deleting messages: {e}")
            return jsonify({"error": "Failed to delete messages"}), 500

@app.route('/api/messages/<contact_id>/search', methods=['GET'])
def search_messages(contact_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    query = request.args.get('query', '')
    if not query:
        return jsonify({"error": "Search query is required"}), 400

    # Search messages between user and contact that contain the query, excluding deleted ones
    messages = messages_collection.find({
        "$and": [
            {
                "$or": [
                    {"senderId": ObjectId(user_id), "receiverId": ObjectId(contact_id)},
                    {"senderId": ObjectId(contact_id), "receiverId": ObjectId(user_id)}
                ]
            },
            {"text": {"$regex": query, "$options": "i"}},  # Case-insensitive search
            {
                "$or": [
                    {"deletedBy": {"$exists": False}},
                    {"deletedBy": {"$not": {"$elemMatch": {"$eq": ObjectId(user_id)}}}}
                ]
            }
        ]
    }).sort("timestamp", 1)

    # Format messages for the frontend
    results = []
    for msg in messages:
        sender_id = str(msg["senderId"])
        sender = users_collection.find_one({"_id": msg["senderId"]})
        sender_name = sender["name"] if sender else "Unknown"

        results.append({
            "id": str(msg["_id"]),
            "sender": sender_id,
            "senderName": sender_name,
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
        })

    return jsonify({"results": results, "count": len(results)}), 200

# Admin routes
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is admin
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    # Get all users
    all_users = users_collection.find({})
    users_list = []

    for user in all_users:
        users_list.append({
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "isAdmin": user.get("isAdmin", False),
            "adminRole": user.get("adminRole", None),
            "department": user.get("department", ""),
            "isActive": str(user["_id"]) in active_users,
            "lastActive": user.get("lastActive", user.get("createdAt")).isoformat(),
            "createdAt": user.get("createdAt").isoformat() if "createdAt" in user else None
        })

    return jsonify(users_list), 200

@app.route('/api/admin/messages', methods=['GET'])
def get_all_messages():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is admin
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    # Check if user is admin master (for handling encrypted messages)
    is_admin_master = user.get("adminRole") == "admin_master"

    # Get all messages
    all_messages = messages_collection.find({}).sort("timestamp", -1).limit(100)
    messages_list = []

    sender_cache = {}
    receiver_cache = {}

    for msg in all_messages:
        sender_id = str(msg["senderId"])
        receiver_id = str(msg["receiverId"])

        if sender_id not in sender_cache:
            sender = users_collection.find_one({"_id": ObjectId(sender_id)})
            sender_cache[sender_id] = sender["name"] if sender else "Unknown"

        if receiver_id not in receiver_cache:
            receiver = users_collection.find_one({"_id": ObjectId(receiver_id)})
            receiver_cache[receiver_id] = receiver["name"] if receiver else "Unknown"

        # Include information about who deleted the message
        deleted_by = []
        if "deletedBy" in msg and msg["deletedBy"]:
            for deleted_user_id in msg["deletedBy"]:
                deleted_user = users_collection.find_one({"_id": deleted_user_id})
                if deleted_user:
                    deleted_by.append({
                        "id": str(deleted_user_id),
                        "name": deleted_user["name"]
                    })

        # Handle encrypted messages differently for regular admins vs admin masters
        message_text = msg["text"]
        is_encrypted = msg.get("encrypted", False)

        # If message is encrypted, always show placeholder text regardless of who sent it
        # This ensures admin's own messages are also shown as encrypted
        if is_encrypted:
            message_text = "End-to-End Encrypted Message"

        messages_list.append({
            "id": str(msg["_id"]),
            "senderId": sender_id,
            "senderName": sender_cache[sender_id],
            "receiverId": receiver_id,
            "receiverName": receiver_cache[receiver_id],
            "text": message_text,
            "timestamp": msg["timestamp"].isoformat(),
            "isDeleted": msg.get("isDeleted", False),
            "deletedBy": deleted_by,
            "fileUrl": msg.get("fileUrl"),
            "fileType": msg.get("fileType"),
            "fileName": msg.get("fileName"),
            "encrypted": is_encrypted,
            "urgencyLevel": msg.get("urgencyLevel", "normal")
        })

    return jsonify(messages_list), 200

@app.route('/api/admin/group-messages', methods=['GET'])
def get_all_group_messages():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is admin
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    # Check if user is admin master (for handling encrypted messages)
    is_admin_master = user.get("adminRole") == "admin_master"

    # Get all group messages
    all_messages = group_messages_collection.find({}).sort("timestamp", -1).limit(100)
    messages_list = []

    sender_cache = {}
    group_cache = {}

    for msg in all_messages:
        sender_id = str(msg["senderId"])
        group_id = str(msg["groupId"])

        if sender_id not in sender_cache:
            sender = users_collection.find_one({"_id": ObjectId(sender_id)})
            sender_cache[sender_id] = sender["name"] if sender else "Unknown"

        if group_id not in group_cache:
            group = groups_collection.find_one({"_id": ObjectId(group_id)})
            group_cache[group_id] = group["name"] if group else "Unknown Group"

        # Include information about who deleted the message
        deleted_by = []
        if "deletedBy" in msg and msg["deletedBy"]:
            for deleted_user_id in msg["deletedBy"]:
                deleted_user = users_collection.find_one({"_id": deleted_user_id})
                if deleted_user:
                    deleted_by.append({
                        "id": str(deleted_user_id),
                        "name": deleted_user["name"]
                    })

        # Handle encrypted messages differently for regular admins vs admin masters
        message_text = msg["text"]
        is_encrypted = msg.get("encrypted", False)

        # If message is encrypted, always show placeholder text regardless of who sent it
        # This ensures admin's own messages are also shown as encrypted
        if is_encrypted:
            message_text = "End-to-End Encrypted Message"

        messages_list.append({
            "id": str(msg["_id"]),
            "senderId": sender_id,
            "senderName": sender_cache[sender_id],
            "groupId": group_id,
            "groupName": group_cache[group_id],
            "text": message_text,
            "timestamp": msg["timestamp"].isoformat(),
            "isDeleted": msg.get("isDeleted", False),
            "deletedBy": deleted_by,
            "fileUrl": msg.get("fileUrl"),
            "fileType": msg.get("fileType"),
            "fileName": msg.get("fileName"),
            "encrypted": is_encrypted,
            "urgencyLevel": msg.get("urgencyLevel", "normal")
        })

    return jsonify(messages_list), 200

@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    admin_id = verify_token(token)

    if not admin_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if the requester is an admin
    admin = users_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    try:
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Don't allow deleting self
        if str(admin_id) == user_id:
            return jsonify({"error": "Cannot delete your own account"}), 403

        # Check if the target user is an admin
        if user.get("isAdmin", False):
            # If target is admin master, only admin master can ban them
            if user.get("adminRole") == "admin_master":
                if admin.get("adminRole") != "admin_master":
                    return jsonify({"error": "Only Admin Masters can ban Admin Masters"}), 403
            # If target is regular admin, only admin master can ban them
            else:
                if admin.get("adminRole") != "admin_master":
                    return jsonify({"error": "Only Admin Masters can ban other admins"}), 403

        # Delete user's contacts
        contacts_collection.delete_many({
            "$or": [
                {"userId": ObjectId(user_id)},
                {"contactId": ObjectId(user_id)}
            ]
        })

        # Delete user's messages
        messages_collection.delete_many({
            "$or": [
                {"senderId": ObjectId(user_id)},
                {"receiverId": ObjectId(user_id)}
            ]
        })

        # Delete user's group messages
        group_messages_collection.delete_many({"senderId": ObjectId(user_id)})

        # Remove user from all groups
        groups_collection.update_many(
            {"members.userId": ObjectId(user_id)},
            {"$pull": {"members": {"userId": ObjectId(user_id)}}}
        )

        # Finally delete the user
        result = users_collection.delete_one({"_id": ObjectId(user_id)})

        if result.deleted_count == 0:
            return jsonify({"error": "Failed to delete user"}), 500

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({"error": "An error occurred while deleting the user"}), 500

@app.route('/api/admin/users/<user_id>/promote', methods=['POST'])
def promote_user(user_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    admin_id = verify_token(token)

    if not admin_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if the requester is an admin
    admin = users_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    # Regular admins can only promote regular users to regular admin role
    # Admin masters can promote any user to any role
    target_user = users_collection.find_one({"_id": ObjectId(user_id)})

    # If requester is not admin_master, they can only promote non-admin users to regular admin
    if admin.get("adminRole") != "admin_master":
        if target_user and target_user.get("isAdmin", False):
            return jsonify({"error": "Forbidden - Regular admins cannot modify other admin roles"}), 403

    try:
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Don't allow promoting self
        if str(admin_id) == user_id:
            return jsonify({"error": "Cannot promote yourself"}), 403

        # Update user to admin
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isAdmin": True, "adminRole": "admin"}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Failed to promote user"}), 500

        return jsonify({"message": "User promoted to admin successfully"}), 200

    except Exception as e:
        print(f"Error promoting user: {e}")
        return jsonify({"error": "An error occurred while promoting the user"}), 500

@app.route('/api/admin-master/users/<user_id>/promote-master', methods=['POST'])
def promote_user_to_master(user_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    admin_id = verify_token(token)

    if not admin_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if the requester is an admin master
    admin = users_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False) or admin.get("adminRole") != "admin_master":
        return jsonify({"error": "Forbidden - Only admin masters can promote to admin master"}), 403

    try:
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Don't allow promoting self
        if str(admin_id) == user_id:
            return jsonify({"error": "Cannot promote yourself"}), 403

        # Update user to admin master
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isAdmin": True, "adminRole": "admin_master"}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Failed to promote user to admin master"}), 500

        return jsonify({"message": "User promoted to admin master successfully"}), 200

    except Exception as e:
        print(f"Error promoting user to admin master: {e}")
        return jsonify({"error": "An error occurred while promoting the user to admin master"}), 500

@app.route('/api/admin/users/<user_id>/demote', methods=['POST'])
def demote_user(user_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    admin_id = verify_token(token)

    if not admin_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if the requester is an admin master - ONLY admin masters can demote users
    admin = users_collection.find_one({"_id": ObjectId(admin_id)})
    if not admin or not admin.get("isAdmin", False) or admin.get("adminRole") != "admin_master":
        return jsonify({"error": "Forbidden - Only admin masters can demote users"}), 403

    try:
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Don't allow demoting self
        if str(admin_id) == user_id:
            return jsonify({"error": "Cannot demote yourself"}), 403

        # Update user to remove admin status
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isAdmin": False}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Failed to demote user"}), 500

        return jsonify({"message": "User demoted successfully"}), 200

    except Exception as e:
        print(f"Error demoting user: {e}")
        return jsonify({"error": "An error occurred while demoting the user"}), 500

# Key exchange endpoint for end-to-end encryption
@app.route('/api/keys/exchange', methods=['POST'])
def exchange_keys():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    recipient_id = data.get('recipientId')
    public_key = data.get('publicKey')

    if not recipient_id or not public_key:
        return jsonify({"error": "Missing required data"}), 400

    # Store the public key in the database
    key_exchange = {
        "senderId": ObjectId(user_id),
        "recipientId": ObjectId(recipient_id),
        "publicKey": public_key,
        "timestamp": get_utc_now()
    }

    # Check if a key exchange already exists
    existing = db.key_exchanges.find_one({
        "senderId": ObjectId(user_id),
        "recipientId": ObjectId(recipient_id)
    })

    if existing:
        # Update the existing key
        db.key_exchanges.update_one(
            {"_id": existing["_id"]},
            {"$set": {"publicKey": public_key, "timestamp": get_utc_now()}}
        )
    else:
        # Insert a new key exchange
        db.key_exchanges.insert_one(key_exchange)

    # Check if the recipient has shared their key with this user
    recipient_key = db.key_exchanges.find_one({
        "senderId": ObjectId(recipient_id),
        "recipientId": ObjectId(user_id)
    })

    if recipient_key:
        # Return the recipient's public key
        return jsonify({
            "success": True,
            "recipientPublicKey": recipient_key["publicKey"]
        }), 200
    else:
        # No key from recipient yet
        return jsonify({
            "success": True,
            "recipientPublicKey": None
        }), 200

# Get public key for a user
@app.route('/api/keys/<user_id>', methods=['GET'])
def get_public_key(user_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    requester_id = verify_token(token)

    if not requester_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Find the key exchange
    key_exchange = db.key_exchanges.find_one({
        "senderId": ObjectId(user_id),
        "recipientId": ObjectId(requester_id)
    })

    if key_exchange:
        return jsonify({
            "success": True,
            "publicKey": key_exchange["publicKey"]
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "No public key found"
        }), 404

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    token = request.args.get('token')
    if not token:
        return False

    user_id = verify_token(token)
    if not user_id:
        return False

    # Join user's personal room
    join_room(user_id)
    active_users[user_id] = request.sid

    # Update user's online status in database
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"lastActive": get_utc_now(), "isOnline": True}}
    )

    # Broadcast user online status to all users
    emit('user_status', {'userId': user_id, 'status': 'online'}, broadcast=True)
    return True

@socketio.on('disconnect')
def handle_disconnect():
    for user_id, sid in list(active_users.items()):
        if sid == request.sid:
            active_users.pop(user_id)

            # Update user's online status in database
            users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"lastActive": get_utc_now(), "isOnline": False}}
            )

            # Broadcast user offline status to all users
            emit('user_status', {'userId': user_id, 'status': 'offline'}, broadcast=True)
            break

@socketio.on('heartbeat')
def handle_heartbeat():
    """Handle heartbeat messages from clients to keep connections alive"""
    # Simply acknowledge the heartbeat
    now = get_utc_now()
    emit('heartbeat-ack', {'status': 'ok', 'timestamp': now.isoformat()})
    print(f"Heartbeat received from {request.sid}")

    # Update user's last active timestamp
    for user_id, sid in active_users.items():
        if sid == request.sid:
            # Update user's last active timestamp in database
            users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"lastActive": now}}
            )
            break

@socketio.on('send_message')
def handle_send_message(data):
    try:
        token = data.get('token')
        user_id = verify_token(token)

        if not user_id:
            return

        receiver_id = data.get('receiverId')
        message_text = data.get('text', '')
        file_type = data.get('fileType')
        file_name = data.get('fileName')
        file_data = data.get('fileData')
        file_url = data.get('fileUrl')  # Get fileUrl directly from data

        # Get encryption data if available
        encrypted = data.get('encrypted', False)
        encrypted_data = data.get('encryptedData')
        iv = data.get('iv')

        # Get urgency level if available
        urgency_level = data.get('urgencyLevel', 'normal')  # Default to normal if not specified

        print(f"Message data received: receiverId={receiver_id}, hasText={bool(message_text.strip())}, "
              f"fileType={file_type}, fileName={file_name}, hasFileData={bool(file_data)}, fileUrl={file_url}, "
              f"encrypted={encrypted}, urgencyLevel={urgency_level}")

        if not receiver_id or (not message_text.strip() and not file_data and not file_url and not encrypted_data):
            print("Missing required data for message")
            return

        # Determine message type
        message_type = "text"

        # Handle file upload if present
        # Case 1: We have file_data (base64) to process
        if file_data and file_type and file_name:
            print(f"Processing file data for {file_name} of type {file_type}")
            # Validate file size
            is_valid, error_message = validate_file_size(file_data, file_type)
            if not is_valid:
                emit('error', {'message': error_message})
                return

            # Generate conversation ID for file storage
            conversation_id = f"dm_{min(user_id, receiver_id)}_{max(user_id, receiver_id)}"

            # Save file to server
            file_url = save_file(file_data, file_type, file_name, conversation_id)

            if not file_url:
                emit('error', {'message': 'Failed to save file'})
                return

            print(f"File saved successfully, URL: {file_url}")

            # Set message type based on file type
            if file_type.startswith('image/'):
                message_type = "image"
            elif file_type.startswith('video/'):
                message_type = "video"
            else:
                message_type = "file"
        # Case 2: We already have a fileUrl from a previous upload
        elif file_url and file_type and file_name:
            print(f"Using pre-uploaded file: {file_url}")
            # Set message type based on file type
            if file_type.startswith('image/'):
                message_type = "image"
            elif file_type.startswith('video/'):
                message_type = "video"
            else:
                message_type = "file"

        # Get current timestamp
        current_time = get_utc_now()

        # Create message record
        message = {
            "senderId": ObjectId(user_id),
            "receiverId": ObjectId(receiver_id),
            "text": message_text,
            "timestamp": current_time,
            "fileUrl": file_url,
            "fileType": file_type,
            "fileName": file_name,
            "messageType": message_type,
            "encrypted": encrypted,
            "urgencyLevel": urgency_level
        }

        # Add encryption data if message is encrypted
        if encrypted and encrypted_data:
            message["encryptedData"] = encrypted_data
            message["iv"] = iv
            # If the message is encrypted, we still store the original text for admin viewing
            # but mark it as encrypted so clients know to decrypt it

        # Save message to database
        result = messages_collection.insert_one(message)
        message_id = result.inserted_id

        # Get sender info
        user = users_collection.find_one({"_id": ObjectId(user_id)})

        # Format message for sending
        message_data = {
            "id": str(message_id),
            "sender": user_id,
            "receiver": receiver_id,
            "text": message_text,
            "timestamp": message["timestamp"].isoformat(),
            "fileUrl": file_url,
            "fileType": file_type,
            "fileName": file_name,
            "messageType": message_type,
            "senderName": user["name"] if user else "Unknown",
            "encrypted": encrypted,
            "urgencyLevel": urgency_level
        }

        # Add encryption data if message is encrypted
        if encrypted and encrypted_data:
            message_data["encryptedData"] = encrypted_data
            message_data["iv"] = iv

        # Update lastActivity for both sender and receiver contacts
        # For sender's contact list
        contacts_collection.update_one(
            {"userId": ObjectId(user_id), "contactId": ObjectId(receiver_id)},
            {"$set": {"lastActivity": current_time}}
        )

        # For receiver's contact list
        contacts_collection.update_one(
            {"userId": ObjectId(receiver_id), "contactId": ObjectId(user_id)},
            {"$set": {"lastActivity": current_time}}
        )

        print(f"Sending message to sender (room {user_id}): {message_data}")
        # Send to sender's room
        emit('receive_message', message_data, room=user_id)

        # Send to receiver's room if online
        if receiver_id in active_users:
            print(f"Sending message to receiver (room {receiver_id}): {message_data}")
            emit('receive_message', message_data, room=receiver_id)
        else:
            print(f"Receiver {receiver_id} is not online, message will be delivered when they connect")
    except Exception as e:
        print(f"Error sending message: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Failed to send message: {str(e)}'})

@socketio.on('group_message')
def handle_group_message(data):
    try:
        token = data.get('token')
        user_id = verify_token(token)
        if not user_id:
            return

        group_id = data.get('groupId')
        text = data.get('text', '')
        file_data = data.get('fileData')
        file_type = data.get('fileType')
        file_name = data.get('fileName')

        if not group_id or (not text.strip() and not file_data):
            return

        # Check if user is member of the group
        group = groups_collection.find_one({
            "_id": ObjectId(group_id),
            "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
        })

        if not group:
            return

        # Determine message type
        message_type = "text"
        file_url = None

        # Handle file upload if present
        if file_data and file_type and file_name:
            # Validate file size
            is_valid, error_message = validate_file_size(file_data, file_type)
            if not is_valid:
                emit('error', {'message': error_message})
                return

            # Save file to server with group ID as conversation ID
            file_url = save_file(file_data, file_type, file_name, f"group_{group_id}")

            if not file_url:
                emit('error', {'message': 'Failed to save file'})
                return

            # Set message type based on file type
            if file_type.startswith('image/'):
                message_type = "image"
            elif file_type.startswith('video/'):
                message_type = "video"
            else:
                message_type = "file"

        # Get user info
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return

        # Generate a unique message ID
        message_id = str(ObjectId())
        timestamp = get_utc_now().isoformat()

        # Create message document
        message = {
            'id': message_id,
            'sender': user_id,
            'senderName': user['name'],
            'groupId': group_id,
            'text': text,
            'timestamp': timestamp,
            'fileUrl': file_url,
            'fileType': file_type,
            'fileName': file_name,
            'messageType': message_type
        }

        # Save message to database
        db.group_messages.insert_one(message)

        # Emit to all users in the group, including sender
        # Use room=f"group_{group_id}" to ensure all users in the group receive the message exactly once
        emit('receive_group_message', message, room=f"group_{group_id}")

    except Exception as e:
        print(f"Error handling group message: {str(e)}")
        emit('error', {'message': 'Failed to send message'})

@socketio.on('join_group')
def on_join_group(data):
    try:
        token = data.get('token')
        user = verify_token(token)
        if not user:
            return

        group_id = data.get('groupId')

        # Join the socket room
        join_room(group_id)

        # Store room information for the session
        if not hasattr(request, 'rooms'):
            request.rooms = set()
        request.rooms.add(group_id)

        # Get group details and check if user is already a member
        group = db.groups.find_one({'_id': ObjectId(group_id)})
        if not group:
            return

        # Check if user is already a member
        is_member = any(member.get('id') == user['id'] for member in (group.get('members') or []))
        if not is_member:
            # Only update members if user isn't already in the group
            db.groups.update_one(
                {'_id': ObjectId(group_id)},
                {'$addToSet': {'members': {
                    'id': user['id'],
                    'name': user['name'],
                    'isActive': True
                }}}
            )

            # Notify other members only if user wasn't already in the group
            emit('group_user_joined', {
                'groupId': group_id,
                'userId': user['id'],
                'userName': user['name'],
                'user': {
                    'id': user['id'],
                    'name': user['name'],
                    'isActive': True
                }
            }, room=group_id)
        # If user is already a member, we don't emit any event
        # This prevents the "User has joined the group" message from appearing every time

    except Exception as e:
        print(f"Error joining group: {str(e)}")

@socketio.on('leave_group')
def on_leave_group(data):
    try:
        token = data.get('token')
        user = verify_token(token)
        if not user:
            return

        group_id = data.get('groupId')

        # Leave the socket room
        leave_room(group_id)

        # Remove room from session storage
        if hasattr(request, 'rooms'):
            request.rooms.discard(group_id)

        # Get group details and check if user is actually a member
        group = db.groups.find_one({'_id': ObjectId(group_id)})
        if not group:
            return

        # Check if user is actually a member
        is_member = any(member.get('id') == user['id'] for member in (group.get('members') or []))
        if is_member:
            # Only update members if user is actually in the group
            result = db.groups.update_one(
                {'_id': ObjectId(group_id)},
                {'$pull': {'members': {'id': user['id']}}}
            )

            if result.modified_count > 0:
                # Notify other members only if user was actually removed
                emit('group_user_left', {
                    'groupId': group_id,
                    'userId': user['id'],
                    'userName': user['name']
                }, room=group_id)

    except Exception as e:
        print(f"Error leaving group: {str(e)}")

@socketio.on('join_group')
def handle_join_group(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    group_id = data.get('groupId')
    if not group_id:
        return

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return

    # Join group room
    join_room(f"group_{group_id}")

    # We don't emit group_user_joined here anymore
    # This is just for joining the socket room, not for notifying about new members

@socketio.on('leave_group')
def handle_leave_group(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    group_id = data.get('groupId')
    if not group_id:
        return

    # Leave group room
    leave_room(f"group_{group_id}")

    # Notify other members
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user:
        emit('group_user_left', {
            "groupId": group_id,
            "userId": user_id,
            "userName": user["name"]
        }, room=f"group_{group_id}")

@socketio.on('edit_group_message')
def handle_edit_group_message(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    message_id = data.get('messageId')
    group_id = data.get('groupId')
    new_text = data.get('newText')

    if not message_id or not group_id or not new_text:
        return

    # Find the message and verify ownership
    message = db.group_messages.find_one({
        "_id": ObjectId(message_id),
        "senderId": ObjectId(user_id)
    })

    if not message:
        return

    # Update the message
    db.group_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"text": new_text, "isEdited": True}}
    )

    # Notify all users in the group
    emit('message_edited', {
        "messageId": message_id,
        "groupId": group_id,
        "newText": new_text
    }, room=f"group_{group_id}")

@socketio.on('delete_group_message')
def handle_delete_group_message(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    message_id = data.get('messageId')
    group_id = data.get('groupId')

    if not message_id or not group_id:
        return

    # Find the message and verify ownership
    message = db.group_messages.find_one({
        "_id": ObjectId(message_id),
        "senderId": ObjectId(user_id)
    })

    if not message:
        return

    # Mark the message as deleted
    db.group_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "isDeleted": True,
            "text": "This message was deleted",
            "fileUrl": None,
            "fileType": None,
            "fileName": None
        }}
    )

    # Notify all users in the group
    emit('message_deleted', {
        "messageId": message_id,
        "groupId": group_id
    }, room=f"group_{group_id}")

@socketio.on('send_group_message')
def handle_send_group_message(data):
    try:
        token = data.get('token')
        user_id = verify_token(token)

        if not user_id:
            return

        group_id = data.get('groupId')
        message_text = data.get('text', '')
        file_type = data.get('fileType')
        file_name = data.get('fileName')
        file_data = data.get('fileData')
        file_url = data.get('fileUrl')  # Get fileUrl directly from data

        # Get encryption data if available
        encrypted = data.get('encrypted', False)
        encrypted_data = data.get('encryptedData')
        iv = data.get('iv')

        # Get urgency level if available
        urgency_level = data.get('urgencyLevel', 'normal')  # Default to normal if not specified

        print(f"Group message data received: groupId={group_id}, hasText={bool(message_text.strip())}, "
              f"fileType={file_type}, fileName={file_name}, hasFileData={bool(file_data)}, fileUrl={file_url}, "
              f"encrypted={encrypted}, urgencyLevel={urgency_level}")

        if not group_id or (not message_text.strip() and not file_data and not file_url and not encrypted_data):
            print("Missing required data for group message")
            return

        # Check if user is member of the group
        group = groups_collection.find_one({
            "_id": ObjectId(group_id),
            "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
        })

        if not group:
            print(f"User {user_id} is not a member of group {group_id}")
            return

        # Determine message type
        message_type = "text"

        # Handle file upload if present
        # Case 1: We have file_data (base64) to process
        if file_data and file_type and file_name:
            print(f"Processing file data for group message: {file_name} of type {file_type}")
            # Validate file size
            is_valid, error_message = validate_file_size(file_data, file_type)
            if not is_valid:
                emit('error', {'message': error_message})
                return

            # Save file to server with group ID as conversation ID
            file_url = save_file(file_data, file_type, file_name, f"group_{group_id}")

            if not file_url:
                emit('error', {'message': 'Failed to save file'})
                return

            print(f"Group file saved successfully, URL: {file_url}")

            # Set message type based on file type
            if file_type.startswith('image/'):
                message_type = "image"
            elif file_type.startswith('video/'):
                message_type = "video"
            else:
                message_type = "file"
        # Case 2: We already have a fileUrl from a previous upload
        elif file_url and file_type and file_name:
            print(f"Using pre-uploaded file for group message: {file_url}")
            # Set message type based on file type
            if file_type.startswith('image/'):
                message_type = "image"
            elif file_type.startswith('video/'):
                message_type = "video"
            else:
                message_type = "file"

        # Create message record
        message = {
            "groupId": ObjectId(group_id),
            "senderId": ObjectId(user_id),
            "text": message_text,
            "timestamp": get_utc_now(),
            "fileUrl": file_url,
            "fileType": file_type,
            "fileName": file_name,
            "messageType": message_type,
            "encrypted": encrypted,
            "urgencyLevel": urgency_level
        }

        # Add encryption data if message is encrypted
        if encrypted and encrypted_data:
            message["encryptedData"] = encrypted_data
            message["iv"] = iv
            # If the message is encrypted, we still store the original text for admin viewing
            # but mark it as encrypted so clients know to decrypt it

        # Save message to database (in a group_messages collection)
        result = db.group_messages.insert_one(message)
        message_id = result.inserted_id

        # Get sender info
        user = users_collection.find_one({"_id": ObjectId(user_id)})

        # Format message for sending
        message_data = {
            "id": str(message_id),
            "groupId": group_id,
            "sender": user_id,
            "senderName": user["name"] if user else "Unknown",
            "text": message_text,
            "timestamp": message["timestamp"].isoformat(),
            "fileUrl": file_url,
            "fileType": file_type,
            "fileName": file_name,
            "messageType": message_type,
            "encrypted": encrypted,
            "urgencyLevel": urgency_level
        }

        # Add encryption data if message is encrypted
        if encrypted and encrypted_data:
            message_data["encryptedData"] = encrypted_data
            message_data["iv"] = iv

        print(f"Sending group message to room group_{group_id}: {message_data}")
        # Send to the group room
        emit('receive_group_message', message_data, room=f"group_{group_id}")
    except Exception as e:
        print(f"Error sending group message: {e}")
        import traceback
        traceback.print_exc()
        emit('error', {'message': f'Failed to send group message: {str(e)}'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is admin
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("isAdmin", False):
        return jsonify({"error": "Forbidden"}), 403

    # Get statistics
    total_users = users_collection.count_documents({})
    active_users_count = len(active_users)
    total_private_messages = messages_collection.count_documents({})
    total_group_messages = group_messages_collection.count_documents({})
    total_messages = total_private_messages + total_group_messages

    # Get messages per day for last 7 days
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_messages = []

    for i in range(7):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)

        # Compter les messages privés
        private_count = messages_collection.count_documents({
            "timestamp": {"$gte": day, "$lt": next_day}
        })

        # Compter les messages de groupe
        group_count = group_messages_collection.count_documents({
            "timestamp": {"$gte": day, "$lt": next_day}
        })

        # Combiner les deux types de messages
        total_count = private_count + group_count

        daily_messages.append({
            "date": day.strftime("%Y-%m-%d"),
            "count": total_count,
            "privateCount": private_count,
            "groupCount": group_count
        })

    # Get number of new users in last 7 days
    new_users = users_collection.count_documents({
        "createdAt": {"$gte": today - timedelta(days=7)}
    })

    stats = {
        "totalUsers": total_users,
        "activeUsers": active_users_count,
        "totalMessages": total_messages,
        "privateMessages": total_private_messages,
        "groupMessages": total_group_messages,
        "dailyMessages": daily_messages,
        "newUsers": new_users
    }

    return jsonify(stats), 200

@app.route('/api/groups', methods=['GET'])
def get_groups():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Get groups where user is a member
    user_groups = groups_collection.find({
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    groups_list = []
    for group in user_groups:
        # Get the last message for the group
        last_message = db.group_messages.find_one(
            {"groupId": group["_id"]},
            sort=[("timestamp", -1)]
        )

        # Get full member details
        members = []
        user_last_read = None
        for member in group["members"]:
            member_user = users_collection.find_one({"_id": member["userId"]})
            if member_user:
                members.append({
                    "id": str(member_user["_id"]),
                    "name": member_user["name"],
                    "role": member["role"],
                    "isActive": str(member_user["_id"]) in active_users,
                })

                # Store the user's last read timestamp
                if str(member["userId"]) == user_id and "lastRead" in member:
                    user_last_read = member["lastRead"]

        # Calculate unread count for this group
        unread_count = 0
        if user_last_read:
            # Count messages that were sent after the user's last read timestamp
            unread_count = db.group_messages.count_documents({
                "groupId": group["_id"],
                "senderId": {"$ne": ObjectId(user_id)},  # Don't count user's own messages
                "timestamp": {"$gt": user_last_read}
            })

        groups_list.append({
            "id": str(group["_id"]),
            "name": group["name"],
            "description": group.get("description", ""),
            "createdBy": str(group["createdBy"]),
            "members": members,
            "lastMessage": last_message["text"] if last_message else "",
            "lastMessageTime": last_message["timestamp"].isoformat() if last_message else None,
            "unreadCount": unread_count,
            "memberCount": len(members)
        })

    return jsonify(groups_list), 200

@app.route('/api/groups', methods=['POST'])
def create_group():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')
    is_department_group = data.get('isDepartmentGroup', False)

    # Check if user is admin for department group creation
    if is_department_group:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("isAdmin", False):
            return jsonify({"error": "Only admins can create department groups"}), 403

        department = data.get('department')
        if not department:
            return jsonify({"error": "Department is required for department groups"}), 400

        # Find all users in the specified department
        department_users = users_collection.find({"department": department})
        member_ids = [str(user["_id"]) for user in department_users]

        # Make sure creator is included
        if user_id not in member_ids:
            member_ids.append(user_id)
    else:
        # Regular group creation
        member_ids = data.get('members', [])

        # Ensure creator is included in members
        if user_id not in member_ids:
            member_ids.append(user_id)

    if not name:
        return jsonify({"error": "Group name is required"}), 400

    # Create member objects
    members = []
    for mid in member_ids:
        try:
            now = get_utc_now()
            member = {
                "userId": ObjectId(mid),
                "role": "admin" if mid == user_id else "member",
                "joinedAt": now,
                "lastRead": now
            }
            members.append(member)
        except:
            pass

    # Create group
    group = {
        "name": name,
        "description": description,
        "createdBy": ObjectId(user_id),
        "createdAt": get_utc_now(),
        "members": members,
        "isDepartmentGroup": is_department_group
    }

    # Add department info if it's a department group
    if is_department_group:
        group["department"] = data.get('department')

    result = groups_collection.insert_one(group)

    # No automatic system message for department groups

    return jsonify({
        "id": str(result.inserted_id),
        "name": name,
        "description": description,
        "memberCount": len(members),
        "isDepartmentGroup": is_department_group,
        "department": data.get('department') if is_department_group else None
    }), 201

@app.route('/api/groups/<group_id>/messages', methods=['GET'])
def get_group_messages(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Forbidden"}), 403

    # Get messages for the group, excluding those deleted by the current user
    messages = db.group_messages.find({
        "$and": [
            {"groupId": ObjectId(group_id)},
            {
                "$or": [
                    {"deletedBy": {"$exists": False}},
                    {"deletedBy": {"$not": {"$elemMatch": {"$eq": ObjectId(user_id)}}}}
                ]
            }
        ]
    }).sort("timestamp", 1)

    # Update last read timestamp
    groups_collection.update_one(
        {
            "_id": ObjectId(group_id),
            "members.userId": ObjectId(user_id)
        },
        {"$set": {"members.$.lastRead": get_utc_now()}}
    )

    # Format messages for the frontend
    messages_list = []
    sender_cache = {}

    for msg in messages:
        sender_id = str(msg["senderId"])

        if sender_id not in sender_cache:
            sender = users_collection.find_one({"_id": ObjectId(sender_id)})
            sender_cache[sender_id] = sender["name"] if sender else "Unknown"

        # Create message object with all fields
        message_data = {
            "id": str(msg["_id"]),
            "sender": sender_id,
            "senderName": sender_cache[sender_id],
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat(),
            "messageType": msg.get("messageType", "text"),
            "isDeleted": msg.get("isDeleted", False)
        }

        # Add file information if present
        if "fileUrl" in msg and msg["fileUrl"]:
            message_data["fileUrl"] = msg["fileUrl"]
            message_data["fileType"] = msg.get("fileType")
            message_data["fileName"] = msg.get("fileName")

            print(f"Group message with file: {message_data['id']}, fileUrl: {message_data['fileUrl']}, fileType: {message_data['fileType']}")

        messages_list.append(message_data)

    return jsonify(messages_list), 200

@app.route('/api/groups/<group_id>/messages/search', methods=['GET'])
def search_group_messages(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Forbidden"}), 403

    query = request.args.get('query', '')
    if not query:
        return jsonify({"error": "Search query is required"}), 400

    # Search messages in the group that contain the query, excluding those deleted by the current user
    messages = group_messages_collection.find({
        "$and": [
            {"groupId": ObjectId(group_id)},
            {"text": {"$regex": query, "$options": "i"}},  # Case-insensitive search
            {
                "$or": [
                    {"deletedBy": {"$exists": False}},
                    {"deletedBy": {"$not": {"$elemMatch": {"$eq": ObjectId(user_id)}}}}
                ]
            }
        ]
    }).sort("timestamp", 1)

    # Format messages for the frontend
    results = []
    for msg in messages:
        sender_id = str(msg["senderId"])
        sender = users_collection.find_one({"_id": msg["senderId"]})
        sender_name = sender["name"] if sender else "Unknown"

        # Create message object with all fields
        message_data = {
            "id": str(msg["_id"]),
            "sender": sender_id,
            "senderName": sender_name,
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat(),
            "messageType": msg.get("messageType", "text"),
            "isDeleted": msg.get("isDeleted", False)
        }

        # Add file information if present
        if "fileUrl" in msg and msg["fileUrl"]:
            message_data["fileUrl"] = msg["fileUrl"]
            message_data["fileType"] = msg.get("fileType")
            message_data["fileName"] = msg.get("fileName")

            print(f"Search result with file: {message_data['id']}, fileUrl: {message_data['fileUrl']}, fileType: {message_data['fileType']}")

        results.append(message_data)

    return jsonify({"results": results, "count": len(results)}), 200

@app.route('/api/groups/<group_id>/messages', methods=['DELETE'])
def delete_group_chat(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Forbidden"}), 403

    # Mark all messages in the group as deleted for this user only
    if delete_group_messages(group_id, user_id):
        return jsonify({"message": "Chat history deleted successfully"}), 200
    else:
        return jsonify({"error": "Failed to delete chat history"}), 500

@app.route('/api/groups/<group_id>/leave', methods=['POST'])
def leave_group(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Remove user from group members
        result = groups_collection.update_one(
            {"_id": ObjectId(group_id)},
            {"$pull": {"members": {"userId": ObjectId(user_id)}}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Group not found or user is not a member"}), 404

        # Get user info for notification
        user = users_collection.find_one({"_id": ObjectId(user_id)})

        # Emit socket event to notify other members
        socketio.emit('group_user_left', {
            "groupId": group_id,
            "userId": str(user_id),
            "userName": user["name"] if user else "Unknown"
        }, room=f"group_{group_id}")

        return jsonify({"message": "Successfully left the group"}), 200

    except Exception as e:
        print(f"Error leaving group: {e}")
        return jsonify({"error": "An error occurred while leaving the group"}), 500

@app.route('/api/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Check if user is the creator of the group
        group = groups_collection.find_one({
            "_id": ObjectId(group_id),
            "createdBy": ObjectId(user_id)
        })

        if not group:
            return jsonify({"error": "Only group creator can delete the group"}), 403

        # Delete all messages in the group (passing no user_id to actually delete them)
        delete_group_messages(group_id)

        # Delete the group itself
        result = groups_collection.delete_one({"_id": ObjectId(group_id)})

        if result.deleted_count == 0:
            return jsonify({"error": "Group not found"}), 404

        # Notify all members via socket
        socketio.emit("group_deleted", {
            "groupId": group_id,
            "groupName": group["name"]
        }, room=f"group_{group_id}")

        return jsonify({"message": "Group deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting group: {e}")
        return jsonify({"error": "An error occurred while deleting the group"}), 500

@app.route('/api/groups/<group_id>/rename', methods=['PUT'])
def rename_group(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    new_name = data.get('name')

    if not new_name or not new_name.strip():
        return jsonify({"error": "Group name is required"}), 400

    # Update the group name
    groups_collection.update_one(
        {"_id": ObjectId(group_id)},
        {"$set": {"name": new_name.strip()}}
    )

    return jsonify({"success": True, "message": "Group renamed successfully"}), 200

@app.route('/api/groups/<group_id>/invite', methods=['POST'])
def invite_to_group(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json()
    member_ids = data.get('members', [])

    if not member_ids:
        return jsonify({"error": "No members specified"}), 400

    try:
        # Add new members
        new_members = []
        for mid in member_ids:
            now = get_utc_now()
            member = {
                "userId": ObjectId(mid),
                "role": "member",
                "joinedAt": now,
                "lastRead": now
            }
            new_members.append(member)

        # Update group with new members
        result = groups_collection.update_one(
            {"_id": ObjectId(group_id)},
            {"$push": {"members": {"$each": new_members}}}
        )

        if result.modified_count == 0:
            return jsonify({"error": "Failed to add members to group"}), 500

        # Get member details for response
        added_members = []
        for mid in member_ids:
            member_user = users_collection.find_one({"_id": ObjectId(mid)})
            if member_user:
                added_members.append({
                    "id": str(member_user["_id"]),
                    "name": member_user["name"],
                    "isActive": str(member_user["_id"]) in active_users
                })

                # Emit socket event to notify the new member
                socketio.emit('group_invite', {
                    "groupId": group_id,
                    "groupName": group["name"],
                    "invitedBy": user_id
                }, room=str(member_user["_id"]))

        return jsonify({
            "success": True,
            "message": "Members invited successfully",
            "members": added_members
        }), 200

    except Exception as e:
        print(f"Error inviting members to group: {e}")
        return jsonify({"error": "An error occurred while inviting members"}), 500

@app.route('/api/groups/<group_id>/invite', methods=['POST'])
def invite_group_members(group_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        members_to_invite = data.get('members', [])

        if not members_to_invite:
            return jsonify({"error": "No members specified"}), 400

        # Check if group exists and user is a member
        group = groups_collection.find_one({"_id": ObjectId(group_id)})
        if not group:
            return jsonify({"error": "Group not found"}), 404

        # Check if user is in the group
        if ObjectId(user_id) not in [member["id"] for member in group.get("members", [])]:
            return jsonify({"error": "You must be a member of the group to invite others"}), 403

        # Convert member IDs to ObjectIds and check if they exist
        member_ids = []
        for member_id in members_to_invite:
            if users_collection.find_one({"_id": ObjectId(member_id)}):
                member_ids.append(ObjectId(member_id))

        if not member_ids:
            return jsonify({"error": "No valid members to invite"}), 400

        # Add new members to the group
        current_members = group.get("members", [])
        new_members = []
        for member_id in member_ids:
            if not any(m["id"] == member_id for m in current_members):
                member = users_collection.find_one({"_id": member_id})
                new_members.append({
                    "id": member_id,
                    "name": member["name"],
                    "isActive": str(member_id) in active_users
                })

        if not new_members:
            return jsonify({"error": "All specified users are already members"}), 400

        # Update group with new members
        groups_collection.update_one(
            {"_id": ObjectId(group_id)},
            {"$push": {"members": {"$each": new_members}}}
        )

        # Emit socket event for each new member
        for member in new_members:
            socketio.emit("group_user_joined", {
                "groupId": group_id,
                "user": {
                    "id": str(member["id"]),
                    "name": member["name"],
                    "isActive": member["isActive"]
                },
                "userName": member["name"]
            })

        return jsonify({
            "success": True,
            "message": f"Successfully invited {len(new_members)} members to the group",
            "newMembers": [{
                "id": str(m["id"]),
                "name": m["name"],
                "isActive": m["isActive"]
            } for m in new_members]
        }), 200

    except Exception as e:
        print(f"Error inviting members to group: {e}")
        return jsonify({"error": "Failed to invite members"}), 500

@socketio.on('edit_message')
def handle_edit_message(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    message_id = data.get('messageId')
    new_text = data.get('text')

    if not message_id or not new_text:
        return

    try:
        # Find the message to edit
        message = messages_collection.find_one({"_id": ObjectId(message_id)})

        if not message:
            # Check if it's a group message
            message = db.group_messages.find_one({"_id": ObjectId(message_id)})
            if not message:
                return

            # Verify sender is the same as the editor
            if str(message["senderId"]) != user_id:
                return

            # Update the message text
            db.group_messages.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": {"text": new_text, "isEdited": True}}
            )

            # Get group ID
            group_id = str(message["groupId"])

            # Get sender name for notification
            sender = users_collection.find_one({"_id": ObjectId(user_id)})
            sender_name = sender["name"] if sender else "Unknown"

            # Notify all users in the group
            emit('message_edited', {
                "groupId": group_id,
                "messageId": message_id,
                "newText": new_text,
                "isEdited": True,
                "senderName": sender_name,
                "sender": user_id
            }, room=f"group_{group_id}")

        else:
            # Verify sender is the same as the editor
            if str(message["senderId"]) != user_id:
                return

            # Update the message text
            messages_collection.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": {"text": new_text, "isEdited": True}}
            )

            # Get sender and receiver IDs
            sender_id = str(message["senderId"])
            receiver_id = str(message["receiverId"])

            # Prepare edited message data
            edited_message = {
                "id": message_id,
                "sender": sender_id,
                "receiver": receiver_id,
                "text": new_text,
                "isEdited": True
            }

            # Notify sender
            emit('message_edited', edited_message, room=sender_id)

            # Notify receiver (even if not active - they'll see it when they connect)
            emit('message_edited', edited_message, room=receiver_id)

    except Exception as e:
        print(f"Error editing message: {e}")
        emit('error', {'message': 'Failed to edit message'})

@socketio.on('edit_group_message')
def handle_edit_group_message(data):
    try:
        token = data.get('token')
        user_id = verify_token(token)

        if not user_id:
            return

        message_id = data.get('messageId')
        new_text = data.get('text')
        group_id = data.get('groupId')

        if not message_id or not new_text or not group_id:
            return

        # Find the message to edit
        message = db.group_messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return

        # Verify sender is the same as the editor
        if str(message["senderId"]) != user_id:
            return

        # Update the message text
        db.group_messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": {"text": new_text, "isEdited": True}}
        )

        # Get sender name for notification
        sender = users_collection.find_one({"_id": ObjectId(user_id)})
        sender_name = sender["name"] if sender else "Unknown"

        # Notify all users in the group
        emit('message_edited', {
            "groupId": group_id,
            "messageId": message_id,
            "newText": new_text,
            "isEdited": True,
            "senderName": sender_name,
            "sender": user_id
        }, room=f"group_{group_id}")
    except Exception as e:
        print(f"Error editing group message: {e}")
        emit('error', {'message': 'Failed to edit message'})

@socketio.on('delete_message')
def handle_delete_message(data):
    token = data.get('token')
    user_id = verify_token(token)

    if not user_id:
        return

    message_id = data.get('messageId')

    if not message_id:
        return

    try:
        # Find the message to delete
        message = messages_collection.find_one({"_id": ObjectId(message_id)})

        if not message:
            # Check if it's a group message
            message = db.group_messages.find_one({"_id": ObjectId(message_id)})
            if not message:
                return

            # Verify sender is the same as the deleter
            if str(message["senderId"]) != user_id:
                return

            # Mark the message as globally deleted instead of just adding to deletedBy
            db.group_messages.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": {
                    "isDeleted": True,
                    "text": "This message was deleted",
                    "fileUrl": None,
                    "fileType": None,
                    "fileName": None
                }}
            )

            # Get group ID
            group_id = str(message["groupId"])

            # Get sender name for notification
            sender = users_collection.find_one({"_id": ObjectId(user_id)})
            sender_name = sender["name"] if sender else "Unknown"

            # Notify all users in the group
            emit('message_deleted', {
                "groupId": group_id,
                "messageId": message_id,
                "senderName": sender_name,
                "sender": user_id
            }, room=f"group_{group_id}")  # Send to all users in the group

        else:
            # Verify sender is the same as the deleter
            if str(message["senderId"]) != user_id:
                return

            # Mark the message as globally deleted instead of just adding to deletedBy
            messages_collection.update_one(
                {"_id": ObjectId(message_id)},
                {"$set": {
                    "isDeleted": True,
                    "text": "This message was deleted",
                    "fileUrl": None,
                    "fileType": None,
                    "fileName": None
                }}
            )

            # Get sender and receiver IDs
            sender_id = str(message["senderId"])
            receiver_id = str(message["receiverId"])

            # Prepare deleted message data
            deleted_message = {
                "id": message_id,
                "sender": sender_id,
                "receiver": receiver_id,
                "isDeleted": True
            }

            # Notify both sender and receiver
            emit('message_deleted', deleted_message, room=sender_id)
            emit('message_deleted', deleted_message, room=receiver_id)
    except Exception as e:
        print(f"Error deleting message: {e}")
        emit('error', {'message': 'Failed to delete message'})

@socketio.on('delete_group_message')
def handle_delete_group_message(data):
    try:
        token = data.get('token')
        user_id = verify_token(token)

        if not user_id:
            return

        message_id = data.get('messageId')
        group_id = data.get('groupId')

        if not message_id or not group_id:
            return

        # Find the message to delete
        message = db.group_messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return

        # Verify sender is the same as the deleter
        if str(message["senderId"]) != user_id:
            return

        # Mark the message as globally deleted instead of just adding to deletedBy
        db.group_messages.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": {
                "isDeleted": True,
                "text": "This message was deleted",
                "fileUrl": None,
                "fileType": None,
                "fileName": None
            }}
        )

        # Get sender name for notification
        sender = users_collection.find_one({"_id": ObjectId(user_id)})
        sender_name = sender["name"] if sender else "Unknown"

        # Notify all users in the group
        emit('message_deleted', {
            "groupId": group_id,
            "messageId": message_id,
            "senderName": sender_name,
            "sender": user_id,
            "isDeleted": True
        }, room=f"group_{group_id}")  # Send to all users in the group
    except Exception as e:
        print(f"Error deleting group message: {e}")
        emit('error', {'message': 'Failed to delete message'})

if __name__ == '__main__':
    # Use threading mode for Python 3.13 compatibility
    socketio.run(app, debug=True, host='0.0.0.0', port=5000,
                 log_output=True, use_reloader=False, allow_unsafe_werkzeug=True)