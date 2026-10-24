type ApiResult<T=any> = { data: T };
async function request<T=any>(method:string, path:string, payload?:any):Promise<ApiResult<T>> {
  const url = new URL(path, window.location.origin);
  if (method === 'GET' && payload) Object.entries(payload).forEach(([k,v])=>{ if(v!==undefined && v!==null && String(v)!=='') url.searchParams.set(k,String(v)); });
  const response = await fetch(url.toString(), {method, headers: payload && method!=='GET' ? {'Content-Type':'application/json'} : undefined, body: payload && method!=='GET' ? JSON.stringify(payload) : undefined});
  const data = await response.json().catch(()=>({error:'invalid_response'}));
  if(!response.ok){ const error:any = new Error(data?.error || 'request_failed'); error.response={status:response.status,data}; error.data=data; throw error; }
  return {data};
}
export const api = { get:<T=any>(path:string, params?:any)=>request<T>('GET',path,params), post:<T=any>(path:string, body?:any)=>request<T>('POST',path,body) };
