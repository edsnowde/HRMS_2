import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

export default function ApplicationStatus() {
  const applications = [
    {
      id: 1,
      position: 'Senior React Developer',
      company: 'TechCorp Inc.',
      appliedDate: '2024-01-20',
      status: 'Interview Scheduled',
      stage: 3,
      score: 94,
    },
    {
      id: 2,
      position: 'Product Manager',
      company: 'Innovation Labs',
      appliedDate: '2024-01-15',
      status: 'Under Review',
      stage: 2,
      score: 87,
    },
    {
      id: 3,
      position: 'UX Designer',
      company: 'Design Studio',
      appliedDate: '2024-01-25',
      status: 'Rejected',
      stage: 1,
      score: 72,
    },
  ];

  const stages = [
    { name: 'Applied', icon: FileText },
    { name: 'Screening', icon: Clock },
    { name: 'Interview', icon: CheckCircle },
    { name: 'Offer', icon: CheckCircle },
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
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Application Status
            </h1>
            <p className="text-muted-foreground mt-2">Track your job applications</p>
          </div>

          <div className="space-y-6">
            {applications.map((app, index) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-semibold mb-1">{app.position}</h3>
                        <p className="text-muted-foreground">{app.company}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-accent mb-1">{app.score}%</div>
                        <div className="text-sm text-muted-foreground">Match Score</div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Applied on {app.appliedDate}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Application Progress</span>
                      <span className={`text-sm font-medium ${
                        app.status === 'Rejected' ? 'text-destructive' : 'text-accent'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="flex justify-between items-center">
                        {stages.map((stage, idx) => {
                          const isCompleted = idx < app.stage;
                          const isCurrent = idx === app.stage;
                          const StageIcon = stage.icon;
                          
                          return (
                            <div key={idx} className="flex-1 relative">
                              <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                                  isCompleted
                                    ? 'bg-accent text-background'
                                    : isCurrent
                                    ? 'bg-primary text-background'
                                    : 'bg-white/10 text-muted-foreground'
                                }`}>
                                  <StageIcon className="w-5 h-5" />
                                </div>
                                <span className="text-xs text-center">{stage.name}</span>
                              </div>
                              {idx < stages.length - 1 && (
                                <div className={`absolute top-5 left-1/2 w-full h-0.5 -z-10 ${
                                  idx < app.stage ? 'bg-accent' : 'bg-white/10'
                                }`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {app.status === 'Interview Scheduled' && (
                    <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                      <p className="text-accent font-medium">📅 Interview scheduled for Feb 15, 2024 at 2:00 PM</p>
                    </div>
                  )}

                  {app.status === 'Rejected' && (
                    <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-destructive font-medium">Application was not successful. Keep applying!</p>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
