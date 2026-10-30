"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown,
  ChevronUp, Clock3, Cloud, Database, ExternalLink, FileArchive,
  HardDrive, KeyRound, LoaderCircle, LockKeyhole, Mail, Pause,
  Play, RefreshCw, RotateCcw, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
type Settings = {
  recoveryReviewRequired?: boolean;
  enabled: boolean;
  ready: boolean;
  driveConnected: boolean;
  driveEmail: string | null;
  driveFolderId: string | null;
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
  pendingEmail: string | null;
  nextBackupAt: string | null;
};
type Backup = {
  id: number;
  run_id: string;
  file_name: string;
  file_size_bytes: string | null;
  status: string;
  created_at: string;
  password_sent_at: string | null;
  drive_verified_at: string | null;
  deleted_at: string | null;
  package_version: number;
  error: string | null;
};
type Job = {
  run_id: string;
  kind: string;
  status: string;
  error: string | null;
};
const when = (value: string) =>
  new Date(value).toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
function fileSize(value: string) {
  const bytes = Number(value);
  const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : bytes >= 1024 ? 1 : 0;
  return (bytes / 1024 ** unit).toFixed(unit ? 1 : 0) + ' ' + ['B', 'KB', 'MB', 'GB'][unit];
}
function StatusPill({ children, tone = "neutral" }: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const colors = {
    neutral: "border-stone-200 bg-stone-100 text-stone-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
}
export function CentralDatabaseBackupSettings({
  connectionResult,
}: { connectionResult?: string } = {}) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [backups, setBackups] = useState<Backup[]>([]),
    [jobs, setJobs] = useState<Job[]>([]);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [messageIsError, setMessageIsError] = useState(connectionResult === "failed"),
    [message, setMessage] = useState(
      connectionResult === "connected"
        ? "Google Drive connected securely."
        : connectionResult === "failed"
          ? "Google Drive connection failed. Please try again."
          : "",
    ),
    [history, setHistory] = useState(false),
    [restore, setRestore] = useState(false);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch("/api/sa/central-backup/settings", { cache: "no-store" }),
      fetch("/api/sa/central-backup/jobs", { cache: "no-store" }),
    ]);
    const [s, j] = await Promise.all([a.json(), b.json()]);
    if (!a.ok || !b.ok)
      throw Error(s.error || j.error || "Could not load database backups");
    setSettings(s);
    setBackups(j.backups);
    setJobs(j.jobs);
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active)
        void load().catch((error) => {
          if (active) {
            setMessage(error.message);
            setMessageIsError(true);
          }
        });
    };
    update();
    const timer = window.setInterval(update, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [load]);
  async function action(
    url: string,
    method: string,
    body: Record<string, unknown>,
  ) {
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, currentPassword }),
      });
      const value = await response.json();
      if (!response.ok) throw Error(value.error || "Request failed");
      if (value.authorizationUrl) {
        window.location.assign(value.authorizationUrl);
        return;
      }
      setMessage(
        body.action === "send-code"
          ? "Verification code sent. Check your recovery email."
          : body.action === "verify-code"
            ? "Recovery email verified. You can now enable nightly backups."
            : url.endsWith("/jobs")
              ? "Backup queued. The worker will start it shortly."
              : body.action === "finish-recovery-review"
                ? "Recovery review completed. Background workers can resume."
                : "Settings saved.",
      );
      setCode("");
      setCurrentPassword("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }
  const retained = backups.filter(
    (b) =>
      b.status === "COMPLETED" &&
      b.password_sent_at &&
      !b.deleted_at &&
      b.package_version === 1,
  );
  const visible = history
    ? backups
    : [
        ...retained.slice(0, 2),
        ...backups.filter((b) => !b.deleted_at && !retained.some((r) => r.id === b.id)).slice(0, 3),
      ];
  const activeJobs = jobs.filter((job) => ["PENDING", "RUNNING"].includes(job.status));
  const setupCount = Number(Boolean(settings?.driveConnected)) + Number(Boolean(settings?.recoveryEmailVerified));
  const needsPassword = !currentPassword;
  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh backups");
      setMessageIsError(true);
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">System &amp; data</p>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-950 sm:text-3xl">Database backup &amp; recovery</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Protect your platform data. Keep a recent copy ready for a fresh start on a new server.</p>
        </div>
        <Button variant="outline" disabled={busy || refreshing} onClick={() => void refresh()} className="gap-2">
          <RefreshCw aria-hidden="true" className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh
        </Button>
      </header>

      <section aria-label="Backup overview" className="overflow-hidden rounded-lg border border-brand-950 bg-brand-950 text-white">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-brand-300"><ShieldCheck aria-hidden="true" className="h-5 w-5" /></span>
              <span className="text-sm font-medium text-white/80">Nightly database protection</span>
              <span className={'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ' + (settings?.enabled ? 'border-brand-300/30 bg-brand-300/10 text-brand-200' : 'border-white/15 bg-white/5 text-white/75')}>
                <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + (settings?.enabled ? 'bg-brand-300' : 'bg-white/50')} />
                {!settings ? 'Loading status' : settings.enabled ? 'Active' : setupCount < 2 ? 'Setup needed' : 'Paused'}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">2:00 AM</p>
              <p className="text-sm text-white/65">Pakistan time, every night</p>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/65">One scheduled backup at 2:00 AM Pakistan time. Your database goes to Google Drive; its unique password goes to your email.</p>
          </div>
          <div className="grid content-center gap-4 border-t border-white/15 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <div className="flex items-start gap-3">
              <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <div><p className="text-xs text-white/55">Next scheduled backup</p><p className="mt-1 text-sm font-medium">{settings?.nextBackupAt ? when(settings.nextBackupAt) + ' PKT' : !settings ? 'Loading schedule…' : 'Enable nightly backups to schedule'}</p></div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div className="flex items-center gap-3"><LockKeyhole aria-hidden="true" className="h-4 w-4 text-brand-300" /><div><p className="text-xs text-white/55">Encryption</p><p className="mt-1 text-sm font-medium">AES-256</p></div></div>
              <div className="flex items-center gap-3"><HardDrive aria-hidden="true" className="h-4 w-4 text-brand-300" /><div><p className="text-xs text-white/55">Retention</p><p className="mt-1 text-sm font-medium">Latest 2 successful copies</p></div></div>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div role={messageIsError ? 'alert' : 'status'} className={'flex items-start gap-3 rounded-md border p-4 text-sm leading-6 ' + (messageIsError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>
          {messageIsError ? <TriangleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />}
          <p>{message}</p>
        </div>
      )}
      {settings?.recoveryReviewRequired && (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-amber-200 bg-amber-50 p-5" role="status">
          <div className="flex max-w-3xl items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div><p className="font-semibold text-amber-950">Review your recovered server</p><p className="mt-1 text-sm leading-6 text-amber-900">Background email, school backup, restore and payment reconciliation workers are paused. Review your data and configuration, then enter your current password below to continue.</p></div>
          </div>
          <Button variant="outline" disabled={busy || needsPassword} onClick={() => void action('/api/sa/central-backup/settings', 'PUT', { action: 'finish-recovery-review' })}>Finish recovery review</Button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6">
              <div><h2 className="text-lg font-semibold text-brand-950">Backup setup</h2><p className="mt-1 text-sm text-stone-600">Choose where your backup and recovery password go.</p></div>
              <StatusPill tone={setupCount === 2 ? 'success' : 'neutral'}>{setupCount === 2 && <Check aria-hidden="true" className="h-3 w-3" />}{settings ? setupCount + ' of 2 connected' : 'Loading…'}</StatusPill>
            </div>
            <CardContent className="space-y-6">
              <div className="rounded-md border border-border bg-stone-50 p-4">
                <div className="mb-3 flex items-center gap-2"><KeyRound aria-hidden="true" className="h-4 w-4 text-brand-700" /><label htmlFor="backup-admin-password" className="text-sm font-semibold text-brand-950">Confirm it’s you</label></div>
                <Input id="backup-admin-password" type="password" autoComplete="current-password" maxLength={1024} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Your current Super Admin password" aria-describedby="backup-password-help" />
                <p id="backup-password-help" className="mt-2 text-xs leading-5 text-stone-600">Enter your password before each sensitive action. It clears after the action succeeds.</p>
              </div>

              <section aria-labelledby="backup-drive-heading" className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-stone-50 text-brand-800"><Cloud aria-hidden="true" className="h-5 w-5" /></span>
                    <div><h3 id="backup-drive-heading" className="text-sm font-semibold text-brand-950">1. Google Drive storage</h3><p className="mt-1 text-sm text-stone-600">Your encrypted database files live here.</p></div>
                  </div>
                  <StatusPill tone={settings?.driveConnected ? 'success' : 'neutral'}>{settings?.driveConnected ? 'Connected' : 'Not connected'}</StatusPill>
                </div>
                {settings?.driveConnected && <p className="break-all rounded-md border border-border bg-stone-50 px-3 py-2.5 text-sm text-brand-950">{settings.driveEmail || 'Google Drive connected securely'}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy || !settings || needsPassword} onClick={() => void action('/api/sa/central-backup/google-drive/connect', 'POST', {})} className="gap-2"><Cloud aria-hidden="true" className="h-4 w-4" />{settings?.driveConnected ? 'Reconnect Google Drive' : 'Connect Google Drive'}</Button>
                  {settings?.driveFolderId && <Button variant="outline" asChild className="gap-2"><a href={'https://drive.google.com/drive/folders/' + encodeURIComponent(settings.driveFolderId)} target="_blank" rel="noopener noreferrer">Open backup folder<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a></Button>}
                  {settings?.driveConnected && <Button variant="ghost" disabled={busy || needsPassword} onClick={() => void action('/api/sa/central-backup/settings', 'PUT', { action: 'disconnect-drive' })} className="text-stone-600">Disconnect Drive</Button>}
                </div>
              </section>

              <section aria-labelledby="backup-email-heading" className="space-y-4 border-t border-border pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-stone-50 text-brand-800"><Mail aria-hidden="true" className="h-5 w-5" /></span>
                    <div><h3 id="backup-email-heading" className="text-sm font-semibold text-brand-950">2. Recovery email</h3><p className="mt-1 text-sm text-stone-600">Receive a new password for every backup.</p></div>
                  </div>
                  <StatusPill tone={settings?.recoveryEmailVerified ? 'success' : settings?.pendingEmail ? 'warning' : 'neutral'}>{settings?.recoveryEmailVerified ? 'Verified' : settings?.pendingEmail ? 'Verification pending' : 'Not verified'}</StatusPill>
                </div>
                {settings?.recoveryEmailVerified && <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">{settings.recoveryEmail}</span></div>}
                <div className="space-y-2">
                  <label htmlFor="backup-recovery-email" className="block text-sm font-medium text-brand-950">{settings?.recoveryEmailVerified ? 'Change recovery email address' : 'Recovery email address'}</label>
                  <Input id="backup-recovery-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recovery@example.com" aria-describedby="backup-email-help" />
                  <p id="backup-email-help" className="text-xs leading-5 text-stone-600">Use a protected mailbox, preferably separate from your Drive account.</p>
                </div>
                <Button variant="outline" disabled={busy || !settings || !email || needsPassword} onClick={() => void action('/api/sa/central-backup/settings', 'PUT', { action: 'send-code', email })} className="gap-2"><Mail aria-hidden="true" className="h-4 w-4" />Send verification code</Button>
                {settings?.pendingEmail && (
                  <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                    <div><label htmlFor="backup-email-code" className="block text-sm font-semibold text-amber-950">Verify your recovery email</label><p className="mt-1 break-words text-xs leading-5 text-amber-900">Enter the 8-character code sent to {settings.pendingEmail}.</p></div>
                    <Input id="backup-email-code" value={code} maxLength={8} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AB12CD34" className="max-w-64 font-mono tracking-[0.25em]" />
                    <Button variant="outline" disabled={busy || code.length !== 8 || needsPassword} onClick={() => void action('/api/sa/central-backup/settings', 'PUT', { action: 'verify-code', code })}>Verify recovery email</Button>
                  </div>
                )}
              </section>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6">
              <div><h2 className="text-lg font-semibold text-brand-950">{history ? 'Backup history' : 'Latest backups'}</h2><p className="mt-1 text-sm text-stone-600">{retained.length ? 'Download a verified copy and keep its matching password email.' : 'Your recovery copies will appear here.'}</p></div>
              <StatusPill>{retained.length} retained</StatusPill>
            </div>
            <CardContent className="space-y-4">
              {!settings ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-600" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Loading backups…</div>
              ) : !visible.length ? (
                <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
                  <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-brand-700"><Database aria-hidden="true" className="h-5 w-5" /></span>
                  <h3 className="text-sm font-semibold text-brand-950">Ready for your first backup</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">Connect Drive, verify your email and enable nightly backups. Use Back up now to test your setup.</p>
                </div>
              ) : visible.map((backup) => (
                <article key={backup.id} className={'overflow-hidden rounded-md border ' + (backup.id === retained[0]?.id ? 'border-brand-700/40' : 'border-border')}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-stone-50 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-brand-950"><FileArchive aria-hidden="true" className="h-4 w-4 text-brand-700" />{backup.id === retained[0]?.id ? 'Latest successful' : backup.id === retained[1]?.id ? 'Previous successful' : backup.deleted_at ? 'Removed by retention' : backup.status === 'COMPLETED' ? 'Historical backup' : backup.status === 'FAILED' ? 'Backup failed' : backup.drive_verified_at && !backup.password_sent_at ? 'Password email pending' : 'Backup in progress'}</span>
                    <StatusPill tone={backup.deleted_at ? 'neutral' : backup.status === 'COMPLETED' && backup.password_sent_at ? 'success' : 'warning'}>{backup.deleted_at ? 'Removed' : backup.status === 'FAILED' ? 'Failed' : backup.status === 'COMPLETED' && backup.password_sent_at ? 'Ready' : 'Pending'}</StatusPill>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-brand-950">{when(backup.created_at)} PKT</p><p className="mt-1.5 break-all font-mono text-xs leading-5 text-stone-600">{backup.file_name}</p></div>
                      {backup.file_size_bytes && <span className="shrink-0 rounded border border-border px-2 py-1 text-xs text-stone-600">{fileSize(backup.file_size_bytes)}</span>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <p className="flex items-center gap-1.5 text-xs text-stone-600"><Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{backup.password_sent_at ? 'Password email accepted by mail provider' : 'Password email pending or legacy backup'}</p>
                      {backup.drive_verified_at && !backup.deleted_at && <Button variant="outline" size="sm" asChild className="gap-2"><a href={'/api/sa/central-backup/' + backup.id + '/download'}><ArrowDownToLine aria-hidden="true" className="h-3.5 w-3.5" />Download encrypted backup</a></Button>}
                    </div>
                    {backup.error && <p className="break-words rounded border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{backup.error}</p>}
                  </div>
                </article>
              ))}
              {settings && backups.length > 0 && <Button variant="ghost" onClick={() => setHistory(!history)} aria-expanded={history} className="w-full gap-2">{history ? 'Show latest backups' : 'Show recent history'}{history ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}</Button>}
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Backup actions and recovery">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5"><div className="mb-3 flex items-center gap-2 text-brand-700"><Clock3 aria-hidden="true" className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-widest">Automatic backups</span></div><h2 className="text-lg font-semibold text-brand-950">Your nightly schedule</h2><p className="mt-2 text-sm leading-6 text-stone-600">Enable once. A fresh encrypted copy is created every night at 2:00 AM.</p></div>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-stone-600">Schedule</span><StatusPill tone={settings?.enabled ? 'success' : 'neutral'}>{settings?.enabled ? 'Enabled' : 'Disabled'}</StatusPill></div>
              <Button disabled={busy || !settings || needsPassword || (!settings.enabled && (setupCount < 2 || settings.recoveryReviewRequired))} onClick={() => void action('/api/sa/central-backup/settings', 'PUT', { action: 'enable', enabled: !settings?.enabled })} className="w-full gap-2">{settings?.enabled ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}{settings?.enabled ? 'Pause nightly backups' : 'Enable nightly backups'}</Button>
              <Button variant="outline" disabled={busy || !settings?.ready || needsPassword || activeJobs.length > 0} onClick={() => void action('/api/sa/central-backup/jobs', 'POST', {})} className="w-full gap-2"><Database aria-hidden="true" className="h-4 w-4" />Back up now</Button>
              <p className="text-xs leading-5 text-stone-600">{!settings ? 'Loading your backup settings…' : setupCount < 2 ? 'Complete Drive and email setup, then enter your password to enable backups.' : needsPassword ? 'Enter your current password in Backup setup to use these controls.' : settings.recoveryReviewRequired ? 'Finish the recovery review before enabling backups.' : 'Back up now creates an extra copy to test your setup.'}</p>
              <div className="border-t border-border pt-4"><p className="text-xs text-stone-500">Latest successful backup</p><p className="mt-1 text-sm font-medium text-brand-950">{retained[0] ? when(retained[0].created_at) + ' PKT' : 'No successful backup yet'}</p></div>
              {busy && <p className="flex items-center gap-2 text-sm text-stone-600" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Saving your request…</p>}
              {activeJobs.map((job) => <div key={job.run_id} className="flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />{job.kind === 'NIGHTLY' ? 'Nightly' : 'Manual'} backup {job.status === 'RUNNING' ? 'running' : 'queued'}</div>)}
              {jobs[0]?.status === 'FAILED' && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">The latest backup job did not finish. Check its history; password delivery retries automatically.</p>}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="space-y-4 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-stone-50 text-brand-700"><RotateCcw aria-hidden="true" className="h-5 w-5" /></span>
              <div><h2 className="text-lg font-semibold text-brand-950">Moving to a new server?</h2><p className="mt-2 text-sm leading-6 text-stone-600">Recover your data using an encrypted backup and its matching password email.</p></div>
              <Button variant="outline" onClick={() => setRestore(!restore)} aria-expanded={restore} aria-controls="backup-recovery-steps" className="w-full gap-2">{restore ? 'Hide recovery steps' : 'Restore backup'}{restore ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}</Button>
              <p className="flex items-start gap-2 text-xs leading-5 text-stone-600"><ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />Recovery runs through a private recovery tool on your new server.</p>
              {restore && <ol id="backup-recovery-steps" className="space-y-4 border-t border-border pt-4 text-sm leading-6 text-stone-600">
                {[
                  ['Prepare the new server', 'Create an empty PostgreSQL 16 database and stop application workers.'],
                  ['Open the recovery tool', 'Start the local Database Recovery tool using the deployment instructions. No existing login is needed.'],
                  ['Choose your backup', 'Upload the .n360backup file, enter its emailed password, inspect the contents and confirm the backup ID.'],
                  ['Test, then switch your domain', 'Apply the recovered configuration and downloads, provision runtime permissions and test the new server before switching DNS. Existing platform sessions will be signed out.'],
                ].map(([title, description], index) => <li key={title} className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-stone-50 text-xs font-semibold text-brand-800">{index + 1}</span><div><p className="font-semibold text-brand-950">{title}</p><p className="mt-1">{description}</p></div></li>)}
              </ol>}
            </CardContent>
          </Card>

          <div className="flex items-start gap-3 px-1 text-xs leading-5 text-stone-600"><LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" /><p>Each backup has its own random 24-character password. Save the matching email alongside your recovery plan.</p></div>
        </aside>
      </div>
    </div>
  );
}
