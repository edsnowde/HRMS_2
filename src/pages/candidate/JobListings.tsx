import { useState } from "react";
import { motion } from "framer-motion";
import { AuroraBackground } from "@/components/AuroraBackground";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { Search, MapPin, Briefcase, DollarSign, Clock, Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApplications } from "@/contexts/ApplicationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function JobListings() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const { user } = useAuth();
  const { addApplication } = useApplications();

  const jobs = [
    {
      id: 1,
      title: 'Senior React Developer',
      company: 'TechCorp Inc.',
      location: 'Remote',
      type: 'Full-time',
      salary: '$100k - $150k',
      posted: '2 days ago',
      description: 'Join our team to build cutting-edge web applications...',
    },
    {
      id: 2,
      title: 'Product Manager',
      company: 'Innovation Labs',
      location: 'New York, NY',
      type: 'Full-time',
      salary: '$120k - $160k',
      posted: '1 week ago',
      description: 'Lead product strategy and development...',
    },
    {
      id: 3,
      title: 'UX Designer',
      company: 'Design Studio',
      location: 'San Francisco, CA',
      type: 'Contract',
      salary: '$80k - $110k',
      posted: '3 days ago',
      description: 'Create beautiful user experiences...',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'resume' && file.type === 'application/pdf') {
        setResumeFile(file);
      } else if (type === 'video' && file.type.startsWith('video/')) {
        setVideoFile(file);
      } else {
        toast.error(`Please upload a valid ${type === 'resume' ? 'PDF' : 'video'} file`);
      }
    }
  };

  const handleApply = async () => {
    if (!resumeFile) {
      toast.error("Please upload your resume");
      return;
    }

    // Convert files to base64 for storage
    const resumeUrl = await fileToBase64(resumeFile);
    const videoUrl = videoFile ? await fileToBase64(videoFile) : undefined;

    addApplication({
      candidateId: user!.id,
      candidateName: user!.name,
      candidateEmail: user!.email,
      jobId: selectedJob.id.toString(),
      jobTitle: selectedJob.title,
      company: selectedJob.company,
      status: 'pending',
      stage: 1,
      score: Math.floor(Math.random() * 30) + 70, // Random score 70-100
      resumeUrl,
      videoUrl,
    });

    toast.success("Application submitted successfully!");
    setSelectedJob(null);
    setResumeFile(null);
    setVideoFile(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
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
              Job Listings
            </h1>
            <p className="text-muted-foreground mt-2">Discover your next career opportunity</p>
          </div>

          <GlassCard className="mb-8">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search jobs by title, skills, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
              />
              <GlassButton>Search</GlassButton>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-6">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard hover>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-semibold mb-2">{job.title}</h3>
                      <p className="text-lg text-muted-foreground mb-3">{job.company}</p>
                    </div>
                    <GlassButton onClick={() => setSelectedJob(job)}>Apply Now</GlassButton>
                  </div>

                  <p className="text-muted-foreground mb-4">{job.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-secondary" />
                      <span>{job.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-accent" />
                      <span>{job.salary}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-pink-400" />
                      <span>{job.posted}</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="resume" className="text-lg mb-2 block">
                Upload Resume (PDF) *
              </Label>
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange(e, 'resume')}
                  className="hidden"
                />
                <label htmlFor="resume" className="cursor-pointer">
                  {resumeFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-primary">{resumeFile.name}</span>
                      <X
                        className="w-4 h-4 text-destructive cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          setResumeFile(null);
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click to upload resume (PDF)</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="video" className="text-lg mb-2 block">
                Upload Introduction Video (Optional)
              </Label>
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileChange(e, 'video')}
                  className="hidden"
                />
                <label htmlFor="video" className="cursor-pointer">
                  {videoFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-primary">{videoFile.name}</span>
                      <X
                        className="w-4 h-4 text-destructive cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          setVideoFile(null);
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click to upload video</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>
                Cancel
              </Button>
              <GlassButton onClick={handleApply}>
                Submit Application
              </GlassButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
