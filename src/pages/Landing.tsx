import { motion } from "framer-motion";
import { GlassButton } from "@/components/GlassButton";
import { GlassCard } from "@/components/GlassCard";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Brain, Users, BarChart3, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "AI-Driven Recruitment",
      description: "Intelligent candidate screening and matching powered by advanced AI algorithms.",
    },
    {
      icon: Users,
      title: "Role-Based Dashboards",
      description: "Customized experiences for Admin, HR, Recruiter, Employee, and Candidate roles.",
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Comprehensive insights into hiring, performance, and system health metrics.",
    },
    {
      icon: MessageSquare,
      title: "AI Chat Assistant",
      description: "Context-aware chatbot providing instant support and guidance across all roles.",
    },
  ];

  return (
    <div className="min-h-screen">
      <AuroraBackground />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-glow-teal"
          >
            Auralis
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GlassButton variant="primary" onClick={() => navigate("/login")}>
              Login
            </GlassButton>
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-6xl md:text-7xl font-bold mb-6 text-glow-teal">
              Auralis
            </h2>
            <p className="text-xl md:text-2xl mb-4 text-muted-foreground">
              The Intelligent Aura for Modern HR
            </p>
            <p className="text-lg md:text-xl mb-12 text-muted-foreground max-w-2xl mx-auto">
              Merging empathy with intelligence to simplify HR operations
            </p>
            <div className="flex gap-4 justify-center">
              <GlassButton variant="primary" className="text-lg px-8 py-4" onClick={() => navigate("/signup")}>
                Get Started
              </GlassButton>
              <GlassButton variant="outline" className="text-lg px-8 py-4" onClick={() => navigate("/login")}>
                Login
              </GlassButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <motion.h3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16 text-glow-violet"
          >
            Powerful Features
          </motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover className="h-full">
                  <feature.icon className="w-12 h-12 mb-4 text-primary" />
                  <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                  <p className="text-muted-foreground">{feature.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <GlassCard>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <h3 className="text-3xl font-bold mb-6 text-glow-teal">What is Auralis?</h3>
              <p className="text-lg text-muted-foreground mb-4">
                Auralis combines <span className="text-primary font-semibold">Aura</span> and{" "}
                <span className="text-secondary font-semibold">Analysis</span> to create a next-generation
                HRMS that feels alive and intelligent.
              </p>
              <p className="text-lg text-muted-foreground">
                Built with cutting-edge technology and designed for the modern workforce,
                Auralis transforms how organizations manage their most valuable asset — people.
              </p>
            </motion.div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-lg font-semibold mb-4 text-glow-teal">Auralis</h4>
              <p className="text-sm text-muted-foreground">
                The future of HR management, powered by AI.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Product</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Legal</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border/50">
            <p>&copy; 2025 Auralis. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
