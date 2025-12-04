import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Application } from '@/types/application';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import ResumeUpload from '@/components/ResumeUpload';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { useApplications } from '@/contexts/ApplicationContext';

// Form validation schema
const applicationSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Valid phone number is required"),
  cover_letter: z.string().min(100, "Cover letter should be at least 100 characters"),
  resume: z.any().refine((file) => file !== null, "Resume is required")
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function ApplicationForm() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setActiveApplication } = useApplications();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Initialize form
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      cover_letter: '',
      resume: null
    }
  });

  // Load job details
  React.useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const response = await apiClient.get(`/api/jobs/${jobId}`);
        setJobDetails(response.data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load job details",
          variant: "destructive"
        });
      }
    };
    
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  // Handle form submission
  const onSubmit = async (data: ApplicationFormData) => {
    if (!jobId || !resumeFile) return;
    
    setIsSubmitting(true);
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('job_id', jobId);
      formData.append('full_name', data.full_name);
      formData.append('email', data.email);
      formData.append('phone', data.phone);
      formData.append('cover_letter', data.cover_letter);
      
      // Submit application
      const response = await apiClient.post<Application>('/api/applications/apply', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Transform the status to match ApplicationContext status type
      const transformedApplication = {
        ...response.data,
        status: 'pending' as const // Initial status when application is submitted
      };
      
      toast({
        title: "Success",
        description: "Your application has been submitted successfully!"
      });
      
      // Redirect to application status page
      // Store application for tracking
      setActiveApplication(transformedApplication);
      
      navigate(`/candidate/applications/${response.data.id}`);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to submit application",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle resume upload
  const handleResumeUpload = (file: File) => {
    setResumeFile(file);
    form.setValue('resume', file);
  };

  if (!jobDetails) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{jobDetails.title}</h1>
          <p className="text-gray-600">{jobDetails.company}</p>
          <div className="flex gap-2 mt-2">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">
              {jobDetails.location}
            </span>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">
              {jobDetails.type}
            </span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cover_letter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Letter</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us why you're interested in this role..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resume"
              render={() => (
                <FormItem>
                  <FormLabel>Resume</FormLabel>
                  <FormControl>
                    <ResumeUpload
                      onFileSelect={handleResumeUpload}
                      acceptedFileTypes={['.pdf', '.doc', '.docx']}
                      maxFileSize={5 * 1024 * 1024} // 5MB
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}