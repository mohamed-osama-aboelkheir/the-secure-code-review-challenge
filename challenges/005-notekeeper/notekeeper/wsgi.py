"""WSGI config for the Notekeeper project."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'notekeeper.settings')

application = get_wsgi_application()
