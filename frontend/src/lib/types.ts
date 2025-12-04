export interface Job {
  title: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  experience_required: number;
  location?: string;
  salary_range?: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'internship';
  department?: string;
}

export interface JobResponse extends Job {
  id: string;
  _id?: string; // MongoDB's internal ID
  job_id?: string; // UUID from backend
  status: string;
  created_by: string;
  created_at: string;
}

export interface Candidate {
  name: string;
  email: string;
  phone?: string;
  // List of skill strings
  skills?: string[];
  // Experience can be represented either as a simple number (total years)
  // or as a list of detailed role entries. Accept both to keep forms
  // and API models compatible during transitions.
  experience?: number | Array<{
    role: string;
    company?: string;
    startDate?: string;
    endDate?: string | null;
    description?: string;
  }>;
  education?: string;
  // Optional UI fields returned by backend
  location?: string;
  profileImage?: string;
  summary?: string;
}

export interface CandidateProfile extends Candidate {
  id: string;
  stage: string;
  latest_score?: {
    score: number;
    rationale: string;
  };
  created_at: string;
}

export interface ResumeUploadResponse {
  job_id: string;
  message: string;
  status: string;
}

export interface ResumeStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  details?: any;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: 'sick' | 'vacation' | 'personal' | 'maternity' | 'paternity' | 'bereavement';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_date: string;
  approved_by?: string;
  approved_date?: string;
  comments?: string;
}

export interface LeaveBalance {
  vacation_days: number;
  sick_days: number;
  personal_days: number;
  maternity_days: number;
  paternity_days: number;
  bereavement_days: number;
  total_available: number;
  total_used: number;
  total_remaining: number;
}

export interface SystemHealthResponse {
  status: string;
  version: string;
  uptime: number;
  services: {
    database: boolean;
    redis: boolean;
    storage: boolean;
    celery: boolean;
  };
}