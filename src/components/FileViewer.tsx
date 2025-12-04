import { useState } from "react";
import { GlassCard } from "./GlassCard";
import { Button } from "./ui/button";
import { FileText, Video, Download, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface FileViewerProps {
  resumeUrl?: string;
  videoUrl?: string;
  candidateName: string;
}

export const FileViewer = ({ resumeUrl, videoUrl, candidateName }: FileViewerProps) => {
  const [showResume, setShowResume] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
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
            {resumeUrl?.startsWith('data:application/pdf') ? (
              <iframe
                src={resumeUrl}
                className="w-full h-[70vh] rounded-lg"
                title="Resume"
              />
            ) : (
              <div className="p-4 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Resume preview not available</p>
                <Button onClick={() => downloadFile(resumeUrl!, `${candidateName}-resume.pdf`)}>
                  Download to View
                </Button>
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
