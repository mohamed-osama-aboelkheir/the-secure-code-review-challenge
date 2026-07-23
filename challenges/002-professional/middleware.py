import jwt
from functools import wraps
from flask import request, jsonify

def authenticate_token(f):
    """
    Middleware function to authenticate JWT tokens
    
    This decorator validates JWT tokens from the Authorization header
    and adds the current user ID to the request context.
    
    Usage:
        @authenticate_token
        def protected_route():
            # Access current user ID via request.current_user_id
            pass
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]  # Bearer <token>
            except IndexError:
                return jsonify({'message': 'Token is missing'}), 401
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Import app here to avoid circular imports
            from app import app
            
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
            current_username = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
        
        # Add current user to the request context
        request.current_user_id = current_user_id
        request.current_username = current_username
        return f(*args, **kwargs)
    
    return decorated

def get_current_user_id():
    """
    Helper function to get the current user ID from request context
    Should only be called within routes decorated with @authenticate_token
    """
    if hasattr(request, 'current_user_id'):
        return request.current_user_id
    return None
