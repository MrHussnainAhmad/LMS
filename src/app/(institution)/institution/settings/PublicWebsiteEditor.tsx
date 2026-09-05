'use client';

import { ChangeEvent, FormEvent, ReactNode, useState } from 'react';
import Image from 'next/image';
import QRCodeGenerator from 'qrcode';
import { CircleHelp, Download, ExternalLink, Globe2, LayoutTemplate, Plus, QrCode, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMAGE_FILE_ACCEPT, prepareContentUpload } from '@/lib/client-upload-file';

const ACCENT_COLORS = [
  { value: '#233c32', label: 'Forest' }, { value: '#1d4ed8', label: 'Blue' },
  { value: '#7c2d12', label: 'Rust' }, { value: '#5b21b6', label: 'Violet' },
  { value: '#0f766e', label: 'Teal' },
] as const;

type ContentCard = { title: string; description: string };
type Statistic = { value: string; label: string };
type GalleryImage = { url: string; caption: string };
type PublicProfile = {
  tagline: string | null; description: string | null; heroImageUrl: string | null;
  announcementText: string | null; announcementLink: string | null; aboutTitle: string | null;
  mission: string | null; vision: string | null; principalName: string | null;
  principalTitle: string | null; principalMessage: string | null; principalImageUrl: string | null;
  statistics: Statistic[]; programs: ContentCard[]; highlights: ContentCard[]; galleryImages: GalleryImage[];
  publicEmail: string | null; publicPhone: string | null; publicAddress: string | null; mapUrl: string | null;
  facebookUrl: string | null; instagramUrl: string | null; youtubeUrl: string | null; accentColor: string;
};
type PublicWebsiteEditorProps = { publicSlug: string | null; publicSiteEnabled: boolean; publicUrl: string | null; qrUrl: string | null; initialProfile: PublicProfile };

const fieldClass = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15';

function EditorSection({ sectionKey, title, description, guide, open, onToggle, children }: { sectionKey: string; title: string; description: string; guide: ReactNode; open: boolean; onToggle: (key: string) => void; children: ReactNode }) {
  return <details open={open} className="group overflow-hidden rounded-xl border border-stone-200 bg-white"><summary onClick={(event) => { event.preventDefault(); onToggle(sectionKey); }} className="cursor-pointer list-none px-5 py-4 transition hover:bg-stone-50"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold text-stone-900">{title}</p><p className="mt-1 text-xs leading-5 text-stone-500">{description}</p></div><span className="text-xl text-stone-400 transition group-open:rotate-45">+</span></div></summary><div className="border-t border-stone-200 bg-stone-50/40 p-5"><details className="mb-5 rounded-lg border border-brand-100 bg-brand-50"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-950"><CircleHelp className="h-4 w-4" />What should I add?</summary><div className="border-t border-brand-100 px-4 py-3 text-sm leading-6 text-stone-600">{guide}</div></details>{children}</div></details>;
}

function ImageUploadButton({ onUploaded, label = 'Choose image', disabled = false }: { onUploaded: (url: string) => void; label?: string; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const preparedFile = await prepareContentUpload(file, { allowedKinds: ['image'] });
      const signatureResponse = await fetch('/api/institution/public-site/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'signature' }) });
      const signature = await signatureResponse.json();
      if (!signatureResponse.ok) throw new Error(signature.error || 'Unable to prepare image upload');
      const form = new FormData();
      form.append('file', preparedFile); form.append('api_key', signature.apiKey); form.append('timestamp', String(signature.timestamp)); form.append('signature', signature.signature); form.append('folder', signature.folder); form.append('allowed_formats', signature.allowedFormats); form.append('type', signature.type);
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: form });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded.error?.message || 'Image upload failed');
      const completeResponse = await fetch('/api/institution/public-site/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete', publicId: uploaded.public_id, format: uploaded.format, resourceType: uploaded.resource_type }) });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error || 'Unable to verify uploaded image');
      onUploaded(completed.url);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Image upload failed'); }
    finally { setUploading(false); }
  }
  return <label className={`inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-brand-800 transition hover:border-brand-300 ${disabled || uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}><Upload className="h-4 w-4" />{uploading ? 'Compressing and uploading...' : label}<input type="file" accept={IMAGE_FILE_ACCEPT} className="sr-only" disabled={disabled || uploading} onChange={upload} /></label>;
}

function SelectedImage({ src, alt, onReplace, onRemove, shape = 'wide' }: { src: string; alt: string; onReplace: (url: string) => void; onRemove: () => void; shape?: 'wide' | 'portrait' }) {
  return <div className={`overflow-hidden rounded-lg border border-stone-200 bg-white ${shape === 'portrait' ? 'max-w-xs' : ''}`}>
    <div className={`relative bg-stone-100 ${shape === 'portrait' ? 'aspect-[4/5]' : 'aspect-[16/6]'}`}>
      <Image unoptimized fill sizes={shape === 'portrait' ? '320px' : '(max-width: 768px) 100vw, 900px'} src={src} alt={alt} className="object-cover" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      <span className="text-xs font-medium text-stone-600">Image selected</span>
      <div className="flex items-center gap-2">
        <ImageUploadButton label="Replace" onUploaded={onReplace} />
        <Button type="button" size="sm" variant="outline" onClick={onRemove}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>
      </div>
    </div>
  </div>;
}

export function PublicWebsiteEditor({ publicSlug, publicSiteEnabled, publicUrl, qrUrl, initialProfile }: PublicWebsiteEditorProps) {
  const [profile, setProfile] = useState({
    ...initialProfile,
    tagline: initialProfile.tagline || '', description: initialProfile.description || '', heroImageUrl: initialProfile.heroImageUrl || '',
    announcementText: initialProfile.announcementText || '', announcementLink: initialProfile.announcementLink || '', aboutTitle: initialProfile.aboutTitle || '',
    mission: initialProfile.mission || '', vision: initialProfile.vision || '', principalName: initialProfile.principalName || '',
    principalTitle: initialProfile.principalTitle || '', principalMessage: initialProfile.principalMessage || '', principalImageUrl: initialProfile.principalImageUrl || '',
    publicEmail: initialProfile.publicEmail || '', publicPhone: initialProfile.publicPhone || '', publicAddress: initialProfile.publicAddress || '',
    mapUrl: initialProfile.mapUrl || '', facebookUrl: initialProfile.facebookUrl || '', instagramUrl: initialProfile.instagramUrl || '', youtubeUrl: initialProfile.youtubeUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['hero']);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const canEdit = Boolean(publicSlug);
  const publicHostname = publicUrl ? new URL(publicUrl).hostname : null;
  const toggleSection = (key: string) => setOpenSections((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current.slice(-1), key]);
  const sectionProps = (sectionKey: string) => ({ sectionKey, open: openSections.includes(sectionKey), onToggle: toggleSection });

  async function generateQrCode() {
    if (qrUrl) setQrDataUrl(await QRCodeGenerator.toDataURL(qrUrl, { width: 320, margin: 2, color: { dark: '#171c1a', light: '#ffffff' } }));
  }

  function updateField(field: keyof typeof profile, value: string) { setProfile((current) => ({ ...current, [field]: value })); }
  function updateCard(list: 'programs' | 'highlights', index: number, field: keyof ContentCard, value: string) { setProfile((current) => ({ ...current, [list]: current[list].map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) })); }
  function addCard(list: 'programs' | 'highlights') { setProfile((current) => current[list].length >= 8 ? current : ({ ...current, [list]: [...current[list], { title: '', description: '' }] })); }
  function removeItem(list: 'programs' | 'highlights' | 'statistics' | 'galleryImages', index: number) { setProfile((current) => ({ ...current, [list]: current[list].filter((_, itemIndex) => itemIndex !== index) })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/institution/public-site', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save website information');
      setMessage({ kind: 'success', text: 'Public website content saved. Changes may take up to one minute to appear.' });
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save website information' }); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className="space-y-5">
    <div className="mt-2 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-stone-50 p-4"><div className="flex gap-3"><Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-stone-900">{publicHostname || 'Subdomain not assigned'}</p><p className="mt-1 text-xs text-stone-500">{publicSiteEnabled ? 'Your public website is live.' : publicSlug ? 'Your subdomain is reserved but not published.' : 'Nisaab360 staff will assign this after approval and payment verification.'}</p></div></div>{publicSiteEnabled && publicUrl && <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" size="sm" onClick={generateQrCode}><QrCode className="mr-2 h-4 w-4" />Generate QR code</Button><a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900">Visit site <ExternalLink className="h-4 w-4" /></a></div>}</div>
    {qrDataUrl && qrUrl && <div className="relative flex flex-col items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 pr-14 sm:flex-row sm:items-center"><Button type="button" variant="ghost" size="icon" onClick={() => setQrDataUrl(null)} aria-label="Close QR code" className="absolute right-3 top-3"><X className="h-4 w-4" /></Button><Image unoptimized width={144} height={144} src={qrDataUrl} alt={`QR code for ${publicHostname}`} className="h-36 w-36 rounded-lg border border-stone-200 bg-white p-2" /><div><p className="font-semibold text-stone-900">Institution homepage QR code</p><p className="mt-1 break-all text-xs text-stone-500">{qrUrl}</p><a href={qrDataUrl} download={`${publicSlug}-website-qr.png`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Download className="h-4 w-4" />Download PNG</a></div></div>}
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950"><div className="flex gap-3"><LayoutTemplate className="mt-0.5 h-5 w-5 shrink-0" /><p><strong>Your website is modular.</strong> Complete only the sections you want visitors to see. Empty optional sections remain hidden automatically.</p></div></div>

    <fieldset disabled={!canEdit || saving} className="space-y-4 disabled:opacity-60">
      <EditorSection {...sectionProps('hero')} title="Brand and homepage hero" description="The first impression: headline, cover photograph, announcement, and colors." guide={<>Use a short promise as the headline, not the institution name. Add one wide, real campus photograph. Use the announcement only for a current notice such as “Admissions open until 20 March”.</>}>
        <div className="mb-4 space-y-2"><span className="block text-sm font-medium text-stone-700">Homepage cover image</span>{profile.heroImageUrl ? <SelectedImage src={profile.heroImageUrl} alt="Homepage cover preview" onReplace={(url) => updateField('heroImageUrl', url)} onRemove={() => updateField('heroImageUrl', '')} /> : <div className="rounded-lg border border-dashed border-stone-300 bg-white p-5"><ImageUploadButton label="Choose cover image from device" onUploaded={(url) => updateField('heroImageUrl', url)} /><p className="mt-2 text-xs leading-5 text-stone-500">JPG, PNG, or WebP. Images are compressed before upload and must be no larger than 5 MB afterward.</p></div>}</div>
        <div className="space-y-4"><label className="block text-sm font-medium text-stone-700">Homepage headline<input value={profile.tagline} onChange={(event) => updateField('tagline', event.target.value)} maxLength={160} placeholder="Building confident learners for a changing world" className={`${fieldClass} mt-1`} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-stone-700">Announcement text<input value={profile.announcementText} onChange={(event) => updateField('announcementText', event.target.value)} maxLength={240} placeholder="Admissions for 2027 are now open" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700">Announcement link<input value={profile.announcementLink} onChange={(event) => updateField('announcementLink', event.target.value)} maxLength={500} placeholder="/admissions or https://..." className={`${fieldClass} mt-1`} /></label></div><div><span className="mb-2 block text-sm font-medium text-stone-700">Website color</span><div className="flex flex-wrap gap-3">{ACCENT_COLORS.map((color) => <label key={color.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${profile.accentColor === color.value ? 'border-brand-800 bg-brand-50' : 'border-border bg-white'}`}><input type="radio" name="accentColor" value={color.value} checked={profile.accentColor === color.value} onChange={(event) => updateField('accentColor', event.target.value)} className="sr-only" /><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color.value }} />{color.label}</label>)}</div></div></div>
      </EditorSection>

      <EditorSection {...sectionProps('about')} title="About, mission and vision" description="Tell families what the institution stands for and how it educates students." guide={<>Write a short introduction covering your history, teaching approach, and community. <strong>Mission</strong> explains what you do today; <strong>vision</strong> explains the future you want to create.</>}>
        <div className="space-y-4"><label className="block text-sm font-medium text-stone-700">About section heading<input value={profile.aboutTitle} onChange={(event) => updateField('aboutTitle', event.target.value)} maxLength={120} placeholder="An education grounded in purpose" className={`${fieldClass} mt-1`} /></label><label className="block text-sm font-medium text-stone-700">About the institution<textarea value={profile.description} onChange={(event) => updateField('description', event.target.value)} maxLength={2000} rows={6} placeholder="History, educational approach, community, and what makes your institution different." className={`${fieldClass} mt-1 resize-y leading-6`} /></label><div className="grid gap-4 lg:grid-cols-2"><label className="text-sm font-medium text-stone-700">Mission<textarea value={profile.mission} onChange={(event) => updateField('mission', event.target.value)} maxLength={1200} rows={4} className={`${fieldClass} mt-1 resize-y`} /></label><label className="text-sm font-medium text-stone-700">Vision<textarea value={profile.vision} onChange={(event) => updateField('vision', event.target.value)} maxLength={1200} rows={4} className={`${fieldClass} mt-1 resize-y`} /></label></div></div>
      </EditorSection>

      <EditorSection {...sectionProps('statistics')} title="Institution at a glance" description="Add up to six strong numbers, such as students, teachers, years, or results." guide={<>Only add factual numbers that help a family understand your scale, for example <strong>1,200+ / Students</strong>, <strong>65 / Teachers</strong>, or <strong>25 years / Serving the community</strong>. Do not add sentences here.</>}>
        <div className="space-y-3">{profile.statistics.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-[140px_1fr_auto]"><input required value={item.value} onChange={(event) => setProfile((current) => ({ ...current, statistics: current.statistics.map((stat, itemIndex) => itemIndex === index ? { ...stat, value: event.target.value } : stat) }))} maxLength={30} placeholder="1,200+" className={fieldClass} /><input required value={item.label} onChange={(event) => setProfile((current) => ({ ...current, statistics: current.statistics.map((stat, itemIndex) => itemIndex === index ? { ...stat, label: event.target.value } : stat) }))} maxLength={80} placeholder="Students learning with us" className={fieldClass} /><Button type="button" size="sm" variant="outline" onClick={() => removeItem('statistics', index)} aria-label="Remove statistic"><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" disabled={profile.statistics.length >= 6} onClick={() => setProfile((current) => ({ ...current, statistics: [...current.statistics, { value: '', label: '' }] }))}><Plus className="mr-2 h-4 w-4" />Add statistic</Button></div>
      </EditorSection>

      {(['programs', 'highlights'] as const).map((list) => <EditorSection {...sectionProps(list)} key={list} title={list === 'programs' ? 'Programs and learning pathways' : 'Campus experience and highlights'} description={list === 'programs' ? 'Show the classes, levels, streams, or degrees families can choose.' : 'Show facilities, activities, student support, sports, labs, or achievements.'} guide={list === 'programs' ? <><strong>Programs are what a student can study</strong>—for example Primary School, Matric Science, FSc Pre-Medical, ICS, or BS Computer Science. Do not enter a campus name here.</> : <><strong>Highlights describe the student experience</strong>—for example a science laboratory, sports ground, scholarship program, counselling, or a notable achievement.</>}><div className="space-y-3">{profile[list].map((item, index) => <div key={index} className="rounded-lg border border-stone-200 bg-white p-4"><div className="flex gap-2"><input required value={item.title} onChange={(event) => updateCard(list, index, 'title', event.target.value)} maxLength={120} placeholder={list === 'programs' ? 'FSc Pre-Medical' : 'Science laboratories'} className={fieldClass} /><Button type="button" size="sm" variant="outline" onClick={() => removeItem(list, index)} aria-label="Remove item"><Trash2 className="h-4 w-4" /></Button></div><textarea value={item.description} onChange={(event) => updateCard(list, index, 'description', event.target.value)} maxLength={500} rows={2} placeholder={list === 'programs' ? 'Subjects, grade level, duration, or who this program is for' : 'What is available and how it benefits students'} className={`${fieldClass} mt-2 resize-y`} /></div>)}<Button type="button" variant="outline" disabled={profile[list].length >= 8} onClick={() => addCard(list)}><Plus className="mr-2 h-4 w-4" />Add {list === 'programs' ? 'program' : 'highlight'}</Button></div></EditorSection>)}

      <EditorSection {...sectionProps('leadership')} title="Message from leadership" description="Add a principal, director, rector, or head’s welcome message." guide={<>Add one genuine welcome message from the principal, director, rector, or head. Include the person’s name, exact designation, and a formal portrait. Keep the message personal and specific.</>}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-stone-700">Name<input value={profile.principalName} onChange={(event) => updateField('principalName', event.target.value)} maxLength={120} placeholder="Dr. Ayesha Khan" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700">Title<input value={profile.principalTitle} onChange={(event) => updateField('principalTitle', event.target.value)} maxLength={120} placeholder="Principal" className={`${fieldClass} mt-1`} /></label><div className="space-y-2 sm:col-span-2"><span className="block text-sm font-medium text-stone-700">Leadership photograph</span>{profile.principalImageUrl ? <SelectedImage shape="portrait" src={profile.principalImageUrl} alt="Leadership photograph preview" onReplace={(url) => updateField('principalImageUrl', url)} onRemove={() => updateField('principalImageUrl', '')} /> : <div className="rounded-lg border border-dashed border-stone-300 bg-white p-5"><ImageUploadButton label="Choose photograph from device" onUploaded={(url) => updateField('principalImageUrl', url)} /><p className="mt-2 text-xs text-stone-500">JPG, PNG, or WebP. Images are compressed before upload and must be no larger than 5 MB afterward.</p></div>}</div><label className="text-sm font-medium text-stone-700 sm:col-span-2">Message<textarea value={profile.principalMessage} onChange={(event) => updateField('principalMessage', event.target.value)} maxLength={1800} rows={5} className={`${fieldClass} mt-1 resize-y`} /></label></div>
      </EditorSection>

      <EditorSection {...sectionProps('gallery')} title="Photo gallery" description="Upload up to eight photographs showing campus life, events, and facilities." guide={<>Use real, clear photographs of your campus, classrooms, events, facilities, or students—with permission. Add a useful caption such as “Annual science exhibition 2026”. Avoid posters and repeated logos.</>}>
        <div className="mb-4 rounded-lg border border-dashed border-stone-300 bg-white p-5"><ImageUploadButton disabled={profile.galleryImages.length >= 8} label="Choose gallery image from device" onUploaded={(url) => setProfile((current) => current.galleryImages.length >= 8 ? current : ({ ...current, galleryImages: [...current.galleryImages, { url, caption: '' }] }))} /><p className="mt-2 text-xs leading-5 text-stone-500">JPG, PNG, or WebP. Images are compressed before upload and must be no larger than 5 MB afterward. {profile.galleryImages.length}/8 images added.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">{profile.galleryImages.map((item, index) => <div key={`${item.url}-${index}`} className="overflow-hidden rounded-lg border border-stone-200 bg-white"><div className="relative aspect-[16/10] bg-stone-100"><Image unoptimized fill sizes="(max-width: 640px) 100vw, 420px" src={item.url} alt={item.caption || `Gallery image ${index + 1}`} className="object-cover" /></div><div className="space-y-2 p-3"><input value={item.caption} onChange={(event) => setProfile((current) => ({ ...current, galleryImages: current.galleryImages.map((image, itemIndex) => itemIndex === index ? { ...image, caption: event.target.value } : image) }))} maxLength={120} placeholder="Photo caption" aria-label={`Caption for gallery image ${index + 1}`} className={fieldClass} /><div className="flex justify-end"><Button type="button" size="sm" variant="outline" onClick={() => removeItem('galleryImages', index)}><Trash2 className="mr-2 h-4 w-4" />Remove</Button></div></div></div>)}</div>
      </EditorSection>

      <EditorSection {...sectionProps('contact')} title="Contact, map and social media" description="Make it easy for families to visit, call, email, and follow the institution." guide={<>Enter details that parents may publicly use. The address should be the visitor-facing campus address. Paste the full Google Maps share link and the full URL of each official social-media page.</>}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-stone-700">Public email<input type="email" value={profile.publicEmail} onChange={(event) => updateField('publicEmail', event.target.value)} maxLength={255} placeholder="admissions@example.edu.pk" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700">Public phone<input type="tel" value={profile.publicPhone} onChange={(event) => updateField('publicPhone', event.target.value)} maxLength={50} placeholder="+92 300 1234567" className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700 sm:col-span-2">Campus address<input value={profile.publicAddress} onChange={(event) => updateField('publicAddress', event.target.value)} maxLength={300} className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700 sm:col-span-2">Google Maps link<input type="url" value={profile.mapUrl} onChange={(event) => updateField('mapUrl', event.target.value)} maxLength={500} placeholder="https://maps.google.com/..." className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700">Facebook<input type="url" value={profile.facebookUrl} onChange={(event) => updateField('facebookUrl', event.target.value)} maxLength={500} placeholder="https://facebook.com/..." className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700">Instagram<input type="url" value={profile.instagramUrl} onChange={(event) => updateField('instagramUrl', event.target.value)} maxLength={500} placeholder="https://instagram.com/..." className={`${fieldClass} mt-1`} /></label><label className="text-sm font-medium text-stone-700 sm:col-span-2">YouTube<input type="url" value={profile.youtubeUrl} onChange={(event) => updateField('youtubeUrl', event.target.value)} maxLength={500} placeholder="https://youtube.com/..." className={`${fieldClass} mt-1`} /></label></div>
      </EditorSection>
    </fieldset>

    {message && <p role="status" className={`rounded-lg px-4 py-3 text-sm ${message.kind === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
    <div className="sticky bottom-4 flex justify-end"><Button type="submit" disabled={!canEdit || saving} className="shadow-lg">{saving ? 'Saving website...' : 'Save public website'}</Button></div>
  </form>;
}
