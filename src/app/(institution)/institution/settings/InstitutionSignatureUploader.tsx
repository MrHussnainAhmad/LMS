"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { Loader2 } from "lucide-react";

type SignaturePayload = {
  signature?: string;
  timestamp?: number;
  cloudName?: string;
  apiKey?: string;
  error?: string;
};

function isImageUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Signature upload failed";
}

export function InstitutionSignatureUploader({
  currentSignatureKey,
}: {
  currentSignatureKey?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentSignatureKey && isImageUrl(currentSignatureKey) ? currentSignatureKey : "");
  const [isUploading, setIsUploading] = useState(false);

  const processImageToTransparent = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Failed to get canvas context"));
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Remove white background: Threshold based
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // If the pixel is mostly white/light (e.g., above 200 on RGB), make it transparent
          if (r > 200 && g > 200 && b > 200) {
            data[i + 3] = 0; // Alpha
          } else {
            // Optional: boost the dark pixels to solid black for better contrast
            // data[i] = 0; data[i+1] = 0; data[i+2] = 0; 
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/png");
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image for processing"));
      };
      
      img.src = objectUrl;
    });
  };

  const uploadSignature = async (file: File) => {
    setIsUploading(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please select an image file");
      if (file.size > 2 * 1024 * 1024) throw new Error("Signature must be 2MB or smaller");

      toast({ title: "Processing...", description: "Removing background and preparing upload." });
      const transparentBlob = await processImageToTransparent(file);
      const uploadFile = new File([transparentBlob], "signature.png", { type: "image/png" });

      const sigRes = await fetch("/api/upload/signature", { method: "POST" });
      const signaturePayload = await sigRes.json() as SignaturePayload;
      if (!sigRes.ok || !signaturePayload.signature || !signaturePayload.timestamp || !signaturePayload.cloudName || !signaturePayload.apiKey) {
        throw new Error(signaturePayload.error || "Upload service is not configured");
      }

      const uploadData = new FormData();
      uploadData.append("file", uploadFile);
      uploadData.append("api_key", signaturePayload.apiKey);
      uploadData.append("timestamp", signaturePayload.timestamp.toString());
      uploadData.append("signature", signaturePayload.signature);
      uploadData.append("folder", "lms-uploads");

      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/image/upload`, {
        method: "POST",
        body: uploadData,
      });
      const uploadPayload = await cloudinaryResponse.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
      if (!cloudinaryResponse.ok || !uploadPayload.secure_url) {
        throw new Error(uploadPayload.error?.message || "Cloudinary rejected the signature upload");
      }

      await api.patch("/api/institution/signature", { publicId: uploadPayload.public_id });
      setPreviewUrl(uploadPayload.secure_url);
      toast({ title: "Signature updated", description: "The Principal's signature has been saved.", variant: "success" });
      router.refresh();
    } catch (error: unknown) {
      toast({ title: "Could not upload signature", description: errorMessage(error), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex h-24 w-48 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-stone-50 print:bg-transparent custom-checkerboard-bg">
        <style dangerouslySetInnerHTML={{__html: `
          .custom-checkerboard-bg {
            background-image: linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          }
        `}} />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Principal Signature" className="h-full w-full object-contain mix-blend-multiply drop-shadow-sm" />
        ) : (
          <span className="text-sm font-medium text-stone-400">No Signature</span>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-brand-950">Principal / Head Signature</p>
          <p className="text-sm text-stone-500 max-w-sm">Upload a signature image with a white background. It should only be the signature of the Principal. The white background will be automatically removed.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadSignature(file);
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-stone-100 px-4 text-sm font-medium text-stone-900 hover:bg-stone-200"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {previewUrl ? "Change Signature" : "Upload Signature"}
          </button>
        </div>
      </div>
    </div>
  );
}
