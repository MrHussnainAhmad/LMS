"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { Receipt, UploadCloud, FileImage, Plus, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface Voucher {
  id: number;
  title: string;
  imageUrl: string;
  createdAt: string;
}

export function FeeVouchersClient() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async (cursor?: string) => {
    try {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res: any = await api.get(`/api/student/vouchers${suffix}`);
      setVouchers((current) => cursor ? [...current, ...(res.vouchers || [])] : (res.vouchers || []));
      setNextCursor(res.nextCursor || null);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load vouchers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      await fetchVouchers(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Only image files are allowed", variant: "destructive" });
      return;
    }

    if (file.size > 500 * 1024) {
      toast({ title: "File too large", description: "Image must be under 500KB. It will be compressed.", variant: "default" });
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress as JPEG
        canvas.toBlob((blob) => {
          if (blob) {
            // Check if still > 500kb and reduce quality if needed, but 0.7 quality usually brings it under 500kb
            resolve(blob);
          } else {
            reject(new Error("Compression failed"));
          }
        }, "image/jpeg", 0.7);
      };
      img.onerror = reject;
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) return;

    try {
      setUploading(true);

      // 1. Compress Image
      const compressedBlob = await compressImage(selectedFile);
      if (compressedBlob.size > 500 * 1024) {
        toast({ title: "Error", description: "Image is still too large after compression. Please select a smaller image.", variant: "destructive" });
        setUploading(false);
        return;
      }

      // 2. Get Cloudinary signature
      const sigRes: any = await api.post("/api/upload/signature", { folder: "vouchers" });
      
      // 3. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", compressedBlob);
      formData.append("api_key", sigRes.apiKey);
      formData.append("timestamp", sigRes.timestamp.toString());
      formData.append("signature", sigRes.signature);
      formData.append("folder", "vouchers");

      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${sigRes.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!cloudinaryResponse.ok) {
        throw new Error("Failed to upload image to Cloudinary");
      }

      const cloudinaryData = await cloudinaryResponse.json();
      const imageUrl = cloudinaryData.secure_url;

      // 4. Save to database
      await api.post("/api/student/vouchers", {
        title: title.trim(),
        imageUrl,
      });

      toast({ title: "Success", description: "Voucher uploaded successfully", variant: "success" });
      setTitle("");
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchVouchers();
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Fee Vouchers</h1>
          <p className="text-stone-500 mt-1">Upload and manage your fee payment vouchers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-brand-600" />
                Upload New Voucher
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Voucher Title / Month</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. October 2024 Fee"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Voucher Image</label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors ${previewUrl ? 'border-brand-300 bg-brand-50/30' : 'border-stone-300 bg-stone-50 hover:bg-stone-100 hover:border-brand-400 cursor-pointer'}`}
                    onClick={() => !previewUrl && fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <div className="relative w-full flex flex-col items-center">
                        <img src={previewUrl} alt="Preview" className="max-h-48 object-contain rounded-md" />
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewUrl(null);
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="absolute -top-3 -right-3 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <p className="text-xs text-stone-500 mt-2 truncate w-full text-center">{selectedFile?.name}</p>
                      </div>
                    ) : (
                      <>
                        <FileImage className="h-10 w-10 text-stone-400 mb-2" />
                        <p className="text-sm font-medium text-brand-700">Click to browse image</p>
                        <p className="text-xs text-stone-500 mt-1">JPEG, PNG up to 500KB</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={uploading || !selectedFile || !title.trim()} 
                  className="w-full bg-brand-800 text-white hover:bg-brand-900"
                >
                  {uploading ? "Uploading..." : "Submit Voucher"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-brand-600" />
                Your Uploaded Vouchers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                </div>
              ) : vouchers.length === 0 ? (
                <div className="text-center py-10 text-stone-500 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                  <Receipt className="h-10 w-10 mx-auto mb-3 text-stone-400 opacity-50" />
                  <p>You haven't uploaded any fee vouchers yet.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {vouchers.map(v => (
                      <div key={v.id} className="border border-border rounded-lg overflow-hidden flex flex-col bg-white">
                        <div className="h-48 bg-stone-100 relative group overflow-hidden">
                          <img src={v.imageUrl} alt={v.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          <a
                            href={v.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <span className="bg-white text-stone-900 text-sm font-medium px-3 py-1.5 rounded-md">View Full Image</span>
                          </a>
                        </div>
                        <div className="p-3">
                          <h4 className="font-semibold text-brand-950 truncate">{v.title}</h4>
                          <p className="text-xs text-stone-500 mt-1">Uploaded on {new Date(v.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {nextCursor && (
                    <div className="mt-6 flex justify-center">
                      <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? "Loading..." : "Load more"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
