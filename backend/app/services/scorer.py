import google.generativeai as genai
from typing import Dict, Any, Tuple
from app.config import settings
import logging
import re
import hashlib

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.gemini_api_key)


class ScorerService:
    """Service for LLM-based scoring and analysis."""
    
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        # Scoring prompt templates
        self.templates = {
            "interview_scoring": """
You are an expert HR evaluator. Score these interview answers based on the job requirements and resume.

JOB DESCRIPTION:
{job_description}

RESUME SUMMARY:
{resume_text}

QUESTIONS & ANSWERS:
{qa_pairs}

Evaluate technical skills and communication ability. For expired answers, score as 0.

Return a JSON response with:
{
  "technical": 0-100 score for technical knowledge and skills
  "communication": 0-100 score for clarity and articulation
  "final_score": weighted average (60% technical, 40% communication)
  "rationale": 2-3 sentence explanation of the scores
}

Consider:
1. Accuracy and depth of technical responses
2. Problem-solving approach
3. Communication clarity and structure
4. Overall alignment with role
"""
        }
    
    def score_candidate(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """
        Score candidate against job description using LLM.
        
        Args:
            resume_text: Candidate's resume text
            job_description: Job description text
        
        Returns:
            Dict with score and rationale
        """
        try:
            prompt = f"""
You are an expert HR AI assistant specializing in candidate evaluation.

TASK: Evaluate how well this resume matches the job description.
Provide a comprehensive analysis with a numerical score from 0-100.

JOB DESCRIPTION:
{job_description}

RESUME:
{resume_text}

Please provide your evaluation in the following format:
SCORE: [number from 0-100]
RATIONALE: [detailed explanation in 2-3 sentences explaining the match quality, key strengths, and any gaps]

Focus on:
1. Technical skills alignment
2. Experience relevance
3. Education background
4. Overall fit for the role

Be objective and provide constructive feedback.
"""
            
            response = self.model.generate_content(prompt)
            output = getattr(response, 'text', '') or ''
            
            # Parse score and rationale
            score, rationale = self._parse_llm_response(output)
            
            return {
                "score": score,
                "rationale": rationale,
                "model": "gemini-2.0-flash-exp",
                "timestamp": None  # Will be set by caller
            }
            
        except Exception as e:
            logger.error(f"LLM scoring failed: {str(e)}")
            # Fallback scoring
            return self._fallback_scoring(resume_text, job_description)
    
    def analyze_communication_skills(self, transcript: str) -> Dict[str, Any]:
        """
        Analyze communication skills from interview transcript.
        
        Args:
            transcript: Interview transcript text
        
        Returns:
            Dict with communication analysis
        """
        try:
            prompt = f"""
You are an expert communication analyst. Analyze this interview transcript for communication skills.

TRANSCRIPT:
{transcript}

Please evaluate the following aspects and provide scores from 1-10:

1. CLARITY: How clear and articulate is the candidate's speech?
2. CONFIDENCE: How confident does the candidate sound?
3. STRUCTURE: How well-organized are the responses?
4. ENGAGEMENT: How engaging and personable is the candidate?
5. TECHNICAL_ACCURACY: How accurate is the technical information shared?

Provide your analysis in this format:
CLARITY: [score]/10 - [brief explanation]
CONFIDENCE: [score]/10 - [brief explanation]
STRUCTURE: [score]/10 - [brief explanation]
ENGAGEMENT: [score]/10 - [brief explanation]
TECHNICAL_ACCURACY: [score]/10 - [brief explanation]

OVERALL_SUMMARY: [2-3 sentence summary of communication strengths and areas for improvement]
"""
            
            response = self.model.generate_content(prompt)
            output = getattr(response, 'text', '') or ''
            
            # Parse scores and summary
            analysis = self._parse_communication_analysis(output)
            
            return {
                "scores": analysis,
                "transcript_length": len(transcript),
                "model": "gemini-2.0-flash-exp",
                "timestamp": None
            }
            
        except Exception as e:
            logger.error(f"Communication analysis failed: {str(e)}")
            return self._fallback_communication_analysis(transcript)
    
    def generate_interview_questions(
        self, 
        job_description: str, 
        resume_text: str,
        num_questions: int = 4
    ) -> list:
        """
        Generate timed interview questions based on job and resume.
        
        Args:
            job_description: Job description text
            resume_text: Candidate's resume text
            num_questions: Number of questions to generate (default 4)
            
        Returns:
            List of questions with IDs
        """
        try:
            prompt = f"""
You are an expert interviewer. Generate {num_questions} relevant interview questions that can be answered in 1 minute each.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume_text}

Generate concise questions that:
1. Test specific technical skills mentioned in the resume
2. Evaluate problem-solving with real scenarios
3. Assess communication and cultural fit
4. Can be answered thoughtfully in 1 minute

For each question:
1. Focus on one clear concept
2. Require specific examples
3. Keep it concise (1-2 sentences)

Format each as: "QUESTION: [question text]"
"""
            
            response = self.model.generate_content(prompt)
            output = getattr(response, 'text', '') or ''
            
            # Parse questions
            questions = self._parse_questions(output)
            
            return questions
            
        except Exception as e:
            logger.error(f"Question generation failed: {str(e)}")
            return self._fallback_questions()
    
    def _parse_llm_response(self, output: str) -> Tuple[int, str]:
        """Parse LLM response to extract score and rationale."""
        try:
            # Extract score
            score_match = re.search(r'SCORE:\s*(\d+)', output, re.IGNORECASE)
            score = int(score_match.group(1)) if score_match else 0
            
            # Extract rationale
            rationale_match = re.search(r'RATIONALE:\s*(.+)', output, re.IGNORECASE | re.DOTALL)
            rationale = rationale_match.group(1).strip() if rationale_match else output
            
            return score, rationale
            
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {str(e)}")
            return 0, output
    
    def _parse_communication_analysis(self, output: str) -> Dict[str, Any]:
        """Parse communication analysis response."""
        try:
            scores = {}
            summary = ""
            
            # Extract scores
            score_patterns = {
                'clarity': r'CLARITY:\s*(\d+)/10',
                'confidence': r'CONFIDENCE:\s*(\d+)/10',
                'structure': r'STRUCTURE:\s*(\d+)/10',
                'engagement': r'ENGAGEMENT:\s*(\d+)/10',
                'technical_accuracy': r'TECHNICAL_ACCURACY:\s*(\d+)/10'
            }
            
            for key, pattern in score_patterns.items():
                match = re.search(pattern, output, re.IGNORECASE)
                if match:
                    scores[key] = int(match.group(1))
                else:
                    scores[key] = 5  # Default score
            
            # Extract summary
            summary_match = re.search(r'OVERALL_SUMMARY:\s*(.+)', output, re.IGNORECASE | re.DOTALL)
            if summary_match:
                summary = summary_match.group(1).strip()
            
            scores['summary'] = summary
            return scores
            
        except Exception as e:
            logger.error(f"Failed to parse communication analysis: {str(e)}")
            return {
                'clarity': 5,
                'confidence': 5,
                'structure': 5,
                'engagement': 5,
                'technical_accuracy': 5,
                'summary': 'Analysis parsing failed'
            }
    
    def _parse_questions(self, output: str) -> list:
        """Parse generated questions."""
        try:
            questions = []
            question_pattern = r'QUESTION:\s*(.+)'
            
            matches = re.findall(question_pattern, output, re.IGNORECASE | re.MULTILINE)
            questions = [match.strip() for match in matches if match.strip()]
            
            return questions[:5]  # Limit to 5 questions
            
        except Exception as e:
            logger.error(f"Failed to parse questions: {str(e)}")
            return []
    
    def _fallback_scoring(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """Fallback scoring based on keyword matching."""
        try:
            job_keywords = set(job_description.lower().split())
            resume_keywords = set(resume_text.lower().split())
            matches = len(job_keywords & resume_keywords)
            
            # Simple scoring based on keyword overlap
            total_keywords = len(job_keywords)
            if total_keywords > 0:
                score = min(100, int((matches / total_keywords) * 100))
            else:
                score = 50
            
            rationale = f"Fallback score based on keyword matching: {matches} matching keywords out of {total_keywords} total job keywords."
            
            return {
                "score": score,
                "rationale": rationale,
                "model": "fallback",
                "timestamp": None
            }
            
        except Exception as e:
            logger.error(f"Fallback scoring failed: {str(e)}")
            return {
                "score": 50,
                "rationale": "Unable to perform scoring analysis.",
                "model": "fallback",
                "timestamp": None
            }
    
    def _fallback_communication_analysis(self, transcript: str) -> Dict[str, Any]:
        """Fallback communication analysis."""
        try:
            # Simple analysis based on transcript length and word count
            word_count = len(transcript.split())
            char_count = len(transcript)
            
            # Basic scoring based on response length
            clarity = min(10, max(1, word_count // 50))
            confidence = min(10, max(1, char_count // 100))
            
            return {
                'clarity': clarity,
                'confidence': confidence,
                'structure': 5,
                'engagement': 5,
                'technical_accuracy': 5,
                'summary': f'Basic analysis based on response length: {word_count} words, {char_count} characters.'
            }
            
        except Exception as e:
            logger.error(f"Fallback communication analysis failed: {str(e)}")
            return {
                'clarity': 5,
                'confidence': 5,
                'structure': 5,
                'engagement': 5,
                'technical_accuracy': 5,
                'summary': 'Unable to perform communication analysis.'
            }
    
    def _fallback_questions(self) -> list:
        """Fallback interview questions."""
        return [
            "Can you tell me about your relevant experience for this role?",
            "What are your key technical skills?",
            "How do you approach problem-solving?",
            "What motivates you in your work?",
            "Do you have any questions about the role or company?"
        ]

    def get_prompt_hash(self, template_key: str) -> str:
        """Get SHA256 hash of a prompt template."""
        template = self.templates.get(template_key, '')
        return hashlib.sha256(template.encode()).hexdigest()

    def score_interview_answers(self, scoring_data: Dict[str, Any], prompt_hash: str = None) -> Dict[str, Any]:
        """Score interview answers using Gemini LLM.
        
        Args:
            scoring_data: Dict containing:
                - job_description: str
                - resume_text: str
                - qa_pairs: List[Dict] with question, answer, expired fields
            prompt_hash: Optional hash of prompt template used
            
        Returns:
            Dict with technical score, communication score, final score and rationale
        """
        try:
            # Format QA pairs for prompt
            qa_text = "\n\n".join([
                f"Q: {qa['question']}\nA: {qa['answer']}\nExpired: {qa['expired']}"
                for qa in scoring_data['qa_pairs']
            ])
            
            # Build full prompt
            prompt = self.templates["interview_scoring"].format(
                job_description=scoring_data['job_description'],
                resume_text=scoring_data['resume_text'],
                qa_pairs=qa_text
            )
            
            # Get LLM response
            response = self.model.generate_content(prompt)
            output = getattr(response, 'text', '') or ''
            
            # Parse scores and rationale from response
            scores = self._parse_interview_scores(output)
            
            # Add metadata
            scores["model_version"] = "gemini-2.5-flash"
            if prompt_hash:
                scores["prompt_hash"] = prompt_hash
                
            return scores
            
        except Exception as e:
            logger.error(f"Interview scoring failed: {str(e)}")
            return self._fallback_interview_scoring(scoring_data)
    
    def _parse_interview_scores(self, output: str) -> Dict[str, Any]:
        """Parse interview scoring response from LLM."""
        try:
            # Extract technical score
            tech_match = re.search(r'"technical":\s*(\d+)', output)
            technical = int(tech_match.group(1)) if tech_match else 0
            
            # Extract communication score
            comm_match = re.search(r'"communication":\s*(\d+)', output)
            communication = int(comm_match.group(1)) if comm_match else 0
            
            # Extract or calculate final score
            final_match = re.search(r'"final_score":\s*(\d+\.?\d*)', output)
            if final_match:
                final_score = float(final_match.group(1))
            else:
                # Calculate weighted average
                final_score = (technical * 0.6) + (communication * 0.4)
            
            # Extract rationale
            rationale_match = re.search(r'"rationale":\s*"([^"]+)"', output)
            rationale = rationale_match.group(1) if rationale_match else "No rationale provided"
            
            return {
                "technical": technical,
                "communication": communication,
                "final_score": round(final_score, 2),
                "rationale": rationale
            }
            
        except Exception as e:
            logger.error(f"Failed to parse interview scores: {str(e)}")
            return {
                "technical": 0,
                "communication": 0,
                "final_score": 0,
                "rationale": f"Failed to parse scores: {str(e)}"
            }

    def _fallback_interview_scoring(self, scoring_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback scoring when LLM fails."""
        try:
            # Count non-expired answers
            valid_answers = len([
                qa for qa in scoring_data['qa_pairs']
                if not qa.get('expired', False)
            ])
            
            total_questions = len(scoring_data['qa_pairs'])
            
            if total_questions == 0:
                return {
                    "technical": 0,
                    "communication": 0,
                    "final_score": 0,
                    "rationale": "No questions found"
                }
            
            # Basic scoring based on completion
            completion_rate = valid_answers / total_questions
            technical = int(completion_rate * 70)  # Max 70 for completion
            communication = int(completion_rate * 70)  # Max 70 for completion
            
            return {
                "technical": technical,
                "communication": communication,
                "final_score": round((technical * 0.6) + (communication * 0.4), 2),
                "rationale": f"Fallback scoring: {valid_answers} valid answers out of {total_questions} questions"
            }
            
        except Exception as e:
            logger.error(f"Fallback interview scoring failed: {str(e)}")
            return {
                "technical": 0,
                "communication": 0,
                "final_score": 0,
                "rationale": "Scoring failed"
            }

    def score_response(self, question: str, response: str, job_description: str, transcript: str = None) -> Tuple[float, str]:
        """Score a candidate's response to an interview question.

        Args:
            question (str): The interview question
            response (str): The candidate's response 
            job_description (str): The job description
            transcript (str, optional): Full interview transcript for context

        Returns:
            Tuple[float, str]: Score (0-10) and feedback
        """
        context = f"""
Full Interview Context:
{transcript if transcript else 'No additional context available'}
"""

        prompt = f"""
You are an expert interviewer reviewing a 1-minute response to a technical question.

QUESTION:
{question}

CANDIDATE RESPONSE:
{response}

JOB CONTEXT:
{job_description}

{context if transcript else ''}

Evaluate this 1-minute response from 0-10 points on:
1. Question Understanding (0-2)
   - Addresses the core question
   - Stays focused and relevant
   
2. Technical Accuracy (0-3)
   - Demonstrates knowledge
   - Uses correct terminology
   - Shows depth of understanding

3. Communication (0-3)
   - Clear and concise
   - Well-structured
   - Professional tone

4. Practical Application (0-2)
   - Provides real examples
   - Shows problem-solving ability

Provide your response as:
SCORE: [0-10]
FEEDBACK: [2-3 sentences with specific examples from their response]
"""
        try:
            response = self.model.generate_content(prompt)
            output = getattr(response, 'text', '') or ''
            
            # Parse score and feedback
            score, feedback = self._parse_llm_response(output)
            return score, feedback
            
        except Exception as e:
            logger.error(f"Response scoring failed: {str(e)}")
            return 5.0, "Unable to score response due to technical error."


# Legacy function for backward compatibility
def llm_score(job_desc: str, resume_text: str) -> Tuple[int, str]:
    """Legacy function for backward compatibility."""
    service = ScorerService()
    result = service.score_candidate(resume_text, job_desc)
    return result["score"], result["rationale"]


# Backwards compatible alias used elsewhere in the codebase
class LLMScoringService(ScorerService):
    """Alias for ScorerService for older imports expecting LLMScoringService."""
    pass