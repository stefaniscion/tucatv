// Independent failures must never prevent the following playlists from refreshing.
export async function refreshAtStartup(lists,active,refresh){
 const pending=lists.filter(p=>p.source).sort((a,b)=>Number(b.id===active)-Number(a.id===active));
 const result={updated:0,failed:0};
 for(let i=0;i<pending.length;i++){try{await refresh(pending[i],{index:i+1,total:pending.length});result.updated++;}catch{result.failed++;}}
 return result;
}
