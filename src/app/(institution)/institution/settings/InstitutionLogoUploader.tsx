"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { ImageUp, Loader2 } from "lucide-react";
import { prepareContentUpload, uploadPreparedContent } from "@/lib/client-upload-file";

function isImageUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Logo upload failed";
}

export function InstitutionLogoUploader({
  currentLogoKey,
  institutionName,
}: {
  currentLogoKey: string;
  institutionName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(isImageUrl(currentLogoKey) ? currentLogoKey : "");
  const [isUploading, setIsUploading] = useState(false);

  const uploadLogo = async (file: File) => {
    setIsUploading(true);
    try {
      const preparedFile = await prepareContentUpload(file, { allowedKinds: ['image'], maximumBytes: 2 * 1024 * 1024 });

      const uploadPayload = await uploadPreparedContent(preparedFile);
      await api.patch("/api/institution/logo", { publicId: uploadPayload.public_id });
      setPreviewUrl(uploadPayload.secure_url || "");
      toast({ title: "Logo updated", description: "Your institution logo has been saved.", variant: "success" });
      router.refresh();
    } catch (error: unknown) {
      toast({ title: "Could not upload logo", description: errorMessage(error), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-stone-50">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`${institutionName} logo`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-bold text-brand-800">{institutionName.substring(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-brand-950">Institution Logo</p>
          <p className="text-sm text-stone-500">Upload a square PNG/JPG logo for your institution profile.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadLogo(file);
          }}
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="gap-2">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Upload Logo"}
        </Button>
      </div>
    </div>
  );
}
