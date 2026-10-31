"use client";

import { useState } from "react";
import { File, LoaderCircle, UploadCloud, X } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { CONTENT_FILE_ACCEPT, prepareContentUpload, uploadPreparedContent } from "@/lib/client-upload-file";

export function ReferenceFileInput() {
  const [uploaded, setUploaded] = useState<{ name: string; key: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const upload = async (file: globalThis.File) => {
    setUploading(true);
    try {
      const preparedFile = await prepareContentUpload(file);
      const result = await uploadPreparedContent(preparedFile, "document");

      setUploaded({ name: file.name, key: result.public_id });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload the reference file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-stone-700">Reference File <span className="font-normal text-stone-500">(optional)</span></label>
      <input type="hidden" name="referenceFileKey" value={uploaded?.key || ""} />
      <input type="hidden" name="referenceFileName" value={uploaded?.name || ""} />
      {uploaded ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-brand-200 bg-brand-50 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <File className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="truncate text-sm text-brand-900">{uploaded.name}</span>
          </div>
          <button type="button" aria-label="Remove reference file" onClick={() => setUploaded(null)} className="text-stone-500 hover:text-stone-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm text-stone-600 hover:bg-stone-50 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
          {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? "Uploading..." : "Choose reference file"}
          <input
            type="file"
            accept={CONTENT_FILE_ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
      <p className="mt-1 text-xs text-stone-500">PDF, DOCX, TXT, JPG, PNG, or WebP up to 5 MB. Images are compressed first.</p>
    </div>
  );
}
