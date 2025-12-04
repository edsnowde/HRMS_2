import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import { RoleSidebar } from '@/components/RoleSidebar';
import { BriefcaseIcon, CalendarIcon, MapPinIcon, BanknoteIcon, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/apiClient';

// Interface for Job data from MongoDB
interface Job {
  _id: string;
  job_id?: string;
  title: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  experience_required?: number;
  location?: string;
  salary_range?: string;
  employment_type?: string;
  department?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  type?: string;
}

export default function RecruiterJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await apiClient.get<{ jobs: Job[]; total: number }>('/job/list');

      // Log both possible shapes for debugging (some apiClients return the payload directly
      // while others return an object with a `data` property like Axios)
      console.log('Jobs API response (raw):', response);
      const payload = (response && (response as any).data) ? (response as any).data : response;
      console.log('Jobs API payload:', payload);

      // payload may be { jobs: Job[], total: number } or an object with jobs array directly.
      let jobsFromServer: Job[] | undefined;
      if (Array.isArray(payload)) {
        // If backend returned an array directly
        jobsFromServer = payload as unknown as Job[];
      } else if (payload && Array.isArray((payload as any).jobs)) {
        jobsFromServer = (payload as any).jobs as Job[];
      }

      if (Array.isArray(jobsFromServer)) {
        setJobs(jobsFromServer);
      } else {
        // Keep existing behavior but provide better diagnostics
        console.error('Unexpected jobs payload shape:', payload);
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch jobs');
      setJobs([]);
      toast({
        title: "Error",
        description: "Failed to load jobs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative pr-56">
      <AuroraBackground />
      
      <div className="relative z-10 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Job Listings
              </h1>
              <p className="text-muted-foreground mt-2">Manage and track all job postings</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => fetchJobs()}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
            </div>
          </div>

          {error ? (
            <GlassCard className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4 text-destructive">Error</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <button
                onClick={() => fetchJobs()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </GlassCard>
          ) : loading ? (
            <div className="flex justify-center items-center min-h-[200px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : jobs.length === 0 ? (
            <GlassCard className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">No Jobs Posted Yet</h3>
              <p className="text-muted-foreground mb-6">Get started by creating your first job posting</p>
              <button
                onClick={() => navigate('/recruiter/post-job')}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg inline-flex items-center gap-2"
              >
                <BriefcaseIcon className="w-4 h-4" />
                Post New Job
              </button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs.map((job) => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard className="h-full">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">Job Title: {job.title}</h3>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="mr-3">JOB ID: {job.job_id ?? job._id}</span>
                            {job.created_at && (
                              <span>Created At: {new Date(job.created_at).toLocaleString()}</span>
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
                      
                      <p className="text-muted-foreground mb-4">Job Description:
                        {job.description}
                      </p>

                      {/* Requirements + quick metadata */}
                      <div className="mb-4">
                        {Array.isArray(job.requirements) && job.requirements.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium mb-2">Requirements</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {job.requirements.map((req: string, idx: number) => (
                                <li key={idx}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {job.department && (
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">{job.department}</span>
                          )}
                          {job.employment_type && (
                            <span className="px-2 py-1 bg-accent/10 text-accent rounded-full text-xs">{job.employment_type}</span>
                          )}
                          {job.location && (
                            <span className="px-2 py-1 bg-muted/10 text-muted-foreground rounded-full text-xs">{job.location}</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPinIcon className="w-4 h-4 text-muted-foreground" />
                          <span>{job.location || 'Remote'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <BriefcaseIcon className="w-4 h-4 text-muted-foreground" />
                          <span>{job.employment_type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                          <span>{job.experience_required ?? 'N/A'}{job.experience_required !== undefined ? '+ years experience' : ''}</span>
                        </div>
                        {job.salary_range && (
                          <div className="flex items-center gap-2 text-sm">
                            <BanknoteIcon className="w-4 h-4 text-muted-foreground" />
                            <span>{job.salary_range}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-6"> Skills: 
                        {(Array.isArray(job.skills_required) ? job.skills_required : []).map((skill, index) => (
                          <span 
                            key={index}
                            className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/recruiter/jobs/${job.job_id || job._id}/pinecone-scoring`)}
                          className="flex-1 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm transition-colors"
                        >
                          View Applicants
                        </button>
                        <button
                          onClick={() => navigate(`/recruiter/jobs/${job.job_id || job._id}/final-results`)}
                          className="flex-1 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm transition-colors"
                        >
                          Final AI Results
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <RoleSidebar />
    </div>
  );
}