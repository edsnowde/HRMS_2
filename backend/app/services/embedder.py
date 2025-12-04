from pinecone import Pinecone, ServerlessSpec
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
from app.config import settings
import logging
import uuid
import hashlib

logger = logging.getLogger(__name__)


class EmbedderService:
    """Service for handling embeddings and Pinecone operations (Updated SDK)."""

    def __init__(self):
        try:
            # ✅ Initialize Pinecone client (new syntax)
            self.pc = Pinecone(api_key=settings.pinecone_api_key)

            # Define metadata schema
            metadata_config = {
                "indexed": [
                    # Primary keys for filtering
                    {"name": "job_id", "type": "string"},
                    {"name": "application_id", "type": "string"},
                    {"name": "vector_type", "type": "string"},
                    {"name": "status", "type": "string"},
                    # Timestamp for sorting/filtering
                    {"name": "timestamp", "type": "string"},
                ]
            }

            # ✅ Load the sentence transformer model once so we can infer embedding dimension
            # NOTE: loading the model before creating the index prevents dimension mismatches
            self.model = SentenceTransformer('all-mpnet-base-v2')  # typically produces 768-d vectors
            try:
                embedding_dim = int(self.model.get_sentence_embedding_dimension())
            except Exception:
                # Fallback in case the model instance doesn't provide the helper
                embedding_dim = 768

            # ✅ Ensure index exists before connecting and use the model's dimension
            if settings.pinecone_index_name not in self.pc.list_indexes().names():
                logger.info(f"Index '{settings.pinecone_index_name}' not found. Creating it (dim={embedding_dim})...")
                self.pc.create_index(
                    name=settings.pinecone_index_name,
                    dimension=embedding_dim,
                    metric='cosine',
                    metadata_config=metadata_config,
                    spec=ServerlessSpec(
                        cloud='aws',
                        region='us-east-1'
                    )
                )

            # ✅ Connect to the index
            self.index = self.pc.Index(settings.pinecone_index_name)

            logger.info(f"Pinecone initialized with index '{settings.pinecone_index_name}'")

        except Exception as e:
            logger.error(f"Failed to initialize Pinecone: {str(e)}")
            raise

    def create_embedding(self, text: str) -> str:
        """Create embedding for given text and store it in Pinecone."""
        try:
            if not text:
                return ""

            # Generate embedding
            # SentenceTransformer.encode may return numpy array; convert to python list
            embedding = self.model.encode(text)
            if hasattr(embedding, 'tolist'):
                embedding = embedding.tolist()
            else:
                embedding = list(embedding)

            # Create a unique ID
            vector_id = str(uuid.uuid4())

            # Upsert into Pinecone
            self.index.upsert(vectors=[(vector_id, embedding, {"text": text})])

            logger.info(f"✅ Created embedding for text (len={len(text)}) with ID={vector_id}")
            return vector_id

        except Exception as e:
            logger.error(f"❌ Failed to create embedding: {str(e)}")
            # Fallback hash ID
            return hashlib.md5(text.encode()).hexdigest()[:10]

    def upsert_to_pinecone(self, vector_id: str, text: str, metadata: Dict[str, Any]) -> bool:
        """Upsert a vector to Pinecone with additional metadata.
        
        Args:
            vector_id: Unique identifier for the vector
            text: Text to embed
            metadata: Additional metadata to store with the vector. Common fields:
                - text: Original text (added automatically)
                - job_id: Associated job ID
                - application_id: Associated application ID
                - type: Vector type (resume, job, interview_qa)
                - timestamp: Creation timestamp
                - status: Current status
                
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Generate embedding
            embedding = self.model.encode(text).tolist()
            
            # Add required metadata
            metadata = metadata.copy()  # Don't modify original
            metadata["text"] = text
            metadata["timestamp"] = metadata.get("timestamp", None)
            metadata["vector_type"] = metadata.get("type", "unknown")
            
            # Validate metadata types (Pinecone requirement)
            for key, value in metadata.items():
                if isinstance(value, (bool, int, float, str, list)):
                    continue
                elif value is None:
                    metadata[key] = ""  # Convert None to empty string
                else:
                    metadata[key] = str(value)  # Convert other types to string
            
            # Upsert with validation
            if not isinstance(vector_id, str):
                vector_id = str(vector_id)
                
            self.index.upsert(vectors=[(vector_id, embedding, metadata)])
            
            logger.info(
                f"✅ Upserted vector {vector_id} "
                f"type={metadata.get('vector_type')} "
                f"job_id={metadata.get('job_id', 'none')} "
                f"app_id={metadata.get('application_id', 'none')}"
            )
            return True

        except Exception as e:
            logger.error(f"❌ Failed to upsert to Pinecone: {str(e)}")
            return False

    def query_similar(self, text_or_vector: Union[str, List[float]], top_k: int = 10,
                      filter_metadata: Dict[str, Any] = None,
                      min_score: float = 0.0,
                      vector_type: Optional[str] = None,
                      scoring_config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Query Pinecone for similar vectors with enhanced filtering and scoring.
        
        Args:
            text_or_vector: Either text to encode or a pre-computed vector
            top_k: Maximum number of results to return (limited by max_top_k from config)
            filter_metadata: Metadata filters to apply (e.g. {"job_id": "123"})
            min_score: Minimum similarity score (0-1) to include in results
            vector_type: Optional type of vectors to query (e.g. "resume", "job")
            scoring_config: Optional configuration for scoring:
                - weight_recent: float (0-1) Weight for recency in scoring
                - max_age_days: int Max age of vectors to consider
                - boost_fields: List[str] Fields to boost in scoring
            
        Returns:
            List of similar vectors with scores and metadata
        """
        try:
            # Handle text or pre-computed vector input
            if isinstance(text_or_vector, str):
                query_vector = self.model.encode(text_or_vector).tolist()
            else:
                query_vector = text_or_vector

            # Build filter query with enhanced filtering
            filter_query = {}
            
            # Add vector type filter if specified
            if vector_type:
                filter_query["vector_type"] = {"$eq": vector_type}
            
            # Add custom metadata filters
            if filter_metadata:
                for key, value in filter_metadata.items():
                    if isinstance(value, (list, tuple)):
                        filter_query[key] = {"$in": value}
                    else:
                        filter_query[key] = {"$eq": value}

            # Add age filter if specified in scoring config
            if scoring_config and scoring_config.get("max_age_days"):
                max_age = scoring_config["max_age_days"]
                min_timestamp = (datetime.now() - timedelta(days=max_age)).isoformat()
                filter_query["timestamp"] = {"$gte": min_timestamp}

            # Get base results from Pinecone
            results = self.index.query(
                vector=query_vector,
                top_k=min(top_k, settings.max_top_k),  # Limit by configured max
                include_metadata=True,
                filter=filter_query if filter_query else None
            )

            # Process and score results with enhancements
            similar_vectors = []
            for match in results.matches:
                score = float(match.score)
                if score < min_score:
                    continue
                    
                metadata = match.metadata or {}
                
                # Apply scoring adjustments if config provided
                final_score = score
                if scoring_config:
                    # Recency boost
                    if scoring_config.get("weight_recent") and metadata.get("timestamp"):
                        age_days = (datetime.now() - datetime.fromisoformat(metadata["timestamp"])).days
                        recency_factor = max(0, 1 - (age_days / (scoring_config.get("max_age_days", 365) * 2)))
                        weight = scoring_config["weight_recent"]
                        final_score = (score * (1 - weight)) + (recency_factor * weight)
                    
                    # Field-specific boosts
                    if scoring_config.get("boost_fields"):
                        boost = 1.0
                        for field in scoring_config["boost_fields"]:
                            if field in metadata:
                                boost += 0.1  # 10% boost per matching field
                        final_score *= min(boost, 1.5)  # Cap boost at 50%
                
                similar_vectors.append({
                    "id": match.id,
                    "score": final_score,
                    "base_score": score,
                    "metadata": metadata,
                    "similarity": round(final_score, 4)
                })
            
            # Sort by final score
            similar_vectors.sort(key=lambda x: x["score"], reverse=True)

            logger.info(
                f"🔍 Found {len(similar_vectors)} similar vectors "
                f"(min_score={min_score}, filter={filter_query})"
            )
            return similar_vectors

        except Exception as e:
            logger.error(f"❌ Query failed: {str(e)}")
            return []

    def get_vector(self, vector_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a specific vector by ID."""
        try:
            result = self.index.fetch(ids=[vector_id])
            if vector_id in result.vectors:
                vector_data = result.vectors[vector_id]
                return {
                    "id": vector_id,
                    "values": vector_data.values,
                    "metadata": vector_data.metadata
                }
            return None

        except Exception as e:
            logger.error(f"❌ Failed to fetch vector: {str(e)}")
            return None

    def delete_vector(self, vector_id: str) -> bool:
        """Delete a vector by ID."""
        try:
            self.index.delete(ids=[vector_id])
            logger.info(f"🗑️ Deleted vector {vector_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to delete vector: {str(e)}")
            return False

    def delete_vectors(self, vector_ids: List[str]) -> int:
        """Delete multiple vectors."""
        try:
            self.index.delete(ids=vector_ids)
            logger.info(f"🗑️ Deleted {len(vector_ids)} vectors")
            return len(vector_ids)
        except Exception as e:
            logger.error(f"❌ Failed to delete multiple vectors: {str(e)}")
            return 0

    def get_index_stats(self) -> Dict[str, Any]:
        """Get Pinecone index statistics."""
        try:
            stats = self.index.describe_index_stats()
            return {
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension,
                "namespaces": stats.namespaces
            }
        except Exception as e:
            logger.error(f"❌ Failed to get index stats: {str(e)}")
            return {}


# ✅ Legacy compatibility
_model = None

def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer('all-mpnet-base-v2')  # This model produces 768-d vectors
    return _model


def create_embedding_and_upsert(text: str) -> str:
    """Legacy function for backward compatibility."""
    service = EmbedderService()
    return service.create_embedding(text)
