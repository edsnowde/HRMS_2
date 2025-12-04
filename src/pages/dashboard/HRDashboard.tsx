import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { AIChatBubble } from "@/components/AIChatBubble";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Briefcase, Users, TrendingUp, CheckCircle, XCircle, Clock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const jobsData = [
  { month: "Jan", posted: 12, filled: 8 },
  { month: "Feb", posted: 15, filled: 11 },
  { month: "Mar", posted: 18, filled: 14 },
  { month: "Apr", posted: 22, filled: 18 },
  { month: "May", posted: 20, filled: 16 },
  { month: "Jun", posted: 25, filled: 21 },
];

const performanceData = [
  { name: "Excellent", value: 35, color: "#14b8a6" },
  { name: "Good", value: 45, color: "#8b5cf6" },
  { name: "Average", value: 15, color: "#ec4899" },
  { name: "Needs Improvement", value: 5, color: "#64748b" },
];

const candidateStatusData = [
  { status: "Applied", count: 156 },
  { status: "Screening", count: 89 },
  { status: "Interview", count: 45 },
  { status: "Offered", count: 23 },
  { status: "Hired", count: 18 },
  { status: "Rejected", count: 67 },
];

export default function HRDashboard() {
  const navigate = useNavigate();

  const stats = [
    { icon: Briefcase, label: "Active Jobs", value: "24", color: "text-accent" },
    { icon: Users, label: "Total Employees", value: "342", color: "text-primary" },
    { icon: TrendingUp, label: "Hiring Rate", value: "84%", color: "text-secondary" },
    { icon: Clock, label: "Pending Reviews", value: "12", color: "text-pink-400" },
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
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                HR Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">Manage recruitment and employee performance</p>
            </div>
            <GlassButton onClick={() => navigate("/hr/create-job")} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Job Posting
            </GlassButton>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover className="relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-12 h-12 ${stat.color} opacity-80`} />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Jobs Overview */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Jobs Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={jobsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="posted" fill="#8b5cf6" name="Posted" />
                  <Bar dataKey="filled" fill="#14b8a6" name="Filled" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Performance Distribution */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Employee Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={performanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Candidate Pipeline */}
          <GlassCard className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Candidate Pipeline</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={candidateStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="status" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(15, 23, 42, 0.9)", 
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px"
                  }} 
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={3} name="Candidates" />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Pending Approvals */}
          <GlassCard>
            <h3 className="text-xl font-semibold mb-4">Pending Candidate Approvals</h3>
            <div className="space-y-3">
              {[
                { name: "Sarah Johnson", position: "Senior Developer", score: 94 },
                { name: "Michael Chen", position: "Product Manager", score: 89 },
                { name: "Emily Rodriguez", position: "UX Designer", score: 91 },
              ].map((candidate, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  <div>
                    <p className="font-semibold">{candidate.name}</p>
                    <p className="text-sm text-muted-foreground">{candidate.position}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-accent">Score: {candidate.score}%</span>
                    <div className="flex gap-2">
                      <button className="p-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent transition-all">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-all">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <AIChatBubble />
    </div>
  );
}
