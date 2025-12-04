import React from 'react';
import { GlassCard } from './GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { GlassButton } from './GlassButton';
import { useNavigate } from 'react-router-dom';

interface CandidateProfileProps {
  candidateId?: string;
  showActions?: boolean;
}

export function CandidateProfile({ candidateId, showActions = true }: CandidateProfileProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const id = candidateId || user?.id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidateProfile', id],
    queryFn: () => apiClient.getCandidate(id!),
    enabled: !!id,
  });

  const { data: interviews } = useQuery({
    queryKey: ['candidateInterviews', id],
    queryFn: () => apiClient.getCandidateInterviews(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <p>Loading profile...</p>
      </GlassCard>
    );
  }

  if (!profile) {
    return (
      <GlassCard className="p-6">
        <p className="text-muted-foreground">Profile not found</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold">{profile.name}</h2>
            <p className="text-muted-foreground">{profile.email}</p>
            {profile.location && (
              <p className="text-sm text-muted-foreground mt-1">{profile.location}</p>
            )}
          </div>
          {profile.profileImage && (
            <img
              src={profile.profileImage}
              alt={profile.name}
              className="w-20 h-20 rounded-full"
            />
          )}
        </div>

        {profile.summary && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Professional Summary</h3>
            <p className="text-muted-foreground">{profile.summary}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-medium mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills?.map((skill: string) => (
                <span
                  key={skill}
                  className="px-2 py-1 text-sm rounded-md bg-primary/10 text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {profile.experience !== undefined && (
            <div>
              <h3 className="font-medium mb-3">Experience</h3>
              <div className="space-y-3">
                {Array.isArray(profile.experience) ? (
                  profile.experience.map((exp: any, index: number) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">{exp.role}</p>
                      {exp.company && (
                        <p className="text-muted-foreground">{exp.company}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {exp.startDate} - {exp.endDate || 'Present'}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-muted-foreground mt-1">{exp.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm">
                    <p className="font-medium">{profile.experience} years</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {interviews && interviews.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4">Interview History</h3>
          <div className="space-y-4">
            {interviews.map((interview: any) => (
              <div
                key={interview.id}
                className="p-4 rounded-lg border border-border/50 hover:bg-accent/5"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{interview.jobTitle}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(interview.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      interview.status === 'completed'
                        ? 'bg-green-500/10 text-green-500'
                        : interview.status === 'scheduled'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-yellow-500/10 text-yellow-500'
                    }`}
                  >
                    {interview.status}
                  </span>
                </div>
                {interview.feedback && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {interview.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {showActions && (
        <div className="flex gap-4 mt-6">
          {user?.role === 'recruiter' && (
            <>
              <GlassButton
                onClick={() => navigate(`/recruiter/screening/${id}`)}
                className="flex-1"
              >
                View AI Screening Results
              </GlassButton>
              <GlassButton
                onClick={() => navigate(`/recruiter/schedule/${id}`)}
                className="flex-1"
              >
                Schedule Interview
              </GlassButton>
            </>
          )}
          {user?.role === 'hr' && (
            <GlassButton
              onClick={() => navigate(`/hr/candidate/${id}/offer`)}
              className="flex-1"
            >
              Manage Offer
            </GlassButton>
          )}
          {user?.role === 'candidate' && id === user.id && (
            <>
              <GlassButton
                onClick={() => navigate('/candidate/edit-profile')}
                className="flex-1"
              >
                Edit Profile
              </GlassButton>
              <GlassButton
                onClick={() => navigate('/candidate/applications')}
                className="flex-1"
              >
                View Applications
              </GlassButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}