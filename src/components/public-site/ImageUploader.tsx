'use client';
import { showError } from "@/lib/show-error";
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMAGE_FILE_ACCEPT, prepareContentUpload, uploadPreparedContent } from '@/lib/client-upload-file';

export async function uploadPublicImage(file: File) {
  const preparedFile = await prepareContentUpload(file, { allowedKinds: ['image'] });
  const uploaded = await uploadPreparedContent(preparedFile, "public-site-image");
  const completed = { url: uploaded.secure_url };
  return completed.url as string;
}

export function ImageUploader({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  const callback = useRef(onChange);
  const mounted = useRef(true);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(true);
    try { const url = await uploadPublicImage(file); if (mounted.current) callback.current(url); } catch (error) { showError(error instanceof Error ? error.message : 'Image upload failed'); } finally { if (mounted.current) setUploading(false); }
  }
  
  const blurDataURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  return <div className="space-y-3">{value && <div className="relative aspect-[16/7] overflow-hidden rounded-lg border border-stone-200 bg-stone-100"><Image placeholder="blur" blurDataURL={blurDataURL} unoptimized fill sizes="700px" src={value} alt="" className="object-cover" /></div>}<div className="flex flex-wrap gap-2"><label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-brand-800 ${uploading ? 'pointer-events-none opacity-60' : ''}`}><Upload className="h-4 w-4" />{uploading ? 'Uploading...' : value ? `Replace ${label}` : `Upload ${label}`}<input type="file" accept={IMAGE_FILE_ACCEPT} className="sr-only" disabled={uploading} onChange={upload} /></label>{value && <Button type="button" size="sm" variant="outline" onClick={() => onChange('')}>Remove</Button>}</div></div>;
}
