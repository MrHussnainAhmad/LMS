"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, UploadCloud, X } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type AssignmentItem = {
  id: number;
  title: string;
  description: string | null;
  dueAtLabel: string;
  subjectName: string | null;
  submittedFileKey: string | null;
};

export function SubmissionsClient({ assignments }: { assignments: AssignmentItem[] }) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(assignments[0]?.id || null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId);

  const validateAndSetFile = (nextFile: File) => {
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }
    if (!ALLOWED_UPLOAD_MIMES.has(nextFile.type)) {
      toast({ title: "Unsupported file", description: "Upload PDF, DOCX, JPG, PNG, or WEBP files only.", variant: "destructive" });
      return;
    }
    setFile(nextFile);
  };

  const handleUpload = async () => {
    if (!file || !selectedAssignmentId) return;
    setIsUploading(true);
    setProgress(0);

    try {
      const sigRes = await fetch("/api/upload/signature", { method: "POST" });
      if (!sigRes.ok) throw new Error("Failed to get upload signature");
      const signaturePayload = await sigRes.json();
      if (!signaturePayload.signature || !signaturePayload.timestamp || !signaturePayload.cloudName || !signaturePayload.apiKey) {
        throw new Error(signaturePayload.error || "Upload service is not configured");
      }
      const { signature, timestamp, cloudName, apiKey } = signaturePayload;

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("api_key", apiKey);
      uploadData.append("timestamp", timestamp.toString());
      uploadData.append("signature", signature);
      uploadData.append("folder", "lms-uploads");

      const cloudinaryResponse = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload error"));
        xhr.send(uploadData);
      });

      const saveRes = await fetch("/api/student/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          fileKey: cloudinaryResponse.public_id,
        }),
      });

      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save submission");
      }

      setFile(null);
      toast({ title: "Success", description: "Assignment submitted successfully.", variant: "success" });
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload file.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Class Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length === 0 ? (
            <p className="text-sm text-stone-500">No assignment has been created for your class yet.</p>
          ) : (
            assignments.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                onClick={() => {
                  setSelectedAssignmentId(assignment.id);
                  setFile(null);
                }}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  assignment.id === selectedAssignmentId ? "border-brand-500 bg-brand-50" : "border-border bg-surface hover:bg-stone-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-brand-950 text-sm">{assignment.title}</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {assignment.subjectName || "General"} - Due {assignment.dueAtLabel}
                    </p>
                    {assignment.description && <p className="text-sm text-stone-600 mt-2">{assignment.description}</p>}
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${
                    assignment.submittedFileKey ? "bg-success text-white" : "bg-warning text-white"
                  }`}>
                    {assignment.submittedFileKey ? "Submitted" : "Pending"}
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Submission</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedAssignment ? (
            <p className="text-sm text-stone-500">Select an assignment to upload.</p>
          ) : !file ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-stone-50 transition-colors cursor-pointer"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedFile = event.dataTransfer.files[0];
                if (droppedFile) validateAndSetFile(droppedFile);
              }}
              onClick={() => document.getElementById("assignment-file-upload")?.click()}
            >
              <input
                id="assignment-file-upload"
                type="file"
                accept=".pdf,.docx,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (selectedFile) validateAndSetFile(selectedFile);
                }}
              />
              <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                <UploadCloud className="h-6 w-6 text-brand-600" />
              </div>
              <h3 className="text-sm font-semibold text-brand-900">Click to upload or drag and drop</h3>
              <p className="text-xs text-stone-500 mt-1">PDF, DOCX or image up to 5MB</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-brand-200 bg-brand-50">
                <div className="flex items-center gap-3 min-w-0">
                  <File className="h-8 w-8 text-brand-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-900 truncate">{file.name}</p>
                    <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!isUploading && (
                  <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
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
                  Submit {selectedAssignment.title}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
