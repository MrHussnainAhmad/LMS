For quick local testing, use a normal terminal with Docker Desktop running and Node 24:

```powershell
cd D:\lms-backend-tunned\lms-backend
npm start
```

The app runs directly on your computer at **http://localhost:3000/login/super-admin**.
Pages compile as you open them and source changes update automatically. Docker
runs only PostgreSQL, PgBouncer and Valkey. No production images are built and no
migrations run during ordinary startup. The previous Docker website and its
workers are stopped so they do not occupy port 3000. Database volumes and existing
accounts are preserved. Keep this terminal open; Ctrl+C stops the local app.
Existing local credentials are reused. Docker checks have short timeouts, and
startup checks the database before launching the app. An unresponsive database
produces an error instead of reporting a working login screen.

Use the full Docker stack when testing the production build and database backup worker:

```powershell
cd D:\lms-backend-tunned\lms-backend
npm run local:docker -- --backups
```

This starts the existing Linux images and the backup worker. It does not rebuild
the website, stop it for migrations, or take another migration snapshot.
If only the backup worker image is missing, it builds just that small image.
Existing worker services are left as they are; omit `--backups` to avoid starting
the backup worker if it is stopped.
Enabling the backup worker permits the configured nightly job and password-email
retries as well as manually requested database backups.

For first setup, or after changing source code or database migrations, explicitly
build and update the stack:

```powershell
npm run local:docker -- --rebuild --backups
```

This saves an encrypted database snapshot before applying migrations, provisions
the restricted runtime role, and starts the updated website and backup worker.
The production build can take several minutes; ordinary starts reuse its result.
Existing accounts and database volumes are preserved. Security migrations may
require signing in again. The rebuild path stops background mail, payment and
school restore workers; it does not restart those automatically.

Open **https://localhost/login/super-admin**. Accept the local Caddy certificate
if your browser prompts. HTTP on port 3000 redirects to this HTTPS site because
the production build uses secure session cookies. This local overlay publishes
web ports only on loopback and does not use public ACME certificates.

Use the existing private `.env`. The launcher generates missing local runtime
secrets in the ignored `.env.local-docker`; it does not rewrite `.env`. Keep that
file private and keep it with `.codex/local-docker` if you need the encrypted
pre-migration safety copies. Do not delete Docker volumes to rebuild.
If no signed Cloudinary upload preset is configured, local startup uses a
placeholder so the rest of the site can run. Configure the real
`CLOUDINARY_CONTENT_UPLOAD_PRESET` in `.env` to test file uploads.

For Google Drive connection testing, register this exact authorized redirect URI
in the Google OAuth client used for central backups:

```text
https://localhost/api/sa/central-backup/google-drive/callback
```

Connect Drive and verify the recovery email in Super Admin before using Backup
Now. This testing flow uses the configured real Drive/email providers when you
request those operations. No passwords are reset automatically.

`npm start` runs the local app; `npm run local:docker` runs the Docker website.
The older explicit `npm start -- --backups` and `--rebuild` commands still select
the Docker workflow for compatibility. Run
`npm start -- --prepare-only` to validate configuration without starting services
or applying migrations.

`npm run build:local` creates a Windows production build in `.next` without
connecting to a database or providers. The Docker launcher builds Linux images
separately. `npm run local:docker -- --prepare-only` validates configuration
without starting services or applying migrations. Production deployment uses
the normal release configuration, never `deployment/compose.local-test.yml`.
