import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  Search, 
  Filter, 
  MapPin, 
  DollarSign,
  Calendar,
  Users,
  Briefcase,
  Star,
  Eye,
  MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { JobResponse } from "@/lib/types";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number;
  salary_max: number;
  job_type: string;
  experience_level: string;
  remote_work: boolean;
  posted_date: string;
  application_deadline?: string;
  description: string;
  match_score?: number;
  applications_count?: number;
}

export default function JobListings() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    job_type: "all",
    experience_level: "all",
    remote_only: false,
    salary_min: 0
  });

  // Auth context to get current candidate details
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Map API response to component's Job interface
  const mapJobResponseToJob = (jobResponse: JobResponse): Job => ({
    id: jobResponse.id,
    title: jobResponse.title,
    company: jobResponse.department || 'Not specified',
    location: jobResponse.location || 'Remote',
    // Parse salary range string (e.g., "$50,000 - $80,000") into min/max
    ...(() => {
      const range = jobResponse.salary_range?.match(/\$?(\d+)(?:,\d+)*(?:\s*-\s*\$?(\d+)(?:,\d+)*)?/);
      return {
        salary_min: range ? parseInt(range[1].replace(/,/g, '')) : 0,
        salary_max: range?.[2] ? parseInt(range[2].replace(/,/g, '')) : parseInt(range?.[1].replace(/,/g, '')) || 0
      };
    })(),
    job_type: jobResponse.employment_type,
    experience_level: jobResponse.experience_required <= 2 ? 'entry' :
                     jobResponse.experience_required <= 5 ? 'mid' :
                     jobResponse.experience_required <= 8 ? 'senior' : 'lead',
    remote_work: !jobResponse.location || jobResponse.location.toLowerCase().includes('remote'),
    posted_date: jobResponse.created_at,
    description: jobResponse.description,
    // Optional fields
    application_deadline: undefined, // Add if API provides this
    match_score: undefined, // Add if API provides this
    applications_count: undefined // Add if API provides this
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJobs();
      const mappedJobs = (response.jobs || []).map(mapJobResponseToJob);
      setJobs(mappedJobs);
    } catch (error: any) {
      toast.error('Failed to fetch jobs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId: string) => {
    try {
      if (authLoading) {
        toast('Checking authentication, please try again...');
        return;
      }

      if (!isAuthenticated || !user) {
        toast.error('You must be signed in to apply.');
        // Optionally: open login modal or redirect to /login
        return;
      }

      const candidateId = user.id;
      const candidateName = user.name || (user.email || '').split('@')[0];
      const candidateEmail = user.email;

      const response = await apiClient.applyToJob({
        job_id: jobId,
        candidate_id: candidateId,
        candidate_name: candidateName,
        candidate_email: candidateEmail
      });

      toast.success(response.message || 'Application submitted successfully!', {
        description: `Application ID: ${response.application_id}`
      });

      // Optionally, refresh the jobs list to update application counts
      await fetchJobs();

    } catch (error: any) {
        const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to submit application';
        toast.error(errorMessage, {
          description: 'Please try again or contact support if the issue persists'
        });
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.job_type === "all" || job.job_type === filters.job_type;
    const matchesLevel = filters.experience_level === "all" || job.experience_level === filters.experience_level;
    const matchesRemote = !filters.remote_only || job.remote_work;
    const matchesSalary = job.salary_min >= filters.salary_min;

    return matchesSearch && matchesType && matchesLevel && matchesRemote && matchesSalary;
  });

  const formatSalary = (min: number, max: number) => {
    if (min === 0 && max === 0) return "Salary not specified";
    if (min === max) return `$${min.toLocaleString()}`;
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getJobTypeColor = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'bg-blue-500/20 text-blue-500';
      case 'part-time':
        return 'bg-green-500/20 text-green-500';
      case 'contract':
        return 'bg-purple-500/20 text-purple-500';
      case 'internship':
        return 'bg-orange-500/20 text-orange-500';
      default:
        return 'bg-gray-500/20 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Job Listings</h2>
          <p className="text-muted-foreground">
            Discover opportunities that match your skills and interests
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Briefcase className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {jobs.length} jobs available
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <GlassCard className="p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs by title, company, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full glass pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Job Type</label>
              <select
                value={filters.job_type}
                onChange={(e) => setFilters({...filters, job_type: e.target.value})}
                className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Types</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Experience Level</label>
              <select
                value={filters.experience_level}
                onChange={(e) => setFilters({...filters, experience_level: e.target.value})}
                className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Levels</option>
                <option value="entry">Entry Level</option>
                <option value="mid">Mid Level</option>
                <option value="senior">Senior Level</option>
                <option value="lead">Lead/Principal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Min Salary</label>
              <select
                value={filters.salary_min}
                onChange={(e) => setFilters({...filters, salary_min: parseInt(e.target.value)})}
                className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value={0}>Any Salary</option>
                <option value={50000}>$50k+</option>
                <option value={75000}>$75k+</option>
                <option value={100000}>$100k+</option>
                <option value={125000}>$125k+</option>
                <option value={150000}>$150k+</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="remote_only"
                checked={filters.remote_only}
                onChange={(e) => setFilters({...filters, remote_only: e.target.checked})}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="remote_only" className="text-sm font-medium">
                Remote only
              </label>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Jobs List */}
      <div className="grid gap-4">
        {filteredJobs.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No jobs found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search criteria or check back later for new opportunities
            </p>
          </GlassCard>
        ) : (
          filteredJobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                      <p className="text-lg text-muted-foreground mb-3">{job.company}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4" />
                          <span>{formatSalary(job.salary_min, job.salary_max)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Posted {formatDate(job.posted_date)}</span>
                        </div>
                        {job.remote_work && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded-full">
                            Remote
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {job.match_score && (
                        <div className="text-right">
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium">{job.match_score}%</span>
                          </div>
                          <div className="text-xs text-muted-foreground">Match</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Job Type and Experience */}
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getJobTypeColor(job.job_type)}`}>
                      {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}
                    </span>
                    <span className="px-3 py-1 bg-background/20 text-muted-foreground text-sm rounded-full">
                      {job.experience_level.charAt(0).toUpperCase() + job.experience_level.slice(1)} Level
                    </span>
                    {job.applications_count && (
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-500 text-sm rounded-full">
                        <Users className="w-3 h-3 inline mr-1" />
                        {job.applications_count} applicants
                      </span>
                    )}
                  </div>

                  {/* Description Preview */}
                  <div className="text-sm text-muted-foreground">
                    {job.description.length > 200 
                      ? `${job.description.substring(0, 200)}...` 
                      : job.description
                    }
                  </div>

                  {/* Application Deadline */}
                  {job.application_deadline && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Application Deadline:</strong> {formatDate(job.application_deadline)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="flex items-center space-x-2">
                      <GlassButton variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </GlassButton>
                      <GlassButton variant="outline" size="sm">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Save Job
                      </GlassButton>
                    </div>
                    
                    <GlassButton
                      variant="primary"
                      onClick={() => handleApply(job.id)}
                    >
                      Apply Now
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))
        )}
      </div>

      {/* Results Summary */}
      <div className="text-center text-sm text-muted-foreground">
        Showing {filteredJobs.length} of {jobs.length} jobs
      </div>
    </div>
  );
}
