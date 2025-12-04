import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApplications } from "@/contexts/ApplicationContext";
import apiClient from '@/lib/apiClient';
import { RoleSidebar } from '@/components/RoleSidebar';

import type { JobResponse } from '@/lib/types';

interface Job extends Omit<JobResponse, 'id'> {
  _id: string;
  job_id?: string;
  [key: string]: any;
}

export default function SimpleJobListings() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { addApplication } = useApplications();

  // Fetch jobs on component mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Map JobResponse to our Job interface
  const mapJobResponseToJob = (job: JobResponse): Job => {
    console.log('Mapping job:', job); // Debug log
    
    // Ensure we have a valid ID hierarchy: job_id (UUID) > id > _id (MongoDB)
    const canonicalId = job.job_id || job.id;
    const internalId = job._id || job.id;
    
    return {
      ...job,
      _id: internalId, // MongoDB internal ID or fallback
      job_id: canonicalId, // UUID from backend
      employment_type: job.employment_type || 'full-time',
      department: job.department || '',
      location: job.location || '',
      salary_range: job.salary_range || '',
    };
  };

  // Function to fetch jobs from backend
  const fetchJobs = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await apiClient.getJobs();
      console.log('Jobs from MongoDB:', response);
      console.log('First job details:', response?.jobs?.[0]); // Detailed logging of first job
      
      if (!response || !response.jobs) {
        throw new Error('No jobs found');
      }

      // Map the API response to our Job interface
      const mappedJobs = response.jobs.map(mapJobResponseToJob);
      setJobs(mappedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch jobs');
      setJobs([]);
      alert("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // Handle file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setResumeFile(file);
      } else {
        alert('Please upload a valid PDF file');
      }
    }
  };

  // Handle application submission
  const handleApply = async (jobId: string) => {
    if (!resumeFile) {
      alert("Please upload your resume");
      return;
    }

    if (!user) {
      alert('You must be signed in to apply');
      return;
    }

    if (!jobId && !selectedJob) {
      alert('Invalid job selection');
      return;
    }

    try {
      // 1) Create application record on backend (/application/create)
      const createResp: any = await apiClient.applyToJob({
        job_id: selectedJob?.job_id || jobId, // Use job_id from the selected job
        candidate_id: user.id,
        candidate_name: user.name || '',
        candidate_email: user.email || '',
      });

      const applicationId = createResp.application_id || createResp.applicationId;
      if (!applicationId) throw new Error('No application id returned from server');
      
      // Check if this is an existing application
      if (createResp.status === 'existing') {
        alert('You have already applied for this job. You cannot apply multiple times.');
        setSelectedJob(null);
        setResumeFile(null);
        return;
      }

      // 2) Upload resume to application-specific endpoint
      const formData = new FormData();
      formData.append('file', resumeFile); // backend expects `file` param in /application/{id}/resume

      const uploadResp = await apiClient.uploadApplicationResume(applicationId, formData);

      // 3) Add to local application context
      addApplication({
        candidateId: user.id,
        candidateName: user.name,
        candidateEmail: user.email,
        jobId: selectedJob?.job_id || selectedJob?._id || '',
        jobTitle: selectedJob?.title || '',
        company: (selectedJob as any)?.company || '',
        status: 'pending',
        stage: 1,
        resumeUrl: uploadResp.gcs_path || uploadResp.resumeUrl || '',
      });

      alert('Application submitted successfully!');
      setSelectedJob(null);
      setResumeFile(null);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      alert((error && error.message) || 'Failed to submit application');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (jobs.length === 0) return <div>No jobs available</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-8">Available Jobs</h1>
      
      {/* Job List */}
      <div className="grid grid-cols-1 gap-6">
        {jobs.map((job) => (
          <div key={job._id} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">{job.title}</h3>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="mr-3">JOB ID: {job.job_id}</span>
                  {job._id && job._id !== job.job_id && (
                    <span className="mr-3 text-muted-foreground/50">Internal ID: {job._id}</span>
                  )}
                  {job.created_at && (
                    <span>Posted: {new Date(job.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                job.status === 'active' ? 'bg-emerald-500/20 text-emerald-500' :
                job.status === 'paused' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-red-500/20 text-red-500'
              }`}>
                {job.status}
              </span>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-muted-foreground">{job.description}</p>
            </div>

            {Array.isArray(job.requirements) && job.requirements.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Requirements</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {job.requirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-6">
              {job.location && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">📍</span>
                  <span>{job.location}</span>
                </div>
              )}
              {job.employment_type && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">💼</span>
                  <span>{job.employment_type}</span>
                </div>
              )}
              {job.experience_required !== undefined && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">⏳</span>
                  <span>{job.experience_required}+ years experience</span>
                </div>
              )}
              {job.salary_range && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">💰</span>
                  <span>{job.salary_range}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {(Array.isArray(job.skills_required) ? job.skills_required : []).map((skill, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                >
                  {skill}
                </span>
              ))}
            </div>
            
            {selectedJob?._id === job._id ? (
              <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
                <div className="space-y-2">
                  <h4>Upload Resume (PDF)</h4>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleApply(job._id)}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Submit Application
                  </button>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSelectedJob(job)}
                className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Apply Now
              </button>
            )}
          </div>
        ))}
      </div>
      <RoleSidebar />
    </div>
  );
}