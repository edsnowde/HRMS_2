import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  Activity, 
  Server, 
  Database,
  Cpu,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Users,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/lib/websocket";
import apiClient from "@/lib/apiClient";

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  version: string;
  timestamp: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  last_check: string;
  response_time?: number;
}

interface QueueStatus {
  total_jobs: number;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  avg_processing_time: number;
}

interface Metrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  requests_per_minute: number;
  error_rate: number;
}

export default function SystemHealth() {
  const { isConnected } = useWebSocket();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchSystemData();
    
    // Set up real-time updates via WebSocket
    const unsubscribeHealth = useWebSocket().subscribe('system_health', (data) => {
      setSystemHealth(data);
    });

    const unsubscribeServices = useWebSocket().subscribe('service_status', (data) => {
      setServices(prev => prev.map(service => 
        service.name === data.name ? { ...service, ...data } : service
      ));
    });

    const unsubscribeQueue = useWebSocket().subscribe('queue_status', (data) => {
      setQueueStatus(data);
    });

    const unsubscribeMetrics = useWebSocket().subscribe('system_metrics', (data) => {
      setMetrics(data);
    });

    return () => {
      unsubscribeHealth();
      unsubscribeServices();
      unsubscribeQueue();
      unsubscribeMetrics();
    };
  }, []);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      const [healthResponse, statusResponse, queueResponse, metricsResponse] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getSystemStatus(),
        apiClient.getQueueStatus(),
        apiClient.getMetrics()
      ]);

      setSystemHealth(healthResponse);
      setServices(statusResponse.services || []);
      setQueueStatus(queueResponse);
      setMetrics(metricsResponse);
    } catch (error: any) {
      toast.error('Failed to fetch system data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSystemData();
    setRefreshing(false);
    toast.success('System data refreshed');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return 'text-green-500 bg-green-500/20';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/20';
      case 'critical':
      case 'error':
      case 'stopped':
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
      case 'error':
      case 'stopped':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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
          <h2 className="text-2xl font-bold mb-2">System Health</h2>
          <p className="text-muted-foreground">
            Monitor system performance and service status
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            isConnected ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          }`}>
            <Wifi className="w-4 h-4" />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
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
      </div>

      {/* System Overview */}
      {systemHealth && (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              System Overview
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.status)}`}>
              {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {formatUptime(systemHealth.uptime)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500 mb-1">
                v{systemHealth.version}
              </div>
              <div className="text-sm text-muted-foreground">Version</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500 mb-1">
                {new Date(systemHealth.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Services Status */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2" />
          Services Status
        </h3>
        
        <div className="space-y-3">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-background/10 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(service.status)}
                <div>
                  <div className="font-medium">{service.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Uptime: {formatUptime(service.uptime)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {service.response_time && (
                  <div className="text-sm text-muted-foreground">
                    {service.response_time}ms
                  </div>
                )}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(service.status)}`}>
                  {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Queue Status */}
      {queueStatus && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Briefcase className="w-5 h-5 mr-2" />
            Job Queue Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {queueStatus.total_jobs}
              </div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500 mb-1">
                {queueStatus.pending_jobs}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500 mb-1">
                {queueStatus.processing_jobs}
              </div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500 mb-1">
                {queueStatus.completed_jobs}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500 mb-1">
                {queueStatus.failed_jobs}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              Average Processing Time: {queueStatus.avg_processing_time.toFixed(2)}s
            </div>
          </div>
        </GlassCard>
      )}

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <Cpu className="w-8 h-8 mx-auto mb-3 text-blue-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.cpu_usage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">CPU Usage</div>
            <div className="w-full bg-background/20 rounded-full h-2 mt-2">
              <motion.div
                className="bg-blue-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${metrics.cpu_usage}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <Database className="w-8 h-8 mx-auto mb-3 text-green-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.memory_usage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Memory Usage</div>
            <div className="w-full bg-background/20 rounded-full h-2 mt-2">
              <motion.div
                className="bg-green-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${metrics.memory_usage}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <HardDrive className="w-8 h-8 mx-auto mb-3 text-purple-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.disk_usage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Disk Usage</div>
            <div className="w-full bg-background/20 rounded-full h-2 mt-2">
              <motion.div
                className="bg-purple-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${metrics.disk_usage}%` }}
                transition={{ duration: 1, delay: 0.4 }}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-3 text-orange-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.active_connections}
            </div>
            <div className="text-sm text-muted-foreground">Active Connections</div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-3 text-cyan-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.requests_per_minute}
            </div>
            <div className="text-sm text-muted-foreground">Requests/min</div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
            <div className="text-2xl font-bold text-primary mb-1">
              {metrics.error_rate.toFixed(2)}%
            </div>
            <div className="text-sm text-muted-foreground">Error Rate</div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
