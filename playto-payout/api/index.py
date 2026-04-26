import os
import sys

# Put the project root on the Python path so Django can find config.settings
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application

# Vercel's Python runtime picks up 'app' as the WSGI handler
app = get_wsgi_application()
