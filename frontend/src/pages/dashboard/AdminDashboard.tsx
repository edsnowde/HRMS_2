import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { AIChatBubble } from "@/components/AIChatBubble";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Users, Briefcase, TrendingUp, Shield, Activity, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "@/components/GlassButton";
import { useAuth } from '@/contexts/AuthContext';
import { RoleSidebar } from '@/components/RoleSidebar';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const stats = [
    { icon: Users, label: "Total Users", value: "1,247", trend: "+12.5%" },
    { icon: Briefcase, label: "Active Jobs", value: "89", trend: "+8.3%" },
    { icon: TrendingUp, label: "Applications", value: "3,456", trend: "+23.1%" },
    { icon: Shield, label: "System Health", value: "99.9%", trend: "Excellent" },
  ];

  const recentActivity = [
    { action: "New user registered", user: "john@example.com", time: "2 minutes ago" },
    { action: "Job posting created", user: "hr@company.com", time: "15 minutes ago" },
    { action: "Candidate screened", user: "AI System", time: "1 hour ago" },
    { action: "Interview scheduled", user: "recruiter@company.com", time: "2 hours ago" },
  ];

  return (
    <div className="min-h-screen pb-20 pr-56">
      <AuroraBackground />

      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-glow-teal">Auralis</h1>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <GlassButton onClick={() => navigate("/admin/users")}>
              User Management
            </GlassButton>
            <GlassButton onClick={() => navigate("/admin/system-health")}>
              System Health
            </GlassButton>
            <GlassButton onClick={() => navigate("/analytics")}>
              Analytics
            </GlassButton>
            <GlassButton variant="outline" onClick={logout}>
              Logout
            </GlassButton>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">Welcome back, Admin</h2>
          <p className="text-muted-foreground">Here's what's happening with your system today.</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard hover className="relative overflow-hidden">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl glass glow-teal">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-sm text-secondary font-medium">{stat.trend}</span>
                </div>
                <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">Recent Activity</h3>
              </div>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-xl glass hover:bg-foreground/5 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 animate-pulse" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* System Overview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GlassCard>
              <div className="flex items-center gap-3 mb-6">
                <Database className="w-6 h-6 text-secondary" />
                <h3 className="text-xl font-bold">System Overview</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">API Performance</span>
                    <span className="font-medium">98.5%</span>
                  </div>
                  <div className="h-2 rounded-full glass overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "98.5%" }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-gradient-to-r from-teal to-violet"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Database Load</span>
                    <span className="font-medium">72%</span>
                  </div>
                  <div className="h-2 rounded-full glass overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "72%" }}
                      transition={{ duration: 1, delay: 0.7 }}
                      className="h-full bg-gradient-to-r from-violet to-pink"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Active Users</span>
                    <span className="font-medium">456</span>
                  </div>
                  <div className="h-2 rounded-full glass overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 1, delay: 0.9 }}
                      className="h-full bg-gradient-to-r from-teal to-secondary"
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* <AIChatBubble /> */}
      <RoleSidebar />
    </div>
  );
}
