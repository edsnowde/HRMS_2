import React from "react";
import { useParams } from "react-router-dom";
import { CandidateProfile } from "@/components/CandidateProfile";
import { RoleSidebar } from "@/components/RoleSidebar";

export default function ViewCandidateProfile() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-8 text-center">
        Candidate Profile
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
        {/* Candidate Profile Section */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 shadow-lg">
          <CandidateProfile candidateId={id} />
        </div>

        {/* Sidebar */}
        <div className="hidden md:block">
          <RoleSidebar />
        </div>
      </div>
    </div>
  );
}
