"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UploadCloud, File, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

export default function StudentSubmissionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }
    setFile(file);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(0);

    try {
      // 1. Get signature from our secure backend
      const sigRes = await fetch('/api/upload/signature', { method: 'POST' });
      if (!sigRes.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, cloudName, apiKey } = await sigRes.json();

      // 2. Prepare FormData for Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      formData.append('folder', 'lms-uploads');

      // 3. Upload directly to Cloudinary via XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          // Here you would save response.secure_url to your database
          console.log('File available at:', response.secure_url);
          setFile(null);
          toast({ title: "Success", description: "Assignment submitted successfully.", variant: "success" });
        } else {
          throw new Error('Upload failed');
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        throw new Error('Upload error');
      };

      xhr.send(formData);

    } catch (err: any) {
      setIsUploading(false);
      toast({ title: "Error", description: err.message || "Failed to upload file.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Submissions</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Upload your assignments and projects.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border border-warning bg-warning/5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning" />
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-brand-900 text-sm">Physics Project Report</h4>
                  <p className="text-xs text-stone-500 mt-1">Due: Tomorrow, 11:59 PM</p>
                </div>
                <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-warning text-white rounded">
                  Pending
                </span>
              </div>
            </div>
            
            <div className="p-4 rounded-lg border border-border bg-surface">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-brand-900 text-sm">English Essay</h4>
                  <p className="text-xs text-stone-500 mt-1">Due: Friday, 05:00 PM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Submission</CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-stone-50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} />
                <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                  <UploadCloud className="h-6 w-6 text-brand-600" />
                </div>
                <h3 className="text-sm font-semibold text-brand-900">Click to upload or drag and drop</h3>
                <p className="text-xs text-stone-500 mt-1">PDF, DOCX up to 5MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-brand-200 bg-brand-50">
                  <div className="flex items-center gap-3">
                    <File className="h-8 w-8 text-brand-600" />
                    <div>
                      <p className="text-sm font-semibold text-brand-900 line-clamp-1">{file.name}</p>
                      <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isUploading && (
                    <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="text-stone-500 hover:text-danger hover:bg-danger/10">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {isUploading ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-brand-900">
                      <span>Uploading...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600 transition-all duration-200" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <Button className="w-full" onClick={handleUpload}>
                    Submit Assignment
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-stone-50/50">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-semibold text-brand-900 text-sm">Mathematics Assignment 3</p>
              <p className="text-xs text-stone-500">Submitted 2 days ago</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
