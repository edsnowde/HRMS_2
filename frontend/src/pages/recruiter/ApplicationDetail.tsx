import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileViewer } from '@/components/FileViewer';
import InterviewResults from '@/components/InterviewResults';
import AIChatbot from '@/components/AIChatbot';
import { Loader2, ArrowLeft } from 'lucide-react';

import { Application, ApplicationStatus } from '@/types/application';

export default function ApplicationDetail() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  // Fetch application details
  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const response = await apiClient.get<{ data: Application }>(`/api/applications/${applicationId}`);
        setApplication(response.data.data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load application details",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (applicationId) {
      fetchApplication();
    }
  }, [applicationId]);

  // Update application status
  const updateStatus = async (status: ApplicationStatus) => {
    if (!application) return;

    try {
      await apiClient.patch<{ data: Application }>(`/api/applications/${applicationId}/status`, { status });
      
      setApplication(prev => prev ? { ...prev, status: status as Application['status'] } : null);
      
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
  const scheduleInterview = async () => {
    if (!application) return;

    try {
      await apiClient.post(`/api/applications/${applicationId}/schedule-interview`);
      
      toast({
        title: "Success",
        description: "Interview scheduled successfully"
      });
      
      // Refresh application data
      const response = await apiClient.get<{ data: Application }>(`/api/applications/${applicationId}`);
      setApplication(response.data.data);
      
    } catch (error) {
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

  if (!application) {
    return (
      <div className="container py-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Application Not Found</h2>
          <Button onClick={() => navigate('/recruiter/jobs')}>
            Back to Jobs List
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Button 
        variant="ghost" 
        onClick={() => navigate(`/recruiter/jobs/${application.jobId}/applications`)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Applications
      </Button>

      <div className="grid gap-6 mb-6">
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                {application.candidateName}
              </h1>
              <p className="text-gray-500 mb-2">{application.jobTitle}</p>
              <div className="flex gap-2 items-center">
                <Badge className={
                  application.status === 'hired' ? 'bg-green-500' :
                  application.status === 'applied' ? 'bg-gray-500' :
                  application.status === 'shortlisted' ? 'bg-blue-500' :
                  application.status === 'interviewed' ? 'bg-purple-500' :
                  application.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                }>
                  {application.status}
                </Badge>
                <Badge variant="outline">
                  Match Score: {application.matchScore}%
                </Badge>
                {application.interviewScore && (
                  <Badge variant="outline">
                    Interview Score: {application.interviewScore}%
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {application.status === 'applied' && (
                <Button onClick={() => updateStatus('shortlisted')}>
                  Shortlist
                </Button>
              )}
              {application.status === 'shortlisted' && (
                <Button onClick={scheduleInterview}>
                  Schedule Interview
                </Button>
              )}
              {application.status === 'interviewed' && (
                <Button onClick={() => updateStatus('hired')}>
                  Mark as Hired
                </Button>
              )}
              {!['rejected', 'hired'].includes(application.status) && (
                <Button 
                  variant="destructive"
                  onClick={() => updateStatus('rejected')}
                >
                  Reject
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              {application.status === 'interviewed' && (
                <TabsTrigger value="interview">Interview Results</TabsTrigger>
              )}
              <TabsTrigger value="chat">AI Chat Assistant</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Email:</span> {application.candidateEmail}</p>
                    <p><span className="font-medium">Phone:</span> {application.phone}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Application Timeline</h3>
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Applied on:</span>{' '}
                      {new Date(application.appliedDate).toLocaleDateString()}
                    </p>
                    <p>
                      <span className="font-medium">Last updated:</span>{' '}
                      {new Date(application.appliedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {application.interviewFeedback && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Interview Feedback</h3>
                    <p className="whitespace-pre-wrap">{application.interviewFeedback}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resume">
              <div className="border rounded-lg overflow-hidden h-[800px]">
                <FileViewer 
                  resumeUrl={application.resumeUrl}
                  candidateName={application.candidateName}
                />
              </div>
            </TabsContent>

            <TabsContent value="interview">
              {application.status === 'interviewed' && (
                <InterviewResults applicationId={application.id} showSingleApplication={true} />
              )}
            </TabsContent>

            <TabsContent value="chat">
              <AIChatbot context={{
                type: 'application' as const,
                applicationId: application.id,
                jobTitle: application.jobTitle,
                candidateName: application.candidateName
              }} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}