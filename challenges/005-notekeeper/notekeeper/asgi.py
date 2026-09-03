"""ASGI config for the Notekeeper project."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'notekeeper.settings')

application = get_asgi_application()
