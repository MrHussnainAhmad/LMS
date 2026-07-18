"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { Loader2, Plus, Trash2, ImageUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRef } from "react";

type FeaturedInst = {
  id: number;
  name: string;
  logoKey: string | null;
  createdAt: string;
};

export default function FeaturedInstitutionsClient() {
  const [institutions, setInstitutions] = useState<FeaturedInst[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [logoKey, setLogoKey] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/featured-institutions");
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
      }
    } catch (error) {
      console.error("Failed to fetch featured institutions", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploadingImage(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please select an image file");
      if (file.size > 2 * 1024 * 1024) throw new Error("Image must be 2MB or smaller");

      const sigRes = await fetch("/api/upload/signature", { method: "POST" });
      const signaturePayload = await sigRes.json();
      
      if (!sigRes.ok || !signaturePayload.signature) {
        throw new Error(signaturePayload.error || "Upload service is not configured");
      }

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("api_key", signaturePayload.apiKey);
      uploadData.append("timestamp", signaturePayload.timestamp.toString());
      uploadData.append("signature", signaturePayload.signature);
      uploadData.append("folder", "lms-uploads");

      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/image/upload`, {
        method: "POST",
        body: uploadData,
      });
      const uploadPayload = await cloudinaryResponse.json();
      
      if (!cloudinaryResponse.ok || !uploadPayload.secure_url) {
        throw new Error(uploadPayload.error?.message || "Cloudinary rejected the picture upload");
      }

      setLogoKey(uploadPayload.secure_url);
      toast({ title: "Image Uploaded", description: "Logo ready to save.", variant: "success" });
    } catch (error: any) {
      toast({ title: "Could not upload", description: error.message || "Upload failed", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/featured-institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoKey: logoKey || undefined }),
      });

      if (!res.ok) throw new Error("Failed to add");
      
      toast({ title: "Success", description: "Added featured institution" });
      setName("");
      setLogoKey("");
      fetchInstitutions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/featured-institutions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      
      toast({ title: "Success", description: "Removed featured institution" });
      fetchInstitutions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 text-lg">Add New Featured Institution</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-stone-700">Institution Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Stanford University" 
              required
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-stone-700">Logo (Optional)</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage} className="gap-2 w-full justify-start text-stone-600 font-normal">
                {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                {isUploadingImage ? "Uploading..." : logoKey ? "Change Logo" : "Upload Image"}
              </Button>
              {logoKey && (
                <div className="h-10 w-10 shrink-0 rounded-md border border-stone-200 overflow-hidden bg-stone-50">
                  <img src={logoKey} alt="Logo preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting || !name.trim() || isUploadingImage} className="bg-brand-600 hover:bg-brand-700">
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Institution</th>
              <th className="px-6 py-4">Logo</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-6 py-4 sm:py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></td>
              </tr>
            )}
            {!isLoading && institutions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 sm:py-8 text-center text-stone-500">No featured institutions added yet.</td>
              </tr>
            )}
            {institutions.map((inst) => (
              <tr key={inst.id} className="hover:bg-stone-50/50">
                <td className="px-6 py-4 font-medium text-stone-900">{inst.name}</td>
                <td className="px-6 py-4">
                  {inst.logoKey ? (
                    <img src={inst.logoKey} alt={inst.name} className="h-8 w-auto object-contain max-w-[100px]" />
                  ) : (
                    <span className="text-stone-400 text-xs italic">No logo</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(inst.id)} className="text-danger hover:text-danger hover:bg-danger/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
