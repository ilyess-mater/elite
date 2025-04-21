from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime
import json
from models import Task, TaskStatus

# Initialize Blueprint
task_routes = Blueprint('task_routes', __name__)

# Helper function to convert MongoDB document to JSON
def task_to_json(task):
    if not task:
        return None
    
    # Convert ObjectId to string and handle datetime objects
    task['_id'] = str(task['_id'])
    if 'deadline' in task and isinstance(task['deadline'], datetime):
        task['deadline'] = task['deadline'].isoformat()
    if 'createdAt' in task and isinstance(task['createdAt'], datetime):
        task['createdAt'] = task['createdAt'].isoformat()
    if 'updatedAt' in task and isinstance(task['updatedAt'], datetime):
        task['updatedAt'] = task['updatedAt'].isoformat()
    
    return task

# Create a new task
@task_routes.route('/api/tasks', methods=['POST'])
def create_task():
    from app import tasks_collection
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['title', 'assignedTo', 'assignedBy', 'groupId', 'deadline']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Field '{field}' is required"}), 400
    
    # Parse deadline string to datetime
    try:
        deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
    except ValueError:
        return jsonify({"error": "Invalid deadline format. Use ISO format (YYYY-MM-DDTHH:MM:SSZ)"}), 400
    
    # Create task document
    task = {
        "_id": ObjectId(),
        "title": data['title'],
        "description": data.get('description', ''),
        "assignedTo": data['assignedTo'],
        "assignedBy": data['assignedBy'],
        "groupId": data['groupId'],
        "deadline": deadline,
        "status": data.get('status', TaskStatus.TODO.value),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    # Insert task into database
    result = tasks_collection.insert_one(task)
    
    # Return the created task
    created_task = tasks_collection.find_one({"_id": result.inserted_id})
    return jsonify(task_to_json(created_task)), 201

# Get all tasks for a group
@task_routes.route('/api/groups/<group_id>/tasks', methods=['GET'])
def get_group_tasks(group_id):
    from app import tasks_collection
    try:
        # Validate group_id
        if not ObjectId.is_valid(group_id):
            return jsonify({"error": "Invalid group ID"}), 400
        
        # Find all tasks for the group
        tasks = list(tasks_collection.find({"groupId": group_id}))
        
        # Convert tasks to JSON
        tasks_json = [task_to_json(task) for task in tasks]
        
        return jsonify(tasks_json), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get tasks assigned to a specific user
@task_routes.route('/api/users/<user_id>/tasks', methods=['GET'])
def get_user_tasks(user_id):
    from app import tasks_collection
    try:
        # Find all tasks assigned to the user
        tasks = list(tasks_collection.find({"assignedTo": user_id}))
        
        # Convert tasks to JSON
        tasks_json = [task_to_json(task) for task in tasks]
        
        return jsonify(tasks_json), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get a specific task
@task_routes.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    from app import tasks_collection
    try:
        # Validate task_id
        if not ObjectId.is_valid(task_id):
            return jsonify({"error": "Invalid task ID"}), 400
        
        # Find the task
        task = tasks_collection.find_one({"_id": ObjectId(task_id)})
        
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        # Convert task to JSON
        return jsonify(task_to_json(task)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Update a task
@task_routes.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    from app import tasks_collection
    try:
        # Validate task_id
        if not ObjectId.is_valid(task_id):
            return jsonify({"error": "Invalid task ID"}), 400
        
        data = request.get_json()
        
        # Check if task exists
        task = tasks_collection.find_one({"_id": ObjectId(task_id)})
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        # Prepare update data
        update_data = {}
        
        # Update fields if provided
        if 'title' in data:
            update_data["title"] = data['title']
        if 'description' in data:
            update_data["description"] = data['description']
        if 'assignedTo' in data:
            update_data["assignedTo"] = data['assignedTo']
        if 'status' in data:
            update_data["status"] = data['status']
        if 'deadline' in data:
            try:
                update_data["deadline"] = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({"error": "Invalid deadline format. Use ISO format (YYYY-MM-DDTHH:MM:SSZ)"}), 400
        
        # Always update the updatedAt field
        update_data["updatedAt"] = datetime.utcnow()
        
        # Update the task
        tasks_collection.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": update_data}
        )
        
        # Get the updated task
        updated_task = tasks_collection.find_one({"_id": ObjectId(task_id)})
        
        return jsonify(task_to_json(updated_task)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Delete a task
@task_routes.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    from app import tasks_collection
    try:
        # Validate task_id
        if not ObjectId.is_valid(task_id):
            return jsonify({"error": "Invalid task ID"}), 400
        
        # Check if task exists
        task = tasks_collection.find_one({"_id": ObjectId(task_id)})
        if not task:
            return jsonify({"error": "Task not found"}), 404
        
        # Delete the task
        tasks_collection.delete_one({"_id": ObjectId(task_id)})
        
        return jsonify({"message": "Task deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500