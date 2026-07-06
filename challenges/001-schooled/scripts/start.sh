#!/bin/sh

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Run database setup
echo "Setting up database..."
node scripts/setup-db.js

# Start the application
echo "Starting application..."
npm start
