// Complete application database snapshot. Every production SQL statement is
// read-only; schema and rows are captured together in one D1 batch transaction.
export const SCHEMA_SQL = "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND substr(name,1,7) != 'sqlite_' AND substr(name,1,4) != '_cf_' ORDER BY type, name";
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ROWS = 20000;
const MAX_TABLES = 20;
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
export async function sha256(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function backupAuthorized(request, tokenHash, expiresAt, now = Date.now()) {
  const expires = Date.parse(expiresAt || "");
  if (!/^[a-f0-9]{64}$/.test(tokenHash || "") || !Number.isFinite(expires) || expires <= now) return false;
  const token = request.headers.get("x-skribo-backup-key") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const candidate = await sha256(token);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= candidate.charCodeAt(i) ^ tokenHash.charCodeAt(i);
  return difference === 0;
}

// Hex encodings preserve all TEXT bytes (including NUL and Unicode) and BLOBs.
// Numeric literals stay strings, so 64-bit integers never pass through JS Number.
export function cellsQuery(table) {
  const values = table.columns.map(name => {
    const column = quote(name);
    return `CASE typeof(${column}) WHEN 'null' THEN 'NULL' WHEN 'text' THEN 'CAST(X''' || hex(CAST(${column} AS BLOB)) || ''' AS TEXT)' WHEN 'blob' THEN 'X''' || hex(${column}) || '''' ELSE quote(${column}) END`;
  });
  return `SELECT json_array(${values.join(",")}) AS cells FROM ${quote(table.name)} ORDER BY ${table.orderBy.map(quote).join(",")}`;
}

function checked(result) {
  if (result.success !== true || result.meta?.rows_written !== 0 || result.meta?.changed_db) throw new Error("snapshot_read_failed");
  return result.results;
}

export async function createDatabaseBackup(binding, projectId) {
  const db = binding.withSession ? binding.withSession("first-primary") : binding;
  const schema = checked(await db.prepare(SCHEMA_SQL).all());
  const definitions = schema.filter(item => item.type === "table");
  if (!definitions.length || definitions.length > MAX_TABLES || definitions.some(item => /CREATE\s+VIRTUAL\s+TABLE/i.test(item.sql))) throw new Error("unsupported_snapshot_schema");
  const tables = [];
  for (const definition of definitions) {
    const info = checked(await db.prepare(`PRAGMA table_xinfo(${quote(definition.name)})`).all());
    const columns = info.filter(column => column.hidden === 0).map(column => column.name);
    if (!columns.length || columns.length >= 100) throw new Error("unsupported_snapshot_columns");
    const withoutRowid = /WITHOUT\s+ROWID\s*;?\s*$/i.test(definition.sql);
    const rowid = withoutRowid ? null : ["_rowid_", "rowid", "oid"].find(name => !info.some(column => column.name.toLowerCase() === name));
    if (!withoutRowid && !rowid) throw new Error("unsupported_snapshot_rowid");
    const orderBy = rowid ? [rowid] : info.filter(column => column.pk).sort((a,b) => a.pk-b.pk).map(column => column.name);
    if (!orderBy.length) throw new Error("unsupported_snapshot_order");
    tables.push({ name: definition.name, columns: rowid ? [rowid, ...columns] : columns, orderBy });
  }
  // sqlite_sequence is created automatically by AUTOINCREMENT table schemas.
  const sequences = checked(await db.prepare("SELECT name FROM sqlite_schema WHERE name='sqlite_sequence'").all());
  if (sequences.length) tables.push({ name: "sqlite_sequence", columns: ["_rowid_", "name", "seq"], orderBy: ["_rowid_"] });
  const countsSql = tables.map(table => `SELECT count(*) AS row_count, coalesce(sum(${table.columns.map(name => `coalesce(length(CAST(${quote(name)} AS BLOB)),0)`).join("+")}),0) AS byte_count FROM ${quote(table.name)}`);
  const preflight = await db.batch(countsSql.map(sql => db.prepare(sql)));
  const preCounts = preflight.map(result => checked(result)[0]);
  if (preCounts.reduce((sum, item) => sum + item.byte_count, 0) > MAX_BYTES || preCounts.reduce((sum, item) => sum + item.row_count, 0) > MAX_ROWS) throw new Error("snapshot_exceeds_safe_export_limit");
  const capturedAt = new Date().toISOString();
  const snapshot = await db.batch([
    db.prepare(SCHEMA_SQL),
    ...tables.flatMap((table, index) => [db.prepare(countsSql[index]), db.prepare(cellsQuery(table))]),
    db.prepare("PRAGMA foreign_key_check"),
  ]);
  const actualSchema = checked(snapshot[0]);
  if (JSON.stringify(actualSchema) !== JSON.stringify(schema)) throw new Error("schema_changed_during_export");
  let bytes = 0, count = 0;
  for (let index = 0; index < tables.length; index++) {
    const totals = checked(snapshot[1 + index * 2])[0];
    const rows = checked(snapshot[2 + index * 2]).map(row => row.cells);
    if (rows.length !== totals.row_count) throw new Error("incomplete_snapshot");
    bytes += totals.byte_count; count += totals.row_count;
    if (bytes > MAX_BYTES || count > MAX_ROWS) throw new Error("snapshot_exceeds_safe_export_limit");
    const hashes = [];
    for (const row of rows) hashes.push(await sha256(row));
    Object.assign(tables[index], { rowCount: rows.length, byteCount: totals.byte_count, sha256: await sha256(hashes.join("")), rows });
  }
  return { format: "skribo-database-backup", version: 1, projectId, capturedAt,
    consistency: "single_read_only_d1_batch", scope: "all_application_schema_and_rows",
    excluded: ["Cloudflare internal _cf_ metadata", "SQLite internal indexes/statistics regenerated on restore", "browser-only unsaved guest drafts"],
    schema, schemaSha256: await sha256(JSON.stringify(schema)), foreignKeyViolations: checked(snapshot.at(-1)), tables };
}

// Stream JSON instead of allocating a second copy of the complete snapshot.
export function backupResponse(backup) {
  function* chunks() {
    const { tables, ...metadata } = backup;
    yield JSON.stringify(metadata).slice(0, -1) + ',"tables":[';
    for (let index = 0; index < tables.length; index++) {
      const { rows, ...table } = tables[index];
      yield (index ? "," : "") + JSON.stringify(table).slice(0, -1) + ',"rows":[';
      for (let row = 0; row < rows.length; row++) yield (row ? "," : "") + JSON.stringify(rows[row]);
      yield "]}";
    }
    yield "]}";
  }
  const iterator = chunks();
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ pull(controller) {
    const next = iterator.next();
    if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value));
  } }), { headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": 'attachment; filename="skribo-database-backup.json"',
    "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  } });
}
