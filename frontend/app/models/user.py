from flask_login import UserMixin

class User(UserMixin):
    def __init__(self, id, username, token=None):
        self.id = id
        self.username = username
        self.token = token
    
    @staticmethod
    def get(user_id):
        # This would typically query the database
        # For now, we'll just return None
        return None 