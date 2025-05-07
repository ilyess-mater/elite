from pymongo import MongoClient
import datetime

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')

# Get the pfe_project database
db = client['pfe_project']

# Get the users collection
users = db['users']

# Print all users in the pfe_project database
print("Users in pfe_project database:")
for user in users.find():
    print(f"User: {user.get('name')}, Email: {user.get('email')}, Admin: {user.get('isAdmin')}, Role: {user.get('adminRole')}, Created: {user.get('createdAt')}")

# Print the total number of users
print(f"\nTotal number of users in pfe_project: {users.count_documents({})}")
