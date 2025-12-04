import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { AIChatBubble } from "@/components/AIChatBubble";
import { AuroraBackground } from "@/components/AuroraBackground";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Upload, FileText, Video, Sparkles, Target, TrendingUp, Clock, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const skillMatchData = [
  { skill: "Technical", candidate: 95, required: 85 },
  { skill: "Communication", candidate: 88, required: 90 },
  { skill: "Leadership", candidate: 82, required: 75 },
  { skill: "Problem Solving", candidate: 92, required: 85 },
  { skill: "Teamwork", candidate: 90, required: 80 },
];

const screeningProgressData = [
  { stage: "Resume", completed: 145, pending: 23 },
  { stage: "AI Screen", completed: 98, pending: 47 },
  { stage: "Video", completed: 67, pending: 31 },
  { stage: "Technical", completed: 42, pending: 25 },
  { stage: "Final", completed: 28, pending: 14 },
];

export default function RecruiterDashboard() {
  const navigate = useNavigate();

  const stats = [
    { icon: FileText, label: "Resumes Reviewed", value: "168", color: "text-primary" },
    { icon: Video, label: "Video Interviews", value: "67", color: "text-secondary" },
    { icon: Target, label: "Match Rate", value: "89%", color: "text-accent" },
    { icon: Sparkles, label: "AI Suggestions", value: "24", color: "text-pink-400" },
  ];

  const candidates = [
    { name: "Alex Turner", position: "Frontend Developer", match: 96, status: "screening", skills: "React, TypeScript, Tailwind" },
    { name: "Jordan Smith", position: "Backend Engineer", match: 92, status: "interview", skills: "Python, FastAPI, PostgreSQL" },
    { name: "Sam Rivera", position: "Full Stack Dev", match: 88, status: "technical", skills: "Node.js, React, MongoDB" },
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
                Recruiter Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">AI-powered candidate screening and matching</p>
            </div>
            <div className="flex gap-3">
              <GlassButton onClick={() => navigate("/recruiter/post-job")} className="gap-2">
                <Plus className="w-4 h-4" />
                Post Job
              </GlassButton>
              <GlassButton onClick={() => navigate("/recruiter/applicants")} className="gap-2">
                <FileText className="w-4 h-4" />
                View Applicants
              </GlassButton>
              <GlassButton onClick={() => navigate("/recruiter/screening")} className="gap-2">
                <Sparkles className="w-4 h-4" />
                AI Screening
              </GlassButton>
            </div>
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
            {/* Skill Match Analysis */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                AI Skill Match Analysis
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={skillMatchData}>
                  <PolarGrid stroke="rgba(255,255,255,0.2)" />
                  <PolarAngleAxis dataKey="skill" stroke="rgba(255,255,255,0.6)" />
                  <PolarRadiusAxis stroke="rgba(255,255,255,0.4)" />
                  <Radar name="Candidate" dataKey="candidate" stroke="#ec4899" fill="#ec4899" fillOpacity={0.5} />
                  <Radar name="Required" dataKey="required" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Screening Progress */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Screening Progress</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={screeningProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="stage" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="#14b8a6" stackId="a" name="Completed" />
                  <Bar dataKey="pending" fill="#8b5cf6" stackId="a" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* Top Matched Candidates */}
          <GlassCard>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Top Matched Candidates
            </h3>
            <div className="space-y-4">
              {candidates.map((candidate, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{candidate.name}</h4>
                      <p className="text-sm text-muted-foreground">{candidate.position}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent">{candidate.match}%</div>
                      <p className="text-xs text-muted-foreground">Match Score</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                      {candidate.status}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      In progress
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    <span className="font-medium text-foreground">Skills:</span> {candidate.skills}
                  </p>

                  <div className="flex gap-2">
                    <GlassButton onClick={() => navigate("/recruiter/applicants")} className="flex-1">View Profile</GlassButton>
                    <GlassButton onClick={() => navigate("/recruiter/screening")} className="flex-1">AI Screening</GlassButton>
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
