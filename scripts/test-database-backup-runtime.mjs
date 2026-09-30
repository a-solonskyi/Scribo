import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createDatabaseBackup, backupResponse } from '../src/utils/databaseBackup.js';
import { encodeDraft } from '../src/utils/draftEncoding.js';
const mf = new Miniflare({modules:true,script:'export default { fetch(){return new Response("Local backup test")} }',d1Databases:['DB']});
try {
  const db=await mf.getD1Database('DB');
  for(const file of ['drizzle/0000_mysterious_garia.sql','drizzle/0001_burly_swordsman.sql']) {
    await db.batch(readFileSync(file,'utf8').split('--> statement-breakpoint').map(sql=>db.prepare(sql.trim())));
  }
  await db.prepare('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)').run();
  const events=Array.from({length:6000},(_,index)=>({event_type:'insert',position:index,inserted_text:'я',timestamp_ms:index}));
  const draft={studentName:'Synthetic',essayText:'я'.repeat(6000),essayHtml:'<p>'+ 'я'.repeat(6000)+'</p>',eventLog:events,pasteEvents:[],pasteOriginRanges:[],pauseEvents:[],startedAt:1};
  const encoded=await encodeDraft(draft);
  await db.batch([
    db.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').bind('synthetic',100),
    db.prepare('INSERT INTO approved_professors(user_id,email,created_at) VALUES (?,?,?)').bind('synthetic','synthetic@example.test','2026-09-30'),
    db.prepare('INSERT INTO classes(id,professor_id,name,created_at) VALUES (?,?,?,?)').bind('class','synthetic','Fixture','2026-09-30'),
    db.prepare('INSERT INTO assignments(id,class_id,professor_id,topic,public_token,created_at) VALUES (?,?,?,?,?,?)').bind('assignment','class','synthetic','Fixture','fixture','2026-09-30'),
    db.prepare('INSERT INTO submissions(id,assignment_id,student_name,final_text,stats_json,event_log_json,paste_events_json,pause_events_json,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)').bind('submission','assignment','Synthetic',draft.essayText,'{"legacy":true}',JSON.stringify(events),'[]','[]','2026-09-30'),
    db.prepare('INSERT INTO student_drafts(id,assignment_id,user_id,draft_json,revision,updated_at) VALUES (?,?,?,?,?,?)').bind('draft','assignment','synthetic',encoded,'revision-synthetic','2026-09-30'),
    db.prepare('INSERT INTO response_annotations(id,submission_id,professor_id,type,start_offset,end_offset,text_quote,comment_text,color,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind('annotation','submission','synthetic','comment',0,1,'я','Preserved','yellow','2026-09-30','2026-09-30'),
  ]);
  const before=(await db.prepare('SELECT draft_json FROM student_drafts').first()).draft_json;
  const backup=await createDatabaseBackup(db,'synthetic-d1-runtime');
  const folder=mkdtempSync(join(tmpdir(),'skribo-d1-restore-'));
  const file=join(folder,'snapshot.json');writeFileSync(file,await backupResponse(backup).text(),{mode:0o600});
  const report=JSON.parse(execFileSync('python3',['scripts/restore-database-backup.py','--file',file,'--destination',folder],{encoding:'utf8'}));
  assert.equal(report.status,'verified');assert.equal(report.foreignKeyViolationCount,0);assert.equal(report.tables.length,8);
  assert.equal((await db.prepare('SELECT draft_json FROM student_drafts').first()).draft_json,before);
  console.log(JSON.stringify({status:'passed',runtime:'Miniflare D1',tables:report.tables.length,events:events.length,restored:true,sourceUnchanged:true}));
} finally {await mf.dispose();}
