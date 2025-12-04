export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: ApplicationStatus;
  stage: number;
  score?: number;
  resumeUrl?: string;
  videoUrl?: string;
  coverLetter?: string;
  phone?: string;
  matchScore?: number;
  interviewScore?: number;
  interviewFeedback?: string;
  timeline?: Array<{
    id: string;
    timestamp: string;
    title: string;
    description?: string;
  }>;
  interviewSession?: {
    id: string;
    status: string;
    questions: Array<{
      id: string;
      text: string;
      answer?: string;
      score?: number;
      feedback?: string;
    }>;
  };
}

export interface InterviewResult {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  company: string;
  interview_date: string;
  duration: number;
  overall_score: number;
  technical_score: number;
  communication_score: number;
  cultural_fit_score: number;
  strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  transcript?: string;
  video_url?: string;
  audio_url?: string;
  status: 'completed' | 'processing' | 'failed';
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  feedback?: 'positive' | 'negative' | null;
}

export type ApplicationStatus = 
  | 'applied'
  | 'shortlisted'
  | 'interviewed'
  | 'hired'
  | 'rejected';