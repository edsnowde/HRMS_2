import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: 'pending' | 'screening' | 'interview' | 'rejected' | 'accepted';
  stage: number;
  score?: number;
  resumeUrl?: string;
  videoUrl?: string;
}

interface ApplicationContextType {
  applications: Application[];
  addApplication: (application: Omit<Application, 'id' | 'appliedDate'>) => void;
  updateApplication: (id: string, updates: Partial<Application>) => void;
  getApplicationsByCandidate: (candidateId: string) => Application[];
  getApplicationsByJob: (jobId: string) => Application[];
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export const ApplicationProvider = ({ children }: { children: ReactNode }) => {
  const [applications, setApplications] = useState<Application[]>(() => {
    const stored = localStorage.getItem('auralis_applications');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('auralis_applications', JSON.stringify(applications));
  }, [applications]);

  const addApplication = (application: Omit<Application, 'id' | 'appliedDate'>) => {
    const newApplication: Application = {
      ...application,
      id: `app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      appliedDate: new Date().toISOString(),
    };
    setApplications(prev => [...prev, newApplication]);
  };

  const updateApplication = (id: string, updates: Partial<Application>) => {
    setApplications(prev =>
      prev.map(app => (app.id === id ? { ...app, ...updates } : app))
    );
  };

  const getApplicationsByCandidate = (candidateId: string) => {
    return applications.filter(app => app.candidateId === candidateId);
  };

  const getApplicationsByJob = (jobId: string) => {
    return applications.filter(app => app.jobId === jobId);
  };

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        addApplication,
        updateApplication,
        getApplicationsByCandidate,
        getApplicationsByJob,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplications = () => {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplications must be used within ApplicationProvider');
  }
  return context;
};
