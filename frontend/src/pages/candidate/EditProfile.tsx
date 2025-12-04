import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/GlassCard';
import { GlassButton } from '@/components/GlassButton';
import { RoleSidebar } from '@/components/RoleSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { candidateApi, ProfileFormData } from '@/lib/candidateApi';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { register, handleSubmit, setValue, watch } = useForm<ProfileFormData>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidateProfile', user?.id],
    queryFn: () => candidateApi.getCandidate(user!.id),
    enabled: !!user?.id,
  });

  React.useEffect(() => {
    if (profile) {
      // Pre-fill form with existing data
      setValue('name', profile.name);
      setValue('email', profile.email);
      setValue('location', profile.location);
      setValue('summary', profile.summary);
      setValue('skills', profile.skills);
      setValue('experience', profile.experience || []);
    }
  }, [profile, setValue]);

  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormData) => candidateApi.updateCandidateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      navigate('/candidate/profile');
    },
    onError: (error: Error | any) => {
      toast.error(error.response?.data?.message || error.message || 'Failed to update profile');
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <RoleSidebar />
      
      <main className="p-8 md:pr-72">
        <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <GlassCard className="p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Full Name
                </label>
                <input
                  {...register('name')}
                  id="name"
                  type="text"
                  className="w-full glass px-4 py-2 rounded-xl"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  className="w-full glass px-4 py-2 rounded-xl"
                  required
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-2">
                  Location
                </label>
                <input
                  {...register('location')}
                  id="location"
                  type="text"
                  className="w-full glass px-4 py-2 rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="summary" className="block text-sm font-medium mb-2">
                  Professional Summary
                </label>
                <textarea
                  {...register('summary')}
                  id="summary"
                  rows={4}
                  className="w-full glass px-4 py-2 rounded-xl resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {watch('skills')?.map((skill: string, index: number) => (
                    <div
                      key={index}
                      className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm flex items-center gap-2"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const skills = watch('skills').filter((_, i) => i !== index);
                          setValue('skills', skills);
                        }}
                        className="text-primary hover:text-primary/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    placeholder="Add skill..."
                    className="glass px-3 py-1 rounded-full text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const skill = input.value.trim();
                        if (skill) {
                          const skills = watch('skills') || [];
                          setValue('skills', [...skills, skill]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold mb-4">Work Experience</h2>
            <div className="space-y-6">
              {watch('experience')?.map((_, index) => (
                <div key={index} className="space-y-4 pb-6 border-b border-border/50 last:border-0">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Job Title
                    </label>
                    <input
                      {...register(`experience.${index}.role`)}
                      type="text"
                      className="w-full glass px-4 py-2 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Company
                    </label>
                    <input
                      {...register(`experience.${index}.company`)}
                      type="text"
                      className="w-full glass px-4 py-2 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Start Date
                      </label>
                      <input
                        {...register(`experience.${index}.startDate`)}
                        type="date"
                        className="w-full glass px-4 py-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        End Date
                      </label>
                      <input
                        {...register(`experience.${index}.endDate`)}
                        type="date"
                        className="w-full glass px-4 py-2 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <textarea
                      {...register(`experience.${index}.description`)}
                      rows={3}
                      className="w-full glass px-4 py-2 rounded-xl resize-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const exp = watch('experience').filter((_, i) => i !== index);
                      setValue('experience', exp);
                    }}
                    className="text-destructive hover:text-destructive/80 text-sm"
                  >
                    Remove Entry
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const exp = watch('experience') || [];
                  setValue('experience', [
                    ...exp,
                    { role: '', company: '', startDate: '', description: '' },
                  ]);
                }}
                className="text-primary hover:text-primary/80 text-sm"
              >
                + Add Experience
              </button>
            </div>
          </GlassCard>

          <div className="flex gap-4">
            <GlassButton type="submit" variant="primary" className="flex-1">
              Save Changes
            </GlassButton>
            <GlassButton
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Cancel
            </GlassButton>
          </div>
        </form>
      </main>
    </div>
  );
}