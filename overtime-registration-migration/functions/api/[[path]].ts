interface Env { DB: D1Database }
type Employee = { code:string; name:string; department:string; job:string; shift:string };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(error:string,status=400)=>json({error},status);
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
function hoursBetween(from:string,to:string){const [fh,fm]=from.split(':').map(Number);const [th,tm]=to.split(':').map(Number);let m=th*60+tm-(fh*60+fm);if(m<0)m+=1440;return m/60;}
function validTime(s:string){return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)}
function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))}
function rowToEntry(r:any){return {id:r.id,code:r.code,name:r.name,department:r.department,job:r.job,shift:r.shift,date:r.date,from:r.start_time,to:r.end_time,task:r.task,hours:Number(r.hours),createdAt:r.created_at};}
export const onRequest: PagesFunction<Env> = async ({request,env})=>{
  const url=new URL(request.url); const path=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,''); const method=request.method;
  try {
    if(path==='_healthcheck'&&method==='GET') return json({message:'Success',database:'D1'});
    if(path==='employees'&&method==='GET'){
      const {results=[]}=await env.DB.prepare('SELECT code,name,department,job,shift FROM employees WHERE deleted=0 ORDER BY department,name').all<Employee>();
      return json({employees:results});
    }
    if(path==='employee-lookup'&&method==='POST'){
      const q:any=await request.json().catch(()=>null); const code=str(q?.employeeCode); if(!code)return fail('missing_fields');
      const e=await env.DB.prepare('SELECT code,name,department,job,shift FROM employees WHERE code=? AND deleted=0').bind(code).first<Employee>();
      return e?json(e):fail('employee_not_found',404);
    }
    if(path==='overtime'&&method==='POST'){
      const q:any=await request.json().catch(()=>null); const code=str(q?.employeeCode),date=str(q?.date),from=str(q?.from),to=str(q?.to),task=str(q?.task);
      if(!code||!validDate(date)||!validTime(from)||!validTime(to)||!task)return fail('missing_fields');
      if(from===to)return fail('invalid_time_range');
      const e=await env.DB.prepare('SELECT code,name,department,job,shift FROM employees WHERE code=? AND deleted=0').bind(code).first<Employee>();
      if(!e)return fail('employee_not_found',404);
      const id=crypto.randomUUID();
      try { await env.DB.prepare('INSERT INTO overtime_entries (id,code,name,department,job,shift,date,start_time,end_time,task,hours) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,e.code,e.name,e.department,e.job||'',e.shift||'',date,from,to,task,hoursBetween(from,to)).run(); }
      catch(err:any){ if(String(err?.message||'').toLowerCase().includes('unique')||String(err?.cause||'').toLowerCase().includes('unique'))return fail('duplicate_overtime',409); throw err; }
      return json({success:true,id});
    }
    if(path==='overtime'&&method==='GET'){
      const code=str(url.searchParams.get('employeeCode')),dept=str(url.searchParams.get('department')),fromDate=str(url.searchParams.get('fromDate')),toDate=str(url.searchParams.get('toDate'));
      let sql='SELECT * FROM overtime_entries WHERE 1=1'; const args:any[]=[];
      if(code){sql+=' AND code=?';args.push(code)} if(dept){sql+=' AND department=?';args.push(dept)} if(fromDate){sql+=' AND date>=?';args.push(fromDate)} if(toDate){sql+=' AND date<=?';args.push(toDate)}
      sql+=' ORDER BY date,created_at'; const result=await env.DB.prepare(sql).bind(...args).all<any>(); const entries=(result.results||[]).map(rowToEntry);
      return json({entries,totalHours:entries.reduce((s:number,r:any)=>s+Number(r.hours||0),0),hasMore:false});
    }
    if(path==='employees'&&method==='POST'){
      const e:any=await request.json().catch(()=>null); const code=str(e?.code),name=str(e?.name),department=str(e?.department),job=str(e?.job),shift=str(e?.shift);
      if(!code||!name||!department)return fail('missing_fields');
      try { await env.DB.prepare('INSERT INTO employees(code,name,department,job,shift,deleted) VALUES(?,?,?,?,?,0) ON CONFLICT(code) DO UPDATE SET name=excluded.name,department=excluded.department,job=excluded.job,shift=excluded.shift,deleted=0').bind(code,name,department,job,shift).run(); }
      catch {return fail('save_failed',500)} return json({success:true});
    }
    if(path==='employees/import'&&method==='POST'){
      const q:any=await request.json().catch(()=>null); if(!Array.isArray(q?.employees))return fail('missing_employees');
      let imported=0,skipped=0; const statements=[];
      for(const e of q.employees){const code=str(e?.code),name=str(e?.name),department=str(e?.department);if(!code||!name||!department){skipped++;continue;} statements.push(env.DB.prepare('INSERT INTO employees(code,name,department,job,shift,deleted) VALUES(?,?,?,?,?,0) ON CONFLICT(code) DO UPDATE SET name=excluded.name,department=excluded.department,job=excluded.job,shift=excluded.shift,deleted=0').bind(code,name,department,str(e?.job),str(e?.shift)));}
      for(let i=0;i<statements.length;i+=100){const results=await env.DB.batch(statements.slice(i,i+100));imported+=results.length;}
      return json({imported,skipped:q.employees.length-imported});
    }
    if(path==='employees/delete'&&method==='POST'){
      const q:any=await request.json().catch(()=>null); if(!Array.isArray(q?.codes)||!q.codes.length)return fail('missing_codes'); const codes=[...new Set(q.codes.map(str).filter(Boolean))]; let removed=0;
      for(let i=0;i<codes.length;i+=100){const part=codes.slice(i,i+100);const placeholders=part.map(()=>'?').join(',');const r=await env.DB.prepare(`UPDATE employees SET deleted=1 WHERE code IN (${placeholders}) AND deleted=0`).bind(...part).run();removed+=r.meta.changes||0;}
      return json({success:true,removed});
    }
    return fail('not_found',404);
  } catch(error){console.error('API error',path,error);return fail('server_error',500)}
};
