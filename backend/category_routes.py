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
        from app import app
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

# Helper function to create department categories
def ensure_department_categories(user_id):
    """Create department categories for a user if they don't exist"""
    from app import db, users_collection, contacts_collection

    print(f"Ensuring department categories for user {user_id}")

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
    from app import db

    # Ensure department categories exist
    ensure_department_categories(user_id)

    # Get all categories
    categories = db.categories.find({"userId": ObjectId(user_id)})

    # Format categories for the frontend
    categories_list = []
    for category in categories:
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
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user_id = verify_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    name = data.get('name')
    color = data.get('color', '#4A76A8')  # Default color if not provided

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    # Get database reference
    from app import db

    # Check if category with same name already exists for this user
    existing = db.categories.find_one({
        "userId": ObjectId(user_id),
        "name": name
    })

    if existing:
        return jsonify({"error": "A category with this name already exists"}), 409

    # Create category
    category = {
        "userId": ObjectId(user_id),
        "name": name,
        "color": color,
        "createdAt": datetime.utcnow()
    }

    result = db.categories.insert_one(category)
    category_id = result.inserted_id

    return jsonify({
        "id": str(category_id),
        "name": name,
        "color": color,
        "createdAt": category["createdAt"].isoformat()
    }), 201

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

    # If category_id is None, remove the category
    if category_id is None:
        db.contacts.update_one(
            {
                "userId": ObjectId(user_id),
                "contactId": ObjectId(contact_id)
            },
            {"$unset": {"categoryId": ""}}
        )
        return jsonify({"message": "Category removed from contact"}), 200

    # Check if category exists and belongs to the user
    category = db.categories.find_one({
        "_id": ObjectId(category_id),
        "userId": ObjectId(user_id)
    })

    if not category:
        return jsonify({"error": "Category not found"}), 404

    # Update contact with category
    db.contacts.update_one(
        {
            "userId": ObjectId(user_id),
            "contactId": ObjectId(contact_id)
        },
        {"$set": {"categoryId": ObjectId(category_id)}}
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
