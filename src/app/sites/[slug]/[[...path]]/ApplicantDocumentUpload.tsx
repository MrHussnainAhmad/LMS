'use client';

import { ChangeEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_FILE_ACCEPT, prepareContentUpload, uploadPreparedContent } from '@/lib/client-upload-file';

export function ApplicantDocumentUpload({ documentId, accentColor }: { documentId: number; accentColor: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const preparedFile = await prepareContentUpload(file);
      const uploaded = await uploadPreparedContent(preparedFile, "document", undefined, `/api/public/admissions/documents/${documentId}`);
      const completeResponse = await fetch(`/api/public/admissions/documents/${documentId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', publicId: uploaded.public_id, format: uploaded.format, resourceType: uploaded.resource_type }) });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error || 'Unable to save uploaded document');
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload document');
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-3">
      <label
        className="inline-flex w-full sm:w-auto items-center justify-center cursor-pointer rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:opacity-90 transition-opacity text-center"
        style={{ backgroundColor: accentColor }}
      >
        <input className="sr-only" type="file" accept={CONTENT_FILE_ACCEPT} disabled={busy} onChange={upload} />
        {busy ? 'Compressing and uploading...' : 'Upload document'}
      </label>
      <p className="mt-2 text-xs text-stone-500 leading-relaxed">
        JPG, PNG, WebP, PDF, DOCX, or TXT; maximum 5 MB. Images are compressed first.
      </p>
      {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
