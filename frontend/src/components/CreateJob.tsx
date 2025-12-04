import React, { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Calendar,
  Users,
  FileText,
  Plus,
  Save
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../lib/apiClient";

interface JobFormData {
  title: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  experience_required: number;
  location?: string;
  salary_range?: string;
  employment_type: 'full-time' | 'part-time' | 'contract' | 'internship';
  department?: string;
}

export default function CreateJob() {
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    description: '',
    requirements: [],
    skills_required: [],
    experience_required: 0,
    location: '',
    salary_range: '',
    employment_type: 'full-time',
    department: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof JobFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.description || formData.requirements.length === 0 || formData.skills_required.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const jobData = {
        ...formData,
        experience_required: Number(formData.experience_required) || 0
      };

      const result = await apiClient.createJob(jobData);
      toast.success('Job created successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        requirements: [],
        skills_required: [],
        experience_required: 0,
        location: '',
        salary_range: '',
        employment_type: 'full-time',
        department: ''
      });
    } catch (error: any) {
      toast.error('Failed to create job: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Create New Job</h2>
        <p className="text-muted-foreground">
          Post a new job opening and start finding the right candidates
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Briefcase className="w-5 h-5 mr-2" />
            Basic Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Job Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder="e.g., Engineering"
                className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="e.g., San Francisco, CA"
                  className="w-full glass pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Salary Range
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.salary_range}
                  onChange={(e) => handleInputChange('salary_range', e.target.value)}
                  placeholder="e.g., $100,000 - $150,000"
                  className="w-full glass pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Job Details */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Job Details
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Job Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the role, responsibilities, and what makes this opportunity unique..."
                rows={6}
                className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Requirements *
              </label>
              <div className="space-y-2">
                {formData.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={req}
                      onChange={(e) => {
                        const newReqs = [...formData.requirements];
                        newReqs[index] = e.target.value;
                        handleInputChange('requirements', newReqs);
                      }}
                      className="w-full glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newReqs = formData.requirements.filter((_, i) => i !== index);
                        handleInputChange('requirements', newReqs);
                      }}
                      className="p-2 glass rounded-lg hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('requirements', [...formData.requirements, '']);
                  }}
                  className="flex items-center gap-2 px-4 py-2 glass rounded-lg hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Requirement
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Required Skills *
              </label>
              <div className="space-y-2">
                {formData.skills_required.map((skill, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => {
                        const newSkills = [...formData.skills_required];
                        newSkills[index] = e.target.value;
                        handleInputChange('skills_required', newSkills);
                      }}
                      className="w-full glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSkills = formData.skills_required.filter((_, i) => i !== index);
                        handleInputChange('skills_required', newSkills);
                      }}
                      className="p-2 glass rounded-lg hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange('skills_required', [...formData.skills_required, '']);
                  }}
                  className="flex items-center gap-2 px-4 py-2 glass rounded-lg hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4" />
                  Add Required Skill
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Salary & Type */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Compensation & Type
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Employment Type
              </label>
              <select
                value={formData.employment_type}
                onChange={(e) => handleInputChange('employment_type', e.target.value)}
                className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Years of Experience Required
              </label>
              <input
                type="number"
                value={formData.experience_required}
                onChange={(e) => handleInputChange('experience_required', parseInt(e.target.value) || 0)}
                min="0"
                step="1"
                className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </GlassCard>

        {/* Submit Button */}
        <div className="flex justify-center">
          <GlassButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="px-8 py-3"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Job...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Job Posting
              </>
            )}
          </GlassButton>
        </div>
      </form>
    </div>
  );
}
