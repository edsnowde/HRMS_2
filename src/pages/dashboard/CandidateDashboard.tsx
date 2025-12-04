import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { AIChatBubble } from "@/components/AIChatBubble";
import { AuroraBackground } from "@/components/AuroraBackground";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Upload, FileText, Video, CheckCircle, Clock, AlertCircle, Sparkles, TrendingUp, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const applicationStatusData = [
  { stage: "Applied", date: "Jan 15", status: "complete" },
  { stage: "Screening", date: "Jan 18", status: "complete" },
  { stage: "AI Assessment", date: "Jan 20", status: "complete" },
  { stage: "Interview", date: "Jan 25", status: "current" },
  { stage: "Offer", date: "Pending", status: "pending" },
];

const skillScoresData = [
  { skill: "Technical", score: 92 },
  { skill: "Communication", score: 88 },
  { skill: "Problem Solving", score: 95 },
  { skill: "Team Collaboration", score: 85 },
];

const interviewPrepData = [
  { week: "Week 1", practice: 3, feedback: 2 },
  { week: "Week 2", practice: 5, feedback: 4 },
  { week: "Week 3", practice: 7, feedback: 6 },
  { week: "Week 4", practice: 4, feedback: 3 },
];

export default function CandidateDashboard() {
  const navigate = useNavigate();

  const stats = [
    { icon: FileText, label: "Applications", value: "3", color: "text-primary" },
    { icon: Clock, label: "In Progress", value: "2", color: "text-secondary" },
    { icon: CheckCircle, label: "Interviews", value: "1", color: "text-accent" },
    { icon: Sparkles, label: "Match Score", value: "94%", color: "text-pink-400" },
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
                Candidate Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">Track your applications and prepare for success</p>
            </div>
            <div className="flex gap-3">
              <GlassButton onClick={() => navigate("/candidate/jobs")} className="gap-2">
                <Search className="w-4 h-4" />
                Browse Jobs
              </GlassButton>
              <GlassButton onClick={() => navigate("/candidate/applications")} className="gap-2">
                <FileText className="w-4 h-4" />
                My Applications
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

          {/* Application Progress */}
          <GlassCard className="mb-8">
            <h3 className="text-xl font-semibold mb-6">Application Progress - Senior Developer</h3>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-white/20" />
              <div className="absolute top-8 left-0 w-3/5 h-0.5 bg-gradient-to-r from-primary to-accent" />
              
              {/* Stages */}
              <div className="relative flex justify-between">
                {applicationStatusData.map((stage, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.2 }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${
                        stage.status === "complete"
                          ? "bg-accent/20 border-2 border-accent"
                          : stage.status === "current"
                          ? "bg-primary/20 border-2 border-primary animate-pulse"
                          : "bg-white/10 border-2 border-white/20"
                      }`}
                    >
                      {stage.status === "complete" ? (
                        <CheckCircle className="w-8 h-8 text-accent" />
                      ) : stage.status === "current" ? (
                        <Clock className="w-8 h-8 text-primary" />
                      ) : (
                        <AlertCircle className="w-8 h-8 text-white/40" />
                      )}
                    </motion.div>
                    <p className="text-sm font-medium text-center mb-1">{stage.stage}</p>
                    <p className="text-xs text-muted-foreground text-center">{stage.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Skill Assessment Scores */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Your Skill Scores
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={skillScoresData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="rgba(255,255,255,0.6)" />
                  <YAxis dataKey="skill" type="category" stroke="rgba(255,255,255,0.6)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="score" fill="url(#colorGradient)" />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#14b8a6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Interview Preparation */}
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Interview Preparation
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={interviewPrepData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="week" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "rgba(15, 23, 42, 0.9)", 
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px"
                    }} 
                  />
                  <Line type="monotone" dataKey="practice" stroke="#8b5cf6" strokeWidth={3} name="Practice Sessions" />
                  <Line type="monotone" dataKey="feedback" stroke="#14b8a6" strokeWidth={3} name="Feedback Received" />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          {/* AI Feedback & Tips */}
          <GlassCard>
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              AI-Generated Feedback & Tips
            </h3>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-lg bg-accent/10 border border-accent/20"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Strong Technical Skills</p>
                    <p className="text-sm text-muted-foreground">
                      Your technical assessment shows excellent proficiency in React and TypeScript. Keep showcasing these skills.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-lg bg-primary/10 border border-primary/20"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Improvement Opportunity</p>
                    <p className="text-sm text-muted-foreground">
                      Consider practicing behavioral interview questions to improve your communication score from 88% to 95%+.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-lg bg-secondary/10 border border-secondary/20"
              >
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Next Steps</p>
                    <p className="text-sm text-muted-foreground">
                      You have an interview scheduled for January 25th. Review the job description and prepare questions about team structure.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <AIChatBubble />
    </div>
  );
}
