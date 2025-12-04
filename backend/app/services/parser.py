import tempfile
import os
import spacy
from pdfminer.high_level import extract_text
import re

class ResumeParser:
    @staticmethod
    def parse(uploaded_bytes: bytes) -> dict:
        """Parse a resume from raw file bytes.
        Returns a dict with keys like name, email, skills, total_experience, degree, and text.
        """
        suffix = ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(uploaded_bytes)
            temp_path = temp.name

        try:
            # Extract text from PDF
            text = extract_text(temp_path)

            # Basic parsing using spaCy
            try:
                nlp = spacy.load("en_core_web_sm")
            except OSError:
                # Fallback if model not available
                return {"text": text, "name": None, "email": None, "skills": [], "total_experience": 0, "degree": None}

            doc = nlp(text)

            # Extract basic info
            name = None
            email = None
            skills = []

            # Find email
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            email_match = re.search(email_pattern, text)
            if email_match:
                email = email_match.group()

            # Find potential name (first proper noun)
            for token in doc:
                if token.pos_ == "PROPN" and len(token.text) > 2:
                    name = token.text
                    break

            # Extract skills (simple keyword matching)
            skill_keywords = [
                "python", "java", "javascript", "react", "node", "sql", "machine learning", "ai",
                "data science", "web development", "mobile development", "cloud", "aws", "azure",
                "docker", "kubernetes", "fastapi", "django", "flask", "vue", "angular",
                "typescript", "html", "css", "git", "github"
            ]
            for token in doc:
                if token.text.lower() in skill_keywords:
                    skills.append(token.text.lower())

            # Estimate experience (look for years)
            experience = 0
            experience_pattern = r'(\d+)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)'
            exp_match = re.search(experience_pattern, text.lower())
            if exp_match:
                experience = int(exp_match.group(1))
            else:
                # Fallback: look for any number that could be years
                for token in doc:
                    if token.text.isdigit() and int(token.text) in range(1, 50):
                        experience = int(token.text)
                        break

            return {
                "text": text,
                "name": name,
                "email": email,
                "skills": list(set(skills)),
                "total_experience": experience,
                "degree": None
            }

        finally:
            try:
                os.remove(temp_path)
            except OSError:
                pass

    # Backwards-compatible wrapper used by Celery worker
    def parse_resume_bytes(self, uploaded_bytes: bytes) -> dict:
        """Compatibility wrapper: older callers expect parse_resume_bytes()."""
        return ResumeParser.parse(uploaded_bytes)
