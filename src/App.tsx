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
import CandidateDashboard from "./pages/dashboard/CandidateDashboard";
import UserManagement from "./pages/admin/UserManagement";
import SystemHealth from "./pages/admin/SystemHealth";
import JobsManagement from "./pages/hr/JobsManagement";
import CreateJob from "./pages/hr/CreateJob";
import PostJob from "./pages/recruiter/PostJob";
import ViewApplicants from "./pages/recruiter/ViewApplicants";
import AIScreening from "./pages/recruiter/AIScreening";
import AttendanceTracker from "./pages/employee/AttendanceTracker";
import LeaveManagement from "./pages/employee/LeaveManagement";
import JobListings from "./pages/candidate/JobListings";
import ApplicationStatus from "./pages/candidate/ApplicationStatus";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

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
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Admin Routes */}
            <Route path="/dashboard/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/system-health" element={<ProtectedRoute allowedRoles={['admin']}><SystemHealth /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'hr']}><Analytics /></ProtectedRoute>} />
            
            {/* HR Routes */}
            <Route path="/dashboard/hr" element={<ProtectedRoute allowedRoles={['hr']}><HRDashboard /></ProtectedRoute>} />
            <Route path="/hr/jobs" element={<ProtectedRoute allowedRoles={['hr']}><JobsManagement /></ProtectedRoute>} />
            <Route path="/hr/create-job" element={<ProtectedRoute allowedRoles={['hr']}><CreateJob /></ProtectedRoute>} />
            
            {/* Recruiter Routes */}
            <Route path="/dashboard/recruiter" element={<ProtectedRoute allowedRoles={['recruiter']}><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/post-job" element={<ProtectedRoute allowedRoles={['recruiter']}><PostJob /></ProtectedRoute>} />
            <Route path="/recruiter/applicants" element={<ProtectedRoute allowedRoles={['recruiter']}><ViewApplicants /></ProtectedRoute>} />
            <Route path="/recruiter/screening" element={<ProtectedRoute allowedRoles={['recruiter']}><AIScreening /></ProtectedRoute>} />
            
            {/* Employee Routes */}
            <Route path="/dashboard/employee" element={<ProtectedRoute allowedRoles={['employee']}><EmployeeDashboard /></ProtectedRoute>} />
            <Route path="/employee/attendance" element={<ProtectedRoute allowedRoles={['employee']}><AttendanceTracker /></ProtectedRoute>} />
            <Route path="/employee/leave" element={<ProtectedRoute allowedRoles={['employee']}><LeaveManagement /></ProtectedRoute>} />
            
            {/* Candidate Routes */}
            <Route path="/dashboard/candidate" element={<ProtectedRoute allowedRoles={['candidate']}><CandidateDashboard /></ProtectedRoute>} />
            <Route path="/candidate/jobs" element={<ProtectedRoute allowedRoles={['candidate']}><JobListings /></ProtectedRoute>} />
            <Route path="/candidate/applications" element={<ProtectedRoute allowedRoles={['candidate']}><ApplicationStatus /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
