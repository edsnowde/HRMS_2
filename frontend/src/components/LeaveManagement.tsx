import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";
import { GlassButton } from "@/components/GlassButton";
import { 
  Calendar, 
  Plus, 
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  TrendingUp,
  CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import apiClient from "@/lib/apiClient";

export interface LeaveRequest {
  id: string;
  type: 'sick' | 'vacation' | 'personal' | 'maternity' | 'paternity' | 'bereavement';
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_date: string;
  approved_by?: string;
  approved_date?: string;
  comments?: string;
}

export interface LeaveBalance {
  vacation_days: number;
  sick_days: number;
  personal_days: number;
  maternity_days: number;
  paternity_days: number;
  bereavement_days: number;
  total_available: number;
  total_used: number;
  total_remaining: number;
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: 'vacation' as LeaveRequest['type'],
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const [balanceResponse, requestsResponse] = await Promise.all([
        apiClient.getLeaveBalance(user?.id || ''),
        apiClient.getLeaveRequests(user?.id || '')
      ]);
      
      setLeaveBalance(balanceResponse);
      setLeaveRequests(requestsResponse.requests || []);
    } catch (error: any) {
      toast.error('Failed to fetch leave data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRequest.start_date || !newRequest.end_date || !newRequest.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDate = new Date(newRequest.start_date);
    const endDate = new Date(newRequest.end_date);
    
    if (startDate >= endDate) {
      toast.error('End date must be after start date');
      return;
    }

    const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    try {
      await apiClient.submitLeaveRequest({
        ...newRequest,
        days_requested: daysRequested,
        employee_id: user?.id
      });
      
      toast.success('Leave request submitted successfully!');
      setShowNewRequestForm(false);
      setNewRequest({
        type: 'vacation',
        start_date: '',
        end_date: '',
        reason: ''
      });
      await fetchLeaveData();
    } catch (error: any) {
      toast.error('Failed to submit leave request: ' + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-500 bg-green-500/20';
      case 'rejected':
        return 'text-red-500 bg-red-500/20';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'text-blue-500 bg-blue-500/20';
      case 'sick':
        return 'text-red-500 bg-red-500/20';
      case 'personal':
        return 'text-purple-500 bg-purple-500/20';
      case 'maternity':
        return 'text-pink-500 bg-pink-500/20';
      case 'paternity':
        return 'text-green-500 bg-green-500/20';
      case 'bereavement':
        return 'text-gray-500 bg-gray-500/20';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Leave Management</h2>
          <p className="text-muted-foreground">
            Manage your leave requests and track your time off
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <GlassButton
            variant="outline"
            onClick={fetchLeaveData}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </GlassButton>
          <GlassButton
            variant="primary"
            onClick={() => setShowNewRequestForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Request Leave
          </GlassButton>
        </div>
      </div>

      {/* Leave Balance */}
      {leaveBalance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-primary mb-1">
              {leaveBalance.total_remaining}
            </div>
            <div className="text-sm text-muted-foreground">Days Remaining</div>
            <div className="text-xs text-muted-foreground mt-1">
              of {leaveBalance.total_available} total
            </div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500 mb-1">
              {leaveBalance.vacation_days}
            </div>
            <div className="text-sm text-muted-foreground">Vacation Days</div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500 mb-1">
              {leaveBalance.sick_days}
            </div>
            <div className="text-sm text-muted-foreground">Sick Days</div>
          </GlassCard>

          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-500 mb-1">
              {leaveBalance.personal_days}
            </div>
            <div className="text-sm text-muted-foreground">Personal Days</div>
          </GlassCard>
        </div>
      )}

      {/* New Request Form */}
      {showNewRequestForm && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Submit Leave Request
          </h3>
          
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Leave Type</label>
                <select
                  value={newRequest.type}
                  onChange={(e) => setNewRequest({...newRequest, type: e.target.value as LeaveRequest['type']})}
                  className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="vacation">Vacation</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="bereavement">Bereavement Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={newRequest.start_date}
                  onChange={(e) => setNewRequest({...newRequest, start_date: e.target.value})}
                  className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={newRequest.end_date}
                  onChange={(e) => setNewRequest({...newRequest, end_date: e.target.value})}
                  className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({...newRequest, reason: e.target.value})}
                  placeholder="Please provide a reason for your leave request..."
                  rows={3}
                  className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <GlassButton
                type="button"
                variant="outline"
                onClick={() => setShowNewRequestForm(false)}
              >
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary">
                Submit Request
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Leave Requests */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Leave Requests
        </h3>
        
        <div className="space-y-4">
          {leaveRequests.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No leave requests</h3>
              <p className="text-muted-foreground">
                Submit your first leave request to get started
              </p>
            </div>
          ) : (
            leaveRequests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-background/10 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getStatusIcon(request.status)}
                      <h4 className="font-medium">
                        {request.type.charAt(0).toUpperCase() + request.type.slice(1)} Leave
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(request.type)}`}>
                        {request.type}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Period:</strong> {formatDate(request.start_date)} - {formatDate(request.end_date)}
                      </div>
                      <div>
                        <strong>Days:</strong> {request.days_requested} days
                      </div>
                      <div>
                        <strong>Submitted:</strong> {formatDate(request.submitted_date)}
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <strong>Reason:</strong> {request.reason}
                    </div>
                    
                    {request.comments && (
                      <div className="mt-2 text-sm">
                        <strong>Comments:</strong> {request.comments}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
