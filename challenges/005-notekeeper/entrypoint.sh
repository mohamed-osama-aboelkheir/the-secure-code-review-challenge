#!/bin/sh
set -e

# Wait for PostgreSQL to accept connections.
echo "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT} ..."
until python -c "import socket,os,sys; s=socket.socket(); s.settimeout(2); \
    s.connect((os.environ.get('POSTGRES_HOST','db'), int(os.environ.get('POSTGRES_PORT','5432')))); s.close()" 2>/dev/null; do
    sleep 1
done
echo "PostgreSQL is up."

python manage.py migrate --noinput

# Seed an admin (for /admin) and a demo user so the app is usable out of the box.
python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

User = get_user_model()

admin_user = os.environ.get('DJANGO_ADMIN_USER', 'admin')
admin_pass = os.environ.get('DJANGO_ADMIN_PASSWORD', 'admin12345')
if not User.objects.filter(username=admin_user).exists():
    User.objects.create_superuser(admin_user, f'{admin_user}@example.com', admin_pass)
    print(f'Created superuser: {admin_user}')

demo_user = os.environ.get('DJANGO_DEMO_USER', 'demo')
demo_pass = os.environ.get('DJANGO_DEMO_PASSWORD', 'demo12345')
if not User.objects.filter(username=demo_user).exists():
    User.objects.create_user(demo_user, f'{demo_user}@example.com', demo_pass)
    print(f'Created user: {demo_user}')
PY

exec python manage.py runserver 0.0.0.0:8000
