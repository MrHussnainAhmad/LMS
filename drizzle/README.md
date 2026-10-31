# Database migrations

`0000_baseline.sql` creates the complete fresh-database structure through the
former `0088_attendance_delegation.sql`. It includes the actual PostgreSQL
constraints, indexes, functions, triggers, extension, and initial plan/notification
records, rather than only the objects represented by the ORM.

Use the existing command for both new installations and upgrades:

```sh
npm run db:migrate:production
```

It requires `DIRECT_URL` to point directly to PostgreSQL. The Docker `migrate`
service invokes the same runner. Do not run the baseline manually on a populated
database and do not use `drizzle-kit push` as the deployment migration path.

## Existing installations

The runner holds the existing PostgreSQL advisory lock and detects whether the
database is empty or already migrated. Empty databases install the baseline once.
Existing databases finish pending historical migrations, verify the expected
schema objects, and record the baseline checkpoint without executing its SQL or
reinitializing customer data. A baseline checkpoint is not recorded when the
schema or historical checksums do not match. Extra site-specific objects are
permitted; required objects must retain their expected definitions.

`legacy-history.json.gz` is a compressed, checksummed archive of all 100 original
SQL files and their 18 metadata files. Historical bytes are preserved; LF/CRLF
checkout variants are recognized when checking deployed migration hashes.
`legacy-history.mjs` reads archived SQL in memory for upgrades and historical
regression fixtures. The archive must remain in the migrator package. Eight old
SQL files were not in the production migration sequence; they are preserved in
the archive but are not newly replayed during upgrades.

To inspect an archived migration without extracting files:

```sh
node --input-type=module -e "import {readLegacyFile} from './drizzle/legacy-history.mjs'; console.log(readLegacyFile('0051_parent_identity.sql'))"
```

## Future changes

- Update `src/db/schema.ts`, then generate a new migration with Drizzle Kit.
- Keep `0000_baseline.sql`, its journal entry, the baseline catalog, and the
  historical archive immutable after deployment. New changes belong in new files.
- `meta/0000_snapshot.json` is the current ORM-model snapshot for subsequent
  generation. `baseline-catalog.json` records the actual pre-baseline
  PostgreSQL definitions used when adopting an existing database. The latter
  includes custom rules that Drizzle's model does not represent.
- Review generated SQL for custom functions/triggers/constraints; ORM generation
  does not manage all of those objects. The runner applies subsequent journal
  entries normally on both fresh and upgraded databases.
- Do not append new entries to the archived supplemental migration list. New
  migrations must be registered in the active journal.

The baseline installs schema and initial product records, not existing customer
data or administrator credentials. Restore customer data or provision the first
administrator separately.

## Verification

The existing backup verification suite includes an in-memory PostgreSQL test
comparing the consolidated baseline with the archived production migration path,
including the complete schema catalog and initial plan records:

```sh
node --import tsx --test --test-name-pattern "consolidated migration baseline" scripts/verify-central-backups.ts
```
