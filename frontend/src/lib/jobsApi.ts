import { apiClient } from './apiClient';
import type { JobFormData, Job, JobAnalytics } from '@/types/job';

interface JobListResponse {
  jobs: Job[];
  total: number;
  skip: number;
  limit: number;
}

export const jobsApi = {
  createJob: async (jobData: JobFormData): Promise<Job> => {
    const response = await apiClient.createJob(jobData);
    // Transform the response into a Job type
    return {
      ...jobData,
      // normalize id fields so frontend can use `id` consistently
      job_id: response.job_id,
      _id: response.job_id,
      id: response.job_id,
      status: response.status as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: jobData.type || 'job_creation',
      embedding_id: '',
      metadata: jobData.metadata || {},
      requirements: jobData.requirements || [],
      skills_required: jobData.skills_required || [],
      department: jobData.department || '',
      location: jobData.location || '',
      experience_required: jobData.experience_required || 0,
      salary_range: jobData.salary_range || '',
      employment_type: jobData.employment_type || 'full-time',
    } as Job;
  },

  listJobs: async (skip = 0, limit = 10): Promise<JobListResponse> => {
    const response = await apiClient.getJobs(skip, limit);
    // Transform JobResponse[] into Job[]
    return {
      ...response,
      jobs: response.jobs.map((jobResponse) => {
        const jr = jobResponse as any;
        const normalizedId = jr.job_id || jr._id || jr.id || String(jr._id || jr.job_id || jr.id || Math.random());
        const mapped: any = {
          ...jr,
          // normalize identifiers used across frontend
          job_id: jr.job_id || jr._id || jr.id || normalizedId,
          _id: jr._id || jr.job_id || jr.id || normalizedId,
          id: normalizedId,
          type: jr.type || 'job_creation',
          embedding_id: jr.embedding_id || '',
          metadata: jr.metadata || {},
          status: jr.status || 'PENDING',
          updated_at: jr.updated_at || new Date().toISOString(),
          requirements: jr.requirements || [],
          skills_required: jr.skills_required || []
        };
        return mapped as unknown as Job;
      })
    };
  },

  getJobStatus: async (jobId: string): Promise<Job> => {
    // Since getJobStatus doesn't exist, we can use getJobs and filter
    const response = await apiClient.getJobs(0, 100);
    const jobsAny = response.jobs as any[];
    const jobAny = jobsAny.find(j => j.job_id === jobId || j._id === jobId || j.id === jobId);
    if (!jobAny) {
      throw new Error(`Job with id ${jobId} not found`);
    }
    const mapped: any = {
      ...jobAny,
      type: jobAny.type || 'job_creation',
      embedding_id: jobAny.embedding_id || '',
      metadata: jobAny.metadata || {},
      status: jobAny.status || 'PENDING',
      updated_at: jobAny.updated_at || new Date().toISOString(),
      requirements: jobAny.requirements || [],
      skills_required: jobAny.skills_required || []
    };
    return mapped as unknown as Job;
  },

  getJobAnalytics: async (): Promise<JobAnalytics> => {
    const response = await apiClient.getJobAnalytics();
    // Add the missing recent_jobs property
    return {
      ...response,
      recent_jobs: response.active_jobs // Using active_jobs as a fallback for recent_jobs
    };
  }
};