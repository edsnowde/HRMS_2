from fastapi import APIRouter, HTTPException, Depends
from app.auth import get_current_user
from app.database import get_database
from app.schemas import CandidateProfile as CandidateProfileCreate, CandidateProfileResponse
from typing import Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/candidate", tags=["candidate"])

@router.post("/profile", response_model=CandidateProfileResponse)
async def create_candidate_profile(
    profile: CandidateProfileCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new candidate profile after signup.
    This should be called right after Firebase authentication is completed.
    """
    try:
        # Check if profile already exists for this user ID
        existing = await db.candidates.find_one({
            "$or": [
                {"user_id": current_user["uid"]},
                {"email": current_user["email"]}
            ]
        })
        
        if existing:
            return CandidateProfileResponse(
                id=str(existing["_id"]),
                **existing
            )
            
        # Create new profile
        profile_dict = profile.dict()
        profile_dict.update({
            "user_id": current_user["uid"],
            "email": current_user["email"],
            "stage": "new",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "latest_score": None
        })
        
        result = await db.candidates.insert_one(profile_dict)
        
        # Get the created profile
        created_profile = await db.candidates.find_one({"_id": result.inserted_id})
        if not created_profile:
            raise HTTPException(
                status_code=500, 
                detail="Failed to retrieve created profile"
            )
        
        # Convert ObjectId to string for the id field
        created_profile["id"] = str(created_profile["_id"])
        
        return CandidateProfileResponse(**created_profile)
        
    except Exception as e:
        logger.error(f"Failed to create candidate profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile", response_model=CandidateProfileResponse)
async def get_candidate_profile(
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get the candidate profile for the current user.
    """
    profile = await db.candidates.find_one({"user_id": current_user.id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return CandidateProfileResponse(**profile)