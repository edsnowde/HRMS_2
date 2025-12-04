import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import HRDashboard from "./pages/dashboard/HRDashboard";
import RecruiterDashboard from "./pages/dashboard/RecruiterDashboard";
import RecruiterJobs from "./pages/recruiter/jobs";
import PineconeScoring from "./pages/recruiter/PineconeScoring";
import FinalAIResults from "./pages/recruiter/FinalAIResults";
import PostJob from "./pages/recruiter/post-job";
import CandidateDashboard from "./pages/dashboard/CandidateDashboard";
import UserManagement from "./pages/admin/UserManagement";
import SystemHealth from "./pages/admin/SystemHealth";
import AuditLogs from "./pages/admin/AuditLogs";
import FairnessReport from "./pages/admin/FairnessReport";
import JobsManagement from "./pages/hr/JobsManagement";
import CreateJob from "./pages/hr/CreateJob";
import AttendanceTracker from "./pages/employee/AttendanceTracker";
import LeaveManagement from "./pages/employee/LeaveManagement";
import MyApplications from "./pages/candidate/MyApplications";
import ViewCandidateProfile from "./pages/candidate/ViewProfile";
import EditProfile from "./pages/candidate/EditProfile";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import SimpleJobListings from "./pages/candidate/simple-job-listings";
import Index from "./pages/Index";
import ApplicationForm from "./pages/candidate/ApplicationForm";
import CandidateApplicationDetail from "./pages/candidate/ApplicationDetail";
import RecruiterApplicationDetail from "./pages/recruiter/ApplicationDetail";
// Some previous builds referenced `ApplicationDetail` directly; export an alias to avoid runtime ReferenceError
import ApplicationDetail from "./pages/recruiter/ApplicationDetail";
import ApplicantsList from "./pages/recruiter/ApplicantsList";
import AI_Interview from "./pages/candidate/AI_Interview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/index" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Admin Routes */}
            <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/system-health" element={<ProtectedRoute allowedRoles={['admin']}><SystemHealth /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogs /></ProtectedRoute>} />
            <Route path="/admin/fairness" element={<ProtectedRoute allowedRoles={['admin']}><FairnessReport /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'hr', 'recruiter']}><Analytics /></ProtectedRoute>} />
            
            {/* HR Routes */}
            <Route path="/dashboard/hr" element={<ProtectedRoute allowedRoles={['hr']}><HRDashboard /></ProtectedRoute>} />
            <Route path="/hr/jobs" element={<ProtectedRoute allowedRoles={['hr']}><JobsManagement /></ProtectedRoute>} />
            <Route path="/hr/create-job" element={<ProtectedRoute allowedRoles={['hr']}><CreateJob /></ProtectedRoute>} />
            
            {/* Recruiter Routes */}
            <Route path="/dashboard/recruiter" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/jobs" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterJobs /></ProtectedRoute>} />
            <Route path="/recruiter/post-job" element={<ProtectedRoute allowedRoles={['recruiter']}><PostJob /></ProtectedRoute>} />
            <Route path="/recruiter/applicants-list" element={<ProtectedRoute allowedRoles={['recruiter']}><ApplicantsList /></ProtectedRoute>} />
            <Route path="/recruiter/application/:id" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterApplicationDetail /></ProtectedRoute>} />
            <Route path="/recruiter/jobs/:jobId/pinecone-scoring" element={<ProtectedRoute allowedRoles={['recruiter', 'admin']}><PineconeScoring /></ProtectedRoute>} />
            <Route path="/recruiter/jobs/:jobId/final-results" element={<ProtectedRoute allowedRoles={['recruiter', 'admin']}><FinalAIResults /></ProtectedRoute>} />
            
            {/* Employee Routes */}
            <Route path="/dashboard/employee" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/employee/attendance" element={<ProtectedRoute allowedRoles={['employee']}><AttendanceTracker /></ProtectedRoute>} />
            <Route path="/employee/leave" element={<ProtectedRoute allowedRoles={['employee']}><LeaveManagement /></ProtectedRoute>} />
            
            {/* Candidate Routes */}
            <Route path="/dashboard/candidate" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
            <Route path="/candidate/profile" element={<ProtectedRoute allowedRoles={['candidate', 'recruiter', 'hr', 'employee']}><ViewCandidateProfile /></ProtectedRoute>} />
            <Route path="/candidate/profile/:id" element={<ProtectedRoute allowedRoles={['recruiter', 'hr','candidate']}><ViewCandidateProfile /></ProtectedRoute>} />
            <Route path="/candidate/EditProfile" element={<ProtectedRoute allowedRoles={['candidate']}><EditProfile /></ProtectedRoute>} />
            <Route path="/candidate/simple-job-listings" element={<ProtectedRoute allowedRoles={['candidate']}><SimpleJobListings /></ProtectedRoute>} />
            <Route path="/candidate/applications" element={<ProtectedRoute allowedRoles={['candidate']}><MyApplications /></ProtectedRoute>} />
            <Route path="/candidate/application-form" element={<ProtectedRoute allowedRoles={['candidate']}><ApplicationForm /></ProtectedRoute>} />
            <Route path="/candidate/application/:id" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateApplicationDetail /></ProtectedRoute>} />
            <Route path="/candidate/interview/:applicationId" element={<ProtectedRoute allowedRoles={['candidate']}><AI_Interview /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter> 
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
