export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobType = 'job_creation' | 'job_matching' | 'candidate_scoring';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export interface JobFormData {
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience_required: number;
  salary_range: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  job_id?: string;
  type?: JobType;
  status?: JobStatus;
  embedding_id?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Job extends Required<JobFormData> {
  job_id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface JobAnalytics {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  recent_jobs: number;
  total_candidates: number;
  total_interviews: number;
}