import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Briefcase,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/apiClient";

interface JobAnalyticsProps {
  jobId: string;
  onClose: () => void;
}

interface JobAnalytics {
  total_jobs: number;
  active_jobs: number;
  total_applications: number;
  avg_processing_time: number;
  success_rate: number;
  top_skills: Array<{ skill: string; count: number }>;
  applications_by_status: Array<{ status: string; count: number }>;
  jobs_by_type: Array<{ type: string; count: number }>;
  monthly_trends: Array<{ month: string; jobs: number; applications: number }>;
}

export default function JobAnalytics({ jobId, onClose }: JobAnalyticsProps) {
  const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJobAnalytics();
      // Transform API response to match JobAnalytics interface
      const transformedData: JobAnalytics = {
        total_jobs: response.total_jobs,
        active_jobs: response.active_jobs,
        total_applications: response.total_candidates || 0,
        avg_processing_time: 24, // Default value
        success_rate: Math.round((response.completed_jobs / response.total_jobs) * 100) || 0,
        top_skills: [], // Default empty array
        applications_by_status: [], // Default empty array
        jobs_by_type: [], // Default empty array
        monthly_trends: [] // Default empty array
      };
      setAnalytics(transformedData);
    } catch (error: any) {
      toast.error('Failed to fetch analytics: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
    toast.success('Analytics refreshed');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'hired':
        return 'text-green-500 bg-green-500/20';
      case 'processing':
      case 'reviewed':
        return 'text-blue-500 bg-blue-500/20';
      case 'failed':
      case 'rejected':
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getJobTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'full-time':
        return 'text-blue-500 bg-blue-500/20';
      case 'part-time':
        return 'text-green-500 bg-green-500/20';
      case 'contract':
        return 'text-purple-500 bg-purple-500/20';
      case 'internship':
        return 'text-orange-500 bg-orange-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <GlassCard className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">No analytics data</h3>
        <p className="text-muted-foreground">
          Analytics will be available once you have job postings and applications
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Job Analytics</h2>
          <p className="text-muted-foreground">
            Insights into your job postings and application performance
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-6 text-center">
          <Briefcase className="w-8 h-8 mx-auto mb-3 text-blue-500" />
          <div className="text-2xl font-bold text-primary mb-1">
            {analytics.total_jobs}
          </div>
          <div className="text-sm text-muted-foreground">Total Jobs</div>
          <div className="text-xs text-green-500 mt-1">
            {analytics.active_jobs} active
          </div>
        </GlassCard>

        <GlassCard className="p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-green-500" />
          <div className="text-2xl font-bold text-primary mb-1">
            {analytics.total_applications}
          </div>
          <div className="text-sm text-muted-foreground">Total Applications</div>
        </GlassCard>

        <GlassCard className="p-6 text-center">
          <Clock className="w-8 h-8 mx-auto mb-3 text-yellow-500" />
          <div className="text-2xl font-bold text-primary mb-1">
            {analytics.avg_processing_time}h
          </div>
          <div className="text-sm text-muted-foreground">Avg Processing Time</div>
        </GlassCard>

        <GlassCard className="p-6 text-center">
          <Target className="w-8 h-8 mx-auto mb-3 text-purple-500" />
          <div className="text-2xl font-bold text-primary mb-1">
            {analytics.success_rate}%
          </div>
          <div className="text-sm text-muted-foreground">Success Rate</div>
        </GlassCard>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications by Status */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Applications by Status
          </h3>
          <div className="space-y-3">
            {analytics.applications_by_status.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status).split(' ')[1]}`} />
                  <span className="text-sm font-medium capitalize">
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-background/20 rounded-full h-2">
                    <motion.div
                      className="bg-primary h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${(item.count / analytics.total_applications) * 100}%` 
                      }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Jobs by Type */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Jobs by Type
          </h3>
          <div className="space-y-3">
            {analytics.jobs_by_type.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getJobTypeColor(item.type).split(' ')[1]}`} />
                  <span className="text-sm font-medium capitalize">
                    {item.type.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-background/20 rounded-full h-2">
                    <motion.div
                      className="bg-primary h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: `${(item.count / analytics.total_jobs) * 100}%` 
                      }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Top Skills */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Most Requested Skills
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analytics.top_skills.slice(0, 9).map((skill, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-background/10 rounded-lg"
            >
              <span className="font-medium">{skill.skill}</span>
              <span className="text-sm text-muted-foreground">
                {skill.count} jobs
              </span>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Monthly Trends */}
      {analytics.monthly_trends && analytics.monthly_trends.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Monthly Trends
          </h3>
          <div className="space-y-4">
            {analytics.monthly_trends.slice(-6).map((trend, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{trend.month}</span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm text-muted-foreground">
                      {trend.jobs} jobs
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm text-muted-foreground">
                      {trend.applications} applications
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Performance Insights */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Performance Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Average Processing Time</span>
              <span className="text-sm text-muted-foreground">
                {analytics.avg_processing_time} hours
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Success Rate</span>
              <span className="text-sm text-muted-foreground">
                {analytics.success_rate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Job Postings</span>
              <span className="text-sm text-muted-foreground">
                {analytics.active_jobs} of {analytics.total_jobs}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium mb-2">Recommendations:</div>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Focus on {analytics.top_skills[0]?.skill} skills for better matches</li>
                <li>• {analytics.success_rate > 80 ? 'Excellent' : 'Improve'} success rate performance</li>
                <li>• Consider posting more {analytics.jobs_by_type[0]?.type} positions</li>
              </ul>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
