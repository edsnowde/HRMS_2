import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Calendar,
  User
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../lib/apiClient";

interface ApplicationStatus {
  id: string;
  job_title: string;
  company: string;
  status: 'pending' | 'processing' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  applied_date: string;
  last_updated: string;
  resume_status: 'uploaded' | 'processing' | 'completed' | 'failed';
  match_score?: number;
  feedback?: string;
}

export default function ApplicationStatus() {
  const [applications, setApplications] = useState<ApplicationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      // This would typically fetch from a user-specific endpoint
      // For now, we'll simulate with mock data
      const mockApplications: ApplicationStatus[] = [
        {
          id: '1',
          job_title: 'Senior Software Engineer',
          company: 'Tech Corp',
          status: 'reviewed',
          applied_date: '2024-01-15',
          last_updated: '2024-01-20',
          resume_status: 'completed',
          match_score: 85,
          feedback: 'Strong technical background, good cultural fit'
        },
        {
          id: '2',
          job_title: 'Product Manager',
          company: 'StartupXYZ',
          status: 'processing',
          applied_date: '2024-01-18',
          last_updated: '2024-01-19',
          resume_status: 'processing',
          match_score: 72
        },
        {
          id: '3',
          job_title: 'UX Designer',
          company: 'Design Studio',
          status: 'shortlisted',
          applied_date: '2024-01-10',
          last_updated: '2024-01-22',
          resume_status: 'completed',
          match_score: 91,
          feedback: 'Excellent portfolio, moving to interview stage'
        }
      ];
      setApplications(mockApplications);
    } catch (error: any) {
      toast.error('Failed to fetch applications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
    toast.success('Applications refreshed');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'shortlisted':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'reviewed':
        return <FileText className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired':
        return 'text-green-500 bg-green-500/20';
      case 'shortlisted':
        return 'text-blue-500 bg-blue-500/20';
      case 'reviewed':
        return 'text-yellow-500 bg-yellow-500/20';
      case 'processing':
        return 'text-blue-500 bg-blue-500/20';
      case 'rejected':
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getResumeStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
          <h2 className="text-2xl font-bold mb-2">Application Status</h2>
          <p className="text-muted-foreground">
            Track your job applications and resume processing status
          </p>
        </div>
        <GlassButton
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </GlassButton>
      </div>

      {applications.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No applications yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your resume to start applying for jobs
          </p>
          <GlassButton variant="primary">
            Upload Resume
          </GlassButton>
        </GlassCard>
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => (
            <motion.div
              key={application.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">
                        {application.job_title}
                      </h3>
                      <p className="text-muted-foreground mb-3">
                        {application.company}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Applied {formatDate(application.applied_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>Updated {formatDate(application.last_updated)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {getStatusIcon(application.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Resume Status */}
                  <div className="flex items-center justify-between p-4 bg-background/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getResumeStatusIcon(application.resume_status)}
                      <div>
                        <p className="font-medium">Resume Status</p>
                        <p className="text-sm text-muted-foreground">
                          {application.resume_status.charAt(0).toUpperCase() + application.resume_status.slice(1)}
                        </p>
                      </div>
                    </div>
                    
                    {application.match_score && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {application.match_score}%
                        </p>
                        <p className="text-sm text-muted-foreground">Match Score</p>
                      </div>
                    )}
                  </div>

                  {/* Feedback */}
                  {application.feedback && (
                    <div className="p-4 bg-background/10 rounded-lg">
                      <h4 className="font-medium mb-2">Feedback</h4>
                      <p className="text-sm text-muted-foreground">
                        {application.feedback}
                      </p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Application Progress</span>
                      <span>{application.match_score || 0}%</span>
                    </div>
                    <div className="w-full bg-background/20 rounded-full h-2">
                      <motion.div
                        className="bg-primary h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${application.match_score || 0}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-primary mb-1">
            {applications.length}
          </div>
          <div className="text-sm text-muted-foreground">Total Applications</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500 mb-1">
            {applications.filter(app => app.status === 'shortlisted' || app.status === 'reviewed').length}
          </div>
          <div className="text-sm text-muted-foreground">Under Review</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500 mb-1">
            {applications.filter(app => app.status === 'hired').length}
          </div>
          <div className="text-sm text-muted-foreground">Hired</div>
        </GlassCard>
      </div>
    </div>
  );
}
