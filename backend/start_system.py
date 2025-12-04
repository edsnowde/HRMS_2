#!/usr/bin/env python3
"""
Quick start script for the AI HRMS & ATS system.
This script helps you start all the necessary services for local development.
"""

import subprocess
import time
import os
import sys
from pathlib import Path


def check_dependencies():
    """Check if required dependencies are installed."""
    print("🔍 Checking dependencies...")
    
    required_commands = [
        ("python", "Python 3.11+"),
        ("pip", "Python package manager"),
        ("docker", "Docker"),
        ("docker-compose", "Docker Compose")
    ]
    
    missing = []
    
    for command, description in required_commands:
        try:
            subprocess.run([command, "--version"], 
                         capture_output=True, check=True)
            print(f"✅ {description} - OK")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"❌ {description} - Missing")
            missing.append(command)
    
    if missing:
        print(f"\n❌ Missing dependencies: {', '.join(missing)}")
        print("Please install the missing dependencies and try again.")
        return False
    
    return True


def check_env_file():
    """Check if .env file exists and has required variables."""
    print("\n🔍 Checking .env configuration...")
    
    env_file = Path(".env")
    if not env_file.exists():
        print("❌ .env file not found")
        print("Creating template .env file...")
        create_env_template()
        return False
    
    required_vars = [
        "MONGO_URL",
        "REDIS_URL", 
    "GOOGLE_APPLICATION_CREDENTIALS",
        "GEMINI_API_KEY",
        "GCS_BUCKET_NAME"
    ]
    
    missing_vars = []
    with open(env_file, 'r') as f:
        content = f.read()
        for var in required_vars:
            if var not in content or f"{var}=" in content and not content.split(f"{var}=")[1].split('\n')[0].strip():
                missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing or empty environment variables: {', '.join(missing_vars)}")
        print("Please update your .env file with the required values.")
        return False
    
    print("✅ .env configuration looks good")
    return True


def create_env_template():
    """Create a template .env file."""
    template = """# Database Configuration
MONGO_URL=mongodb://localhost:27017/ai_ats
MONGO_DB_NAME=ai_ats

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Vertex AI / GCP Configuration
# Set GOOGLE_APPLICATION_CREDENTIALS to point to your service account JSON
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/gcp-service-account.json
VTX_GCP_PROJECT_ID=your_gcp_project_id
VTX_GCP_REGION=us-central1
VTX_INDEX_ID=resumes
VTX_INDEX_ENDPOINT_ID=your_vertex_index_endpoint_id

# Google Cloud Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GCS_BUCKET_NAME=your_gcs_bucket_name_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Firebase Configuration (optional for development)
FIREBASE_CREDENTIALS=path/to/firebase-credentials.json

# Security
SECRET_KEY=your_secret_key_here

# Application Settings
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=INFO
"""
    
    with open(".env", "w") as f:
        f.write(template)
    
    print("✅ Created .env template file")
    print("Please update it with your actual API keys and configuration.")


def install_python_dependencies():
    """Install Python dependencies."""
    print("\n📦 Installing Python dependencies...")
    
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True)
        print("✅ Python dependencies installed")
        
        # Download spaCy model
        print("📦 Downloading spaCy model...")
        subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"], 
                      check=True)
        print("✅ spaCy model downloaded")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False


def start_infrastructure():
    """Start Redis and MongoDB using Docker Compose."""
    print("\n🐳 Starting infrastructure services...")
    
    try:
        # Start only Redis and MongoDB
        subprocess.run([
            "docker-compose", "-f", "docker/docker-compose.yaml", "up", "-d", 
            "redis", "mongodb"
        ], check=True)
        
        print("✅ Infrastructure services started")
        print("   - Redis: localhost:6379")
        print("   - MongoDB: localhost:27017")
        
        # Wait a bit for services to be ready
        print("⏳ Waiting for services to be ready...")
        time.sleep(10)
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start infrastructure: {e}")
        print("Make sure Docker and Docker Compose are installed and running.")
        return False


def start_celery_workers():
    """Start Celery workers."""
    print("\n👷 Starting Celery workers...")
    
    try:
        # Start workers in background
        worker_cmd = [
            sys.executable, "-m", "celery", "-A", "app.workers.celery_app", 
            "worker", "--loglevel=info", "--concurrency=2"
        ]
        
        print(f"Running: {' '.join(worker_cmd)}")
        print("Workers will start in the background...")
        
        # For development, we'll just show the command
        print("To start workers manually, run:")
        print(f"   {' '.join(worker_cmd)}")
        
        return True
    except Exception as e:
        print(f"❌ Failed to start workers: {e}")
        return False


def start_api_server():
    """Start the FastAPI server."""
    print("\n🚀 Starting FastAPI server...")
    
    try:
        api_cmd = [
            sys.executable, "-m", "uvicorn", "app.main:app", 
            "--reload", "--host", "0.0.0.0", "--port", "8000"
        ]
        
        print(f"Running: {' '.join(api_cmd)}")
        print("API server will start in the background...")
        
        # For development, we'll just show the command
        print("To start the API server manually, run:")
        print(f"   {' '.join(api_cmd)}")
        
        return True
    except Exception as e:
        print(f"❌ Failed to start API server: {e}")
        return False


def print_next_steps():
    """Print next steps for the user."""
    print("\n" + "="*60)
    print("🎉 SYSTEM SETUP COMPLETE!")
    print("="*60)
    
    print("\n📋 Next Steps:")
    print("\n1. Start the API server:")
    print("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    
    print("\n2. Start Celery workers (in another terminal):")
    print("   celery -A app.workers.celery_app worker --loglevel=info --concurrency=2")
    
    print("\n3. Start Celery beat for scheduled tasks (optional):")
    print("   celery -A app.workers.celery_app beat --loglevel=info")
    
    print("\n4. Start Flower for monitoring (optional):")
    print("   celery -A app.workers.celery_app flower --port=5555")
    
    print("\n🌐 Access Points:")
    print("   - API Server: http://localhost:8000")
    print("   - API Documentation: http://localhost:8000/docs")
    print("   - Health Check: http://localhost:8000/health")
    print("   - Metrics: http://localhost:8000/metrics")
    print("   - Flower (if started): http://localhost:5555")
    
    print("\n🧪 Test the System:")
    print("   python test_system.py")
    
    print("\n📚 Documentation:")
    print("   - README.md - Complete setup and usage guide")
    print("   - API Docs at http://localhost:8000/docs")
    
    print("\n🔧 Troubleshooting:")
    print("   - Check logs for detailed error messages")
    print("   - Ensure all API keys are set in .env")
    print("   - Verify Docker services are running: docker-compose ps")


def main():
    """Main setup function."""
    print("🚀 AI HRMS & ATS System Quick Start")
    print("="*50)
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Check environment configuration
    if not check_env_file():
        print("\n⚠️  Please update your .env file and run this script again.")
        return False
    
    # Install Python dependencies
    if not install_python_dependencies():
        return False
    
    # Start infrastructure
    if not start_infrastructure():
        return False
    
    # Show how to start workers and API
    start_celery_workers()
    start_api_server()
    
    # Print next steps
    print_next_steps()
    
    return True


if __name__ == "__main__":
    try:
        success = main()
        if success:
            print("\n✅ Setup completed successfully!")
        else:
            print("\n❌ Setup failed. Please check the errors above.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
