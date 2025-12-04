import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import { RoleSidebar } from '@/components/RoleSidebar';
import { useNavigate, useLocation } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { useToast } from '@/hooks/use-toast';

interface JobFormData {
  title: string;
  description: string;
  requirements: string;
  skills_required: string;
  experience_required: number;
  location: string;
  salary_range: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'internship';
  department: string;
}

export default function PostJob() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    requirements: '',
    skills_required: '',
    experience_required: 0,
    location: '',
    salary_range: '',
    employment_type: 'full-time',
    department: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title || !formData.description) {
        throw new Error('Title and description are required');
      }

      const payload = {
        ...formData,
        requirements: formData.requirements.split('\n').filter(r => r.trim()),
        skills_required: formData.skills_required.split(',').map(s => s.trim()).filter(Boolean),
        experience_required: Number(formData.experience_required),
        created_at: new Date().toISOString(),
        status: 'active'
      };

      const response = await axios.post('/api/job/create', payload);

      if (!response.data || response.status !== 200) {
        throw new Error('Failed to create job. Please try again.');
      }

      toast({
        title: "Success",
        description: "Job has been posted successfully!",
        variant: "default",
        duration: 3000
      });

      // Add a small delay to ensure the job is saved before redirecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to job listings after successful creation
      navigate('/recruiter/jobs', { replace: true });

    } catch (error) {
      console.error('Error creating job:', error);
      const errorMessage = error instanceof AxiosError 
        ? error.response?.data?.detail || error.message
        : error instanceof Error 
          ? error.message 
          : 'Failed to create job';
      
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Post New Job
            </h1>
            <p className="text-muted-foreground mt-2">Create a new job posting for candidates</p>
          </div>

          <GlassCard className="max-w-3xl">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-t-lg text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div>
                <label className="block text-sm font-medium mb-2">Job Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  placeholder="e.g., Senior Frontend Developer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Job Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none resize-none"
                  placeholder="Describe the role, responsibilities, and what you're looking for..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Requirements (one per line)</label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none resize-none"
                  placeholder="- 5+ years of experience with React&#10;- Strong TypeScript skills&#10;- Experience with state management"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Required Skills (comma separated)</label>
                <input
                  type="text"
                  name="skills_required"
                  value={formData.skills_required}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  placeholder="React, TypeScript, Node.js, REST APIs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Years of Experience Required</label>
                  <input
                    type="number"
                    name="experience_required"
                    value={formData.experience_required}
                    onChange={handleChange}
                    min="0"
                    step="0.5"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                    placeholder="e.g., Remote, New York, NY"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Salary Range</label>
                  <input
                    type="text"
                    name="salary_range"
                    value={formData.salary_range}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                    placeholder="e.g., $120,000 - $150,000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Employment Type</label>
                  <select
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Department</label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none"
                  placeholder="e.g., Engineering, Product, Design"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'}`}
                >
                  {loading ? 'Posting...' : 'Post Job'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/recruiter/jobs')}
                  className="flex-1 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/90 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        </motion.div>
      </div>

      <RoleSidebar />
    </div>
  );
}