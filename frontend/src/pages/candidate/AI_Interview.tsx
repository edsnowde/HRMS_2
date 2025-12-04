import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from "@/lib/apiClient";
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RoleSidebar } from '@/components/RoleSidebar';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Question {
  id: string;
  text: string;
  max_time?: number;
}

interface InterviewState {
  session_id: string;
  application_id: string;
  job_id: string;
  candidate_id?: string;
  status: string;
  questions: Question[];
  responses: Record<string, { text: string; submitted_at: string }>;
  scores?: Record<string, any> | null;
}

export default function AI_Interview() {
  const { applicationId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    fetchInterviewState();
  }, [applicationId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft !== null && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timeLeft]);

  const fetchInterviewState = async () => {
    try {
      setLoading(true);
      // Use backend interview sessions endpoint. It returns a list of sessions
      const response = await apiClient.get(`/api/interviews/application/${applicationId}`);
      const sessions = response?.data ?? response;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        setInterview(null);
        setTimeLeft(null);
      } else {
        const session = sessions[0];
        const questions = (session.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text,
          max_time: q.max_time || q.maxTime || 60
        }));

        const responses = session.responses || {};

        setInterview({
          session_id: session.session_id || session.sessionId || session._id,
          application_id: session.application_id,
          job_id: session.job_id,
          candidate_id: session.candidate_id,
          status: session.status,
          questions,
          responses,
          scores: session.scores || null
        });

        const answeredCount = Object.keys(responses).length;
        if (questions.length > answeredCount) {
          const nextTime = questions[answeredCount]?.max_time || 60;
          setTimeLeft(nextTime);
          // Auto-start timer when a question is displayed
          setTimerActive(true);
        } else {
          setTimeLeft(null);
          setTimerActive(false);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load interview state",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startQuestion = () => {
    setTimerActive(true);
    // Start the timer for the current unanswered question
    if (!interview) return;
    const idx = Object.keys(interview.responses).length;
    setTimeLeft(interview.questions[idx]?.max_time || 60);
  };

  const handleTimeUp = async () => {
    // current question time expired
    setTimerActive(false);
    if (answer.trim()) {
      await submitAnswer(true);
    } else {
      // Advance to next question without submitting
      if (!interview) return;
      const answeredCount = Object.keys(interview.responses).length;
      if (answeredCount < interview.questions.length - 1) {
        const nextTime = interview.questions[answeredCount + 1]?.max_time || 60;
        setTimeLeft(nextTime);
        // auto-start next question timer
        setTimerActive(true);
      } else {
        setTimeLeft(null);
        setTimerActive(false);
      }
    }
  };

  const submitAnswer = async (expired = false) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      if (!interview) throw new Error('No interview session available');
      const answeredCount = Object.keys(interview.responses).length;
      const currentQuestion = interview.questions[answeredCount];
      if (!currentQuestion) throw new Error('No current question');

      // Submit to backend: POST /api/interviews/{session_id}/answer?question_id={questionId}
      const url = `/api/interviews/${encodeURIComponent(interview.session_id)}/answer?question_id=${encodeURIComponent(currentQuestion.id)}`;
      await apiClient.post(url, { text: answer.trim() });

      const submittedAt = new Date().toISOString();
      // Update local state to reflect the answered question
      setInterview(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          responses: {
            ...prev.responses,
            [currentQuestion.id]: { text: answer.trim(), submitted_at: submittedAt }
          }
        };
      });

      setAnswer('');

      // Prepare next question timer (auto-start)
      const nextIdx = answeredCount + 1;
      if (interview.questions[nextIdx]) {
        const nextTime = interview.questions[nextIdx].max_time || 60;
        setTimeLeft(nextTime);
        setTimerActive(true);
      } else {
        setTimeLeft(null);
        setTimerActive(false);
      }

      toast({ title: "Success", description: "Answer submitted successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-row min-h-screen bg-background p-8 gap-8">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Interview</h1>
            <p className="text-muted-foreground">
              Answer each question within the time limit. Your responses will be evaluated by AI.
            </p>
          </div>
        </div>

        <Card className="p-6">
          {!interview || interview.questions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-lg font-medium">Interview questions are being generated...</p>
              <p className="text-muted-foreground mt-2">Please wait while we prepare your questions.</p>
            </div>
          ) : Object.keys(interview.responses).length >= interview.questions.length ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium text-green-600">Interview Completed!</h3>
              <p className="text-muted-foreground mt-2">
                All questions have been answered. Your responses are being evaluated.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Question {Object.keys(interview.responses).length + 1} of {interview.questions.length}
                </div>
                {timeLeft !== null && (
                  <div className={`text-lg font-mono ${timeLeft <= 10 ? 'text-red-500' : 'text-primary'}`}>
                    {timeLeft}s
                  </div>
                )}
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-lg font-medium">
                  {interview.questions[Object.keys(interview.responses).length].text}
                </p>
              </div>

              <textarea
                className="w-full min-h-[150px] p-4 rounded-lg border focus:ring-2 focus:ring-primary text-foreground bg-background"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                // Allow the candidate to compose their answer before starting the timer.
                // Only disable while the answer is being submitted to avoid blocking input.
                disabled={submitting}
              />

              <div className="flex justify-end gap-4">
                {!timerActive && timeLeft !== 0 ? (
                  <Button onClick={startQuestion} disabled={submitting}>
                    Start Question
                  </Button>
                ) : (
                  <Button onClick={() => submitAnswer(false)} disabled={!answer.trim() || submitting || !timerActive}>
                    Submit Answer {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Previous Questions & Answers */}
          {interview && Object.keys(interview.responses).length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Previous Responses</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Your Answer</TableHead>
                    <TableHead>Submitted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(interview.responses).map(([qid, resp]) => {
                    const question = interview.questions.find(q => q.id === qid);
                    return (
                      <TableRow key={qid}>
                        <TableCell className="font-medium">{question?.text || 'Unknown Question'}</TableCell>
                        <TableCell>{resp.text}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(resp.submitted_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <div className="w-72">
        <RoleSidebar />
      </div>
    </div>
  );
}