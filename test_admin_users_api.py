import requests
import json

# First, sign in as an admin user to get a token
signin_url = "http://localhost:5000/api/auth/signin"
signin_data = {
    "email": "admin123@gmail.com",  # This should be an admin user
    "password": "password123"
}

# Sign in to get the token
signin_response = requests.post(signin_url, json=signin_data)
if signin_response.status_code != 200:
    print(f"Failed to sign in: {signin_response.text}")
    exit(1)

token = json.loads(signin_response.text)["token"]
print(f"Successfully signed in, got token: {token[:20]}...")

# Now use the token to call the admin users API
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
else:
    print(f"Error: {response.text}")
