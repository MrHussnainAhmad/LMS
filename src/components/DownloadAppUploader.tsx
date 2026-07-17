"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DownloadAppUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setMessage(null);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/download-app", { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      setMessage(body.message || "Android app replaced successfully.");
      setFile(null);
      event.currentTarget.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="max-w-xl space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-brand-950">Replace Android app</h2>
        <p className="mt-1 text-sm text-stone-600">Upload one APK (up to 200 MB). Uploading a new file permanently removes the previous app file.</p>
      </div>
      <input
        type="file"
        accept=".apk,application/vnd.android.package-archive"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="block w-full rounded-md border border-border bg-white p-2 text-sm"
        required
      />
      {message && <p className="text-sm font-medium text-success">{message}</p>}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!file || isUploading}>
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Replacing…" : "Upload and replace"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/api/download-app" prefetch={false}><Download className="mr-2 h-4 w-4" />Current download</Link>
        </Button>
      </div>
    </form>
  );
}
