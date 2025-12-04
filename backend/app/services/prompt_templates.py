"""
Structured prompt templates for consistent AI interactions.
All prompts follow the specification requirements for deterministic outputs.
"""

from typing import Dict, Any, List
from app.services.audit import AuditService

audit_service = AuditService()


class PromptTemplates:
    """Centralized prompt templates for all AI operations."""
    
    @staticmethod
    def get_candidate_scoring_prompt(job_description: str, candidates: List[Dict[str, Any]]) -> str:
        """
        Structured prompt for scoring candidates against job description.
        Returns deterministic JSON output.
        """
        candidates_text = ""
        for i, candidate in enumerate(candidates, 1):
            candidates_text += f"""
{i}) id: {candidate.get('id', 'unknown')}
resume excerpt: {candidate.get('resume_excerpt', '')[:500]}..."""
        
        prompt = f"""
You are a structured HR scoring assistant. Return ONLY a valid JSON array of objects with fields: candidate_id, score(0-100 integer), rationale (2 short sentences), top_skills (array of max 3 skills).

Job Description:
{job_description}

Candidates:
{candidates_text}

Return only valid JSON in this exact format:
[
  {{
    "candidate_id": "id1",
    "score": 85,
    "rationale": "Strong Python experience with 3+ years in ML. Good fit for data science role.",
    "top_skills": ["Python", "Machine Learning", "TensorFlow"]
  }},
  {{
    "candidate_id": "id2", 
    "score": 72,
    "rationale": "Good technical background but limited ML experience. May need training.",
    "top_skills": ["Python", "SQL", "Analytics"]
  }}
]

Do not include any text outside the JSON array.
"""
        return prompt
    
    @staticmethod
    def get_communication_analysis_prompt(transcript: str, job_context: str = "") -> str:
        """Prompt for analyzing communication skills from interview transcript."""
        prompt = f"""
You are an expert communication analyst. Analyze this interview transcript for communication effectiveness.

Job Context: {job_context}

Transcript:
{transcript}

Evaluate these aspects and provide scores from 1-10:

1. CLARITY: How clear and articulate is the candidate's speech?
2. CONFIDENCE: How confident does the candidate sound?
3. STRUCTURE: How well-organized are the responses?
4. ENGAGEMENT: How engaging and personable is the candidate?
5. TECHNICAL_ACCURACY: How accurate is the technical information shared?

Provide your analysis in this exact format:
CLARITY: [score]/10 - [brief explanation]
CONFIDENCE: [score]/10 - [brief explanation]
STRUCTURE: [score]/10 - [brief explanation]
ENGAGEMENT: [score]/10 - [brief explanation]
TECHNICAL_ACCURACY: [score]/10 - [brief explanation]

OVERALL_SUMMARY: [2-3 sentence summary of communication strengths and areas for improvement]
"""
        return prompt
    
    @staticmethod
    def get_chatbot_role_prompt(role: str, query: str, context: Dict[str, Any] = None) -> str:
        """Role-specific chatbot prompts."""
        context_str = ""
        if context:
            context_str = f"\n\nRelevant Context: {context}"
        
        role_prompts = {
            "admin": f"""You are an AI assistant for system administrators. Help with system management, analytics, and oversight tasks.

User Query: {query}{context_str}

Provide helpful, accurate, and professional responses. Focus on system administration, monitoring, and analytics.""",

            "hr": f"""You are an AI assistant for HR professionals. Help with recruitment, employee management, and HR policies.

User Query: {query}{context_str}

Provide helpful guidance on HR processes, policies, and best practices. Do not make decisions that require human approval.""",

            "recruiter": f"""You are an AI assistant for recruiters. Help with candidate sourcing, job matching, and recruitment workflows.

User Query: {query}{context_str}

Provide helpful guidance on recruitment processes, candidate evaluation, and hiring best practices.""",

            "employee": f"""You are an AI assistant for employees. Help with leave requests, attendance, payroll, and general HR queries.

User Query: {query}{context_str}

Provide helpful information about employee benefits, policies, and procedures. Direct users to appropriate forms or contacts when needed.""",

            "candidate": f"""You are an AI assistant for job candidates. Help with application status, interview preparation, and career guidance.

User Query: {query}{context_str}

Provide helpful guidance on application processes, interview tips, and career development."""
        }
        
        return role_prompts.get(role.lower(), role_prompts["candidate"])
    
    @staticmethod
    def get_interview_question_generator_prompt(
        job_description: str,
        candidate_resume: str,
        role_type: str,
        time_per_question: int = 60,
        total_questions: int = 5
    ) -> str:
        """
        Prompt for generating timed interview questions with detailed scoring criteria.
        
        Args:
            job_description: Full job description
            candidate_resume: Candidate's resume text
            role_type: Type of role (technical, non-technical, leadership)
            time_per_question: Time in seconds for each answer (default 60)
            total_questions: Number of questions to generate (default 5)
            
        Returns:
            Formatted prompt for question generation
        """
        prompt = f"""
You are an expert technical interviewer. Generate {total_questions} targeted interview questions for a {role_type} role.
Each question should be precisely answerable within the time limit of {time_per_question} seconds.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{candidate_resume}

Question Requirements:
1. Each question must target ONE specific skill/concept from the job description or resume
2. Questions must require specific, measurable examples
3. Each question MUST be completely answerable in {time_per_question} seconds
4. Questions should progress from basic screening to complex assessment
5. Include a balanced mix of technical and behavioral questions based on role type
6. Each question should have clear scoring criteria with specific rubrics
7. Time management should be factored into scoring

Return a JSON array in this exact format:
[
  {{
    "id": "Q1",
    "question": "Question text here",
    "type": "technical|behavioral",
    "target_skill": "Specific skill being tested",
    "difficulty_level": "basic|intermediate|advanced",
    "expected_answer_points": [
      "Key point 1 to look for",
      "Key point 2 to look for",
      "Key point 3 to look for"
    ],
    "time_limit": {time_per_question},
    "retry_limit": 2,
    "scoring_criteria": {{
      "technical_accuracy": {{
        "weight": 40,
        "rubric": [
          "0-3: Incorrect or missing key concepts",
          "4-7: Partially correct with some gaps",
          "8-10: Complete and accurate technical response"
        ]
      }},
      "communication": {{
        "weight": 30,
        "rubric": [
          "0-3: Unclear or disorganized response",
          "4-7: Clear but could be more concise",
          "8-10: Clear, concise, well-structured"
        ]
      }},
      "problem_solving": {{
        "weight": 30,
        "rubric": [
          "0-3: No clear approach or methodology",
          "4-7: Basic approach with some structure",
          "8-10: Systematic and efficient approach"
        ]
      }},
      "time_management": {{
        "penalty_per_second": 1,
        "grace_period": 5
      }}
    }}
  }}
]

Generate exactly {total_questions} questions. Do not include any text outside the JSON array."""
        return prompt
    
    @staticmethod
    def get_resume_parsing_prompt(resume_text: str) -> str:
        """Prompt for structured resume parsing."""
        prompt = f"""
Extract structured information from this resume text. Return a JSON object with these fields:

Resume Text:
{resume_text}

Return JSON in this exact format:
{{
  "name": "Full Name",
  "email": "email@example.com", 
  "phone": "phone number",
  "skills": ["skill1", "skill2", "skill3"],
  "experience_years": 3.5,
  "education": "Degree and Institution",
  "summary": "Brief professional summary",
  "work_history": [
    {{
      "company": "Company Name",
      "position": "Job Title", 
      "duration": "2020-2023",
      "description": "Brief description"
    }}
  ]
}}

Extract only information explicitly present in the text. Use null for missing fields.
"""
        return prompt
    
    @staticmethod
    def get_fairness_check_prompt(job_description: str, candidate_data: Dict[str, Any]) -> str:
        """Prompt for fairness and bias checking."""
        prompt = f"""
You are an AI fairness auditor. Analyze this candidate evaluation for potential bias.

Job Description:
{job_description}

Candidate Data:
{{
  "name": "{candidate_data.get('name', '')}",
  "education": "{candidate_data.get('education', '')}",
  "experience": {candidate_data.get('experience', 0)},
  "skills": {candidate_data.get('skills', [])}
}}

Check for potential bias based on:
1. Name-based assumptions (gender, ethnicity)
2. Education bias (prestigious vs. non-prestigious schools)
3. Experience bias (overemphasis on years vs. quality)
4. Skills bias (missing relevant skills due to parsing errors)

Return JSON in this format:
{{
  "bias_detected": false,
  "bias_type": null,
  "confidence": 0.95,
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "requires_human_review": false
}}

Be conservative in bias detection. Only flag clear cases.
"""
        return prompt


class PromptValidator:
    """Validate and sanitize AI responses."""
    
    @staticmethod
    def validate_json_response(response: str, expected_fields: List[str]) -> Dict[str, Any]:
        """Validate JSON response from AI."""
        try:
            import json
            data = json.loads(response.strip())
            
            # Check if it's a list
            if isinstance(data, list):
                for item in data:
                    if not isinstance(item, dict):
                        raise ValueError("List items must be objects")
                    
                    # Check required fields
                    for field in expected_fields:
                        if field not in item:
                            raise ValueError(f"Missing required field: {field}")
            
            # Check if it's a single object
            elif isinstance(data, dict):
                for field in expected_fields:
                    if field not in data:
                        raise ValueError(f"Missing required field: {field}")
            
            else:
                raise ValueError("Response must be JSON object or array")
            
            return data
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Validation error: {str(e)}")
    
    @staticmethod
    def sanitize_score(score: Any) -> int:
        """Sanitize and validate score values."""
        try:
            if isinstance(score, str):
                score = float(score)
            
            score = int(round(float(score)))
            score = max(0, min(100, score))  # Clamp to 0-100
            
            return score
            
        except (ValueError, TypeError):
            return 50  # Default neutral score
    
    @staticmethod
    def sanitize_rationale(rationale: str, max_length: int = 200) -> str:
        """Sanitize rationale text."""
        if not isinstance(rationale, str):
            return "No rationale provided."
        
        # Remove any potentially harmful content
        sanitized = rationale.strip()
        
        # Limit length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length-3] + "..."
        
        return sanitized


class PromptManager:
    """Manage prompt versioning and configuration."""
    
    def __init__(self):
        self.audit_service = AuditService()
    
    def get_prompt_with_config(
        self,
        prompt_template: str,
        model_config: Dict[str, Any],
        variables: Dict[str, Any]
    ) -> tuple:
        """
        Get prompt with configuration and generate audit hash.
        
        Returns:
            Tuple of (formatted_prompt, prompt_hash, model_config)
        """
        # Format the prompt with variables
        formatted_prompt = prompt_template.format(**variables)
        
        # Generate prompt hash for auditing
        prompt_hash = self.audit_service.generate_prompt_hash(formatted_prompt, model_config)
        
        # Set model configuration for deterministic outputs
        model_config.update({
            "temperature": 0.0,  # Deterministic
            "max_tokens": 1000,  # Reasonable limit
            "top_p": 1.0
        })
        
        return formatted_prompt, prompt_hash, model_config
