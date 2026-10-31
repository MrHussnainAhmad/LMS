// PostgreSQL's own definitions include rules not represented by the ORM schema.
// Ignore migration bookkeeping and extension-owned objects, but retain application
// columns, enum order, sequences, constraints, indexes, functions and triggers.
export async function readSchemaCatalog(client) {
  await client.query('SET search_path TO public, pg_catalog');
  const { rows } = await client.query(`
    WITH app_relations AS (
      SELECT c.oid, c.relname, c.relkind FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname <> 'nisaab360_supplemental_migrations'
        AND c.relname <> 'nisaab360_supplemental_migrations_pkey'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
    )
    SELECT 'relation:'||relname AS key, relkind::text AS definition FROM app_relations WHERE relkind IN ('r','p')
    UNION ALL
    SELECT 'column:'||r.relname||'.'||a.attname,
      jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
        'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))::text
      FROM app_relations r JOIN pg_attribute a ON a.attrelid=r.oid
      LEFT JOIN pg_attrdef d ON d.adrelid=r.oid AND d.adnum=a.attnum
      WHERE r.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL
    SELECT 'constraint:'||r.relname||'.'||c.conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c JOIN app_relations r ON r.oid=c.conrelid
    UNION ALL
    SELECT 'index:'||r.relname,
      jsonb_build_object('definition',pg_get_indexdef(r.oid),'valid',i.indisvalid,'ready',i.indisready)::text
      FROM app_relations r JOIN pg_index i ON i.indexrelid=r.oid WHERE relkind='i'
    UNION ALL
    SELECT 'sequence:'||r.relname,
      jsonb_build_object('type',format_type(s.seqtypid,NULL),'start',s.seqstart,'increment',s.seqincrement,
        'min',s.seqmin,'max',s.seqmax,'cache',s.seqcache,'cycle',s.seqcycle)::text
      FROM pg_sequence s JOIN app_relations r ON r.oid=s.seqrelid
    UNION ALL
    SELECT 'enum:'||t.typname, jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)::text
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname='public' GROUP BY t.typname
    UNION ALL
    SELECT 'function:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    UNION ALL
    SELECT 'trigger:'||r.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)
      FROM pg_trigger t JOIN app_relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal
    ORDER BY key
  `);
  return rows.map(row => ({ ...row, definition: normalizeDefinition(row.definition) }));
}

function normalizeDefinition(definition) {
  // pg_dump/reparse expands a varchar-array-to-text-array coercion into casts
  // on its elements. Canonicalize just that equivalent PostgreSQL representation.
  return definition.replace(/\r\n/g, '\n').replace(/\(ARRAY\[((?:'(?:[^']|'')*'::character varying(?:, )?)*)\]\)::text\[\]/g,
    (_match, elements) => `ARRAY[${elements.replace(/('(?:[^']|'')*'::character varying)/g, '($1)::text')}]`);
}

export async function assertBaselineSchema(client, expected) {
  const actual = new Map((await readSchemaCatalog(client)).map(row => [row.key, row.definition]));
  const mismatches = expected.filter(row => actual.get(row.key) !== normalizeDefinition(row.definition));
  if (mismatches.length) {
    throw new Error(`Refusing to adopt the migration baseline: ${mismatches.length} schema objects are missing or different. First mismatches: ${mismatches.slice(0, 12).map(row => row.key).join(', ')}. No baseline checkpoint was recorded.`);
  }
}
