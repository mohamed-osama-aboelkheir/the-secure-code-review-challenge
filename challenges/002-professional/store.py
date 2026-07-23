import os
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

class BaseStore:
    """Base store class for MongoDB operations"""
    
    def __init__(self, collection_name):
        self.client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.client.professional_app
        self.collection = self.db[collection_name]
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()

class UserStore(BaseStore):
    """Store class for user operations"""
    
    def __init__(self):
        super().__init__('users')
    
    def create_user(self, username, password_hash):
        """Create a new user"""
        user_data = {
            'username': username,
            'password': password_hash,
            'created_at': datetime.utcnow()
        }
        result = self.collection.insert_one(user_data)
        return result.inserted_id
    
    def get_user_by_username(self, username):
        """Get user by username"""
        return self.collection.find_one({'username': username})
    
    def get_user_by_id(self, user_id):
        """Get user by ID"""
        return self.collection.find_one({'_id': ObjectId(user_id)})
    
    def user_exists(self, username):
        """Check if user exists"""
        return self.collection.find_one({'username': username}) is not None
    
    def update_user(self, user_id, update_data):
        """Update user data"""
        return self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
    
    def delete_user(self, user_id):
        """Delete user"""
        return self.collection.delete_one({'_id': ObjectId(user_id)})

class ProfileStore(BaseStore):
    """Store class for professional profile operations"""
    
    def __init__(self):
        super().__init__('profiles')
    
    def create_profile(self, profile_data):
        """Create a new professional profile"""
        profile_data['created_at'] = datetime.utcnow()
        profile_data['updated_at'] = datetime.utcnow()
        result = self.collection.insert_one(profile_data)
        return result.inserted_id
    
    def get_profile(self, profile_id):
        """Get profile by ID"""
        profile = self.collection.find_one({'_id': ObjectId(profile_id)})
        if profile:
            profile['_id'] = str(profile['_id'])
            profile['user_id'] = str(profile['user_id'])
        return profile
    
    def get_user_profiles(self, user_id):
        """Get all profiles for a user"""
        profiles = list(self.collection.find({'user_id': user_id}))
        for profile in profiles:
            profile['_id'] = str(profile['_id'])
            profile['user_id'] = str(profile['user_id'])
        return profiles
    
    def get_public_profiles(self):
        """Get all public profiles"""
        profiles = list(self.collection.find({'is_private': False}))
        for profile in profiles:
            profile['_id'] = str(profile['_id'])
            profile['user_id'] = str(profile['user_id'])
        return profiles
    
    def update_profile(self, profile_id, update_data):
        """Update profile data"""
        update_data['updated_at'] = datetime.utcnow()
        return self.collection.update_one(
            {'_id': ObjectId(profile_id)},
            {'$set': update_data}
        )
    
    def delete_profile(self, profile_id):
        """Delete profile"""
        return self.collection.delete_one({'_id': ObjectId(profile_id)})
    
    def get_all_profiles(self):
        """Get all profiles (admin function)"""
        profiles = list(self.collection.find())
        for profile in profiles:
            profile['_id'] = str(profile['_id'])
            profile['user_id'] = str(profile['user_id'])
        return profiles
