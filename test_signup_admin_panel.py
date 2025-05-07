import requests
import json

# API endpoint
url = "http://localhost:5000/api/auth/signup"

# User data
data = {
    "username": "testadminpanel2",
    "email": "testadminpanel2@example.com",
    "password": "password123",
    "department": "Development"
}

# Make the POST request
response = requests.post(url, json=data)

# Print the response
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# If successful, check the database
if response.status_code == 201:
    print("\nUser created successfully! Check the admin panel to verify.")
else:
    print("\nFailed to create user.")
