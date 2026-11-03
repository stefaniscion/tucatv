export function visibleChannels(channels,hidden=[]){if(!hidden.length)return channels;const excluded=new Set(hidden);return channels.filter(c=>!excluded.has(c.group||'Altri'));}
export function categoryCounts(channels,locale='it'){const result=new Map();for(const c of channels){const group=c.group||'Altri';result.set(group,(result.get(group)||0)+1);}return [...result].map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name,locale));}
export function lastOpenedChannel(channels,last){return last?.url?channels.find(c=>c.url===last.url):undefined;}
