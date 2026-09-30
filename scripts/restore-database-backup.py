#!/usr/bin/env python3
"""Download a protected snapshot or verify/restore an existing one, locally only."""
import argparse, datetime, getpass, hashlib, json, os, re, shutil, sqlite3, urllib.request
from pathlib import Path

def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()

def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

def identifier(value):
    return '"' + value.replace('"', '""') + '"'

def cells_query(table):
    expressions = []
    for name in table['columns']:
        c = identifier(name)
        expressions.append(f"CASE typeof({c}) WHEN 'null' THEN 'NULL' WHEN 'text' THEN 'CAST(X''' || hex(CAST({c} AS BLOB)) || ''' AS TEXT)' WHEN 'blob' THEN 'X''' || hex({c}) || '''' ELSE quote({c}) END")
    return f"SELECT json_array({','.join(expressions)}) AS cells FROM {identifier(table['name'])} ORDER BY {','.join(map(identifier,table['orderBy']))}"

def table_hash(rows):
    return digest(''.join(digest(row) for row in rows))

def write_private(path, content):
    with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w', encoding='utf-8') as f:
        f.write(content)

def restore(snapshot_path, folder):
    raw = snapshot_path.read_bytes()
    backup = json.loads(raw)
    if backup.get('format') != 'skribo-database-backup' or backup.get('version') != 1 or backup.get('consistency') != 'single_read_only_d1_batch':
        raise ValueError('Unsupported backup format or snapshot consistency')
    if digest(compact(backup['schema'])) != backup['schemaSha256']:
        raise ValueError('Schema checksum mismatch')
    names = [t['name'] for t in backup['tables']]
    schema_tables = {s['name'] for s in backup['schema'] if s['type'] == 'table'}
    if len(names) != len(set(names)) or set(names) - {'sqlite_sequence'} != schema_tables:
        raise ValueError('Incomplete or duplicated table inventory')
    for table in backup['tables']:
        if len(table['rows']) != table['rowCount'] or table_hash(table['rows']) != table['sha256']:
            raise ValueError('Table row count/checksum mismatch: ' + table['name'])
    restored_path = folder / 'restored.sqlite'
    os.close(os.open(restored_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600))
    db = sqlite3.connect(restored_path)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=OFF')
    db.execute('BEGIN')
    statements = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']
    try:
        for schema in backup['schema']:
            if schema['type'] != 'table':
                continue
            if not re.match(r'^CREATE\s+TABLE\b', schema['sql'], re.I):
                raise ValueError('Unsupported table schema')
            db.execute(schema['sql'])  # execute accepts exactly one statement.
            statements.append(schema['sql'].rstrip(';') + ';')
        for table in backup['tables']:
            if table['name'] == 'sqlite_sequence':
                db.execute('DELETE FROM sqlite_sequence')
                statements.append('DELETE FROM sqlite_sequence;')
            for row in table['rows']:
                cells = json.loads(row)
                if len(cells) != len(table['columns']):
                    raise ValueError('Column count mismatch')
                for cell in cells:
                    if not isinstance(cell, str) or not re.fullmatch(r"NULL|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|X'[0-9A-F]*'|CAST\(X'[0-9A-F]*' AS TEXT\)", cell):
                        raise ValueError('Unsupported cell encoding')
                statement = f"INSERT INTO {identifier(table['name'])} ({','.join(map(identifier,table['columns']))}) VALUES ({','.join(cells)})"
                db.execute(statement)
                statements.append(statement + ';')
        for schema in backup['schema']:
            if schema['type'] == 'table':
                continue
            if schema['type'] not in ('index','view','trigger') or not re.match(r'^CREATE\s+(?:UNIQUE\s+)?' + schema['type'] + r'\b', schema['sql'], re.I):
                raise ValueError('Unsupported schema object')
            db.execute(schema['sql'])
            statements.append(schema['sql'].rstrip(';') + ';')
        db.commit()
        statements += ['COMMIT;', 'PRAGMA foreign_keys=ON;']
        db.execute('PRAGMA foreign_keys=ON')
        if [row[0] for row in db.execute('PRAGMA integrity_check')] != ['ok']:
            raise ValueError('Restored SQLite integrity check failed')
        actual_schema = [dict(row) for row in db.execute("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND substr(name,1,7) != 'sqlite_' AND substr(name,1,4) != '_cf_' ORDER BY type, name")]
        if compact(actual_schema) != compact(backup['schema']):
            raise ValueError('Restored schema differs')
        checks = []
        for table in backup['tables']:
            restored_rows = [row['cells'] for row in db.execute(cells_query(table))]
            if len(restored_rows) != table['rowCount'] or table_hash(restored_rows) != table['sha256']:
                raise ValueError('Restored records differ: ' + table['name'])
            checks.append({'table':table['name'], 'rows':table['rowCount'], 'sha256':table['sha256'], 'matches':True})
        foreign_keys = [dict(row) for row in db.execute('PRAGMA foreign_key_check')]
        if sorted(map(compact,foreign_keys)) != sorted(map(compact,backup['foreignKeyViolations'])):
            raise ValueError('Foreign-key check differs from source snapshot')
    finally:
        db.close()
    report = {'status':'verified','projectId':backup['projectId'],'capturedAt':backup['capturedAt'],
        'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'snapshotSha256':hashlib.sha256(raw).hexdigest(),
        'schemaMatches':True,'integrityCheck':'ok','foreignKeyViolationCount':len(foreign_keys),'tables':checks,
        'snapshot':str(snapshot_path),'restoredDatabase':str(restored_path),'excluded':backup['excluded']}
    write_private(folder / 'database.sql', '\n'.join(statements) + '\n')
    write_private(folder / 'verification.json', json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    write_private(folder / 'SHA256SUMS', '\n'.join(hashlib.sha256((folder/name).read_bytes()).hexdigest()+'  '+name for name in ['backup.json','database.sql','restored.sqlite','verification.json'])+'\n')
    write_private(folder / 'README.txt', 'Skribo production application database backup\n\nThe backup contains private student records. Keep this folder private.\nbackup.json: consistent source snapshot with schema, raw records and per-table checksums.\ndatabase.sql: portable schema and data restoration script.\nrestored.sqlite: separate local database restored and verified against every source row.\nverification.json: row counts, checksums and verification results.\nSHA256SUMS: file integrity hashes.\n\nThe live database was read only. No live records were restored or overwritten.\nBrowser-only unsaved drafts and Cloudflare internal service metadata are outside this database backup.\n\nTo repeat verification into a NEW folder:\npython3 restore-database-backup.py --file backup.json --destination /path/to/another/folder\nDo not overwrite a live database with this snapshot: records written after its timestamp must be preserved separately.\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--url')
    source.add_argument('--file',type=Path)
    parser.add_argument('--destination',type=Path,required=True)
    args = parser.parse_args()
    os.umask(0o077)
    args.destination.mkdir(parents=True,exist_ok=True)
    folder = args.destination / ('Scribo-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H%M%S-%fZ'))
    folder.mkdir(mode=0o700)
    snapshot = folder / 'backup.json'
    if args.url:
        if args.url != 'https://skribo-essay.andriisolonskyi.chatgpt.site/api/admin/database-backup':
            raise ValueError('Only the selected production Site export URL is allowed')
        token = getpass.getpass('Backup credential (hidden): ')
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*_args,**_kwargs):
                return None
        request = urllib.request.Request(args.url,data=b'',method='POST',headers={'X-Skribo-Backup-Key':token,'Accept':'application/json'})
        with urllib.request.build_opener(NoRedirect).open(request,timeout=120) as response:
            if response.status != 200 or 'application/json' not in response.headers.get('Content-Type',''):
                raise ValueError('Export did not return a complete JSON snapshot')
            with open(os.open(snapshot,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output:
                shutil.copyfileobj(response,output)
        del token,request
    else:
        with open(os.open(snapshot,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output:
            output.write(args.file.read_bytes())
    shutil.copyfile(__file__,folder / 'restore-database-backup.py')
    os.chmod(folder / 'restore-database-backup.py',0o600)
    result = restore(snapshot,folder)
    # Counts and hashes only; never print essays, names, tokens or other records.
    print(json.dumps(result))
