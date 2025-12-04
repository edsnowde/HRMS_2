import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { Upload, FileText, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../lib/apiClient';

interface CandidateProfileFormProps {
  onComplete?: () => void;
}

export const CandidateProfileForm = ({ onComplete }: CandidateProfileFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    skills: [''],
    experience: 0,
    education: ''
  });
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      setResumeFile(file);
    }
  };

  const handleAddSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, '']
    }));
  };

  const handleRemoveSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const handleSkillChange = (index: number, value: string) => {
    setFormData(prev => {
      const newSkills = [...prev.skills];
      newSkills[index] = value;
      return {
        ...prev,
        skills: newSkills
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    try {
      // First create the profile
      const profile = await apiClient.createCandidateProfile({
        ...formData,
        skills: formData.skills.filter(s => s.trim() !== '')
      });

      // If we have a resume, upload it
      if (resumeFile) {
        await apiClient.uploadResume(resumeFile);
        toast.success('Resume uploaded successfully');
      }

      toast.success('Profile created successfully!');
      onComplete?.();
    } catch (error: any) {
      toast.error('Failed to create profile: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Professional Details</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Skills</label>
            {formData.skills.map((skill, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => handleSkillChange(index, e.target.value)}
                  placeholder="e.g., JavaScript"
                  className="flex-1 glass px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(index)}
                  className="p-2 glass rounded-lg hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddSkill}
              className="text-sm text-primary hover:text-primary/80"
            >
              + Add Another Skill
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Years of Experience</label>
            <input
              type="number"
              min="0"
              value={formData.experience}
              onChange={(e) => setFormData(prev => ({ ...prev, experience: parseInt(e.target.value) || 0 }))}
              className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Education</label>
            <textarea
              value={formData.education}
              onChange={(e) => setFormData(prev => ({ ...prev, education: e.target.value }))}
              rows={3}
              className="w-full glass px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Enter your educational background..."
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resume Upload</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 glass border-2 border-primary/30 border-dashed rounded-lg cursor-pointer hover:bg-primary/5">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {resumeFile ? (
                  <>
                    <Check className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm">{resumeFile.name}</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-primary/60" />
                    <p className="mb-2 text-sm"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PDF files only</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <GlassButton
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Creating Profile...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Create Profile
            </>
          )}
        </GlassButton>
      </div>
    </form>
  );
};