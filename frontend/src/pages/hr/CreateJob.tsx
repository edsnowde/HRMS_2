import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '@/lib/jobsApi';
import type { JobFormData, EmploymentType, JobStatus, JobType } from '@/types/job';

// UI form state type: requirements is a textarea string in the UI, converted to string[] for backend
type CreateJobUI = {
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  experience_required: number;
  salary_range: string;
  description: string;
  requirements: string; // UI string (one per line)
  skills_required: string[]; // optional prefilled tag array
  type: JobType;
  status: JobStatus;
  job_id?: string;
  metadata?: Record<string, any>;
};

export default function CreateJob() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Use a UI-specific form type where `requirements` is the textarea string.
  const [formData, setFormData] = useState<CreateJobUI>({
    title: '',
    department: '',
    location: '',
    employment_type: 'full-time' as EmploymentType,
    experience_required: 0,
    salary_range: '',
    description: '',
    requirements: '',
    skills_required: [],
    // optional backend fields left undefined: job_id, embedding_id, metadata, created_at, updated_at
    type: 'job_creation' as JobType,
    status: 'PENDING' as JobStatus,
  });
  // UI-only comma-separated skills input (not sent directly to backend)
  const [skillsInput, setSkillsInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to post a job",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Format data to match backend schema
      const jobData: JobFormData = {
        ...formData,
        experience_required: parseFloat(String(formData.experience_required)) || 0,
        // Split requirements into array and filter out empty lines
        requirements: String(formData.requirements).split('\n').map(s => s.trim()).filter(Boolean),
        // Convert skills from ui input into array and filter out empty entries. Prefer explicit array if present.
        skills_required: (formData.skills_required && formData.skills_required.length > 0)
          ? formData.skills_required
          : (skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(Boolean) : []),
      };

      const result = await jobsApi.createJob(jobData);
      // Expose the created job id and status in the form so it's visible in the UI
      setFormData(prev => ({ ...prev, job_id: (result as any).job_id || (result as any)._id || '', status: (result as any).status || prev.status }));
      
      toast({
        title: "Success",
        description: `Job posting "${formData.title}" created successfully!`,
      });

      // Redirect to job listings page
      navigate('/hr/jobs');
    } catch (error) {
      console.error('Failed to create job:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create job posting",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <AuroraBackground />
      
      <div className="relative z-10 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Create Job Posting
                </h1>
                <p className="text-muted-foreground mt-2">Post a new job opportunity</p>
              </div>
              {formData.job_id && (
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    formData.status === 'COMPLETED' ? 'bg-green-500' :
                    formData.status === 'FAILED' ? 'bg-red-500' :
                    formData.status === 'PROCESSING' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="text-sm text-muted-foreground">Status: {formData.status}</span>
                </div>
              )}
            </div>
          </div>

          <GlassCard>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Job ID</label>
                  <input
                    type="text"
                    value={formData.job_id}
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary opacity-50"
                    placeholder="Automatically generated"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Job Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Senior React Developer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Engineering"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. Remote, New York"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Employment Type</label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({
                      ...formData,
                      employment_type: e.target.value as 'full-time' | 'part-time' | 'contract' | 'internship'
                    })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Experience Required (years)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.experience_required}
                    onChange={(e) => setFormData({
                      ...formData,
                      experience_required: parseFloat(e.target.value) || 0
                    })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. 3"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Salary Range</label>
                  <input
                    type="text"
                    value={formData.salary_range}
                    onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. $80,000 - $120,000"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Job Description</label>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Suggestions
                  </button>
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[150px]"
                  placeholder="Describe the role, responsibilities, and team..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Requirements</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[150px]"
                  placeholder="List required skills, qualifications, and experience (one per line)..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Required Skills</label>
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter skills separated by commas (e.g., React, TypeScript, Node.js)"
                  required
                />
                {skillsInput && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skillsInput.split(',').map((skill, index) => (
                      skill.trim() && (
                        <span key={index} className="px-2 py-1 text-sm bg-primary/10 text-primary rounded">
                          {skill.trim()}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 justify-end">
                <GlassButton type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    'Publish Job'
                  )}
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
