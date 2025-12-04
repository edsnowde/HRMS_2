import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassButton } from "../components/GlassButton";
import { GlassCard } from "../components/GlassCard";
import { AuroraBackground } from "../components/AuroraBackground";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, user, loginWithRole, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "hr" | "recruiter" | "employee" | "candidate">("candidate");
  const [isLoading, setIsLoading] = useState(false);

  // If a session already exists, show a small banner allowing the user to continue or sign out.
  const [sessionPresent, setSessionPresent] = useState(false);
  useEffect(() => {
    if (user && user.role) {
      setSessionPresent(true);
    } else {
      setSessionPresent(false);
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // if a role was explicitly selected by the user, use loginWithRole so it persists
      if (selectedRole) {
        await loginWithRole(email, password, selectedRole as any);
      } else {
        await login(email, password);
      }
      toast.success("Login successful!");
      // Navigate to the dashboard for the selected role immediately after successful login
      try {
        navigate(`/dashboard/${selectedRole}`);
      } catch (e) {
        // ignore navigation errors
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // persist the selected role so loginWithGoogle picks it up
      try { localStorage.setItem('auralis:selectedRole', selectedRole); } catch (e) { /* ignore */ }
      await loginWithGoogle();
      toast.success("Google login successful!");
      // Navigate to dashboard for the selected role
      try { navigate(`/dashboard/${selectedRole}`); } catch (e) { /* ignore */ }
    } catch (error: any) {
      toast.error(error.message || "Google login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <AuroraBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </button>

        <GlassCard className="p-8">
          {sessionPresent && user && (
            <div className="mb-6 p-4 rounded-lg bg-accent/5 border border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-semibold">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground">Role: {user.role}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/dashboard/${user.role}`)}
                    className="px-3 py-2 rounded-lg bg-primary text-white"
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setSessionPresent(false);
                    }}
                    className="px-3 py-2 rounded-lg border"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-glow-teal">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to your Auralis account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full glass pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full glass pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <a href="#" className="text-primary hover:text-primary/80 transition-colors">
                Forgot password?
              </a>
            </div>



            <div className="mt-2">
              <label className="block text-sm font-medium mb-2">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full glass pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                <option value="candidate">Candidate</option>
                <option value="employee">Employee</option>
                <option value="recruiter">Recruiter</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <GlassButton
              type="submit"
              variant="primary"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </GlassButton>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <GlassButton
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </GlassButton>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </button>
            </p>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}