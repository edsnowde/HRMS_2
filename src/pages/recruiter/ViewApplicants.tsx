import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { User, Filter, Download, CheckCircle, XCircle } from 'lucide-react';
import { useApplications } from '@/contexts/ApplicationContext';
import { FileViewer } from '@/components/FileViewer';
import { Badge } from '@/components/ui/badge';

export default function ViewApplicants() {
  const [filterStage, setFilterStage] = useState<string>('all');
  const { applications } = useApplications();

  const stages = ['all', 'pending', 'screening', 'interview', 'accepted', 'rejected'];
  const filteredApplicants = filterStage === 'all' 
    ? applications 
    : applications.filter(a => a.status === filterStage);

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
                View Applicants
              </h1>
              <p className="text-muted-foreground mt-2">Manage and review candidates</p>
            </div>
            <GlassButton className="gap-2">
              <Download className="w-4 h-4" />
              Export Data
            </GlassButton>
          </div>

          <div className="flex gap-4 mb-6 overflow-x-auto">
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => setFilterStage(stage)}
                className={`px-6 py-2 rounded-lg transition-all whitespace-nowrap ${
                  filterStage === stage
                    ? 'glass text-primary font-medium'
                    : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                }`}
              >
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredApplicants.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-muted-foreground">No applications found</p>
              </GlassCard>
            ) : (
              filteredApplicants.map((applicant, index) => (
                <motion.div
                  key={applicant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard hover className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                          <User className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-1">{applicant.candidateName}</h3>
                          <p className="text-muted-foreground">{applicant.jobTitle}</p>
                          <p className="text-sm text-muted-foreground">{applicant.candidateEmail}</p>
                        </div>
                      </div>
                      {applicant.score && (
                        <Badge className="glass glow-teal">
                          Score: {applicant.score}%
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className="ml-2 capitalize font-medium">{applicant.status}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Applied:</span>
                        <span className="ml-2 font-medium">
                          {new Date(applicant.appliedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <FileViewer
                        resumeUrl={applicant.resumeUrl}
                        videoUrl={applicant.videoUrl}
                        candidateName={applicant.candidateName}
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <GlassButton variant="primary" className="flex-1">
                        View Profile
                      </GlassButton>
                      <GlassButton variant="secondary" className="flex-1">
                        Schedule Interview
                      </GlassButton>
                      <button className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-all">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
