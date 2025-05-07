import requests
import json

# API endpoint
url = "http://localhost:5000/api/auth/signup"

# Admin user data
data = {
    "username": "testadmin",
    "email": "testadmin@example.com",
    "password": "password123",
    "isAdmin": True,
    "adminPassword": "admin_master",
    "adminRole": "admin_master",
    "department": "Development"
}

# Make the POST request
response = requests.post(url, json=data)

# Print the response
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# If successful, check the database
if response.status_code == 201:
    print("\nAdmin user created successfully!")
    
    # Save the token for later use
    token = json.loads(response.text)["token"]
    with open("admin_token.txt", "w") as f:
        f.write(token)
    print(f"Token saved to admin_token.txt")
else:
    print("\nFailed to create admin user.")
