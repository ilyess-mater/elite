from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from pymongo import MongoClient
import os
import json
import bcrypt
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from bson import ObjectId

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
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# MongoDB connection
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client.elite_messaging
users_collection = db.users
messages_collection = db.messages
contacts_collection = db.contacts
groups_collection = db.groups
group_messages_collection = db.group_messages

# Active users dictionary to track online status
active_users = {}

# Helper functions
def generate_token(user_id):
    """Generate JWT token for authenticated user"""
    payload = {
        'exp': datetime.utcnow() + timedelta(days=1),
        'iat': datetime.utcnow(),
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

def delete_group_messages(group_id):
    """Delete all messages for a group"""
    try:
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
    if is_admin and admin_password != "admin":
        return jsonify({"error": "Invalid admin password"}), 401

    # Hash password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Create user document
    user = {
        "name": username,
        "email": email,
        "password": hashed_password,
        "isAdmin": is_admin,
        "createdAt": datetime.utcnow(),
        "lastActive": datetime.utcnow()
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
            "isAdmin": is_admin
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
        {"$set": {"lastActive": datetime.utcnow()}}
    )

    # Generate token
    token = generate_token(user["_id"])

    # Return user info and token
    return jsonify({
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "isAdmin": user.get("isAdmin", False)
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
            contacts_list.append({
                "id": str(contact_user["_id"]),
                "name": contact_user["name"],
                "email": contact_user["email"],
                "department": contact.get("department", ""),
                "isActive": str(contact_user["_id"]) in active_users
            })
    
    return jsonify(contacts_list), 200

@app.route('/api/contacts', methods=['POST'])
def add_contact():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    email = data.get('email')
    department = data.get('department', '')
    
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
    
    # Add the contact
    contact = {
        "userId": ObjectId(user_id),
        "contactId": contact_user["_id"],
        "department": department,
        "createdAt": datetime.utcnow()
    }
    
    contacts_collection.insert_one(contact)
    
    return jsonify({
        "id": str(contact_user["_id"]),
        "name": contact_user["name"],
        "email": contact_user["email"],
        "department": department,
        "isActive": str(contact_user["_id"]) in active_users
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
@app.route('/api/messages/<contact_id>', methods=['GET'])
def get_messages(contact_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)
    
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    
    # Get messages between user and contact
    messages = messages_collection.find({
        "$or": [
            {"senderId": ObjectId(user_id), "receiverId": ObjectId(contact_id)},
            {"senderId": ObjectId(contact_id), "receiverId": ObjectId(user_id)}
        ]
    }).sort("timestamp", 1)
    
    # Format messages for the frontend
    messages_list = []
    for msg in messages:
        messages_list.append({
            "id": str(msg["_id"]),
            "sender": str(msg["senderId"]),
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
        })
    
    return jsonify(messages_list), 200

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
        
        messages_list.append({
            "id": str(msg["_id"]),
            "senderId": sender_id,
            "senderName": sender_cache[sender_id],
            "receiverId": receiver_id,
            "receiverName": receiver_cache[receiver_id],
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
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
        
        messages_list.append({
            "id": str(msg["_id"]),
            "senderId": sender_id,
            "senderName": sender_cache[sender_id],
            "groupId": group_id,
            "groupName": group_cache[group_id],
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
        })
    
    return jsonify(messages_list), 200

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
        {"$set": {"lastActive": datetime.utcnow(), "isOnline": True}}
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
                {"$set": {"lastActive": datetime.utcnow(), "isOnline": False}}
            )
            
            # Broadcast user offline status to all users
            emit('user_status', {'userId': user_id, 'status': 'offline'}, broadcast=True)
            break

@socketio.on('send_message')
def handle_send_message(data):
    token = data.get('token')
    user_id = verify_token(token)
    
    if not user_id:
        return
    
    receiver_id = data.get('receiverId')
    message_text = data.get('text')
    
    if not receiver_id or not message_text:
        return
    
    # Create message record
    message = {
        "senderId": ObjectId(user_id),
        "receiverId": ObjectId(receiver_id),
        "text": message_text,
        "timestamp": datetime.utcnow()
    }
    
    # Save message to database
    result = messages_collection.insert_one(message)
    message_id = result.inserted_id
    
    # Format message for sending
    message_data = {
        "id": str(message_id),
        "sender": user_id,
        "text": message_text,
        "timestamp": message["timestamp"].isoformat()
    }
    
    # Send to sender's room
    emit('receive_message', message_data, room=user_id)
    
    # Send to receiver's room if online
    if receiver_id in active_users:
        emit('receive_message', message_data, room=receiver_id)

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
    
    # Notify other members
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user:
        emit('group_user_joined', {
            "groupId": group_id,
            "userId": user_id,
            "userName": user["name"]
        }, room=f"group_{group_id}")

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

@socketio.on('send_group_message')
def handle_send_group_message(data):
    token = data.get('token')
    user_id = verify_token(token)
    
    if not user_id:
        return
    
    group_id = data.get('groupId')
    message_text = data.get('text')
    
    if not group_id or not message_text:
        return
    
    # Check if user is member of the group
    group = groups_collection.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })
    
    if not group:
        return
    
    # Create message record
    message = {
        "groupId": ObjectId(group_id),
        "senderId": ObjectId(user_id),
        "text": message_text,
        "timestamp": datetime.utcnow()
    }
    
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
        "timestamp": message["timestamp"].isoformat()
    }
    
    # Send to the group room
    emit('receive_group_message', message_data, room=f"group_{group_id}")

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
        for member in group["members"]:
            member_user = users_collection.find_one({"_id": member["userId"]})
            if member_user:
                members.append({
                    "id": str(member_user["_id"]),
                    "name": member_user["name"],
                    "role": member["role"],
                    "isActive": str(member_user["_id"]) in active_users,
                })
        
        groups_list.append({
            "id": str(group["_id"]),
            "name": group["name"],
            "description": group.get("description", ""),
            "createdBy": str(group["createdBy"]),
            "members": members,
            "lastMessage": last_message["text"] if last_message else "",
            "lastMessageTime": last_message["timestamp"].isoformat() if last_message else None,
            "unreadCount": 0,
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
    member_ids = data.get('members', [])
    
    if not name:
        return jsonify({"error": "Group name is required"}), 400
    
    # Ensure creator is included in members
    if user_id not in member_ids:
        member_ids.append(user_id)
    
    # Create member objects
    members = []
    for mid in member_ids:
        try:
            member = {
                "userId": ObjectId(mid),
                "role": "admin" if mid == user_id else "member",
                "joinedAt": datetime.utcnow(),
                "lastRead": datetime.utcnow()
            }
            members.append(member)
        except:
            pass
    
    # Create group
    group = {
        "name": name,
        "description": description,
        "createdBy": ObjectId(user_id),
        "createdAt": datetime.utcnow(),
        "members": members
    }
    
    result = groups_collection.insert_one(group)
    
    return jsonify({
        "id": str(result.inserted_id),
        "name": name,
        "description": description,
        "memberCount": len(members)
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
    
    # Get messages for the group
    messages = db.group_messages.find({
        "groupId": ObjectId(group_id)
    }).sort("timestamp", 1)
    
    # Update last read timestamp
    groups_collection.update_one(
        {
            "_id": ObjectId(group_id),
            "members.userId": ObjectId(user_id)
        },
        {"$set": {"members.$.lastRead": datetime.utcnow()}}
    )
    
    # Format messages for the frontend
    messages_list = []
    sender_cache = {}
    
    for msg in messages:
        sender_id = str(msg["senderId"])
        
        if sender_id not in sender_cache:
            sender = users_collection.find_one({"_id": ObjectId(sender_id)})
            sender_cache[sender_id] = sender["name"] if sender else "Unknown"
        
        messages_list.append({
            "id": str(msg["_id"]),
            "sender": sender_id,
            "senderName": sender_cache[sender_id],
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
        })
    
    return jsonify(messages_list), 200

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
    
    # Delete all messages in the group
    if delete_group_messages(group_id):
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
        
        # Delete all messages in the group
        group_messages_collection.delete_many({"groupId": ObjectId(group_id)})
        
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

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)