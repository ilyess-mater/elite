import requests
import json

# Read the admin token from file
with open("admin_token.txt", "r") as f:
    token = f.read().strip()

print(f"Using token: {token[:20]}...")

# API endpoint for admin users
admin_users_url = "http://localhost:5000/api/admin/users"
headers = {
    "Authorization": f"Bearer {token}"
}

# Make the request to get all users
response = requests.get(admin_users_url, headers=headers)

# Print the response
print(f"\nStatus Code: {response.status_code}")
if response.status_code == 200:
    users = json.loads(response.text)
    print(f"Total users returned: {len(users)}")
    
    # Check if the new user is in the response
    new_user = next((user for user in users if user["email"] == "testadminpanel2@example.com"), None)
    if new_user:
        print("\nNew user found in admin panel API response:")
        print(f"  Name: {new_user['name']}")
        print(f"  Email: {new_user['email']}")
        print(f"  Department: {new_user['department']}")
        print(f"  Admin: {new_user['isAdmin']}")
        print(f"  Admin Role: {new_user['adminRole']}")
    else:
        print("\nNew user NOT found in admin panel API response!")
        
    # Print a few users to check the format
    print("\nSample users from the response:")
    for i, user in enumerate(users[:3]):
        print(f"\nUser {i+1}:")
        print(f"  Name: {user['name']}")
        print(f"  Email: {user['email']}")
        print(f"  Department: {user.get('department', 'N/A')}")
        print(f"  Admin: {user['isAdmin']}")
        print(f"  Admin Role: {user.get('adminRole', 'N/A')}")
else:
    print(f"Error: {response.text}")
