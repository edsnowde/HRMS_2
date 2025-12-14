import {
  Job,
  JobResponse,
  Candidate,
  CandidateProfile,
  ResumeUploadResponse,
  ResumeStatusResponse,
  LeaveRequest,
  LeaveBalance,
  SystemHealthResponse
} from './types';
import type { ApplicationStatus } from '../types/application';

let API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Detect common mixed-content deployment issue at runtime and warn/help.
if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:' && API_BASE_URL && API_BASE_URL.startsWith('http://')) {
  // Log a clear, actionable message in the browser console to help diagnose the "Failed to fetch" error.
  // Common cause: Vercel (frontend) has `VITE_API_URL` set to an HTTP address which browsers block when page is HTTPS.
  // Recommended fixes: remove `VITE_API_URL` from Vercel env (so frontend uses relative `/api`), or use an HTTPS backend.
  console.error('Insecure API base URL detected: your app is served over HTTPS but VITE_API_URL is HTTP. Browsers will block this (mixed content). Remove VITE_API_URL or set it to an HTTPS URL, or rely on the /api Vercel proxy. Falling back to \'/api\' for safety.');
  API_BASE_URL = '/api';
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    try {
      const token = localStorage.getItem('auralis:idToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      // ignore localStorage errors
    }

    return headers;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<{ data: T }> {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request<{ data: T }>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, config?: RequestInit): Promise<{ data: T }> {
    return this.request<{ data: T }>(endpoint, {
      ...config,
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<{ data: T }> {
    return this.request<{ data: T }>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<{ data: T }> {
    return this.request<{ data: T }>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<{ data: T }> {
    return this.request<{ data: T }>(endpoint, { method: 'DELETE' });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getAuthHeaders();

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('API Error:', {
          status: response.status,
          url: url,
          response: responseText,
          headers: Object.fromEntries(response.headers.entries()),
        });
        
        if (response.status === 401) {
          throw new Error(`Authentication failed: ${responseText}`);
        }
        throw new Error(`HTTP error! status: ${response.status}, details: ${responseText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text() as T;
    } catch (error) {
      console.error('API request failed:', error);
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:' && API_BASE_URL && API_BASE_URL.startsWith('http://')) {
        console.error('Possible Mixed Content: frontend is HTTPS but API base URL is HTTP. Remove VITE_API_URL or use the /api proxy on Vercel.');
      }
      throw error;
    }
  }

  // Resume endpoints
  async uploadResume(file: File): Promise<ResumeUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    try {
      const token = localStorage.getItem('auralis:idToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) { /* ignore */ }

    const response = await fetch(`${this.baseURL}/resume/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return await response.json();
  }

  async getResumeStatus(jobId: string): Promise<ResumeStatusResponse> {
    return this.request(`/resume/status/${jobId}`);
  }

  async getCandidate(candidateId: string): Promise<CandidateProfile> {
    return this.request(`/resume/candidate/${candidateId}`);
  }

  async getCandidates(page = 1, limit = 10): Promise<{
    candidates: CandidateProfile[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.request(`/resume/candidates?page=${page}&limit=${limit}`);
  }

  async deleteCandidate(candidateId: string): Promise<{ success: boolean }> {
    return this.request(`/resume/candidate/${candidateId}`, {
      method: 'DELETE',
    });
  }

  // Job endpoints
  async createJob(jobData: {
    title: string;
    description: string;
    requirements: string[];
    skills_required: string[];
    experience_required: number;
    location?: string;
    salary_range?: string;
    employment_type: 'full-time' | 'part-time' | 'contract' | 'internship';
    department?: string;
  }): Promise<{
    job_id: string;
    status: string;
    message: string;
    title: string;
  }> {
    return this.request('/job/create', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  async matchCandidates(jobDescription: string): Promise<{
    job_id: string;
    status: string;
    task_id: string;
  }> {
    return this.request('/job/match', {
      method: 'POST',
      body: JSON.stringify({ job_desc: jobDescription }),
    });
  }

  async getJobMatches(jobId: string): Promise<{
    job_id: string;
    status: string;
    matches: Array<{
      candidate_id: string;
      similarity_score: number;
      status: string;
    }>;
  }> {
    return this.request(`/job/matches/${jobId}`);
  }

  async getJobs(skip = 0, limit = 10): Promise<{
    jobs: JobResponse[];
    total: number;
    skip: number;
    limit: number;
  }> {
    return this.request(`/job/list?skip=${skip}&limit=${limit}`);
  }

  async getJobAnalytics(): Promise<{
    total_jobs: number;
    active_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    total_candidates: number;
    total_interviews: number;
  }> {
    return this.request('/job/analytics');
  }

  // Voice/Video endpoints
  // Voice/Video endpoints - deprecated in text-only ATS
  async uploadVideo(_file: File, _candidateId: string, _jobDescription?: string): Promise<any> {
    return Promise.reject(new Error('Video uploads are deprecated. Use text-based interview flow.'));
  }

  async uploadAudio(_file: File, _candidateId: string, _jobDescription?: string): Promise<any> {
    return Promise.reject(new Error('Audio uploads are deprecated. Use text-based interview flow.'));
  }

  /**
   * Upload a resume (and optional video) for a specific application.
   * This hits the backend route: POST /application/{application_id}/resume
   */
  async uploadApplicationResume(applicationId: string, formData: FormData): Promise<any> {
    const headers: HeadersInit = {};
    try {
      const token = localStorage.getItem('auralis:idToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) { /* ignore */ }

    const response = await fetch(`${this.baseURL}/application/${applicationId}/resume`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Upload failed: ${response.status} ${txt}`);
    }

    return await response.json();
  }

  async getVoiceStatus(jobId: string): Promise<any> {
    return Promise.reject(new Error('Voice status endpoint removed.'));
  }

  async getInterviewResults(interviewId: string): Promise<any> {
    return Promise.reject(new Error('Interview results endpoint removed.'));
  }

  async getCandidateInterviews(candidateId: string): Promise<any> {
    return Promise.reject(new Error('Candidate interview endpoint removed.'));
  }

  // Chatbot endpoints
  async sendChatQuery(query: string, userRole: string, userId?: string, context?: any): Promise<any> {
    return this.request('/chat/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        user_role: userRole,
        user_id: userId,
        context,
      }),
    });
  }

  async getChatSuggestions(userRole: string): Promise<any> {
    return this.request(`/chat/suggestions/${userRole}`);
  }

  async submitChatFeedback(feedback: any): Promise<any> {
    return this.request('/chat/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  // Employee endpoints
  async getEmployeeProfile(employeeId: string): Promise<any> {
    return this.request(`/employee/profile/${employeeId}`);
  }

  async getEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return this.request(`/employee/attendance/${employeeId}?${params.toString()}`);
  }

  async checkIn(employeeId: string): Promise<any> {
    return this.request(`/employee/attendance/check-in/${employeeId}`, {
      method: 'POST',
    });
  }

  async checkOut(employeeId: string): Promise<any> {
    return this.request(`/employee/attendance/check-out/${employeeId}`, {
      method: 'POST',
    });
  }

  async getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
    return this.request(`/employee/leave-balance/${employeeId}`);
  }

  async submitLeaveRequest(leaveData: Omit<LeaveRequest, 'id' | 'status' | 'submitted_date'>): Promise<LeaveRequest> {
    return this.request('/employee/leave-request', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  }

  async getLeaveRequests(employeeId: string): Promise<{
    requests: LeaveRequest[];
    total: number;
  }> {
    return this.request(`/employee/leave-requests/${employeeId}`);
  }

  async getPayrollInfo(employeeId: string): Promise<any> {
    return this.request(`/employee/payroll/${employeeId}`);
  }

  async getEmployeeDashboard(employeeId: string): Promise<any> {
    return this.request(`/employee/dashboard/${employeeId}`);
  }

  // System endpoints
  async getHealth(): Promise<SystemHealthResponse> {
    return this.request('/health');
  }

  async verifyUser(): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    verified: boolean;
  }> {
    return this.request('/auth/me');
  }

  async getSystemStatus(): Promise<{
    running_jobs: number;
    failed_jobs: number;
    completed_jobs: number;
    system_load: number;
  }> {
    return this.request('/jobs/status');
  }

  async getQueueStatus(): Promise<any> {
    return this.request('/jobs/queue');
  }

  async retryJob(jobId: string): Promise<any> {
    return this.request(`/jobs/retry/${jobId}`, {
      method: 'POST',
    });
  }

  async getMetrics(): Promise<any> {
    return this.request('/metrics');
  }

  // Candidate endpoints
  async createCandidateProfile(data: Omit<Candidate, 'email'>): Promise<CandidateProfile> {
    return this.request('/candidate/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Application endpoints
  async applyToJob(data: {
    job_id: string; // Must be the UUID job_id
    candidate_id: string;
    candidate_name: string;
    candidate_email: string;
  }): Promise<{ 
    application_id: string;
    job_id: string; 
    status: ApplicationStatus; 
    message: string;
  }> {
    // Ensure we're using the canonical job_id
    if (!data.job_id) {
      throw new Error('job_id is required and must be the UUID from the backend');
    }

    return this.request('/application/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCandidateProfile(data: Partial<Candidate>): Promise<CandidateProfile> {
    return this.request('/candidate/profile/update', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Admin endpoints
  async getAuditLogs(params: { filter?: string; page?: number; limit?: number } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.filter) queryParams.append('filter', params.filter);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    return this.request(`/admin/audit-logs?${queryParams.toString()}`);
  }

  async getFairnessMetrics(): Promise<any> {
    return this.request('/admin/fairness-metrics');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
