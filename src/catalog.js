export function separator(c) { return /^[-_=*•─━]{3,}.+[-_=*•─━]{3,}$/.test(c?.name?.trim() || ''); }
export function kind(c) {
 if (c.kind === 'vod' || c.kind === 'live') return c.kind;
 let path='';try { path=new URL(c.url).pathname; } catch {}
 return /\.(mp4|mkv|avi|mov|webm|m4v)$/i.test(path)||/\/(movie|series|vod)\//i.test(path)||/\b(vod|film|movies|cinema|serie|series)\b/i.test(c.group||'') ? 'vod' : 'live';
}
export function catalogue(channels, mode, query, group, favorites) {
 const q=query.trim().toLocaleLowerCase('it');
 return channels.filter(c=>!separator(c)&&(mode==='all'||kind(c)===mode)&&(group==='Tutti'||group==='Preferiti'&&favorites.includes(c.url)||c.group===group)&&c.name.toLocaleLowerCase('it').includes(q));
}
export function shelves(items, limit=12) {
 const groups=new Map();
 for(const c of items){const key=c.group||'Altri';if(!groups.has(key)){if(groups.size>=limit)continue;groups.set(key,[]);}if(groups.get(key).length<20)groups.get(key).push(c);}
 return [...groups].map(([name,items])=>({name,items}));
}
