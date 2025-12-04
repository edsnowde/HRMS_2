import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useRoutePersist } from '@/hooks/use-route-persist';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { RoleSidebar } from '@/components/RoleSidebar';

interface Applicant {
  _id?: string;
  application_id: string;
  candidate_id?: string;
  candidate_name: string;
  resume_url?: string;
  status?: string;
  match_score?: number;
  similarity_score?: number;  // Raw Pinecone similarity score
}

export default function PineconeScoring() {
  const { jobId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use route persistence
  useRoutePersist();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [topK, setTopK] = useState<number>(10);
  const pollAbortRef = useRef(false);
  const isPollingRef = useRef(false);

  // Handle page refresh and route persistence
  useEffect(() => {
    if (!jobId) return;
    // Store the current location in session storage
    sessionStorage.setItem('lastPineconeScoringPath', window.location.pathname);

    // If we have previously stored applicants for this job, restore them and do NOT auto-refresh.
    const storageKey = `pineconeApplicants:${jobId}`;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          setApplicants(parsed as Applicant[]);
          setLoading(false);
          // Do not auto-fetch; user wants to keep showing the same data until they refresh
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored applicants', e);
    }

    const fetchData = async () => {
      try {
        const resp: any = await apiClient.get(`/job/${jobId}`);
        const job = resp?.data;

        // If the job has an internal job_id field use that; otherwise fall back to the provided id
        const target = job && job.job_id ? job.job_id : jobId;
        await fetchApplicants(target);
      } catch (error) {
        console.error('Error fetching job data:', error);
        await fetchApplicants(jobId);
      }
    };

    fetchData();
  }, [jobId]);

  const fetchApplicants = async (targetJobId: string) => {
    if (!targetJobId) return;
    console.log("Fetching applicants for job:", targetJobId);
    setLoading(true);
    try {
      // Prefer job matches (these contain Pinecone similarity scores) so we show all
      // matches produced by the matching job. If no matches exist, fall back to stored applications.
      try {
        const matchesResp: any = await apiClient.get(`/job/matches/${targetJobId}`);
        console.log("Matches response:", matchesResp);
        
        // Extract matches array, handling both direct response and .data wrapper
        const matches = matchesResp?.matches || matchesResp?.data?.matches || [];
        console.log("Processing matches:", matches);

        if (matches && matches.length) {
          const mapped: Applicant[] = matches.map((m: any) => {
            // Prefer application-level data when available; otherwise use match metadata
            const application_id = m.application_id || m.applicationId;
            const candidate_id = m.candidate_id || m.candidateId;
            // Try to reuse existing applicant snapshot (restored from sessionStorage) to preserve original application IDs and names
            const existing = applicants.find((a: any) => (a.candidate_id && candidate_id && a.candidate_id === candidate_id) || (a.application_id && application_id && a.application_id === application_id));
            const final_application_id = application_id || (existing ? existing.application_id : undefined);
            const final_candidate_name = m.candidate_name || (existing ? existing.candidate_name : undefined) || candidate_id || 'Unknown';
            // Handle MongoDB number wrapper format - looking for similarity_score.$numberDouble first
            const rawScore = m.similarity_score?.$numberDouble ?? 
                           m.similarity_score ?? 
                           m.score?.$numberDouble ?? 
                           m.score ?? 
                           null;
            
            // Simplified score parsing since we're handling $numberDouble above
            const parseScore = (s: any) => {
              if (s == null) return null;
              if (typeof s === 'number') return s;
              if (typeof s === 'string') return Number(s);
              return null;
            };

            return normalizeApplicant({
              application_id: final_application_id,
              candidate_id: candidate_id,
              candidate_name: final_candidate_name,
              resume_url: m.resume_url || (existing ? existing.resume_url : ''),
              status: m.status || (existing ? existing.status : 'pending'),
              similarity_score: parseScore(rawScore),
              match_score: null
            });
          });

          setApplicants(mapped);
          // Persist the applicants so UI can be restored across reloads
          try {
            const storageKey = `pineconeApplicants:${targetJobId}`;
            sessionStorage.setItem(storageKey, JSON.stringify(mapped));
          } catch (e) {
            console.warn('Failed to persist applicants to sessionStorage', e);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log("No matches found or matches endpoint failed, falling back to applications", err);
      }

      // Fall back to applications endpoint if no matches
      try {
        const resp: any = await apiClient.get(`/job/jobs/${targetJobId}/applications`);
        console.log("Applications response:", resp);
        if (resp?.applications?.length) {
          const applicants = resp.applications.map((a: any) => {
            // Try to get similarity score from MongoDB format first
            const similarityScore = a.similarity_score?.$numberDouble ?? 
                                  a.similarity_score ??
                                  a.match_score?.$numberDouble ??
                                  a.match_score ?? 
                                  null;
            return normalizeApplicant({
              ...a,
              similarity_score: similarityScore ? Number(similarityScore) : null
            });
          });
          setApplicants(applicants);
          // Persist the fallback applicants as well
          try {
            const storageKey = `pineconeApplicants:${targetJobId}`;
            sessionStorage.setItem(storageKey, JSON.stringify(applicants));
          } catch (e) {
            console.warn('Failed to persist applicants to sessionStorage', e);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log("Applications endpoint failed", err);
      }

      setApplicants([]);
    } catch (error) {
      console.error('Failed to load applicants', error);
      toast({ title: 'Error', description: 'Failed to load applicants', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateTempId = () => `temp-${Math.random().toString(36).slice(2, 8)}`;

  const normalizeApplicant = (a: any): Applicant => {
    console.log("Normalizing applicant data:", a);

    // Generate consistent IDs
    const applicationId = a.application_id || a._id || a.id || generateTempId();
    const candidateId = a.candidate_id || a.candidateId || generateTempId();

    // Validate and clean data
    const applicant: Applicant = {
      _id: a._id || '',
      application_id: applicationId,
      candidate_id: candidateId,
      candidate_name: a.candidate_name || (a.candidate || {}).name || a.name || `Candidate ${candidateId}`,
      resume_url: a.gcs_resume_uri || a.resume_url || a.gcs_path || '',
      status: a.status || a.stage || 'pending',
      match_score: typeof a.ai_match_score === 'number' ? a.ai_match_score : null,
      similarity_score: typeof a.similarity_score === 'number' ? a.similarity_score : 
                       typeof a.match_score === 'number' ? a.match_score : null,
    };

    // Log validation
    if (!applicant.candidate_id) {
      console.warn(`Missing candidate_id for application ${applicant.application_id}`);
    }

    return applicant;
  };

  // Manual refresh handler
  // Poll for matches for a given job id until matches appear or we hit max attempts
  const pollForMatches = async (targetJobId: string, maxAttempts = 15, intervalMs = 2000) => {
    if (!targetJobId) return false;
    pollAbortRef.current = false;
    isPollingRef.current = true;
    setLoading(true);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (pollAbortRef.current) {
        // Polling was cancelled
        console.log('Polling cancelled');
        isPollingRef.current = false;
        setLoading(false);
        return false;
      }

      try {
        const matchesResp: any = await apiClient.get(`/job/matches/${targetJobId}`);
        const matches = Array.isArray(matchesResp?.matches)
          ? matchesResp.matches
          : Array.isArray(matchesResp?.data?.matches)
          ? matchesResp.data.matches
          : [];

        if (matches && matches.length) {
          // We have matches — fetch and show them
          await fetchApplicants(targetJobId);
          toast({ title: 'Matches Ready', description: `Found ${matches.length} matches`, duration: 3000 });
          pollAbortRef.current = false;
          isPollingRef.current = false;
          return true;
        }
      } catch (err) {
        // Continue retrying; don't fail fast
        console.log(`Poll attempt ${attempt} failed for ${targetJobId}`, err);
      }

      // Wait before next attempt
      await new Promise((res) => setTimeout(res, intervalMs));
    }

    isPollingRef.current = false;
    setLoading(false);
    // toast({ title: 'No matches yet', description: 'No matches were found within the polling window', variant: 'warning' });
    return false;
  };

  // Manual refresh handler — starts or cancels polling
  const handleRefresh = async () => {
    if (!jobId) return;

    // If a poll is already running, clicking Refresh will cancel it
    if (isPollingRef.current) {
      pollAbortRef.current = true;
      toast({ title: 'Cancelled', description: 'Auto-refresh cancelled' });
      return;
    }

    // Decide which ID to poll: prefer matchingJobId returned by the last scoring run
    const target = matchingJobId || jobId;

    toast({ title: 'Auto-refresh started', description: 'Polling for matches until available...', duration: 3000 });
    // Start polling — this sets loading state internally
    await pollForMatches(target);
  };

  const handleRunScoring = async () => {
    if (!jobId) return;
    setScoring(true);
    try {
      // Start matching. The server returns a matching job id which contains the actual matches
      const resp: any = await apiClient.post(`/job/${jobId}/match?top_k=${topK}`);
  const matchingJobId = resp?.data?.job_id || resp?.job_id || resp?.data?.jobId || null;
  // store the returned matching job id so the Refresh button can poll it
  if (matchingJobId) setMatchingJobId(matchingJobId);

      toast({
        title: 'Scoring Started',
        description: 'Matching job started. Refreshing results shortly...',
        duration: 5000
      });

      // Fetch matches for the matching job (if provided) after a short delay to allow processing
      const fetchTarget = matchingJobId || jobId;
      setTimeout(() => fetchApplicants(fetchTarget), 2000);
    } catch (error) {
      console.error('Scoring error', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to start scoring', 
        variant: 'destructive' 
      });
    } finally {
      setScoring(false);
    }
  };

  const toggleSelect = (applicationId: string) => {
    setSelected((prev) => ({ ...prev, [applicationId]: !prev[applicationId] }));
  };

  const handleSendForInterview = async () => {
    const selectedIds = Object.keys(selected).filter((id) => selected[id]);
    if (selectedIds.length === 0) {
      toast({ title: 'No selection', description: 'Please select one or more candidates' });
      return;
    }

    try {
      for (const appId of selectedIds) {
        try {
          await apiClient.post(`/application/${appId}/interview/start`, {
            num_questions: 4,
            time_per_question_seconds: 60,
          });
        } catch (e) {
          console.warn('Interview start failed for', appId, e);
        }

        try {
          await apiClient.post(`/application/${appId}/status`, {
            status: 'shortlisted',
            actor_uid: user?.id || 'system',
            comment: 'Sent for AI interview',
          });
        } catch (e) {
          console.warn('Status update failed for', appId, e);
        }
      }

      toast({ title: 'Success', description: 'Selected candidates sent for AI interview' });
      fetchApplicants(jobId);
      setSelected({});
    } catch (error) {
      console.error('Failed to send for interview', error);
      toast({
        title: 'Error',
        description: 'Failed to send candidates for interview',
        variant: 'destructive',
      });
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
      {/* Left Section - Main Content */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pinecone AI Shortlisting</h1>
            <p className="text-muted-foreground">
              Analyze candidates who applied for this job using Pinecone embeddings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={5}
              max={100}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-24"
            />
            <Button onClick={handleRunScoring} disabled={scoring}>
              {scoring ? 'Scoring...' : 'Run AI Scoring'}
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              disabled={scoring}
            >
              Refresh Scores
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Application ID</TableHead>
                <TableHead>Resume</TableHead>
                <TableHead>AI Match Score</TableHead>
                <TableHead>Pinecone Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No applicants found
                  </TableCell>
                </TableRow>
              )}

              {applicants.map((app) => (
                <TableRow key={app.application_id}>
                  <TableCell>
                    <div className="font-medium">{app.candidate_name}</div>
                    <div className="text-sm text-gray-500">{app.candidate_id || '-'}</div>
                  </TableCell>
                  <TableCell>{app.application_id}</TableCell>
                  <TableCell>
                    {app.resume_url ? (
                      <a
                        href={app.resume_url.replace('gs://', 'https://storage.googleapis.com/')}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        View
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {typeof app.match_score === 'number' ? (
                      <Badge
                        className={
                          app.match_score >= 0.8
                            ? 'bg-emerald-500'
                            : app.match_score >= 0.6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }
                      >
                        {(app.match_score * 100).toFixed(0)}%
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not Scored</span>
                    )}
                  </TableCell>
                  <TableCell>
                      {typeof app.similarity_score === 'number' ? (
                        <Badge variant="secondary" className="font-medium text-black">
                          {app.similarity_score.toFixed(4)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                  </TableCell>
                  <TableCell>
                    <Badge>{app.status || 'applied'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="checkbox"
                      checked={!!selected[app.application_id]}
                      onChange={() => toggleSelect(app.application_id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {Object.values(selected).some(Boolean) && (
            <div className="flex justify-end mt-4">
              <Button variant="default" onClick={handleSendForInterview}>
                Send for AI Interview
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Right Section - Role Sidebar */}
      <div className="w-72">
        <RoleSidebar />
      </div>
    </div>
  );
}
