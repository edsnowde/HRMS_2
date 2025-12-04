import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { Button } from "./ui/button";
import { FileText, Video, Download, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export interface FileViewerProps {
  resumeUrl?: string;
  videoUrl?: string;
  candidateName: string;
}

export const FileViewer = ({ resumeUrl, videoUrl, candidateName }: FileViewerProps) => {
  const [showResume, setShowResume] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>('');

  // Get a signed URL when showing the resume
  const handleShowResume = async () => {
    if (!resumeUrl) return;
    
    try {
      // Convert gs:// URL to signed URL via backend
      const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(resumeUrl)}`);
      const data = await response.json();
      setSignedUrl(data.url);
      setShowResume(true);
    } catch (error) {
      console.error('Failed to get signed URL:', error);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const downloadUrl = url.startsWith('gs://') 
        ? await fetch(`/api/storage/signed-url?path=${encodeURIComponent(url)}`).then(r => r.json()).then(d => d.url)
        : url;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {resumeUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResume(true)}
            className="glass border-primary/30"
          >
            <FileText className="w-4 h-4 mr-2" />
            View Resume
          </Button>
        )}
        {videoUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVideo(true)}
            className="glass border-primary/30"
          >
            <Video className="w-4 h-4 mr-2" />
            View Video
          </Button>
        )}
      </div>

      <Dialog open={showResume} onOpenChange={setShowResume}>
        <DialogContent className="max-w-4xl max-h-[90vh] glass">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{candidateName}'s Resume</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadFile(resumeUrl!, `${candidateName}-resume.pdf`)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh]">
            {signedUrl ? (
              <iframe
                src={signedUrl}
                className="w-full h-[70vh] rounded-lg"
                title="Resume"
              />
            ) : (
              <div className="p-4 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Loading resume...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVideo} onOpenChange={setShowVideo}>
        <DialogContent className="max-w-4xl glass">
          <DialogHeader>
            <DialogTitle>{candidateName}'s Introduction Video</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            <video
              src={videoUrl}
              controls
              className="w-full h-full rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
