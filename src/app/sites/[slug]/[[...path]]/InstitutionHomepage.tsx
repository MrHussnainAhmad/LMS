import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import type { PublicInstitutionTenant } from "@/lib/institution-tenant";
import { institutionPublicUrl } from "@/lib/institution-domain";

const linkClass = "inline-flex h-11 items-center justify-center gap-2 px-5 text-xs font-bold transition-colors";

function SocialIcon({ name }: { name: "Facebook" | "Instagram" | "YouTube" }) {
  if (name === "Facebook") return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true"><path d="M13.7 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5H17V3.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2H7.5V13h2.8v8h3.4Z" /></svg>;
  if (name === "Instagram") return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.7" r="1" className="fill-current stroke-none" /></svg>;
  return <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true"><path d="M21.6 7.1a2.8 2.8 0 0 0-2-2C17.9 4.6 12 4.6 12 4.6s-5.9 0-7.6.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.9 2.8 2.8 0 0 0 2 2c1.7.5 7.6.5 7.6.5s5.9 0 7.6-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.9ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z" /></svg>;
}

export function InstitutionHomepage({ tenant, baseDomain, studentLoginUrl }: { tenant: PublicInstitutionTenant; baseDomain: string; studentLoginUrl: string }) {
  const institutionType = tenant.type.charAt(0) + tenant.type.slice(1).toLowerCase();
  const introduction = tenant.description || `${tenant.name} is a ${institutionType.toLowerCase()} in ${tenant.city}, ${tenant.country}.`;
  const hasLogo = tenant.logoKey.startsWith("http") || tenant.logoKey.startsWith("/");
  const hasContact = Boolean(tenant.publicEmail || tenant.publicPhone || tenant.publicAddress);
  const publicUrl = institutionPublicUrl(tenant.publicSlug, undefined, 'https:', baseDomain);
  const socialLinks = [
    { label: "Facebook" as const, href: tenant.facebookUrl },
    { label: "Instagram" as const, href: tenant.instagramUrl },
    { label: "YouTube" as const, href: tenant.youtubeUrl },
  ].filter((item): item is { label: "Facebook" | "Instagram" | "YouTube"; href: string } => Boolean(item.href));
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": tenant.type === "UNIVERSITY" ? "CollegeOrUniversity" : "EducationalOrganization",
    name: tenant.name,
    url: publicUrl,
    logo: hasLogo ? tenant.logoKey : undefined,
    image: tenant.heroImageUrl || undefined,
    email: tenant.publicEmail || undefined,
    telephone: tenant.publicPhone || undefined,
    address: { "@type": "PostalAddress", streetAddress: tenant.publicAddress || undefined, addressLocality: tenant.city, addressCountry: tenant.country },
  }).replace(/</g, "\\u003c");

  return (
    <div className="min-h-screen bg-[#f2efe7] text-[#171c1a] selection:bg-[var(--site-accent)] selection:text-white" style={{ "--site-accent": tenant.accentColor } as CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      {tenant.announcementText && (
        <div className="border-b border-white/15 bg-[var(--site-accent)] px-5 py-2 text-center text-[11px] font-semibold text-white">
          {tenant.announcementLink ? <Link href={tenant.announcementLink} className="underline-offset-4 hover:underline">{tenant.announcementText}</Link> : tenant.announcementText}
        </div>
      )}

      <header className="border-b border-black/10 bg-[#f2efe7]">
        <div className="mx-auto flex min-h-[78px] max-w-[1440px] items-center justify-between gap-5 px-5 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${tenant.name} home`}>
            {hasLogo ? (
              <Image src={tenant.logoKey} alt={`${tenant.name} logo`} width={44} height={44} className="h-11 w-11 border border-black/10 bg-white object-contain" />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center bg-[var(--site-accent)] text-sm font-bold text-white">{tenant.name.slice(0, 2).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <strong className="block truncate font-display text-base tracking-[-0.03em] sm:text-lg">{tenant.name}</strong>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45">{institutionType} / {tenant.city}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Institution navigation">
            <a href="#about" className="text-xs font-semibold text-black/55 hover:text-black">About</a>
            {tenant.programs.length > 0 && <a href="#programs" className="text-xs font-semibold text-black/55 hover:text-black">Programs</a>}
            {tenant.galleryImages.length > 0 && <a href="#campus" className="text-xs font-semibold text-black/55 hover:text-black">Campus</a>}
            {hasContact && <a href="#contact" className="text-xs font-semibold text-black/55 hover:text-black">Contact</a>}
            <Link href="/admissions/login" className="text-xs font-semibold text-black/55 hover:text-black">Applicant login</Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={studentLoginUrl} className={`${linkClass} border border-black/15 bg-transparent text-[#171c1a] hover:border-black`}>Student login</Link>
            {tenant.admissionsEnabled ? (
              <Link href="/admissions" className={`${linkClass} hidden shrink-0 bg-[#171c1a] text-white hover:bg-[var(--site-accent)] sm:inline-flex`}>Apply for admission <ArrowRight className="h-3.5 w-3.5" /></Link>
            ) : (
              <span className="hidden border border-black/15 px-4 py-2 text-[11px] font-semibold text-black/50 sm:block">Admissions closed</span>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1440px] border-x border-black/10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex min-h-[480px] flex-col justify-between border-b border-black/10 bg-[var(--site-accent)] p-6 text-white sm:p-10 lg:min-h-[620px] lg:border-b-0 lg:border-r lg:border-white/15 lg:p-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">{institutionType} / {tenant.city}, {tenant.country}</p>
            <div className="py-16">
              <h1 className="max-w-3xl font-display text-[clamp(2.8rem,6vw,5.8rem)] font-semibold leading-[0.95] tracking-[-0.055em]">{tenant.tagline || tenant.name}</h1>
              {tenant.tagline && <p className="mt-7 max-w-xl text-sm font-semibold uppercase tracking-[0.1em] text-white/65">{tenant.name}</p>}
            </div>
            <div className="flex flex-wrap gap-px">
              {tenant.admissionsEnabled && <Link href="/admissions" className={`${linkClass} bg-white text-[#171c1a] hover:bg-[#e8e5dc]`}>Admission information <ArrowRight className="h-3.5 w-3.5" /></Link>}
              <a href="#about" className={`${linkClass} border border-white/30 text-white hover:bg-white/10`}>Learn about us</a>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden border-b border-black/10 bg-[#d9d4c9] lg:min-h-[620px] lg:border-b-0">
            {tenant.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.heroImageUrl} alt={`${tenant.name} campus`} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-[#d9d4c9] p-10"><span className="font-display text-[clamp(5rem,14vw,12rem)] font-semibold tracking-[-0.08em] text-black/10">{tenant.name.slice(0, 2).toUpperCase()}</span></div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 bg-gradient-to-t from-black/60 to-transparent p-6 pt-24 text-white sm:p-8">
              <p className="max-w-md text-sm leading-6 text-white/80">{introduction}</p>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 sm:block">Our institution</span>
            </div>
          </div>
        </section>

        {tenant.statistics.length > 0 && (
          <section className="mx-auto grid max-w-[1440px] border-x border-t border-black/10 sm:grid-cols-2 lg:grid-cols-4">
            {tenant.statistics.map((stat, index) => <div key={`${stat.label}-${index}`} className="border-b border-r border-black/10 p-6 last:border-r-0 sm:p-8"><strong className="block font-display text-3xl tracking-[-0.04em] sm:text-4xl">{stat.value}</strong><span className="mt-2 block text-xs font-semibold text-black/50">{stat.label}</span></div>)}
          </section>
        )}

        <section id="about" className="scroll-mt-16 border-y border-black/10">
          <div className="mx-auto grid max-w-[1440px] border-x border-black/10 lg:grid-cols-[0.35fr_0.65fr]">
            <div className="border-b border-black/10 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">About</p>
              <h2 className="mt-5 max-w-sm font-display text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">{tenant.aboutTitle || `Welcome to ${tenant.name}`}</h2>
            </div>
            <div className="p-6 sm:p-10 lg:p-14">
              <p className="max-w-3xl whitespace-pre-line text-base leading-8 text-black/65 sm:text-lg">{introduction}</p>
              {(tenant.mission || tenant.vision) && (
                <div className="mt-12 grid border-l border-t border-black/10 sm:grid-cols-2">
                  {tenant.mission && <div className="border-b border-r border-black/10 p-6"><h3 className="text-xs font-bold uppercase tracking-[0.14em]">Mission</h3><p className="mt-4 whitespace-pre-line text-sm leading-7 text-black/60">{tenant.mission}</p></div>}
                  {tenant.vision && <div className="border-b border-r border-black/10 p-6"><h3 className="text-xs font-bold uppercase tracking-[0.14em]">Vision</h3><p className="mt-4 whitespace-pre-line text-sm leading-7 text-black/60">{tenant.vision}</p></div>}
                </div>
              )}
            </div>
          </div>
        </section>

        {tenant.programs.length > 0 && (
          <section id="programs" className="scroll-mt-16 bg-[#171c1a] text-white">
            <div className="mx-auto max-w-[1440px] border-x border-white/10 px-6 py-16 sm:px-10 sm:py-20 lg:px-14">
              <div className="grid gap-8 border-b border-white/15 pb-10 lg:grid-cols-[0.35fr_0.65fr]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Academic programs</p>
                <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">What students can study here.</h2>
              </div>
              <div>{tenant.programs.map((program, index) => <article key={`${program.title}-${index}`} className="grid gap-3 border-b border-white/15 py-7 sm:grid-cols-[80px_0.45fr_0.55fr] sm:gap-8"><span className="text-xs font-semibold text-white/35">{String(index + 1).padStart(2, "0")}</span><h3 className="font-display text-xl font-semibold sm:text-2xl">{program.title}</h3><p className="text-sm leading-7 text-white/55">{program.description || "Contact the institution for program details."}</p></article>)}</div>
            </div>
          </section>
        )}

        {tenant.principalMessage && (
          <section className="border-b border-black/10">
            <div className="mx-auto grid max-w-[1440px] border-x border-black/10 lg:grid-cols-[0.38fr_0.62fr]">
              <div className="min-h-[380px] border-b border-black/10 bg-[#d9d4c9] lg:border-b-0 lg:border-r">
                {tenant.principalImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tenant.principalImageUrl} alt={tenant.principalName || "Institution leader"} className="h-full min-h-[380px] w-full object-cover" />
                ) : <div className="grid h-full min-h-[380px] place-items-center bg-[var(--site-accent)] text-white/20"><span className="font-display text-8xl font-semibold">“</span></div>}
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">From the leadership</p>
                <blockquote className="mt-7 max-w-3xl whitespace-pre-line font-display text-2xl font-medium leading-[1.45] tracking-[-0.025em] sm:text-3xl">“{tenant.principalMessage}”</blockquote>
                <p className="mt-8 text-sm font-bold">{tenant.principalName || "Institution leadership"}</p>
                {tenant.principalTitle && <p className="mt-1 text-xs text-black/50">{tenant.principalTitle}</p>}
              </div>
            </div>
          </section>
        )}

        {tenant.highlights.length > 0 && (
          <section className="border-b border-black/10 bg-[#e9e5dc]">
            <div className="mx-auto max-w-[1440px] border-x border-black/10 px-6 py-16 sm:px-10 sm:py-20 lg:px-14">
              <div className="grid gap-8 lg:grid-cols-[0.35fr_0.65fr]">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">Institution life</p><h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">What we provide</h2></div>
                <div className="border-t border-black/15">{tenant.highlights.map((highlight, index) => <article key={`${highlight.title}-${index}`} className="grid gap-2 border-b border-black/15 py-6 sm:grid-cols-[0.4fr_0.6fr] sm:gap-8"><h3 className="font-display text-lg font-semibold">{highlight.title}</h3><p className="text-sm leading-7 text-black/55">{highlight.description || "Available to our students and community."}</p></article>)}</div>
              </div>
            </div>
          </section>
        )}

        {tenant.galleryImages.length > 0 && (
          <section id="campus" className="scroll-mt-16 border-b border-black/10 bg-[#f2efe7]">
            <div className="mx-auto max-w-[1440px] border-x border-black/10 px-6 py-16 sm:px-10 sm:py-20 lg:px-14">
              <div className="mb-10 flex items-end justify-between gap-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">Campus</p><h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Inside {tenant.name}</h2></div><span className="hidden text-xs font-semibold text-black/40 sm:block">{tenant.galleryImages.length} photographs</span></div>
              <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
                {tenant.galleryImages.map((image, index) => (
                  <figure key={`${image.url}-${index}`} className="relative aspect-[4/3] overflow-hidden bg-[#d9d4c9]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.caption || `${tenant.name} campus`} className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]" />
                    {image.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-black/65 px-4 py-3 text-xs font-semibold text-white">{image.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-black/10 bg-[var(--site-accent)] text-white">
          <div className="mx-auto grid max-w-[1440px] gap-8 border-x border-white/15 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[0.65fr_0.35fr] lg:items-end lg:px-14">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Admissions</p><h2 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Applications to {tenant.name}</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">{tenant.admissionsEnabled ? "Review available admission rounds, submit an application, or check an application already in progress." : "Admissions are currently closed. Please contact the institution for further information."}</p></div>
            <div className="flex flex-wrap gap-px lg:justify-end">{tenant.admissionsEnabled && <Link href="/admissions" className={`${linkClass} bg-white text-[#171c1a] hover:bg-[#e8e5dc]`}>View admissions <ArrowRight className="h-3.5 w-3.5" /></Link>}<Link href="/admissions/login" className={`${linkClass} border border-white/30 text-white hover:bg-white/10`}>Applicant login</Link></div>
          </div>
        </section>

        {hasContact && (
          <section id="contact" className="scroll-mt-16 border-b border-black/10">
            <div className="mx-auto grid max-w-[1440px] border-x border-black/10 lg:grid-cols-[0.35fr_0.65fr]">
              <div className="border-b border-black/10 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--site-accent)]">Contact</p><h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Speak with the institution</h2></div>
              <div className="divide-y divide-black/10">
                {tenant.publicAddress && <div className="grid gap-4 p-6 sm:grid-cols-[150px_1fr] sm:p-8"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]"><MapPin className="h-4 w-4" />Address</span><div><p className="whitespace-pre-line text-sm leading-7 text-black/60">{tenant.publicAddress}</p>{tenant.mapUrl && <a href={tenant.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--site-accent)]">View map <ExternalLink className="h-3.5 w-3.5" /></a>}</div></div>}
                {tenant.publicPhone && <a href={`tel:${tenant.publicPhone}`} className="grid gap-4 p-6 hover:bg-black/[0.025] sm:grid-cols-[150px_1fr] sm:p-8"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]"><Phone className="h-4 w-4" />Phone</span><span className="text-sm font-semibold">{tenant.publicPhone}</span></a>}
                {tenant.publicEmail && <a href={`mailto:${tenant.publicEmail}`} className="grid gap-4 p-6 hover:bg-black/[0.025] sm:grid-cols-[150px_1fr] sm:p-8"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em]"><Mail className="h-4 w-4" />Email</span><span className="break-all text-sm font-semibold">{tenant.publicEmail}</span></a>}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-[#171c1a] px-5 py-10 text-white md:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div><div className="flex items-center gap-3">{hasLogo && <Image src={tenant.logoKey} alt="" width={36} height={36} className="h-9 w-9 bg-white object-contain" />}<strong className="font-display text-lg">{tenant.name}</strong></div><p className="mt-4 text-xs text-white/45">{tenant.city}, {tenant.country}</p></div>
          {socialLinks.length > 0 && <nav className="flex items-center gap-2" aria-label="Social media">{socialLinks.map(({ label, href }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="grid h-10 w-10 place-items-center border border-white/15 text-white/55 transition-colors hover:border-white/40 hover:text-white"><SocialIcon name={label} /></a>)}</nav>}
        </div>
        <div className="mx-auto mt-9 flex max-w-[1440px] flex-col justify-between gap-2 border-t border-white/10 pt-5 text-[10px] text-white/35 sm:flex-row"><span>© {new Date().getFullYear()} {tenant.name}</span><span>Admissions and institution services powered by Nisaab360</span></div>
      </footer>
    </div>
  );
}
