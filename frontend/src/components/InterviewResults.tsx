import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  Play, 
  Pause, 
  Download, 
  Star,
  Clock,
  User,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient";

import { InterviewResult } from '@/types/application';

interface InterviewResultsProps {
  applicationId?: string;
  showSingleApplication?: boolean;
}

export default function InterviewResults({ applicationId, showSingleApplication = false }: InterviewResultsProps) {
  const [interviews, setInterviews] = useState<InterviewResult[]>([]);
  const [loading, setLoading] = useState(true);
  const emptyInterview: InterviewResult = {
    id: '',
    candidate_id: '',
    candidate_name: '',
    job_title: '',
    company: '',
    interview_date: '',
    duration: 0,
    overall_score: 0,
    technical_score: 0,
    communication_score: 0,
    cultural_fit_score: 0,
    strengths: [],
    areas_for_improvement: [],
    recommendations: [],
    status: 'completed'
  };

    const [selectedInterview, setSelectedInterview] = useState<InterviewResult>(emptyInterview);
  useEffect(() => {
    if (showSingleApplication && applicationId) {
      setSelectedInterview(emptyInterview); // Initialize with empty interview
    }
  }, [applicationId]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      
      if (showSingleApplication && applicationId) {
        const response = await apiClient.get<InterviewResult>(`/api/applications/${applicationId}/interview`);
        setInterviews([response.data as InterviewResult]);
        return;
      }
      
      // This would typically fetch from a user-specific endpoint
      // For now, we'll simulate with mock data
      const mockInterviews: InterviewResult[] = [
        {
          id: '1',
          candidate_id: 'candidate_1',
          candidate_name: 'John Doe',
          job_title: 'Senior Software Engineer',
          company: 'Tech Corp',
          interview_date: '2024-01-20',
          duration: 25,
          overall_score: 85,
          technical_score: 90,
          communication_score: 80,
          cultural_fit_score: 85,
          strengths: ['Strong technical knowledge', 'Clear communication', 'Good problem-solving'],
          areas_for_improvement: ['Could elaborate more on experience', 'Ask more questions about role'],
          recommendations: ['Proceed to technical interview', 'Strong candidate'],
          transcript: 'Interview transcript would be here...',
          video_url: 'https://example.com/video.mp4',
          status: 'completed'
        },
        {
          id: '2',
          candidate_id: 'candidate_2',
          candidate_name: 'Jane Smith',
          job_title: 'Product Manager',
          company: 'StartupXYZ',
          interview_date: '2024-01-19',
          duration: 30,
          overall_score: 72,
          technical_score: 75,
          communication_score: 70,
          cultural_fit_score: 70,
          strengths: ['Good analytical thinking', 'Team player'],
          areas_for_improvement: ['Limited product experience', 'Needs more strategic thinking'],
          recommendations: ['Consider for junior role', 'Additional screening needed'],
          transcript: 'Interview transcript would be here...',
          audio_url: 'https://example.com/audio.mp3',
          status: 'completed'
        }
      ];
      setInterviews(mockInterviews);
    } catch (error: any) {
      toast.error('Failed to fetch interviews: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInterviews();
    setRefreshing(false);
    toast.success('Interviews refreshed');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
          <h2 className="text-2xl font-bold mb-2">Interview Results</h2>
          <p className="text-muted-foreground">
            Review and analyze interview performance
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

      {interviews.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <Play className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No interviews yet</h3>
          <p className="text-muted-foreground">
            Interview results will appear here once candidates complete their interviews
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-6">
          {interviews.map((interview) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{interview.candidate_name}</h3>
                      <p className="text-lg text-muted-foreground mb-3">
                        {interview.job_title} at {interview.company}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(interview.interview_date)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(interview.duration)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>Interview #{interview.id}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(interview.overall_score)}`}>
                        {interview.overall_score}%
                      </div>
                      <div className="text-sm text-muted-foreground">Overall Score</div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg ${getScoreBgColor(interview.technical_score)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Technical</span>
                        <span className={`text-lg font-bold ${getScoreColor(interview.technical_score)}`}>
                          {interview.technical_score}%
                        </span>
                      </div>
                      <div className="w-full bg-background/20 rounded-full h-2">
                        <motion.div
                          className="bg-primary h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${interview.technical_score}%` }}
                          transition={{ duration: 1, delay: 0.1 }}
                        />
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${getScoreBgColor(interview.communication_score)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Communication</span>
                        <span className={`text-lg font-bold ${getScoreColor(interview.communication_score)}`}>
                          {interview.communication_score}%
                        </span>
                      </div>
                      <div className="w-full bg-background/20 rounded-full h-2">
                        <motion.div
                          className="bg-primary h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${interview.communication_score}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                        />
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${getScoreBgColor(interview.cultural_fit_score)}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Cultural Fit</span>
                        <span className={`text-lg font-bold ${getScoreColor(interview.cultural_fit_score)}`}>
                          {interview.cultural_fit_score}%
                        </span>
                      </div>
                      <div className="w-full bg-background/20 rounded-full h-2">
                        <motion.div
                          className="bg-primary h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${interview.cultural_fit_score}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detailed Analysis */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        Strengths
                      </h4>
                      <ul className="space-y-2">
                        {interview.strengths.map((strength, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start">
                            <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                        Areas for Improvement
                      </h4>
                      <ul className="space-y-2">
                        {interview.areas_for_improvement.map((area, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                            {area}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2 text-blue-500" />
                      Recommendations
                    </h4>
                    <div className="bg-background/10 rounded-lg p-4">
                      <ul className="space-y-2">
                        {interview.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div className="flex items-center space-x-2">
                      {interview.video_url && (
                        <GlassButton variant="outline" size="sm">
                          <Play className="w-4 h-4 mr-2" />
                          Watch Video
                        </GlassButton>
                      )}
                      {interview.audio_url && (
                        <GlassButton variant="outline" size="sm">
                          <Play className="w-4 h-4 mr-2" />
                          Play Audio
                        </GlassButton>
                      )}
                      <GlassButton variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </GlassButton>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <GlassButton
                        variant="primary"
                        onClick={() => setSelectedInterview(interview)}
                      >
                        View Details
                      </GlassButton>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-primary mb-1">
            {interviews.length}
          </div>
          <div className="text-sm text-muted-foreground">Total Interviews</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500 mb-1">
            {interviews.filter(i => i.overall_score >= 80).length}
          </div>
          <div className="text-sm text-muted-foreground">High Performers</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500 mb-1">
            {Math.round(interviews.reduce((acc, i) => acc + i.overall_score, 0) / interviews.length) || 0}%
          </div>
          <div className="text-sm text-muted-foreground">Average Score</div>
        </GlassCard>
        
        <GlassCard className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-500 mb-1">
            {Math.round(interviews.reduce((acc, i) => acc + i.duration, 0) / interviews.length) || 0}m
          </div>
          <div className="text-sm text-muted-foreground">Avg Duration</div>
        </GlassCard>
      </div>
    </div>
  );
}
