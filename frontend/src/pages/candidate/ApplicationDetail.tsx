import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiClient from "@/lib/apiClient";
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Building2, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWebSocket } from '@/hooks/use-websocket';
import { FileViewer } from '@/components/FileViewer';

const statusSteps = [
  { key: 'submitted', label: 'Application Submitted' },
  { key: 'resume_screened', label: 'Resume Screened' },
  { key: 'interview_scheduled', label: 'Interview Scheduled' },
  { key: 'interview_completed', label: 'Interview Completed' },
  { key: 'hired', label: 'Hired' }
];

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-500',
  resume_screened: 'bg-yellow-500',
  interview_scheduled: 'bg-purple-500',
  interview_completed: 'bg-green-500',
  hired: 'bg-emerald-500',
  rejected: 'bg-red-500'
};

export default function ApplicationDetail() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const socket = useWebSocket();
  
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('overview');

  // Fetch application details
  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const response = await apiClient.get(`/api/applications/${applicationId}`);
        setApplication(response.data);
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

    fetchApplication();
  }, [applicationId]);

  // Listen for real-time updates
  useEffect(() => {
    if (socket && applicationId) {
      socket.on('application_update', (data) => {
        if (data.application_id === applicationId) {
          setApplication(prev => ({ ...prev, ...data }));
          
          toast({
            title: "Application Updated",
            description: `Status changed to ${data.status}`
          });
        }
      });

      return () => {
        socket.off('application_update');
      };
    }
  }, [socket, applicationId]);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    const currentIndex = statusSteps.findIndex(step => step.key === application?.status);
    return ((currentIndex + 1) / statusSteps.length) * 100;
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
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Application Not Found</h2>
          <p className="text-gray-600 mb-4">
            The application you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate('/candidate/applications')}>
            Back to My Applications
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <Card className="p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{application.job_title}</h1>
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 className="h-4 w-4" />
              <span>{application.company}</span>
            </div>
          </div>
          <Badge className={`${statusColors[application.status]} text-white`}>
            {application.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Application Progress */}
        <div className="mt-6">
          <Progress value={getProgressPercentage()} className="h-2 mb-4" />
          <div className="grid grid-cols-5 gap-2">
            {statusSteps.map((step) => {
              const isCompleted = statusSteps.findIndex(s => s.key === application.status) >= 
                                statusSteps.findIndex(s => s.key === step.key);
              return (
                <div key={step.key} className="text-center">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 mx-auto text-primary" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 mx-auto" />
                  )}
                  <p className="text-xs mt-1">{step.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Content Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="p-6">
            <div className="grid gap-6">
              {/* Application Details */}
              <div>
                <h3 className="font-semibold mb-4">Application Details</h3>
                <div className="grid gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>Applied on {new Date(application.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Last updated {new Date(application.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              <div>
                <h3 className="font-semibold mb-4">Cover Letter</h3>
                <p className="whitespace-pre-wrap text-gray-600">
                  {application.cover_letter}
                </p>
              </div>

              {/* Additional Information */}
              {application.feedback && (
                <div>
                  <h3 className="font-semibold mb-4">Feedback</h3>
                  <p className="text-gray-600">{application.feedback}</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="resume" className="mt-4">
          <Card className="p-6">
            {application.resume_url ? (
              <FileViewer resumeUrl={application.resume_url} candidateName={application.candidate_name || 'Candidate'} />
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p>Resume not available</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="interview" className="mt-4">
          <Card className="p-6">
            {application.interview_session ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Interview Session</h3>
                  <Badge>
                    {application.interview_session.status}
                  </Badge>
                </div>

                {/* Interview Questions */}
                <div className="space-y-4">
                  {application.interview_session.questions?.map((question: any, index: number) => (
                    <div key={question.id} className="p-4 rounded-lg border">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">Question {index + 1}</span>
                        {question.score && (
                          <Badge className={cn(
                            question.score >= 7 ? "bg-green-500" : "bg-yellow-500",
                            "text-white"
                          )}>
                            Score: {question.score}/10
                          </Badge>
                        )}
                      </div>
                      <p className="mb-2">{question.text}</p>
                      {question.answer && (
                        <>
                          <p className="text-sm text-gray-600 mt-2">Your Answer:</p>
                          <p className="bg-gray-50 p-2 rounded mt-1">
                            {question.answer}
                          </p>
                        </>
                      )}
                      {question.feedback && (
                        <p className="text-sm text-gray-600 mt-2">
                          Feedback: {question.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {application.interview_session.status === 'completed' && (
                  <div className="mt-4 p-4 rounded-lg bg-gray-50">
                    <h4 className="font-medium mb-2">Overall Interview Score</h4>
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold">
                        {application.interview_score}/100
                      </div>
                      <Progress 
                        value={application.interview_score} 
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p>No interview scheduled yet</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card className="p-6">
            <div className="space-y-6">
              {application.timeline?.map((event: any) => (
                <div key={event.id} className="flex gap-4">
                  <div className="w-[2px] bg-gray-200 relative">
                    <div className="absolute w-2 h-2 rounded-full bg-primary top-1.5 -left-1" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                    <p className="font-medium">{event.title}</p>
                    {event.description && (
                      <p className="text-gray-600 mt-1">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}