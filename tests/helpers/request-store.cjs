const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');
exports.fixture=()=>{
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('migrations/0002_request_workflow.sql','utf8'));
 const statement=(q,args=[])=>({bind:(...a)=>statement(q,a),first:async()=>db.prepare(q).get(...args)||null,all:async()=>({results:db.prepare(q).all(...args)}),run:async()=>{const r=db.prepare(q).run(...args);return {success:true,meta:{changes:r.changes}}}});
 const env={REQUESTS_DB:{prepare:q=>statement(q),batch:async queries=>{db.exec('BEGIN');try{const rows=[];for(const query of queries)rows.push(await query.run());db.exec('COMMIT');return rows}catch(e){db.exec('ROLLBACK');throw e}}}};
 return {db,env};
};
