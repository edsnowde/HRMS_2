import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
from app.config import settings
from app.models import UserRole
import logging

logger = logging.getLogger(__name__)

# -------------------------------
# Initialize Firebase Admin SDK
# -------------------------------
try:
    if settings.google_application_credentials:
        print(f"🔑 Loading Firebase credentials from: {settings.google_application_credentials}")
        cred = credentials.Certificate(settings.google_application_credentials)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin initialized with service account.")
    else:
        print("⚠️ No service account provided. Using default credentials (for Cloud Run deployment).")
        firebase_admin.initialize_app()
        print("✅ Firebase Admin initialized with default credentials.")
except Exception as e:
    logger.error(f"❌ Failed to initialize Firebase Admin SDK: {e}")
    print(f"❌ Failed to initialize Firebase Admin SDK: {e}")
    firebase_admin = None  # For development/mock

# -------------------------------
# HTTP Bearer token security
# -------------------------------
security = HTTPBearer()


class FirebaseAuth:
    """Service class for Firebase authentication and role management."""

    # Allowed Firebase project IDs. Prefer configuring via environment.
    # If `allowed_firebase_project_ids` is set in settings it will be used
    # as the authoritative list. Otherwise `firebase_project_id` is used.
    _allowed_ids = []
    # Normalize allowed IDs: support a list from settings or a comma-separated string
    raw_allowed = settings.allowed_firebase_project_ids
    if raw_allowed:
        if isinstance(raw_allowed, str):
            _allowed_ids = [p.strip() for p in raw_allowed.split(',') if p.strip()]
        elif isinstance(raw_allowed, (list, tuple, set)):
            _allowed_ids = [str(x).strip() for x in raw_allowed if x]
        else:
            # Fallback: coerce to string and split
            _allowed_ids = [p.strip() for p in str(raw_allowed).split(',') if p.strip()]
    elif settings.firebase_project_id:
        _allowed_ids = [str(settings.firebase_project_id).strip()]

    @staticmethod
    async def verify_token(token: str) -> Dict[str, Any]:
        """
        Verify a Firebase ID token and return user information.

        Raises HTTP 401 if token is invalid or audience mismatch.
        """
        try:
            if not firebase_admin:
                # Development mode - return mock user
                print("⚡ Using mock user (development mode)")
                return {
                    "uid": "dev_user_123",
                    "email": "dev@example.com",
                    "role": UserRole.ADMIN.value,
                    "name": "Development User"
                }

            # Verify token with Firebase
            decoded_token = auth.verify_id_token(token)
            print(f"🔐 Token decoded successfully: UID={decoded_token.get('uid')}")

            # Check audience/project ID against configured allowed IDs
            aud = decoded_token.get("aud") or decoded_token.get("firebase", {}).get("project_id")
            if FirebaseAuth._allowed_ids:
                if aud not in FirebaseAuth._allowed_ids:
                    expected = ", ".join(FirebaseAuth._allowed_ids)
                    print(f"❌ Token audience mismatch: expected one of [{expected}], got {aud}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid Firebase token: expected project {expected}, got {aud}"
                    )
            else:
                # If no allowed IDs configured, warn and continue (note: less strict)
                print("⚠️ No Firebase project IDs configured in settings; skipping audience check")

            # Extract user info
            user_info = {
                "uid": decoded_token.get("uid"),
                "email": decoded_token.get("email"),
                "name": decoded_token.get("name", ""),
                "role": decoded_token.get("role", UserRole.CANDIDATE.value)
            }
            print(f"✅ Token verified for user: {user_info['uid']}, role: {user_info['role']}")
            return user_info

        except Exception as e:
            print(f"❌ Token verification failed: {e}")
            logger.error(f"Token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    @staticmethod
    def require_role(required_role: UserRole):
        """
        Dependency for FastAPI routes to enforce user roles.

        Raises HTTP 403 if user role is insufficient.
        """
        async def role_checker(token: HTTPAuthorizationCredentials = Depends(security)):
            user_info = await FirebaseAuth.verify_token(token.credentials)

            # Define role hierarchy
            role_hierarchy = {
                UserRole.CANDIDATE: 0,
                UserRole.EMPLOYEE: 1,
                UserRole.RECRUITER: 2,
                UserRole.HR: 3,
                UserRole.ADMIN: 4
            }

            user_role_level = role_hierarchy.get(UserRole(user_info.get("role", "candidate")), 0)
            required_role_level = role_hierarchy.get(required_role, 0)

            if user_role_level < required_role_level:
                print(f"⚠️ User {user_info['uid']} has insufficient role: {user_info['role']}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required role: {required_role.value}"
                )

            print(f"✅ User {user_info['uid']} authorized with role {user_info['role']}")
            return user_info

        return role_checker

    @staticmethod
    async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
        """FastAPI dependency to get the current authenticated user."""
        return await FirebaseAuth.verify_token(token.credentials)


# -------------------------------
# Convenience role checks
# -------------------------------
require_role = FirebaseAuth.require_role  # Export the role checker directly
require_admin = require_role(UserRole.ADMIN)
require_hr = require_role(UserRole.HR)
require_recruiter = require_role(UserRole.RECRUITER)
require_employee = require_role(UserRole.EMPLOYEE)
require_candidate = require_role(UserRole.CANDIDATE)

# -------------------------------
# Generic authenticated user
# -------------------------------
async def get_authenticated_user(token: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get any authenticated user (minimum role check)."""
    return await FirebaseAuth.verify_token(token.credentials)

# Backwards-compatible reference
get_current_user = FirebaseAuth.get_current_user


async def get_user_role(current_user = Depends(get_current_user)):
    """FastAPI dependency that returns the current user's role as a string.

    Some routes use `role = Depends(get_user_role)` and expect a role
    string such as 'admin', 'hr', 'recruiter', etc.
    """
    try:
        # current_user is a dict returned by verify_token
        return current_user.get("role", UserRole.CANDIDATE.value)
    except Exception:
        # Fallback to candidate role
        return UserRole.CANDIDATE.value
