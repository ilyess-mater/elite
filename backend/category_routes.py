from flask import Blueprint, request, jsonify
from bson import ObjectId
import jwt
from datetime import datetime

# Create a blueprint for category routes
category_routes = Blueprint('category_routes', __name__)

# Function to verify JWT token (copied from app.py for consistency)
def verify_token(token):
    """Verify JWT token and return user_id if valid"""
    try:
        # Import app config directly to avoid circular imports
        from flask import current_app
        payload = jwt.decode(
            token,
            current_app.config.get('SECRET_KEY'),
            algorithms=['HS256']
        )
        return payload['sub']
    except jwt.ExpiredSignatureError:
        print("Token expired")
        return None
    except jwt.InvalidTokenError:
        print("Invalid token")
        return None
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        return None

# Department color mapping
DEPARTMENT_COLORS = {
    "Human Resources": "#ff6b6b",
    "Marketing": "#4ecdc4",
    "Finance": "#45b7d1",
    "IT": "#7367f0",
    "Operations": "#ff9f43",
    "Sales": "#28c76f",
    "Customer Service": "#ea5455",
    "Research & Development": "#9f44d3",
    "Development": "#5a8dee",
    "Legal": "#a66a2c",
    "Executive": "#475f7b"
}

# Helper function to clean orphaned department categories
def clean_orphaned_department_categories(user_id):
    """Remove department categories that have no active contacts"""
    print(f"Cleaning orphaned department categories for user: {user_id}")

    # Get database reference
    from app import db, contacts_collection

    # Get all department categories for this user
    department_categories = db.categories.find({
        "userId": ObjectId(user_id),
        "isDepartmentCategory": True
    })

    for category in department_categories:
        # Check if there are any contacts in this department
        active_contacts = contacts_collection.find({
            "userId": ObjectId(user_id),
            "department": category["name"]
        }).limit(1)

        # If no active contacts, delete the category
        if not list(active_contacts):
            print(f"Removing orphaned department category: {category['name']}")
            db.categories.delete_one({"_id": category["_id"]})

# Helper function to create department categories
def ensure_department_categories(user_id):
    """Create department categories for a user if they don't exist"""
    from app import db, users_collection, contacts_collection

    print(f"Ensuring department categories for user {user_id}")

    # First clean up orphaned categories
    clean_orphaned_department_categories(user_id)

    # Get user's department
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user and user.get("department"):
        user_department = user.get("department")

        # Check if user already has a category for their department
        existing_category = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": user_department,
            "isDepartmentCategory": True
        })

        # If not, create it
        if not existing_category:
            print(f"Creating department category for user's department: {user_department}")
            color = DEPARTMENT_COLORS.get(user_department, "#4A76A8")
            category = {
                "userId": ObjectId(user_id),
                "name": user_department,
                "color": color,
                "isDepartmentCategory": True,
                "createdAt": datetime.utcnow()
            }

            category_id = db.categories.insert_one(category).inserted_id
            print(f"Created department category with ID: {category_id}")

            # Find all contacts in the same department
            contacts = contacts_collection.find({
                "userId": ObjectId(user_id),
                "department": user_department
            })

            # Assign them to this category
            update_count = 0
            for contact in contacts:
                contacts_collection.update_one(
                    {"_id": contact["_id"]},
                    {"$set": {"categoryId": category_id}}
                )
                update_count += 1

            print(f"Updated {update_count} contacts with the new department category")

    # Get all departments from user's contacts
    contact_departments = contacts_collection.distinct(
        "department",
        {"userId": ObjectId(user_id)}
    )

    print(f"Found {len(contact_departments)} distinct departments in contacts")

    # Create categories for each department if they don't exist
    for department in contact_departments:
        if not department:
            continue

        print(f"Processing department: {department}")
        existing_category = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": department,
            "isDepartmentCategory": True
        })

        if not existing_category:
            print(f"Creating category for department: {department}")
            color = DEPARTMENT_COLORS.get(department, "#4A76A8")
            category = {
                "userId": ObjectId(user_id),
                "name": department,
                "color": color,
                "isDepartmentCategory": True,
                "createdAt": datetime.utcnow()
            }

            category_id = db.categories.insert_one(category).inserted_id
            print(f"Created department category with ID: {category_id}")

            # Assign all contacts from this department to this category
            result = contacts_collection.update_many(
                {
                    "userId": ObjectId(user_id),
                    "department": department
                },
                {"$set": {"categoryId": category_id}}
            )

            print(f"Updated {result.modified_count} contacts with the new department category")
        else:
            print(f"Department category already exists for {department}")

            # Make sure all contacts in this department have the category assigned
            result = contacts_collection.update_many(
                {
                    "userId": ObjectId(user_id),
                    "department": department,
                    "$or": [
                        {"categoryId": {"$exists": False}},
                        {"categoryId": None}
                    ]
                },
                {"$set": {"categoryId": existing_category["_id"]}}
            )

            print(f"Updated {result.modified_count} contacts that were missing the department category")

# Routes for category management
@category_routes.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories for the current user"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Get database reference
    from app import db, contacts_collection

    # Ensure department categories exist
    ensure_department_categories(user_id)

    # Get IDs of removed chats from request parameters or default to empty list
    removed_chats_param = request.args.get('removedChats', '[]')
    try:
        removed_chats = [ObjectId(id) for id in eval(removed_chats_param) if id]
    except:
        removed_chats = []

    # Get all active contacts (not removed from conversations)
    active_contacts = list(contacts_collection.find({
        "userId": ObjectId(user_id),
        "_id": {"$nin": removed_chats}
    }))

    # Get all departments from active contacts
    active_departments = set()
    for contact in active_contacts:
        if contact.get("department"):
            active_departments.add(contact.get("department"))

    print(f"Active departments: {active_departments}")

    # Get all categories
    categories = db.categories.find({"userId": ObjectId(user_id)})

    # Format categories for the frontend, filtering out department categories without active contacts
    categories_list = []
    for category in categories:
        # Include non-department categories or department categories with active contacts
        if not category.get("isDepartmentCategory", False) or category.get("name") in active_departments:
            categories_list.append({
                "id": str(category["_id"]),
                "name": category["name"],
                "color": category.get("color", "#4A76A8"),
                "isDepartmentCategory": category.get("isDepartmentCategory", False),
                "createdAt": category["createdAt"].isoformat() if "createdAt" in category else None
            })

    return jsonify(categories_list), 200

@category_routes.route('/api/categories', methods=['POST'])
def create_category():
    """Create a new category"""
    try:
        print("Starting category creation process")
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        print(f"Token received: {token[:10]}..." if token else "No token received")
        
        user_id = verify_token(token)
        print(f"User ID from token: {user_id}")

        if not user_id:
            print("Authentication failed: Invalid or expired token")
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json()
        print(f"Request data: {data}")
        
        name = data.get('name')
        color = data.get('color', '#4A76A8')  # Default color if not provided

        if not name:
            print("Validation error: Category name is required")
            return jsonify({"error": "Category name is required"}), 400

        # Get database reference - import at function level to avoid circular imports
        try:
            from app import db
            print("Database reference obtained successfully")
        except ImportError as ie:
            print(f"Import error: {str(ie)}")
            # Fallback to direct MongoDB connection if import fails
            from pymongo import MongoClient
            from dotenv import load_dotenv
            import os
            load_dotenv()
            client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
            db = client.elite_messaging
            print("Using fallback database connection")

        # Check if category with same name already exists for this user (excluding department categories)
        existing = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": name,
            "isDepartmentCategory": {"$ne": True}  # Exclude department categories
        })

        if existing:
            print(f"Conflict: Category '{name}' already exists for user {user_id}")
            return jsonify({"error": "A category with this name already exists"}), 409

        # Also check if there's a department category with the same name that has active contacts
        department_category = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": name,
            "isDepartmentCategory": True
        })

        if department_category:
            # Check if this department has active contacts
            from app import contacts_collection
            active_contacts = contacts_collection.find({
                "userId": ObjectId(user_id),
                "department": name
            }).limit(1)

            if list(active_contacts):
                print(f"Conflict: Department category '{name}' already exists with active contacts")
                return jsonify({"error": "A category with this name already exists"}), 409

        # Create category
        category = {
            "userId": ObjectId(user_id),
            "name": name,
            "color": color,
            "createdAt": datetime.utcnow()
        }
        print(f"Category object created: {category}")

        result = db.categories.insert_one(category)
        category_id = result.inserted_id
        print(f"Category created with ID: {category_id}")

        return jsonify({
            "id": str(category_id),
            "name": name,
            "color": color,
            "createdAt": category["createdAt"].isoformat()
        }), 201
    except Exception as e:
        print(f"Error in create_category: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to create category: {str(e)}"}), 500

@category_routes.route('/api/categories/<category_id>', methods=['PUT'])
def update_category(category_id):
    """Update an existing category"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    name = data.get('name')
    color = data.get('color')

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    # Get database reference
    from app import db

    # Check if category exists and belongs to the user
    category = db.categories.find_one({
        "_id": ObjectId(category_id),
        "userId": ObjectId(user_id)
    })

    if not category:
        return jsonify({"error": "Category not found"}), 404

    # Check if another category with the same name exists (excluding department categories and current category)
    existing = db.categories.find_one({
        "userId": ObjectId(user_id),
        "name": name,
        "_id": {"$ne": ObjectId(category_id)},
        "isDepartmentCategory": {"$ne": True}
    })

    if existing:
        return jsonify({"error": "A category with this name already exists"}), 409

    # Also check if there's a department category with the same name that has active contacts
    department_category = db.categories.find_one({
        "userId": ObjectId(user_id),
        "name": name,
        "_id": {"$ne": ObjectId(category_id)},
        "isDepartmentCategory": True
    })

    if department_category:
        # Check if this department has active contacts
        from app import contacts_collection
        active_contacts = contacts_collection.find({
            "userId": ObjectId(user_id),
            "department": name
        }).limit(1)

        if list(active_contacts):
            return jsonify({"error": "A category with this name already exists"}), 409

    # Update category
    update_data = {"name": name}
    if color:
        update_data["color"] = color

    db.categories.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": update_data}
    )

    return jsonify({
        "id": category_id,
        "name": name,
        "color": color or category.get("color", "#4A76A8")
    }), 200

@category_routes.route('/api/categories/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    """Delete a category"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Get database reference
    from app import db

    # Check if category exists and belongs to the user
    category = db.categories.find_one({
        "_id": ObjectId(category_id),
        "userId": ObjectId(user_id)
    })

    if not category:
        return jsonify({"error": "Category not found"}), 404

    # Remove category from all conversations
    db.contacts.update_many(
        {"userId": ObjectId(user_id), "categoryId": ObjectId(category_id)},
        {"$unset": {"categoryId": ""}}
    )

    # Remove category from all groups
    db.groups.update_many(
        {"createdBy": ObjectId(user_id), "categoryId": ObjectId(category_id)},
        {"$unset": {"categoryId": ""}}
    )

    # Delete the category
    db.categories.delete_one({"_id": ObjectId(category_id)})

    return jsonify({"message": "Category deleted successfully"}), 200

@category_routes.route('/api/contacts/<contact_id>/category', methods=['PUT'])
def set_contact_category(contact_id):
    """Set the category for a contact"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    category_id = data.get('categoryId')

    # Get database reference
    from app import db

    # Find the contact document using the contact's user ID
    # The contact_id here is actually the user ID of the contact, not the contact document ID
    contact = db.contacts.find_one({
        "userId": ObjectId(user_id),
        "contactId": ObjectId(contact_id)
    })

    if not contact:
        return jsonify({"error": "Contact not found"}), 404

    # If category_id is None, remove the custom category but keep department category
    if category_id is None:
        # Check if contact has a department category
        department = contact.get("department", "")
        if department:
            # Find the department category
            department_category = db.categories.find_one({
                "userId": ObjectId(user_id),
                "name": department,
                "isDepartmentCategory": True
            })

            if department_category:
                # Keep only the department category
                db.contacts.update_one(
                    {
                        "userId": ObjectId(user_id),
                        "contactId": ObjectId(contact_id)
                    },
                    {
                        "$set": {"categoryIds": [department_category["_id"]]},
                        "$unset": {"categoryId": ""}  # Remove old single categoryId field
                    }
                )
                return jsonify({"message": "Custom category removed, department category kept"}), 200

        # If no department category, remove all categories
        db.contacts.update_one(
            {
                "userId": ObjectId(user_id),
                "contactId": ObjectId(contact_id)
            },
            {
                "$set": {"categoryIds": []},
                "$unset": {"categoryId": ""}  # Remove old single categoryId field
            }
        )
        return jsonify({"message": "Category removed from contact"}), 200

    # Check if category exists and belongs to the user
    category = db.categories.find_one({
        "_id": ObjectId(category_id),
        "userId": ObjectId(user_id)
    })

    if not category:
        return jsonify({"error": "Category not found"}), 404

    # Initialize categoryIds array if it doesn't exist
    if not contact.get("categoryIds"):
        contact["categoryIds"] = []

        # If there's an old categoryId, add it to the array
        if "categoryId" in contact:
            contact["categoryIds"].append(contact["categoryId"])

    # Check if contact has a department category
    department = contact.get("department", "")
    department_category_id = None

    if department:
        # Find the department category
        department_category = db.categories.find_one({
            "userId": ObjectId(user_id),
            "name": department,
            "isDepartmentCategory": True
        })

        if department_category:
            department_category_id = department_category["_id"]

    # Create a new categoryIds array with the department category (if any) and the new category
    new_category_ids = []

    # Add department category if it exists
    if department_category_id:
        new_category_ids.append(department_category_id)

    # Add the new category if it's not already in the list and it's not the department category
    if not category.get("isDepartmentCategory", False) and ObjectId(category_id) not in new_category_ids:
        new_category_ids.append(ObjectId(category_id))

    # Update contact with new categories array
    db.contacts.update_one(
        {
            "userId": ObjectId(user_id),
            "contactId": ObjectId(contact_id)
        },
        {
            "$set": {
                "categoryIds": new_category_ids,
                "categoryId": ObjectId(category_id)  # Keep for backward compatibility
            }
        }
    )

    return jsonify({"message": "Contact category updated successfully"}), 200

@category_routes.route('/api/groups/<group_id>/category', methods=['PUT'])
def set_group_category(group_id):
    """Set the category for a group"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    category_id = data.get('categoryId')

    # Get database reference
    from app import db

    # Check if group exists and user is a member
    group = db.groups.find_one({
        "_id": ObjectId(group_id),
        "members": {"$elemMatch": {"userId": ObjectId(user_id)}}
    })

    if not group:
        return jsonify({"error": "Group not found"}), 404

    # If category_id is None, remove the category
    if category_id is None:
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$unset": {"categoryId": ""}}
        )
        return jsonify({"message": "Category removed from group"}), 200

    # Check if category exists and belongs to the user
    category = db.categories.find_one({
        "_id": ObjectId(category_id),
        "userId": ObjectId(user_id)
    })

    if not category:
        return jsonify({"error": "Category not found"}), 404

    # Update group with category
    db.groups.update_one(
        {"_id": ObjectId(group_id)},
        {"$set": {"categoryId": ObjectId(category_id)}}
    )

    return jsonify({"message": "Group category updated successfully"}), 200
