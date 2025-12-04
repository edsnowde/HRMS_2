import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Database, Cpu, HardDrive, Zap } from 'lucide-react';

const apiLatencyData = [
  { time: '00:00', latency: 45 },
  { time: '04:00', latency: 52 },
  { time: '08:00', latency: 89 },
  { time: '12:00', latency: 120 },
  { time: '16:00', latency: 95 },
  { time: '20:00', latency: 67 },
];

const systemMetrics = [
  { name: 'CPU Usage', value: '45%', icon: Cpu, color: 'text-primary' },
  { name: 'Memory', value: '62%', icon: HardDrive, color: 'text-secondary' },
  { name: 'Database Load', value: '38%', icon: Database, color: 'text-accent' },
  { name: 'API Uptime', value: '99.9%', icon: Zap, color: 'text-pink-400' },
];

export default function SystemHealth() {
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              System Health Monitor
            </h1>
            <p className="text-muted-foreground mt-2">Real-time system performance metrics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {systemMetrics.map((metric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm mb-1">{metric.name}</p>
                      <p className="text-3xl font-bold">{metric.value}</p>
                    </div>
                    <metric.icon className={`w-12 h-12 ${metric.color} opacity-80`} />
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          <GlassCard className="mb-8">
            <h3 className="text-xl font-semibold mb-4">API Response Time (24h)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={apiLatencyData}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="latency" stroke="#8b5cf6" fillOpacity={1} fill="url(#latencyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard>
            <h3 className="text-xl font-semibold mb-4">System Status</h3>
            <div className="space-y-4">
              {[
                { service: 'AI Screening Service', status: 'Operational', uptime: '99.8%' },
                { service: 'Database Cluster', status: 'Operational', uptime: '100%' },
                { service: 'Authentication Service', status: 'Operational', uptime: '99.9%' },
                { service: 'File Storage', status: 'Degraded', uptime: '98.2%' },
              ].map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'Operational' ? 'bg-accent' : 'bg-yellow-500'
                    } animate-pulse`} />
                    <span className="font-medium">{service.service}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">Uptime: {service.uptime}</span>
                    <span className={`text-sm font-medium ${
                      service.status === 'Operational' ? 'text-accent' : 'text-yellow-500'
                    }`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
