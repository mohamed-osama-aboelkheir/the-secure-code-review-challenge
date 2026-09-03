"""
Django settings for the Notekeeper project.

Generated for the Secure Code Review Challenge. Values are read from the
environment (see .env.example) so the same code runs under Docker Compose and
on a local machine. These are throwaway dev defaults — never reuse them.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env when present (local runs); under Docker Compose the values come
# from env_file / environment instead.
load_dotenv(BASE_DIR / '.env')


def _env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


SECRET_KEY = os.getenv(
    'DJANGO_SECRET_KEY',
    'dev-insecure-secret-key-change-me-for-anything-real',
)

DEBUG = _env_bool('DJANGO_DEBUG', True)

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',')
    if h.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'notes',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'notekeeper.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'notekeeper.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'notekeeper'),
        'USER': os.getenv('POSTGRES_USER', 'notekeeper'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'notekeeper'),
        'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Authentication redirects
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'notes_home'
LOGOUT_REDIRECT_URL = 'login'
