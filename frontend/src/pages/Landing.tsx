import { motion } from "framer-motion";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Brain, Users, BarChart3, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

export default function Landing(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const features = [
    {
      icon: Brain,
      title: "AI-Driven Recruitment",
      description:
        "Intelligent candidate screening and matching powered by advanced AI algorithms.",
    },
    {
      icon: Users,
      title: "Role-Based Dashboards",
      description:
        "Customized experiences for Admin, HR, Recruiter, Employee, and Candidate roles.",
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description:
        "Comprehensive insights into hiring, performance, and system health metrics.",
    },
    {
      icon: MessageSquare,
      title: "AI Chat Assistant",
      description:
        "Context-aware chatbot providing instant support and guidance across all roles.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#f4f7ff] via-white to-[#e9edff] text-gray-900">
      {/* 🌈 Floating Aura Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Decorative blended logo (subtle, low-opacity, blurred background) */}
        <img
          src="/logo2.png"
          aria-hidden="true"
          alt=""
          className="absolute inset-x-0 top-[400px] mx-auto w-[100%]  max-w-[1200px] pointer-events-none select-none "
        />

        {/* Subtle glowing gradient circles */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-violet-400/30 to-blue-400/30 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-gradient-to-tr from-blue-400/30 to-violet-400/30 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <AuroraBackground />

      {/* 🧭 Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass backdrop-blur-xl border-b border-white/20 bg-white/60">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* Brand */}
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent tracking-tight"
          >
            Auralis ✦
          </motion.h1>

          {/* Sign In / Out */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {isAuthenticated ? (
              <GlassButton variant="outline" onClick={logout}>
                Sign Out
              </GlassButton>
            ) : (
              <GlassButton variant="primary" onClick={() => navigate("/login")}>
                Login
              </GlassButton>
            )}
          </motion.div>
        </div>
      </nav>

      {/* 🌟 Hero Section */}
      <section className="pt-36 pb-20 px-6 text-center">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-teal-500 to-violet-500 bg-clip-text text-transparent drop-shadow-sm">
              Auralis
            </h2>
            <p className="text-xl md:text-2xl mb-3 text-gray-600">
              From “aura” + “analysis” — symbolizes an intelligent aura guiding HR.
            </p>
            <p className="text-lg md:text-xl mb-10 text-gray-500 max-w-2xl mx-auto">
              Merging empathy with intelligence to simplify HR operations.
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4 justify-center flex-wrap">
              <GlassButton
                variant="primary"
                className="text-lg px-8 py-4 shadow-lg hover:shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all"
                onClick={() => navigate("/signup")}
              >
                Get Started
              </GlassButton>
              <GlassButton
                variant="outline"
                className="text-lg px-8 py-4 border border-violet-400 hover:bg-violet-50 transition-all"
                onClick={() => navigate("/login")}
              >
                Login
              </GlassButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ⚡ Features Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-white via-[#fafaff] to-[#eef2ff]">
        <div className="container mx-auto">
          <motion.h3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent"
          >
            Powerful Features
          </motion.h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard
                    hover
                    className="h-full p-8 text-center rounded-2xl shadow-md hover:shadow-lg transition-all"
                  >
                    <div className="mx-auto mb-5 p-3 rounded-full bg-gradient-to-br from-violet-500/10 to-blue-500/10 w-16 h-16 flex items-center justify-center">
                      <Icon className="w-8 h-8 text-violet-600" />
                    </div>
                    <h4 className="text-xl font-semibold mb-2 text-gray-800">
                      {feature.title}
                    </h4>
                    <p className="text-gray-500">{feature.description}</p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 💡 About Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <GlassCard className="p-12 rounded-3xl shadow-xl bg-white/70 backdrop-blur-lg border border-white/40">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-teal-500 to-violet-500 bg-clip-text text-transparent">
                What is Auralis?
              </h3>
              <p className="text-lg font-bold text-gray-600 mb-4">
                <b>Auralis</b> — From “aura” + “analysis” — symbolizes an intelligent aura guiding HR.
              </p>
              <p className="text-lg font-bold text-gray-500">
                Built with cutting-edge technology and designed for the modern workforce,
                Auralis transforms how organizations manage their most valuable asset — people.
              </p>
            </motion.div>
          </GlassCard>
        </div>
      </section>

      {/* 🧩 Footer */}
      <footer className="py-12 px-6 border-t border-gray-200 bg-white/60 backdrop-blur-md">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
                Auralis
              </h4>
              <p className="text-sm text-gray-500">
                The future of HR management, powered by AI.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-violet-500 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-violet-500 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-violet-500 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-violet-500 transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500 pt-8 border-t border-gray-200">
            <p>&copy; 2025 Auralis. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
