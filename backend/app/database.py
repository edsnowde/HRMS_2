from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document
from app.config import settings
from app.models import (
    User, Candidate, Job, Application, Interview, JobMatch, File,
    Notification, Employee, Attendance, LeaveRequest, Payroll,
    AuditLog, SystemLog, APIUsage
)
import asyncio
import logging

logger = logging.getLogger(__name__)

# Global MongoDB client and database references
client: AsyncIOMotorClient = None
database = None


class AsyncMongoClient:
    """Async context manager wrapper around Motor's AsyncIOMotorClient.

    Usage:
        async with AsyncMongoClient() as client:
            db = client.get_default_database()
            ...
    This wrapper creates a short-lived Motor client and closes it on exit.
    """
    def __init__(self, uri: str = None, db_name: str = None):
        self._uri = uri or settings.mongo_url
        self._db_name = db_name or settings.mongo_db_name
        self._client: AsyncIOMotorClient | None = None

    async def __aenter__(self):
        # Create a new Motor client instance
        self._client = AsyncIOMotorClient(self._uri)
        return self._client

    async def __aexit__(self, exc_type, exc, tb):
        try:
            if self._client:
                # Motor's close() is synchronous but safe to call here
                self._client.close()
        except Exception:
            pass


async def init_database():
    """Initialize MongoDB and Beanie ODM connection."""
    global client, database
    try:
        print("🚀 Initializing MongoDB connection...")

        # 1️⃣ Connect to MongoDB
        client = AsyncIOMotorClient(settings.mongo_url)
        database = client[settings.mongo_db_name]
        print(f"✅ Connected to MongoDB database: {settings.mongo_db_name}")

        # 2️⃣ Initialize Beanie with all document models
        await init_beanie(
            database=database,
            document_models=[
                    User, Candidate, Job, Application, Interview, JobMatch, File,
                Notification, Employee, Attendance, LeaveRequest, Payroll,
                AuditLog, SystemLog, APIUsage
            ]
        )
        print("✅ Beanie ODM initialized with all models")

        # Small delay to ensure registration completes
        await asyncio.sleep(1)

        # 3️⃣ Create indexes to speed up queries
        await create_indexes()

        print("✅ Database initialization completed successfully!")

    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        logger.error(f"❌ Failed to initialize database: {e}")
        raise


async def create_indexes():
    """Create important indexes for better query performance."""
    try:
        print("⚙️  Creating indexes for collections...")

        # List of models to create indexes for
        models_with_indexes = [Candidate, Job, Application, Interview, File, User]

        for model in models_with_indexes:
            if not issubclass(model, Document):
                logger.warning(f"Skipping {model.__name__}: Not a Beanie Document")
                continue

            print(f"📂 {model.__name__} collection indexes...")
            # Robustly obtain the motor collection for the model. Some Beanie versions
            # may not expose `get_motor_collection` in the same way depending on
            # initialization timing or import scopes. Fall back to using the
            # database object and model Settings.name when necessary.
            try:
                if hasattr(model, 'get_motor_collection'):
                    coll = model.get_motor_collection()
                else:
                    # Fallback: try to read collection name from Settings
                    coll_name = getattr(getattr(model, 'Settings', None), 'name', None) or model.__name__.lower() + 's'
                    coll = database[coll_name]

                # Candidate indexes
                if model == Candidate:
                    await coll.create_index([("email", 1)], unique=True)
                    await coll.create_index([("skills", 1)])
                    await coll.create_index([("stage", 1)])
                    await coll.create_index([("created_at", -1)])

                # Job indexes
                elif model == Job:
                    await coll.create_index([("title", "text"), ("description", "text")])
                    await coll.create_index([("status", 1)])
                    await coll.create_index([("created_by", 1)])
                    await coll.create_index([("created_at", -1)])

                # Application indexes
                elif model == Application:
                    await coll.create_index([("job_id", 1), ("candidate_id", 1)], unique=True)
                    await coll.create_index([("status", 1)])
                    await coll.create_index([("applied_at", -1)])

                # Interview indexes
                elif model == Interview:
                    await coll.create_index([("candidate_id", 1)])
                    await coll.create_index([("job_id", 1)])
                    await coll.create_index([("type", 1)])
                    await coll.create_index([("created_at", -1)])

                # File indexes
                elif model == File:
                    await coll.create_index([("file_type", 1)])
                    await coll.create_index([("uploaded_by", 1)])
                    await coll.create_index([("job_id", 1)])
                    await coll.create_index([("candidate_id", 1)])
                    await coll.create_index([("deleted", 1)])

                # User indexes
                elif model == User:
                    await coll.create_index([("email", 1)], unique=True)
                    await coll.create_index([("role", 1)])
                    await coll.create_index([("is_active", 1)])

                else:
                    logger.debug(f"No explicit indexes configured for {model.__name__}")

            except Exception as e:
                # Log detailed context for debugging
                logger.error(f"Failed to create indexes for {model.__name__}: {e}")
                raise

        print("✅ Indexes created successfully for all collections!")

    except Exception as e:
        print(f"❌ Failed to create indexes: {e}")
        logger.error(f"Failed to create indexes: {e}")


async def close_database():
    """Gracefully close the MongoDB connection."""
    global client
    try:
        if client:
            client.close()
            print("🔌 MongoDB connection closed successfully")
    except Exception as e:
        print(f"⚠️  Error closing MongoDB connection: {e}")
        logger.error(f"Failed to close database connection: {e}")


def get_database():
    """Return the current MongoDB database instance."""
    return database


def get_client():
    """Return the current MongoDB client instance."""
    return client
