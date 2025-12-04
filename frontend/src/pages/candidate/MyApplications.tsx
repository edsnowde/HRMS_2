import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from "@/lib/apiClient";
import type { Application } from '@/types/application';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSidebar } from '@/components/RoleSidebar';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Application status badges
const statusBadges: Record<string, { color: string; label: string }> = {
  submitted: { color: 'bg-blue-500', label: 'Submitted' },
  resume_screened: { color: 'bg-yellow-500', label: 'Resume Screened' },
  interview_scheduled: { color: 'bg-purple-500', label: 'Interview Scheduled' },
  interview_completed: { color: 'bg-green-500', label: 'Interview Completed' },
  hired: { color: 'bg-emerald-500', label: 'Hired' },
  rejected: { color: 'bg-red-500', label: 'Not Selected' }
};

export default function MyApplications() {
  const navigate = useNavigate();
  // Using the imported apiClient directly
  const { toast } = useToast();
  
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  // Fetch applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        // Backend exposes the route at /application/me (no '/api' prefix)
        const response = await apiClient.get('/application/me');

        // apiClient.request returns the raw JSON body. Some endpoints
        // return { data: ... } while others return the array directly.
        // Support both shapes here.
        const apps = (response as any)?.data ?? (response as any);

        if (Array.isArray(apps)) {
          setApplications(apps as Application[]);
        } else {
          // defensive: if backend returned an object with nested data
          setApplications((apps?.applications || apps?.data || []) as Application[]);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load your applications",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  // Filter and sort applications
  const filteredApplications = applications
    .filter(app => {
      const jobTitle = (app.job_title ?? '').toString();
      const company = (app.company ?? '').toString();

      const matchesSearch =
        jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <Button onClick={() => navigate('/jobs')} size="sm">
          Browse Jobs
        </Button>
      </div>

      <Card className="p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs or companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(statusBadges).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={setSortBy}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Last Updated</SelectItem>
              <SelectItem value="oldest">Date Applied</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>Application ID</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Candidate ID</TableHead>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>Candidate Email</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {searchTerm || statusFilter !== 'all' ? (
                      <p>No applications match your filters</p>
                    ) : (
                      <div className="space-y-4">
                        <p>You haven't applied to any jobs yet</p>
                        <Button
                          onClick={() => navigate('/jobs')}
                          variant="outline"
                          size="sm"
                        >
                          Browse Open Positions
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell className="font-mono text-sm">{app.application_id ?? app._id}</TableCell>
                    <TableCell className="text-xs">{app.job_id}</TableCell>
                    <TableCell className="text-xs">{app.candidate_id}</TableCell>
                    <TableCell className="font-medium">{app.candidate_name ?? '-'}</TableCell>
                    <TableCell className="text-xs">{app.candidate_email ?? '-'}</TableCell>
                    <TableCell className="text-sm">{app.stage ?? '-'}</TableCell>
                    <TableCell>
                      <Badge className={`${statusBadges[app.status]?.color ?? 'bg-gray-400'} text-white`}>
                        {statusBadges[app.status]?.label ?? (app.status ?? '-')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {app.created_at ? formatDate(app.created_at) : '-'}
                    </TableCell>
                    <TableCell>
                      {app.updated_at ? formatDate(app.updated_at) : '-'}
                    </TableCell>
                    <TableCell>
                      {app.gcs_resume_uri ? (
                        <a href={app.gcs_resume_uri} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Open</a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {app.consent_given ? (
                        <span className="text-sm text-green-600">Yes</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                      {app.consent_timestamp && (
                        <div className="text-xs text-muted-foreground">{formatDate(app.consent_timestamp)}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/candidate/interview/${app.application_id ?? app._id}`)}
                      >
                        AI interview
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
            <RoleSidebar />

    </div>
  );
}