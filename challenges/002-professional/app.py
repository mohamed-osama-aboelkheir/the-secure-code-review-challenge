import os
import sys
import jwt
import bcrypt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file
from werkzeug.exceptions import BadRequest
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from store import UserStore, ProfileStore
from middleware import authenticate_token
from pdf_generator import generate_resume_pdf

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# Initialize stores
user_store = UserStore()
profile_store = ProfileStore()


@app.route('/')
def index():
    """Serve the static web UI"""
    return app.send_static_file('index.html')

@app.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Username and password are required'}), 400
        
        username = data['username']
        password = data['password']
        
        # Check if user already exists
        if user_store.user_exists(username):
            return jsonify({'message': 'User already exists'}), 400
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create user
        user_id = user_store.create_user(username, password_hash.decode('utf-8'))
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': str(user_id)
        }), 201
        
    except Exception as e:
        return jsonify({'message': 'Registration failed', 'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    """Login user and return JWT token"""
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Username and password are required'}), 400
        
        username = data['username']
        password = data['password']
        
        # Get user from database
        user = user_store.get_user_by_username(username)
        if not user:
            return jsonify({'message': 'Invalid credentials'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return jsonify({'message': 'Invalid credentials'}), 401
        
        # Generate JWT token
        token = jwt.encode({
            'user_id': str(user['_id']),
            'username': user['username'],
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user_id': str(user['_id']),
            'username': user['username']
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500

@app.route('/profiles', methods=['GET'])
def get_profiles():
    """Get all public profiles"""
    try:
        profiles = profile_store.get_public_profiles()
        return jsonify({'profiles': profiles}), 200
    except Exception as e:
        return jsonify({'message': 'Failed to fetch profiles', 'error': str(e)}), 500

@app.route('/profiles/my', methods=['GET'])
@authenticate_token
def get_my_profiles():
    """Get current user's profiles"""
    try:
        print(request.current_user_id, file=sys.stderr)
        profiles = profile_store.get_user_profiles(request.current_user_id)
        return jsonify({'profiles': profiles}), 200
    except Exception as e:
        return jsonify({'message': 'Failed to fetch profiles', 'error': str(e)}), 500

@app.route('/profiles', methods=['POST'])
@authenticate_token
def create_profile():
    """Create a new professional profile"""
    try:
        data = request.get_json()
        
        if not data or not data.get('bio'):
            return jsonify({'message': 'Bio is required'}), 400
        
        profile_data = {
            'user_id': request.current_user_id,
            'bio': data['bio'],
            'work_experiences': data.get('work_experiences', []),
            'is_private': data.get('is_private', False)
        }
        
        profile_id = profile_store.create_profile(profile_data)
        
        return jsonify({
            'message': 'Profile created successfully',
            'profile_id': str(profile_id)
        }), 201
        
    except Exception as e:
        return jsonify({'message': 'Failed to create profile', 'error': str(e)}), 500

@app.route('/profiles/<profile_id>', methods=['GET'])
def get_profile(profile_id):
    """Get a specific profile by ID"""
    try:
        profile = profile_store.get_profile(profile_id)
        if not profile:
            return jsonify({'message': 'Profile not found'}), 404
        
        # Check if profile is private and user is not the owner
        if profile['is_private']:
            # Check if user is authenticated and is the owner
            if not hasattr(request, 'current_user_id') or str(profile['user_id']) != request.current_user_id:
                return jsonify({'message': 'Profile not found'}), 404
        
        return jsonify({'profile': profile}), 200
    except Exception as e:
        return jsonify({'message': 'Failed to fetch profile', 'error': str(e)}), 500

@app.route('/profiles/<profile_id>', methods=['PUT'])
@authenticate_token
def update_profile(profile_id):
    """Update a profile"""
    try:
        data = request.get_json()
        
        # Check if profile exists and user owns it
        profile = profile_store.get_profile(profile_id)
        if not profile:
            return jsonify({'message': 'Profile not found'}), 404
        
        if str(profile['user_id']) != request.current_user_id:
            return jsonify({'message': 'Unauthorized'}), 403
        
        update_data = {}
        if 'bio' in data:
            update_data['bio'] = data['bio']
        if 'work_experiences' in data:
            update_data['work_experiences'] = data['work_experiences']
        if 'is_private' in data:
            update_data['is_private'] = data['is_private']
        
        profile_store.update_profile(profile_id, update_data)
        
        return jsonify({'message': 'Profile updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to update profile', 'error': str(e)}), 500

@app.route('/profiles/<profile_id>', methods=['DELETE'])
@authenticate_token
def delete_profile(profile_id):
    """Delete a profile"""
    try:
        # Check if profile exists and user owns it
        profile = profile_store.get_profile(profile_id)
        if not profile:
            return jsonify({'message': 'Profile not found'}), 404
        
        if str(profile['user_id']) != request.current_user_id:
            return jsonify({'message': 'Unauthorized'}), 403
        
        profile_store.delete_profile(profile_id)
        
        return jsonify({'message': 'Profile deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to delete profile', 'error': str(e)}), 500

@app.route('/profiles/my/resume', methods=['POST'])
@authenticate_token
def generate_resume():
    """Generate a PDF resume for a profile"""
    try:
        # Get user's profile
        profiles = profile_store.get_user_profiles(request.current_user_id)
        if not profiles:
            return jsonify({'message': 'No profile found'}), 404
        
        # Use the first profile for resume generation
        profile = profiles[0]
        buffer = generate_resume_pdf(profile)
        
        # Return PDF file
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"resume_{profile['_id']}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({'message': 'Failed to generate resume', 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
