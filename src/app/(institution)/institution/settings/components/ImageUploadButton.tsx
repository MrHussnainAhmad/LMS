import { showError } from "@/lib/show-error";
import { ChangeEvent, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { IMAGE_FILE_ACCEPT, prepareContentUpload, uploadPreparedContent } from '@/lib/client-upload-file';
import { preserveElementPosition } from './EditorSection';

export function ImageUploadButton({ onUploaded, label = 'Choose image', disabled = false }: { onUploaded: (url: string) => void; label?: string; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const labelRef = useRef<HTMLLabelElement>(null);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const preparedFile = await prepareContentUpload(file, { allowedKinds: ['image'] });
      const uploaded = await uploadPreparedContent(preparedFile, "public-site-image");
      const completed = { url: uploaded.secure_url };
      const section = labelRef.current?.closest<HTMLElement>('[data-editor-section]') || labelRef.current;
      preserveElementPosition(section, () => onUploaded(completed.url));
    } catch (error) { showError(error instanceof Error ? error.message : 'Image upload failed'); }
    finally { setUploading(false); }
  }
  return <label ref={labelRef} className={`inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-brand-800 transition hover:border-brand-300 ${disabled || uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}><Upload className="h-4 w-4" />{uploading ? 'Compressing and uploading...' : label}<input type="file" accept={IMAGE_FILE_ACCEPT} className="sr-only" disabled={disabled || uploading} onChange={upload} /></label>;
}
