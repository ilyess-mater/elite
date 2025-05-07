import requests
import json

# API endpoint
url = "http://localhost:5000/api/auth/signup"

# User data
data = {
    "username": "testuser2",
    "email": "testuser2@example.com",
    "password": "password123"
}

# Make the POST request
response = requests.post(url, json=data)

# Print the response
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# If successful, check the database
if response.status_code == 201:
    print("\nUser created successfully! Check the database to verify.")
else:
    print("\nFailed to create user.")
