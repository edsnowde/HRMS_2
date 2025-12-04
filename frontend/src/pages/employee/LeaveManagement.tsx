import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Calendar, Plus, Clock } from 'lucide-react';

export default function LeaveManagement() {
  const [showForm, setShowForm] = useState(false);

  const leaveBalance = [
    { type: 'Annual Leave', used: 8, total: 20, color: 'primary' },
    { type: 'Sick Leave', used: 2, total: 10, color: 'secondary' },
    { type: 'Personal Leave', used: 1, total: 5, color: 'accent' },
  ];

  const leaveRequests = [
    { id: 1, type: 'Annual Leave', from: '2024-02-15', to: '2024-02-17', days: 3, status: 'Approved' },
    { id: 2, type: 'Sick Leave', from: '2024-01-20', to: '2024-01-21', days: 2, status: 'Approved' },
    { id: 3, type: 'Personal Leave', from: '2024-03-01', to: '2024-03-01', days: 1, status: 'Pending' },
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Leave Management
              </h1>
              <p className="text-muted-foreground mt-2">Manage your time off requests</p>
            </div>
            <GlassButton 
              className="gap-2"
              onClick={() => setShowForm(!showForm)}
            >
              <Plus className="w-4 h-4" />
              Apply for Leave
            </GlassButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {leaveBalance.map((leave, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <h3 className="text-lg font-semibold mb-4">{leave.type}</h3>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Used: {leave.used}</span>
                      <span>Remaining: {leave.total - leave.used}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-${leave.color}`}
                        style={{ width: `${(leave.used / leave.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-4">{leave.total - leave.used} Days Left</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8"
            >
              <GlassCard>
                <h3 className="text-xl font-semibold mb-6">Apply for Leave</h3>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Leave Type</label>
                      <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                        <option>Annual Leave</option>
                        <option>Sick Leave</option>
                        <option>Personal Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Duration</label>
                      <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                        <option>Full Day</option>
                        <option>Half Day</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">From Date</label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">To Date</label>
                      <input
                        type="date"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Reason</label>
                    <textarea
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                      placeholder="Provide a brief reason for your leave..."
                    />
                  </div>
                  <div className="flex gap-4">
                    <GlassButton type="submit">Submit Request</GlassButton>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          )}

          <GlassCard>
            <h3 className="text-xl font-semibold mb-4">Leave History</h3>
            <div className="space-y-3">
              {leaveRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold">{request.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.from} to {request.to} ({request.days} {request.days === 1 ? 'day' : 'days'})
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    request.status === 'Approved'
                      ? 'bg-accent/20 text-accent'
                      : request.status === 'Pending'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-destructive/20 text-destructive'
                  }`}>
                    {request.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
