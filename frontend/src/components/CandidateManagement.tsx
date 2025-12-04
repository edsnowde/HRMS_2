import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye,
  Calendar,
  MapPin,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../lib/apiClient";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  experience_years?: number;
  skills: string[];
  resume_url?: string;
  created_at: string;
  status: 'active' | 'inactive' | 'hired';
  last_activity?: string;
}

export default function CandidateManagement() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchCandidates();
  }, [currentPage]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCandidates(currentPage, 10);
      setCandidates(response.candidates || []);
      setTotalPages(response.total_pages || 1);
    } catch (error: any) {
      toast.error('Failed to fetch candidates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    try {
      await apiClient.deleteCandidate(candidateId);
      toast.success('Candidate deleted successfully');
      fetchCandidates();
    } catch (error: any) {
      toast.error('Failed to delete candidate: ' + error.message);
    }
  };

  const handleViewResume = async (candidateId: string) => {
    try {
      const candidate = await apiClient.getCandidate(candidateId);
      if (candidate.resume_url) {
        window.open(candidate.resume_url, '_blank');
      } else {
        toast.error('Resume not available');
      }
    } catch (error: any) {
      toast.error('Failed to fetch resume: ' + error.message);
    }
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === "all" || candidate.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

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
          <h2 className="text-2xl font-bold mb-2">Candidate Management</h2>
          <p className="text-muted-foreground">
            Manage and review candidate profiles
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {candidates.length} candidates
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search candidates by name, email, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full glass pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="hired">Hired</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Candidates List */}
      <div className="grid gap-4">
        {filteredCandidates.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No candidates found</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterStatus !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "No candidates have been uploaded yet"
              }
            </p>
          </GlassCard>
        ) : (
          filteredCandidates.map((candidate) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold">{candidate.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        candidate.status === 'active' ? 'bg-green-500/20 text-green-500' :
                        candidate.status === 'hired' ? 'bg-blue-500/20 text-blue-500' :
                        'bg-gray-500/20 text-gray-500'
                      }`}>
                        {candidate.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <span>{candidate.email}</span>
                        </div>
                        {candidate.phone && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>{candidate.phone}</span>
                          </div>
                        )}
                        {candidate.location && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{candidate.location}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {candidate.experience_years && (
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Briefcase className="w-4 h-4" />
                            <span>{candidate.experience_years} years experience</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Added {formatDate(candidate.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {candidate.skills.slice(0, 8).map((skill, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.skills.length > 8 && (
                            <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md">
                              +{candidate.skills.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {candidate.resume_url && (
                      <GlassButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewResume(candidate.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </GlassButton>
                    )}
                    <GlassButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCandidate(candidate.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <GlassButton
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </GlassButton>
          <span className="flex items-center px-4 py-2 text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <GlassButton
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </GlassButton>
        </div>
      )}
    </div>
  );
}
