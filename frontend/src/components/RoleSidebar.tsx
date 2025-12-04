import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  to: string;
}

const roleNavMap: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', to: '/dashboard/admin' },
    { label: 'User Management', to: '/admin/user-management' },
    { label: 'System Health', to: '/admin/system-health' },
    { label: 'Analytics', to: '/analytics' },
    { label: 'Audit Logs', to: '/admin/audit-logs' },
    { label: 'Fairness Report', to: '/admin/fairness-report' },
    { label: 'Metrics', to: '/admin/metrics' },
    { label: 'API Usage', to: '/admin/api-usage' },
    { label: 'System Logs', to: '/admin/system-logs' },
    { label: 'AI Monitoring', to: '/admin/ai-monitoring' },
  ],
  hr: [
    { label: 'Dashboard', to: '/dashboard/hr' },
    { label: 'Jobs Management', to: '/hr/jobs-management' },
    { label: 'Create Job', to: '/hr/create-job' },
    { label: 'Employee Directory', to: '/hr/employee-directory' },
    { label: 'Department Management', to: '/hr/departments' },
    { label: 'Leave Approvals', to: '/hr/leave-approvals' },
    { label: 'Payroll Management', to: '/hr/payroll' },
    { label: 'Analytics', to: '/analytics' },
    { label: 'Reports', to: '/hr/reports' },
    { label: 'Company Policies', to: '/hr/policies' },
  ],
  recruiter: [
    { label: 'Dashboard', to: '/dashboard/recruiter' },
    { label: 'Jobs List', to: '/recruiter/jobs' },
    { label: 'Post New Job', to: '/recruiter/post-job' },

    // below is for testing 
    
    { label: 'ApplicantsList', to: '/recruiter/applicants-list' }, //Connected to backend? Partially / Yes


    { label: 'Pinecone Scoring', to: '/recruiter/PineconeScoring' },
    { label: 'Application Details', to: '/recruiter/application' }, //Connected to backend? Yes (but with several path/method mismatches)
    { label: 'Resume Database', to: '/recruiter/resumes' }, //Connected to backend? Partially / Yes
  
  ],
  candidate: [
    { label: 'Dashboard', to: '/dashboard/candidate' },
    { label: 'Job Listings', to: '/candidate/simple-job-listings' },
    { label: 'My Applications', to: '/candidate/applications' },
    { label: 'View Profile', to: '/candidate/ViewProfile'},
    { label: 'Edit Profile', to: '/candidate/edit-profile' },
    { label: 'Application Status', to: '/candidate/application-status' },
    { label: 'Resume Upload', to: '/candidate/resume-upload' },
    { label: 'Video Interview', to: '/candidate/video-interview' },
    { label: 'Interview Schedule', to: '/candidate/interview-schedule' },
    { label: 'AI Assistant', to: '/candidate/ai-assistant' },
    { label: 'Documents', to: '/candidate/documents' },
  ],
  employee: [
    { label: 'Dashboard', to: '/dashboard/employee' },
    { label: 'Attendance Tracker', to: '/employee/attendance-tracker' },
    { label: 'Leave Management', to: '/employee/leave-management' },
    { label: 'Payroll Info', to: '/employee/payroll' },
    { label: 'Time Sheet', to: '/employee/timesheet' },
    { label: 'Performance', to: '/employee/performance' },
    { label: 'Benefits', to: '/employee/benefits' },
    { label: 'Documents', to: '/employee/documents' },
    { label: 'Training', to: '/employee/training' },
    { label: 'Help Desk', to: '/employee/help-desk' },
  ],
};

export const RoleSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = roleNavMap[user.role] || [];

  return (
    <aside className="fixed right-0 top-0 h-full w-56 p-4 bg-background/60 border-l border-border/20 z-20 hidden md:block">
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-semibold">{user.name || user.email}</p>
          <p className="text-xs text-muted-foreground">Role: {user.role}</p>
        </div>

        <nav className="flex-1 space-y-2">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg hover:bg-accent/10 transition-colors ${isActive ? 'bg-accent/10 font-semibold' : ''}`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4">
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
};
