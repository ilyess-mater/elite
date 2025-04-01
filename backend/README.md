# Elite Messaging Backend

This is the Flask backend for the Elite Messaging application, providing REST API endpoints and real-time communication via Socket.IO.

## Requirements
- Python 3.8+
- MongoDB

## Setup

1. Create a virtual environment (optional but recommended):
```
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

3. Install dependencies:
```
pip install -r requirements.txt
```

4. Configure environment variables:
Create a `.env` file in the backend directory with the following variables:
```
SECRET_KEY=your_secret_key
MONGO_URI=mongodb://localhost:27017/
DEBUG=True
```

5. Make sure MongoDB is running on your system.

## Running the Server

```
python app.py
```

The server will run on http://localhost:5000 by default.

## API Documentation

The backend provides the following API endpoints:

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Login a user

### Contacts
- `GET /api/contacts` - Get all contacts for current user
- `POST /api/contacts` - Add a new contact

### Messaging
- `GET /api/messages/<contact_id>` - Get all messages between current user and specified contact

### Groups
- `GET /api/groups` - Get all groups for current user
- `POST /api/groups` - Create a new group
- `GET /api/groups/<group_id>/messages` - Get all messages for a group

### Admin
- `GET /api/admin/users` - Get all users (admin only)
- `GET /api/admin/messages` - Get all messages (admin only)
- `GET /api/stats` - Get system statistics (admin only)

## Socket.IO Events

### Connection
- `connect` - Authenticate and connect a user
- `disconnect` - Handle user disconnection

### Individual Messaging
- `send_message` - Send a message to a specific user
- `receive_message` - Receive a message

### Group Messaging
- `join_group` - Join a group chat room
- `leave_group` - Leave a group chat room
- `send_group_message` - Send a message to a group
- `receive_group_message` - Receive a group message

### Status Updates
- `user_status` - Broadcast user online/offline status 