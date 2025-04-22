from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import os
from datetime import datetime

# Initialize Blueprint
integration_routes = Blueprint('integration_routes', __name__)

# OpenAI suggested replies endpoint
@integration_routes.route('/api/suggested-replies', methods=['POST'])
def get_suggested_replies():
    try:
        data = request.get_json()
        message_text = data.get('message')
        group_id = data.get('groupId')
        
        # Validate required fields
        if not message_text:
            return jsonify({"error": "Message text is required"}), 400
            
        # Get OpenAI client from extension
        openai_client = current_app.extensions['openai'].client
        
        # Generate suggested replies using OpenAI
        completion = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates 3 short, natural-sounding reply suggestions for a message in a group chat. Each reply should be concise (max 5 words), conversational, and appropriate for a professional setting. Provide only the replies, separated by '|' characters without any additional text."},
                {"role": "user", "content": f"Generate 3 short reply suggestions for this message: '{message_text}'"}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        # Extract and format the suggested replies
        reply_text = completion.choices[0].message.content
        suggested_replies = [reply.strip() for reply in reply_text.split('|')]
        
        # Filter out any empty replies and limit to 3
        suggested_replies = [reply for reply in suggested_replies if reply]
        suggested_replies = suggested_replies[:3]
        
        return jsonify({"suggestions": suggested_replies}), 200
        
    except Exception as e:
        print(f"Error generating suggested replies: {str(e)}")
        return jsonify({"error": "Failed to generate suggested replies"}), 500