import { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Upload, FileText, Zap, CheckCircle } from 'lucide-react';

export default function AIScreening() {
  const [screening, setScreening] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartScreening = () => {
    setScreening(true);
    // Simulate screening progress
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => setScreening(false), 1000);
      }
    }, 500);
  };

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
              AI Resume Screening
            </h1>
            <p className="text-muted-foreground mt-2">Upload resumes for intelligent analysis</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Upload Resumes</h3>
              <div className="border-2 border-dashed border-white/20 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Drop files here or click to upload</p>
                <p className="text-sm text-muted-foreground">Supports PDF, DOC, DOCX (Max 10MB)</p>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm">sarah_johnson_resume.pdf</span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-accent" />
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm">michael_chen_resume.pdf</span>
                  </div>
                  <CheckCircle className="w-5 h-5 text-accent" />
                </div>
              </div>

              <GlassButton 
                className="w-full mt-6 gap-2"
                onClick={handleStartScreening}
                disabled={screening}
              >
                <Zap className="w-4 h-4" />
                {screening ? 'Screening in Progress...' : 'Start AI Screening'}
              </GlassButton>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xl font-semibold mb-4">Screening Progress</h3>
              
              {screening || progress > 0 ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall Progress</span>
                      <span className="text-accent">{progress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary via-secondary to-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { step: 'Parsing Resumes', status: progress >= 20 },
                      { step: 'Extracting Skills', status: progress >= 40 },
                      { step: 'Matching Requirements', status: progress >= 60 },
                      { step: 'Calculating Scores', status: progress >= 80 },
                      { step: 'Generating Reports', status: progress >= 100 },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          item.status ? 'bg-accent/10' : 'bg-white/5'
                        }`}
                      >
                        {item.status ? (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-white/20 rounded-full" />
                        )}
                        <span className={item.status ? 'text-accent' : 'text-muted-foreground'}>
                          {item.step}
                        </span>
                      </div>
                    ))}
                  </div>

                  {progress >= 100 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-accent/20 rounded-lg text-center"
                    >
                      <p className="text-accent font-semibold">Screening Complete! ✨</p>
                      <p className="text-sm text-muted-foreground mt-1">View results in applicants list</p>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Upload resumes and start screening to see progress</p>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
