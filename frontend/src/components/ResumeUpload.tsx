import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { GlassButton } from "./GlassButton";
import { FileText, Upload, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../lib/apiClient";

export interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message: string;
  progress?: number;
}

export interface ResumeUploadProps {
  onFileSelect: (file: File) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

export default function ResumeUpload({ 
  onFileSelect, 
  acceptedFileTypes = ['.pdf'],
  maxFileSize = 10 * 1024 * 1024 
}: ResumeUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    message: 'Select a resume file to upload'
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please select a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setUploadStatus({
        status: 'idle',
        message: `Selected: ${file.name}`
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus({
      status: 'uploading',
      message: 'Uploading resume...',
      progress: 0
    });

    try {
      const result = await apiClient.uploadResume(selectedFile);
      
      setUploadStatus({
        status: 'processing',
        message: 'Processing resume...',
        progress: 50
      });

      // Poll for status updates
      const pollStatus = async () => {
        try {
          const status = await apiClient.getResumeStatus(result.job_id);
          
          if (status.status === 'completed') {
            setUploadStatus({
              status: 'completed',
              message: 'Resume processed successfully!',
              progress: 100
            });
            toast.success('Resume uploaded and processed successfully!');
          } else if (status.status === 'failed') {
            setUploadStatus({
              status: 'error',
              message: 'Processing failed. Please try again.',
              progress: 0
            });
            toast.error('Resume processing failed');
          } else {
            // Still processing, poll again
            setTimeout(pollStatus, 2000);
          }
        } catch (error) {
          setUploadStatus({
            status: 'error',
            message: 'Error checking status',
            progress: 0
          });
        }
      };

      // Start polling after a short delay
      setTimeout(pollStatus, 1000);

    } catch (error: any) {
      setUploadStatus({
        status: 'error',
        message: error.message || 'Upload failed',
        progress: 0
      });
      toast.error('Upload failed: ' + error.message);
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <Clock className="w-8 h-8 text-blue-500 animate-spin" />;
      default:
        return <FileText className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus.status) {
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'uploading':
      case 'processing':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Upload Resume</h2>
        <p className="text-muted-foreground">
          Upload your resume to get started with job matching
        </p>
      </div>

      <GlassCard className="p-8">
        <div className="space-y-6">
          {/* File Selection */}
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {selectedFile ? selectedFile.name : 'Click to select resume'}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF files only, max 10MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile && (
              <div className="flex justify-center">
                <GlassButton
                  onClick={handleUpload}
                  disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                  variant="primary"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Resume
                </GlassButton>
              </div>
            )}
          </div>

          {/* Status Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3">
              {getStatusIcon()}
              <span className={`font-medium ${getStatusColor()}`}>
                {uploadStatus.message}
              </span>
            </div>

            {uploadStatus.progress !== undefined && uploadStatus.progress > 0 && (
              <div className="w-full bg-background/20 rounded-full h-2">
                <motion.div
                  className="bg-primary h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadStatus.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-background/10 rounded-lg p-4">
            <h3 className="font-medium mb-2">What happens next?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your resume will be parsed and analyzed</li>
              <li>• Skills and experience will be extracted</li>
              <li>• You'll be matched with relevant job opportunities</li>
              <li>• You can track your application status</li>
            </ul>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
