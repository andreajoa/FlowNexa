import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function identityDatabase(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of ['0001_initial.sql','0002_oauth.sql','0006_identity.sql'])sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 function prepared(sql,args=[]){return{bind(...values){return prepared(sql,values)},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(r.changes)}}}};}
 return{sqlite,prepare:prepared,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close()}};
}
