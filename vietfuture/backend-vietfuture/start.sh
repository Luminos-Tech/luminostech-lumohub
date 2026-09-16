#!/usr/bin/env bash
# Quick setup script for backend development

set -e

echo "🚀 LumoHub Backend Setup"

# Check Python
python3 --version || { echo "❌ Python 3 required"; exit 1; }

# Create venv if not exists
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "✅ Virtualenv created"
fi

# Activate
source venv/bin/activate

# Install deps
pip install -r requirements.txt -q
echo "✅ Dependencies installed"

# Copy .env if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ .env created from .env.example — please update DATABASE_URL and SECRET_KEY"
fi

# Run migrations
alembic upgrade head
echo "✅ Migrations applied"

# Seed
python -m app.db.seed
echo "✅ Seed data loaded"

# Start server
echo "🌐 Starting server at http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
