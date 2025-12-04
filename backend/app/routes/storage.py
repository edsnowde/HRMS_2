from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_current_user
from app.services.storage import StorageService
from typing import Dict

router = APIRouter(prefix="/storage", tags=["storage"])
storage_service = StorageService()

@router.get("/signed-url")
async def get_signed_url(
    path: str,
    current_user = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Generate a signed URL for accessing a file in Google Cloud Storage.
    File must be in the configured GCS bucket.
    """
    try:
        if not path.startswith("gs://"):
            raise HTTPException(status_code=400, detail="Invalid GCS path format")
            
        url = storage_service.generate_signed_url(path)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))