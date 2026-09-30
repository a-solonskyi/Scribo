import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { backupAuthorized, createDatabaseBackup, backupResponse, sha256 } from './databaseBackup.js';

test('export authentication rejects missing, incorrect and expired credentials', async () => {
  const token = 'ab'.repeat(32), hash = await sha256(token), expires = '2030-01-01T00:00:00Z';
  const request = value => new Request('https://example.test/api/admin/database-backup',{headers:{'x-skribo-backup-key':value}});
  assert.equal(await backupAuthorized(request(token),hash,expires),true);
  assert.equal(await backupAuthorized(request('cd'.repeat(32)),hash,expires),false);
  assert.equal(await backupAuthorized(request(token),hash,'2000-01-01T00:00:00Z'),false);
  assert.equal(await backupAuthorized(request(''),hash,expires),false);
  assert.equal(await backupAuthorized(request(token),undefined,expires),false);
});

test('complete read-only snapshot restores exact NUL/Unicode text, blobs, large integers, rowids, sequence, indexes and relationships', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE parents (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, data BLOB, big INTEGER, value REAL); CREATE UNIQUE INDEX parent_text ON parents(text); CREATE TABLE children (id TEXT PRIMARY KEY, parent_id INTEGER REFERENCES parents(id));');
  db.prepare('INSERT INTO parents (text,data,big,value) VALUES (?,?,?,?)').run('Есе 📚\u0000 after NUL',new Uint8Array([0,255,128]),9007199254740993n,1.2345678901234567);
  db.exec("INSERT INTO children VALUES ('child',1); INSERT INTO parents(id,text) VALUES(900,'deleted'); DELETE FROM parents WHERE id=900;");
  const before = db.prepare('SELECT hex(text) AS text,hex(data) AS data,CAST(big AS TEXT) AS big FROM parents').all();
  const adapter = {
    prepare(sql) {
      assert.match(sql,/^(SELECT|PRAGMA (table_xinfo|foreign_key_check))/);
      return { sql, all() { return {success:true,meta:{rows_written:0,changed_db:false},results:db.prepare(sql).all()}; } };
    },
    batch(statements) { db.exec('BEGIN'); try { const result=statements.map(statement=>statement.all()); db.exec('COMMIT'); return result; } catch(error) { db.exec('ROLLBACK'); throw error; } },
  };
  const backup = await createDatabaseBackup(adapter,'synthetic-test');
  assert.deepEqual(db.prepare('SELECT hex(text) AS text,hex(data) AS data,CAST(big AS TEXT) AS big FROM parents').all(),before);
  const response = backupResponse(backup);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
  const folder = mkdtempSync(join(tmpdir(),'skribo-backup-test-'));
  const file = join(folder,'source.json');
  writeFileSync(file,await response.text(),{mode:0o600});
  const output=execFileSync('python3',['scripts/restore-database-backup.py','--file',file,'--destination',folder],{encoding:'utf8'});
  const report=JSON.parse(output);
  assert.equal(report.status,'verified'); assert.equal(report.foreignKeyViolationCount,0);
  assert.ok(report.tables.every(table=>table.matches));
  const restored = new DatabaseSync(report.restoredDatabase);
  assert.deepEqual(restored.prepare('SELECT hex(text) AS text,hex(data) AS data,CAST(big AS TEXT) AS big FROM parents').all(),before);
  assert.equal(restored.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get('parents').seq,900);
  const damaged=JSON.parse(readFileSync(file,'utf8')); damaged.tables[0].rows[0]+=' ';
  const damagedPath=join(folder,'damaged.json'); writeFileSync(damagedPath,JSON.stringify(damaged),{mode:0o600});
  assert.throws(()=>execFileSync('python3',['scripts/restore-database-backup.py','--file',damagedPath,'--destination',folder],{stdio:'pipe'}));
  restored.close(); db.close();
});
