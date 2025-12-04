import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Briefcase, Plus, Edit, Eye, X } from 'lucide-react';

export default function JobsManagement() {
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  const jobs = [
    { id: 1, title: 'Senior React Developer', department: 'Engineering', applicants: 45, status: 'Active', posted: '2024-01-15' },
    { id: 2, title: 'Product Manager', department: 'Product', applicants: 32, status: 'Active', posted: '2024-01-20' },
    { id: 3, title: 'UX Designer', department: 'Design', applicants: 28, status: 'Active', posted: '2024-01-18' },
    { id: 4, title: 'Data Scientist', department: 'Analytics', applicants: 67, status: 'Closed', posted: '2023-12-10' },
  ];

  const filteredJobs = filter === 'all' ? jobs : jobs.filter(job => job.status.toLowerCase() === filter);

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
                Jobs Management
              </h1>
              <p className="text-muted-foreground mt-2">Manage all job postings</p>
            </div>
            <GlassButton className="gap-2">
              <Plus className="w-4 h-4" />
              Create New Job
            </GlassButton>
          </div>

          <div className="flex gap-4 mb-6">
            {(['all', 'active', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-2 rounded-lg transition-all ${
                  filter === status
                    ? 'glass text-primary font-medium'
                    : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold mb-1">{job.title}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{job.department}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">Posted: {job.posted}</span>
                          <span className="text-accent">{job.applicants} Applicants</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        job.status === 'Active'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-muted/20 text-muted-foreground'
                      }`}>
                        {job.status}
                      </span>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
