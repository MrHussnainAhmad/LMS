import { pool } from '@/db';
export async function assertRuntimeDatabaseRole() {
  if (process.env.DEPLOYMENT_ENV !== 'production') return;
  const result = await pool.query(`SELECT r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=r.oid) AS owns_objects,
    EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS has_memberships,
    EXISTS (SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND d.datdba=r.oid) AS owns_database,
    EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='public' AND n.nspowner=r.oid) AS owns_schema,
    has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects,
    has_database_privilege(current_user,current_database(),'CREATE') AS can_create_schemas
    FROM pg_roles r WHERE r.rolname=current_user`);
  const role = result.rows[0];
  if (!role || Object.values(role).some(Boolean)) throw new Error('Refusing an overprivileged application database role; provision a separate runtime login');
}
