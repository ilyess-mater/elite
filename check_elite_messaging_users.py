from pymongo import MongoClient
import datetime

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')

# Get the elite_messaging database
db = client['elite_messaging']

# Get the users collection
users = db['users']

# Print all users in the elite_messaging database
print("Users in elite_messaging database:")
for user in users.find():
    print(f"User: {user.get('name')}, Email: {user.get('email')}, Admin: {user.get('isAdmin')}, Role: {user.get('adminRole')}, Created: {user.get('createdAt')}")

# Print the total number of users
print(f"\nTotal number of users in elite_messaging: {users.count_documents({})}")
