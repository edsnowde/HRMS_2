import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Loader2, MoreVertical, Search } from 'lucide-react';
import { FileViewer } from '@/components/FileViewer';

interface Application {
  _id: string;
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  email: string;
  resume_url: string;
  status: string;
  match_score: number;
  interview_score?: number;
  created_at: string;
  updated_at: string;
}

interface Job {
  _id: string;
  title: string;
  company: string;
}

export default function ApplicantsList() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('match_score');
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [selectedResume, setSelectedResume] = useState<string | null>(null);

  // Fetch job details and applications
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: jobData }, { data: applicationsData }] = await Promise.all([
          apiClient.get<{ data: Job }>(`/api/jobs/${jobId}`),
          apiClient.get<{ data: Application[] }>(`/api/jobs/${jobId}/applications`)
        ]);

        setJob(jobData.data);
        setApplications(applicationsData.data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load applications",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  // Filter and sort applications
  const filteredApplications = applications
    .filter(app => {
      const matchesSearch = 
        app.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchesScore = app.match_score >= minMatchScore;
      
      return matchesSearch && matchesStatus && matchesScore;
    })
    .sort((a, b) => {
      if (sortBy === 'match_score') {
        return b.match_score - a.match_score;
      } else if (sortBy === 'interview_score') {
        return (b.interview_score || 0) - (a.interview_score || 0);
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // Update application status
  const updateApplicationStatus = async (applicationId: string, status: string) => {
    try {
      await apiClient.patch(`/api/applications/${applicationId}/status`, { status });
      
      setApplications(prev => prev.map(app => 
        app._id === applicationId ? { ...app, status } : app
      ));
      
      toast({
        title: "Success",
        description: "Application status updated"
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update application status",
        variant: "destructive"
      });
    }
  };

  // Schedule interview
  const scheduleInterview = async (applicationId: string) => {
    try {
      await apiClient.post(`/api/applications/${applicationId}/schedule-interview`);
      
      toast({
        title: "Success",
        description: "Interview scheduled successfully"
      });
      
      // Refresh application data
      const response = await apiClient.get(`/api/jobs/${jobId}/applications`);
        setApplications(response.data as Application[]);    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule interview",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container py-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Job Not Found</h2>
          <Button onClick={() => navigate('/recruiter/jobs')}>
            Back to Jobs List
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-gray-500">{job.company}</p>
        </div>
        <Button onClick={() => navigate('/recruiter/jobs')}>
          Back to Jobs
        </Button>
      </div>

      {/* Applications Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Total Applications</h3>
          <div className="text-3xl font-bold">{applications.length}</div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Shortlisted</h3>
          <div className="text-3xl font-bold">
            {applications.filter(a => a.status === 'shortlisted').length}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Interviewed</h3>
          <div className="text-3xl font-bold">
            {applications.filter(a => a.status === 'interviewed').length}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Hired</h3>
          <div className="text-3xl font-bold">
            {applications.filter(a => a.status === 'hired').length}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applicants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="shortlisted">Shortlisted</SelectItem>
              <SelectItem value="interviewed">Interviewed</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match_score">Match Score</SelectItem>
              <SelectItem value="interview_score">Interview Score</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">
            Minimum Match Score: {minMatchScore}%
          </label>
          <Slider
            value={[minMatchScore]}
            onValueChange={([value]) => setMinMatchScore(value)}
            max={100}
            step={5}
            className="w-[200px]"
          />
        </div>

        {/* Applications Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead>Interview Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No applications match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <div className="font-medium">{app.candidate_name}</div>
                      <div className="text-sm text-gray-500">{app.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        app.match_score >= 80 ? 'bg-green-500' :
                        app.match_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }>
                        {app.match_score}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {app.interview_score ? (
                        <Badge variant="outline">
                          {app.interview_score}%
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        app.status === 'hired' ? 'bg-green-500' :
                        app.status === 'shortlisted' ? 'bg-blue-500' :
                        app.status === 'interviewed' ? 'bg-purple-500' :
                        app.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                      }>
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => setSelectedResume(app.resume_url)}
                          >
                            View Resume
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => navigate(`/recruiter/applications/${app._id}`)}
                          >
                            View Details
                          </DropdownMenuItem>
                          {app.status === 'applied' && (
                            <DropdownMenuItem 
                              onClick={() => updateApplicationStatus(app._id, 'shortlisted')}
                            >
                              Shortlist
                            </DropdownMenuItem>
                          )}
                          {app.status === 'shortlisted' && (
                            <DropdownMenuItem 
                              onClick={() => scheduleInterview(app._id)}
                            >
                              Schedule Interview
                            </DropdownMenuItem>
                          )}
                          {app.status === 'interviewed' && (
                            <DropdownMenuItem 
                              onClick={() => updateApplicationStatus(app._id, 'hired')}
                            >
                              Mark as Hired
                            </DropdownMenuItem>
                          )}
                          {app.status !== 'rejected' && app.status !== 'hired' && (
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => updateApplicationStatus(app._id, 'rejected')}
                            >
                              Reject
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Resume Viewer Modal */}
      {selectedResume && (
        <FileViewer
          resumeUrl={selectedResume}
          candidateName={filteredApplications.find(app => app.resume_url === selectedResume)?.candidate_name || 'Candidate'}
        />
      )}
    </div>
  );
}