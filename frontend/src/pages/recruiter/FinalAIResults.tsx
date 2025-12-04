// Improved UI for "View" section without changing logic
// Only reorganized layout inside <details> for better readability

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { RoleSidebar } from '@/components/RoleSidebar';

interface FinalApp {
  _id?: string;
  application_id: string;
  candidate_id?: string;
  candidate_name: string;
  candidate_email?: string;
  resume_url?: string;
  status?: string;
  ai_match_score?: number | null;
  pinecone_similarity_score?: number | null;
  pinecone_metadata?: any;
  gemini_questions?: any[];
  gemini_answers?: any[];
}

export default function FinalAIResults() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [apps, setApps] = useState<FinalApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      toast({ title: 'Error', description: 'Job ID missing', variant: 'destructive' });
      return;
    }
    const storageKey = `finalAIResults:${jobId}`;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          setApps(parsed);
          setLoading(false);
          fetchFinalResults(jobId);
          return;
        }
      }
    } catch {}

    fetchFinalResults(jobId);
  }, [jobId]);

  const fetchFinalResults = async (targetJobId: string) => {
    setLoading(true);
    try {
      const resp: any = await apiClient.get(`/job/jobs/${targetJobId}/final-results`);
      let data = [] as any[];
      if (Array.isArray(resp)) data = resp;
      else if (Array.isArray(resp?.applications)) data = resp.applications;
      else if (Array.isArray(resp?.data?.applications)) data = resp.data.applications;
      else if (Array.isArray(resp?.data)) data = resp.data;

      const mapped: FinalApp[] = (data || []).map((a: any) => ({
        _id: a._id || a.application_id || '',
        application_id: a.application_id || a._id || 'unknown',
        candidate_id: a.candidate_id || a.candidateId || '',
        candidate_name: a.candidate_name || a.candidate || a.name || 'Unknown',
        candidate_email: a.candidate_email || a.email || '',
        resume_url: a.gcs_resume_uri || a.resume_url || (a.pinecone_metadata && a.pinecone_metadata.gcs_resume_uri) || '',
        status: a.status || a.stage || 'pending',
        ai_match_score: a.ai_match_score ?? a.match_score ?? null,
        pinecone_similarity_score: a.pinecone_similarity_score ?? (a.match_score ?? null),
        pinecone_metadata: a.pinecone_metadata || null,
        gemini_questions: a.gemini_questions || [],
        gemini_answers: a.gemini_answers || []
      }));

      setApps(mapped);
      try { sessionStorage.setItem(`finalAIResults:${targetJobId}`, JSON.stringify(mapped)); } catch {}
    } catch (err) {
      console.error('Failed to fetch final results', err);
      toast({ title: 'Error', description: 'Failed to load final AI results', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionText = (q: any) => {
    try {
      if (!q) return 'No text';
      if (typeof q === 'string') return q;
      if (typeof q.text === 'string' && q.text.trim()) return q.text;
      if (typeof q.question === 'string' && q.question.trim()) return q.question;
      if (q.expires_at && !q.text && !q.question) return '[Generated question — text missing]';
      return JSON.stringify(q);
    } catch {
      return 'Invalid question';
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
            <h1 className="text-2xl font-bold">Final AI Results</h1>
            <p className="text-muted-foreground">Full candidate review: Pinecone metadata, Gemini Q&A and scores.</p>
          </div>
          <Button onClick={() => fetchFinalResults(jobId || '')}>Refresh</Button>
        </div>

        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Application ID</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>AI Match Score</TableHead>
                <TableHead>Pinecone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">No results found</TableCell>
                </TableRow>
              )}

              {apps.map((app) => (
                <React.Fragment key={app.application_id}>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">{app.candidate_name}</div>
                      <div className="text-sm text-gray-500">{app.candidate_id || '-'}</div>
                    </TableCell>

                    <TableCell>{app.application_id}</TableCell>

                    <TableCell>
                      {app.resume_url ? (
                        <a href={app.resume_url.replace('gs://', 'https://storage.googleapis.com/')} target="_blank" rel="noreferrer" className="text-primary underline">View</a>
                      ) : '-'}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {typeof app.ai_match_score === 'number' ? (
                          <Badge className="font-medium text-black">AI: {app.ai_match_score.toFixed(2)}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">AI: -</span>
                        )}

                        {typeof app.pinecone_similarity_score === 'number' ? (
                          <Badge className="font-medium text-black">Pinecone: {app.pinecone_similarity_score.toFixed(4)}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Pinecone: -</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {app.pinecone_metadata ? (
                        <div className="text-sm">
                          <div>Skills: {(app.pinecone_metadata.skills || []).slice(0,5).join(', ')}</div>
                          <div>Exp: {app.pinecone_metadata.experience ?? '-'}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge>{app.status || 'applied'}</Badge>
                    </TableCell>

                    {/* IMPROVED UI INSIDE DETAILS */}
                    <TableCell className="text-right">
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">View</summary>

                        <div className="mt-3 p-4 bg-muted/20 rounded-lg border space-y-6 text-left max-h-[500px] overflow-auto">

                          {/* -------------------- SECTION 1: PINECONE METADATA -------------------- */}
                          <section>
                            <h3 className="font-semibold text-base mb-2">📌 Pinecone Metadata</h3>
                            <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-3 rounded border">{JSON.stringify(app.pinecone_metadata || {}, null, 2)}</pre>
                          </section>

                          {/* -------------------- SECTION 2: GEMINI QUESTIONS & ANSWERS -------------------- */}
                          <section>
                            <h3 className="font-semibold text-base mb-2">💬 Gemini Questions & Answers</h3>

                            {app.gemini_questions && app.gemini_questions.length ? (
                              <div className="space-y-4">
                                {app.gemini_questions.map((q: any, idx: number) => {
                                  const qid = q.qid || `q${idx+1}`;
                                  const answerObj = (app.gemini_answers || []).find((a: any) => {
                                    return a?.qid === qid || a?.question === (q.text || q.question) || a?.answer_qid === qid;
                                  });

                                  const getAnswerText = (a: any) => a?.answer || a?.answer_text || a?.response || '-';

                                  const formatDate = (d: any) => {
                                    try {
                                      if (!d) return '-';
                                      if (typeof d === 'string') return d;
                                      if (d?.$date) {
                                        const ms = Number(d.$date.$numberLong ?? d.$date);
                                        if (!Number.isNaN(ms)) return new Date(ms).toLocaleString();
                                      }
                                      if (typeof d === 'number') return new Date(d).toLocaleString();
                                      return new Date(d).toLocaleString();
                                    } catch {
                                      return String(d);
                                    }
                                  };

                                  return (
                                    <div key={idx} className="p-3 bg-muted/10 rounded-lg">
                                      <div className="font-medium">{qid}: {renderQuestionText(q)}</div>
                                      {answerObj ? (
                                        <div className="text-xs mt-1">
                                          <div className="text-muted-foreground">Answer: {getAnswerText(answerObj)}</div>
                                          <div className="text-muted-foreground">Submitted: {formatDate(answerObj.submitted_at || answerObj.submittedAt || answerObj.submitted)}</div>
                                          <div className="text-muted-foreground">Evaluated: {formatDate(answerObj.evaluated_at || answerObj.evaluatedAt || answerObj.evaluated)}</div>
                                          <div className="text-muted-foreground">Score: {answerObj.score ?? (answerObj.feedback?.score ?? '-')}</div>
                                          <div className="mt-1">Feedback:</div>
                                          <pre className="whitespace-pre-wrap text-xs bg-muted/10 p-2 rounded mt-1">{JSON.stringify(answerObj.feedback ?? answerObj, null, 2)}</pre>
                                        </div>
                                      ) : (
                                        <div className="text-muted-foreground">Not answered</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No generated questions</div>
                            )}
                          </section>

                          {/* -------------------- SECTION 3: RAW APPLICATION JSON -------------------- */}
                          <section>
                            <h3 className="font-semibold text-base mb-2">🗂️ Full Application JSON</h3>
                            <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-3 rounded border">{JSON.stringify(app, null, 2)}</pre>
                          </section>

                        </div>
                      </details>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="w-72">
        <RoleSidebar />
      </div>
    </div>
  );
}
