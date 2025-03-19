import requests
from flask import current_app
from flask_login import current_user

def api_request(method, endpoint, **kwargs):
    """Make an API request to the backend."""
    url = f"{current_app.config['API_URL']}{endpoint}"
    
    # Add authentication if user is logged in
    if current_user.is_authenticated:
        kwargs['headers'] = kwargs.get('headers', {})
        kwargs['headers']['Authorization'] = f"Bearer {current_user.token}"
    
    response = requests.request(method, url, **kwargs)
    
    if response.status_code == 401:
        # Handle unauthorized access
        from flask import redirect, url_for
        return redirect(url_for('auth.login'))
    
    return response 