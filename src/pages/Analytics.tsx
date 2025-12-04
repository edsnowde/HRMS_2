import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, Briefcase, Target } from 'lucide-react';

const hiringTrendsData = [
  { month: 'Jan', hired: 12, applications: 156 },
  { month: 'Feb', hired: 15, applications: 189 },
  { month: 'Mar', hired: 18, applications: 203 },
  { month: 'Apr', hired: 22, applications: 245 },
  { month: 'May', hired: 20, applications: 221 },
  { month: 'Jun', hired: 25, applications: 267 },
];

const departmentData = [
  { name: 'Engineering', value: 45, color: '#8b5cf6' },
  { name: 'Product', value: 25, color: '#14b8a6' },
  { name: 'Design', value: 15, color: '#ec4899' },
  { name: 'Marketing', value: 15, color: '#f59e0b' },
];

const retentionData = [
  { quarter: 'Q1', rate: 92 },
  { quarter: 'Q2', rate: 94 },
  { quarter: 'Q3', rate: 91 },
  { quarter: 'Q4', rate: 95 },
];

const satisfactionData = [
  { month: 'Jan', score: 7.8 },
  { month: 'Feb', score: 8.1 },
  { month: 'Mar', score: 8.3 },
  { month: 'Apr', score: 8.5 },
  { month: 'May', score: 8.7 },
  { month: 'Jun', score: 8.9 },
];

export default function Analytics() {
  const metrics = [
    { icon: Users, label: 'Total Employees', value: '342', change: '+12%', color: 'text-primary' },
    { icon: Briefcase, label: 'Active Jobs', value: '24', change: '+8%', color: 'text-secondary' },
    { icon: TrendingUp, label: 'Hiring Rate', value: '84%', change: '+5%', color: 'text-accent' },
    { icon: Target, label: 'Retention Rate', value: '94%', change: '+2%', color: 'text-pink-400' },
  ];

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
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">Comprehensive HR insights and metrics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics.map((metric, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className={`w-10 h-10 ${metric.color} opacity-80`} />
                    <span className="text-sm text-accent font-medium">{metric.change}</span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">{metric.label}</p>
                  <p className="text-3xl font-bold">{metric.value}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Hiring Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hiringTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="applications" fill="#8b5cf6" name="Applications" />
                  <Bar dataKey="hired" fill="#14b8a6" name="Hired" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Department Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }: any) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Retention Rate</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={retentionData}>
                  <defs>
                    <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="quarter" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#14b8a6"
                    fillOpacity={1}
                    fill="url(#retentionGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Employee Satisfaction</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={satisfactionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" domain={[0, 10]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#ec4899"
                    strokeWidth={3}
                    dot={{ fill: '#ec4899', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
