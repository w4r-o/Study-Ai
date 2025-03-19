from flask import Flask
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
import os
from dotenv import load_dotenv

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')
    app.config['API_URL'] = os.getenv('API_URL', 'http://localhost:8000')
    
    # Initialize extensions
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    csrf = CSRFProtect()
    csrf.init_app(app)
    
    # Register blueprints
    from .routes import main, auth, quiz
    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(quiz.bp)
    
    return app 