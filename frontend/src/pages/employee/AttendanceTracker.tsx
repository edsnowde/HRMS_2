import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Calendar, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const attendanceData = [
  { month: 'Jan', days: 22 },
  { month: 'Feb', days: 20 },
  { month: 'Mar', days: 23 },
  { month: 'Apr', days: 21 },
  { month: 'May', days: 22 },
  { month: 'Jun', days: 20 },
];

export default function AttendanceTracker() {
  const [checkedIn, setCheckedIn] = useState(false);

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
              Attendance Tracker
            </h1>
            <p className="text-muted-foreground mt-2">Track your daily attendance</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <GlassCard hover>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">This Month</p>
                  <p className="text-3xl font-bold">20 Days</p>
                </div>
                <Calendar className="w-12 h-12 text-primary opacity-80" />
              </div>
            </GlassCard>

            <GlassCard hover>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Current Streak</p>
                  <p className="text-3xl font-bold">12 Days</p>
                </div>
                <TrendingUp className="w-12 h-12 text-accent opacity-80" />
              </div>
            </GlassCard>

            <GlassCard hover>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Today's Status</p>
                  <p className="text-3xl font-bold">{checkedIn ? 'Present' : 'Absent'}</p>
                </div>
                <Clock className="w-12 h-12 text-secondary opacity-80" />
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <GlassCard>
              <h3 className="text-xl font-semibold mb-6">Quick Check-in</h3>
              <div className="text-center py-8">
                {!checkedIn ? (
                  <>
                    <Clock className="w-20 h-20 mx-auto mb-6 text-primary" />
                    <p className="text-lg mb-6">Ready to mark your attendance?</p>
                    <GlassButton 
                      className="px-8 py-4 text-lg"
                      onClick={() => setCheckedIn(true)}
                    >
                      Check In Now
                    </GlassButton>
                  </>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <CheckCircle className="w-20 h-20 mx-auto mb-6 text-accent" />
                    <p className="text-lg text-accent font-semibold mb-2">Successfully Checked In!</p>
                    <p className="text-sm text-muted-foreground">Today at {new Date().toLocaleTimeString()}</p>
                  </motion.div>
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Monthly Overview</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={attendanceData}>
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
                  <Bar dataKey="days" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>

          <GlassCard>
            <h3 className="text-xl font-semibold mb-4">Recent Attendance</h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {Array.from({ length: 14 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (13 - i));
                const isPresent = Math.random() > 0.2;
                
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-lg text-center ${
                      isPresent ? 'bg-accent/20' : 'bg-destructive/20'
                    }`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold mb-1">{date.getDate()}</div>
                    <div className={`w-2 h-2 rounded-full mx-auto ${
                      isPresent ? 'bg-accent' : 'bg-destructive'
                    }`} />
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
