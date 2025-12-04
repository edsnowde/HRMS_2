import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { AIChatBubble } from "@/components/AIChatBubble";
import { AuroraBackground } from "@/components/AuroraBackground";
import { Calendar, DollarSign, Clock, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassButton } from "@/components/GlassButton";
import { useAuth } from '@/contexts/AuthContext';
import { RoleSidebar } from '@/components/RoleSidebar';

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const quickStats = [
    { icon: Calendar, label: "Leave Balance", value: "15 days", color: "text-teal" },
    { icon: Clock, label: "Attendance", value: "96%", color: "text-violet" },
    { icon: DollarSign, label: "Last Payroll", value: "$5,400", color: "text-pink" },
    { icon: Briefcase, label: "Active Projects", value: "3", color: "text-primary" },
  ];

  const upcomingLeaves = [
    { type: "Annual Leave", dates: "Jan 15-20, 2025", status: "Approved" },
    { type: "Sick Leave", dates: "Feb 5, 2025", status: "Pending" },
  ];

  const recentPayslips = [
    { month: "December 2024", amount: "$5,400", status: "Paid" },
    { month: "November 2024", amount: "$5,400", status: "Paid" },
    { month: "October 2024", amount: "$5,200", status: "Paid" },
  ];

  return (
    <div className="min-h-screen pb-20 pr-56">
      <AuroraBackground />

      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-glow-teal">Auralis</h1>
            <p className="text-sm text-muted-foreground">Employee Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
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
          <h2 className="text-3xl font-bold mb-2">Hello, John!</h2>
          <p className="text-muted-foreground">Have a productive day at work.</p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard hover>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl glass glow-teal`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Leaves */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Upcoming Leaves</h3>
                <GlassButton variant="outline" className="text-sm px-4 py-2" onClick={() => navigate("/employee/leave")}>
                  Apply Leave
                </GlassButton>
              </div>
              <div className="space-y-4">
                {upcomingLeaves.map((leave, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-xl glass"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{leave.type}</h4>
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          leave.status === "Approved"
                            ? "bg-teal/20 text-teal"
                            : "bg-violet/20 text-violet"
                        }`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{leave.dates}</p>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Recent Payslips */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Recent Payslips</h3>
                <GlassButton variant="outline" className="text-sm px-4 py-2" onClick={() => navigate("/employee/attendance")}>
                  View Attendance
                </GlassButton>
              </div>
              <div className="space-y-4">
                {recentPayslips.map((payslip, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-xl glass hover:bg-foreground/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{payslip.month}</h4>
                        <p className="text-sm text-muted-foreground">{payslip.status}</p>
                      </div>
                      <p className="text-xl font-bold text-primary">{payslip.amount}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      
      <RoleSidebar />
    </div>
  );
}
