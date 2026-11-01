# Nisaab360 search files

These are ready-to-host copies for `https://nisaab360.app`:

| File | Public URL |
| --- | --- |
| `sitemap.xml` | `https://nisaab360.app/sitemap.xml` |
| `robots.txt` | `https://nisaab360.app/robots.txt` |
| `llms.txt` | `https://nisaab360.app/llms.txt` |

The apex-domain XML snapshot contains 13 public URLs: the seven built-in public pages plus About Us, Contact, Privacy Policy, Terms of Service, Security, and GDPR. At the user's request, all six named managed pages are included in the application generator and export ahead of content publication. Their inclusion does not depend on database records already existing. Actual database update dates override the default entries when records exist, without duplicating URLs. All 13 public pages are linked from llms.txt and permitted by the main-domain robots rules.

All login pages, including employee, institution/admin and super-admin logins, and private portal pages remain excluded from the sitemap. The apex generator also includes other eligible managed pages. Blogs have a separate, automatically updated sitemap at `https://blog.nisaab360.app/sitemap.xml`, containing the blog homepage and published article URLs on that same host. With no published posts, it contains only the blog homepage. The blog's robots.txt points to this blog sitemap. No Search Console submission was performed.

After deploying sitemap changes or publishing managed pages/posts, refresh this downloadable snapshot from the running generator instead of exporting with empty database placeholders:

```powershell
Invoke-WebRequest -Uri 'https://nisaab360.app/sitemap.xml' -OutFile 'deployment/seo/sitemap.xml'
```

Inspect the XML and confirm it still excludes login/private paths before publishing the standalone copy. A sitemap entry does not create its target page.

The main-domain robots rules allow public pages and their resources, including `/api/version`, and disallow only login and private portal prefixes. FAQ, blog, About, Contact, Privacy, Terms, Security and GDPR paths are allowed; each page still needs published content to be indexed. The broader API/workflow restrictions were removed. Existing application authentication still controls access to private data. Active tenant subdomains retain their separate API/site restrictions and version-check exception.

## Publish with this application

Deploy the updated `src/app/sitemap.ts`, `src/app/robots.ts`, and `public/llms.txt` through the normal production build/release process. Next.js serves them at the three public URLs above. These local changes do not update an already-running deployment.

Do not copy this directory's `sitemap.xml` or `robots.txt` into `public/` while the existing metadata routes remain: they would compete for the same URLs. The files in this directory are standalone exports for download or a separately configured web server. They are not automatically served by Next.js. For a separate static host, serve these filenames from the domain's web root; these rules are intended for the apex domain, not tenant subdomains. The static sitemap snapshot needs manual updates as public content changes.

## Submit to Google

1. Deploy the updated application, or publish the standalone files with your web server.
2. Open all three public URLs and confirm the new content appears. The updated sitemap contains `/faq`, `/download-app`, and `/download-software`, and does not contain `/login`. If a CDN cache override still returns old content after deployment, purge these exact URLs.
3. In Google Search Console, select the verified `nisaab360.app` Domain property, open **Sitemaps**, and submit both `https://nisaab360.app/sitemap.xml` and `https://blog.nisaab360.app/sitemap.xml`. If you use URL-prefix properties instead, verify the blog's HTTPS URL-prefix property separately and submit its sitemap there.

The blog sitemap and canonical URLs use `https://blog.nisaab360.app/` and `https://blog.nisaab360.app/article-slug`. The apex sitemap does not advertise the older `/blog` copies. Deploy the blog pages alongside the sitemap/robots changes; this also corrects article links, the back-to-blog link, paginated canonical URLs, and article sharing metadata. Publishing new posts requires no sitemap export when using the application's dynamic blog sitemap.

Search Console receives the hosted sitemap URL, not a local file upload. Keep `robots.txt` at the domain root; Google fetches it automatically. `llms.txt` is descriptive information for tools that support it, not a sitemap to submit to Google. It is not required for Google's AI search features.

References: [Google sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Google robots.txt setup](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt), [Google AI features](https://developers.google.com/search/docs/appearance/ai-features).
