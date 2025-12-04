import os
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from google.cloud import storage
from google.cloud.exceptions import NotFound
from app.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    """
    Service for handling Google Cloud Storage (GCS) operations.
    Handles upload, download, delete, and signed URLs for files.
    """

    def __init__(self):
        """Initialize storage service with proper development mode support."""
        self.client = None
        self.bucket = None
        self.bucket_name = None

        # In development mode without GCS config, use mock storage
        if settings.is_development and not settings.has_gcs_config:
            logger.info("Running in development mode with mock storage")
            self.bucket_name = "mock-development-bucket"
            return

        # Attempt to initialize GCS client
        try:
            # Try explicit credentials first, then fall back to application default
            if settings.gcs_credentials_path:
                self.client = storage.Client.from_service_account_json(settings.gcs_credentials_path)
            elif settings.google_application_credentials:
                self.client = storage.Client.from_service_account_json(settings.google_application_credentials)
            else:
                self.client = storage.Client()
            
            self.bucket_name = settings.gcs_bucket_name
            if not self.bucket_name:
                raise ValueError("GCS bucket name not configured")
                
            self.bucket = self.client.bucket(self.bucket_name)
            logger.info(f"✅ Connected to GCS bucket: {self.bucket_name}")
            
        except Exception as e:
            if settings.is_development:
                logger.warning(f"GCS initialization failed in development mode: {e}")
                self.bucket_name = "mock-development-bucket"
            else:
                logger.error(f"GCS initialization failed in production: {e}")
                raise

    # ----------------------------------------------------------------------
    def upload_to_gcs(self, file_content: bytes, file_name: str, folder: str = None) -> str:
        """
        Upload a file to Google Cloud Storage inside an optional folder.
        Automatically generates a unique filename and correct MIME type.

        Args:
            file_content: The actual file data (bytes)
            file_name: Original file name
            folder: Folder name inside bucket (e.g., "resumes" or "interviews")

        Returns:
            GCS path (e.g., gs://your-bucket/folder/uuid.pdf)
        """
        try:
            if not self.bucket:
                raise RuntimeError("Google Cloud Storage client not configured. Set credentials or GCS bucket name.")
            # Extract file extension and generate a unique filename
            file_extension = os.path.splitext(file_name)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            # Build final path inside the bucket
            if folder:
                gcs_path = f"{folder}/{unique_filename}"
            else:
                gcs_path = unique_filename

            blob = self.bucket.blob(gcs_path)

            # Upload file to GCS with correct MIME type (important for PDFs!)
            content_type = "application/pdf" if file_extension.lower() == ".pdf" else "application/octet-stream"
            blob.upload_from_string(file_content, content_type=content_type)
            print(f"📤 Uploaded file '{file_name}' as '{gcs_path}' with content_type={content_type}")

            # Add metadata (human-readable info) - best-effort
            try:
                blob.metadata = {
                    "original_name": file_name,
                    "folder": folder or "root",
                    "upload_timestamp": str(datetime.utcnow())
                }
                blob.patch()
            except Exception as meta_err:
                logger.warning(f"Could not set blob metadata: {meta_err}")

            # Generate signed URL for viewing (valid for 60 min) - non-fatal
            try:
                signed_url = blob.generate_signed_url(expiration=3600, method="GET")
                print(f"🔗 Signed URL generated: {signed_url}")
            except Exception as url_err:
                logger.warning(f"Could not generate signed URL (continuing): {url_err}")

            logger.info(f"File uploaded successfully to {gcs_path}")
            return f"gs://{self.bucket_name}/{gcs_path}"

        except Exception as e:
            logger.error(f"❌ Failed to upload file: {str(e)}")
            print(f"❌ Upload error: {e}")
            raise

    # ----------------------------------------------------------------------
    def download_file(self, gcs_path: str) -> bytes:
        """
        Download a file from Google Cloud Storage.

        Args:
            gcs_path: GCS path (gs://bucket/path or just path)

        Returns:
            File content as bytes
        """
        try:
            if not self.bucket:
                raise RuntimeError("Google Cloud Storage client not configured. Set credentials or GCS bucket name.")
            # Extract path from gs:// URL if needed
            if gcs_path.startswith("gs://"):
                path_parts = gcs_path.split("/", 3)
                blob_path = path_parts[3] if len(path_parts) >= 4 else None
            else:
                blob_path = gcs_path

            if not blob_path:
                raise ValueError("Invalid GCS path format")

            blob = self.bucket.blob(blob_path)
            content = blob.download_as_bytes()
            print(f"📥 Downloaded file successfully: {blob_path}")
            return content

        except NotFound:
            print(f"⚠️ File not found in GCS: {gcs_path}")
            raise FileNotFoundError(f"File not found: {gcs_path}")
        except Exception as e:
            print(f"❌ Error downloading file: {e}")
            raise

    # ----------------------------------------------------------------------
    def delete_file(self, gcs_path: str) -> bool:
        """
        Delete a file from Google Cloud Storage.

        Args:
            gcs_path: Full GCS path to delete

        Returns:
            True if deleted, False otherwise
        """
        try:
            if not self.bucket:
                raise RuntimeError("Google Cloud Storage client not configured. Set credentials or GCS bucket name.")
            # Extract blob path
            if gcs_path.startswith("gs://"):
                path_parts = gcs_path.split("/", 3)
                blob_path = path_parts[3] if len(path_parts) >= 4 else None
            else:
                blob_path = gcs_path

            if not blob_path:
                raise ValueError("Invalid GCS path format")

            blob = self.bucket.blob(blob_path)
            blob.delete()
            print(f"🗑️ Deleted file: {blob_path}")
            return True

        except NotFound:
            print(f"⚠️ File not found for deletion: {gcs_path}")
            return False
        except Exception as e:
            print(f"❌ Error deleting file: {e}")
            return False

    # ----------------------------------------------------------------------
    def get_file_info(self, gcs_path: str) -> Optional[Dict[str, Any]]:
        """
        Fetch metadata and details of a file in GCS.

        Args:
            gcs_path: GCS path

        Returns:
            Dict with file info (name, size, metadata, timestamps)
        """
        try:
            if not self.bucket:
                raise RuntimeError("Google Cloud Storage client not configured. Set credentials or GCS bucket name.")
            # Extract path
            if gcs_path.startswith("gs://"):
                path_parts = gcs_path.split("/", 3)
                blob_path = path_parts[3] if len(path_parts) >= 4 else None
            else:
                blob_path = gcs_path

            if not blob_path:
                raise ValueError("Invalid GCS path format")

            blob = self.bucket.blob(blob_path)
            blob.reload()

            info = {
                "name": blob.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "created": blob.time_created,
                "updated": blob.updated,
                "metadata": blob.metadata or {}
            }

            print(f"ℹ️ File Info: {info}")
            return info

        except NotFound:
            print(f"⚠️ File not found: {gcs_path}")
            return None
        except Exception as e:
            print(f"❌ Error fetching file info: {e}")
            return None

    # ----------------------------------------------------------------------
    def generate_signed_url(self, gcs_path: str, expiration_minutes: int = 60) -> str:
        """
        Generate a temporary signed URL to access a private GCS file.

        Args:
            gcs_path: GCS path
            expiration_minutes: Time until link expires (default = 60 min)

        Returns:
            Signed URL (string)
        """
        try:
            if gcs_path.startswith("gs://"):
                path_parts = gcs_path.split("/", 3)
                blob_path = path_parts[3] if len(path_parts) >= 4 else None
            else:
                blob_path = gcs_path

            if not blob_path:
                raise ValueError("Invalid GCS path format")

            blob = self.bucket.blob(blob_path)
            url = blob.generate_signed_url(
                expiration=expiration_minutes * 60,
                method="GET"
            )

            print(f"🔑 Signed URL (valid for {expiration_minutes} mins): {url}")
            return url

        except Exception as e:
            print(f"❌ Failed to generate signed URL: {e}")
            raise
