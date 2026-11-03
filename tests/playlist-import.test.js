import {test} from 'node:test';import assert from 'node:assert/strict';
import {readTextStream,parsePlaylist,byteProgress} from '../src/playlist-import.js';
function stream(chunks){return new ReadableStream({start(c){chunks.forEach(x=>c.enqueue(x));c.close();}});}
test('download reports bytes, preserves UTF8 split across chunks',async()=>{const bytes=new TextEncoder().encode('Città');let events=[];assert.equal(await readTextStream(stream([bytes.slice(0,5),bytes.slice(5)]),{total:bytes.length,onProgress:p=>events.push(p)}),'Città');assert.equal(events.at(-1).percent,100);assert.equal(events.at(-1).received,6);});
test('unknown or inconsistent content length never invents a percentage',async()=>{assert.equal(byteProgress(12,0).percent,null);assert.equal(byteProgress(12,10).percent,null);let event;await readTextStream(stream([new Uint8Array(12)]),{onProgress:p=>event=p});assert.equal(event.percent,null);assert.equal(event.received,12);});
test('size limit cancels stream and propagates failure',async()=>{await assert.rejects(readTextStream(stream([new Uint8Array(12)]),{limit:10}),/10 byte/);});
test('parsing preserves M3U metadata, relative URLs and commas in attributes',async()=>{const p=await parsePlaylist('#EXTM3U url-tvg="guide.xml"\n#EXTINF:-1 tvg-id="r1" tvg-logo="logo.png" group-title="News, Italia",Rai 1, HD\nlive.m3u8','https://example.test/list.m3u');assert.equal(p.channels[0].name,'Rai 1, HD');assert.equal(p.channels[0].group,'News, Italia');assert.equal(p.epg,'https://example.test/guide.xml');assert.equal(p.channels[0].url,'https://example.test/live.m3u8');});
test('large playlist yields UI and reports incremental counts',async()=>{const text='#EXTM3U\n'+Array.from({length:12000},(_,i)=>`#EXTINF:-1,Canale ${i}\nhttps://example.test/${i}`).join('\n');let events=[],yielded=false;setTimeout(()=>yielded=true,0);const result=await parsePlaylist(text,undefined,p=>events.push(p));assert.equal(result.channels.length,12000);assert.ok(yielded);assert.ok(events.length>10);assert.ok(events.some(e=>e.count>0&&e.count<12000));assert.equal(events.at(-1).percent,100);});
test('invalid playlist rejects without claiming completion',async()=>{await assert.rejects(parsePlaylist('<html>Access denied</html>'),/M3U/);await assert.rejects(parsePlaylist('#EXTM3U\n#EXTINF:-1,No stream'),/Nessun canale/);});

test('streaming parser handles byte-sized UTF8, CRLF, BOM and final line without newline',async()=>{
 const {parsePlaylistStream}=await import('../src/playlist-import.js');
 const bytes=new TextEncoder().encode('\uFEFF#EXTM3U\r\n#EXTINF:-1 tvg-logo="logo.png" group-title="Città, TV",Città\r\nchannel');
 const result=await parsePlaylistStream(stream([...bytes].map(b=>new Uint8Array([b]))),'https://example.test/list',{total:bytes.length});
 assert.equal(result.channels[0].name,'Città');assert.equal(result.channels[0].url,'https://example.test/channel');
});
test('parser cancels upstream on malformed input, oversized line or total size limit',async()=>{
 const {parsePlaylistStream}=await import('../src/playlist-import.js');
 for(const [text,opts,pattern] of [['<html>denied</html>\n',{},/M3U/],['#EXTM3U\n'+'x'.repeat(65537),{},/riga/],['#EXTM3U\n',{limit:3},/3 byte/]]){let cancelled=false;const input=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(text));},cancel(){cancelled=true;}});await assert.rejects(parsePlaylistStream(input,undefined,opts),pattern);assert.equal(cancelled,true);}
});
test('mid-stream failure never returns a partial playlist',async()=>{
 const {parsePlaylistStream}=await import('../src/playlist-import.js');let n=0;
 const input=new ReadableStream({pull(c){if(n++===0)c.enqueue(new TextEncoder().encode('#EXTM3U\n#EXTINF:-1,One\nhttps://example.test/1\n'));else c.error(new TypeError('connection lost'));}});
 await assert.rejects(parsePlaylistStream(input),/connection lost/);
});
test('new 256 MiB cap accepts streaming input larger than 64 MiB and rejects oversized declared input',async()=>{
 const {parsePlaylistStream,MAX_PLAYLIST_BYTES}=await import('../src/playlist-import.js');assert.equal(MAX_PLAYLIST_BYTES,256*1024*1024);
 let step=0;const encoder=new TextEncoder(),comment=encoder.encode(('#'+'x'.repeat(1022)+'\n').repeat(64));
 const input=new ReadableStream({pull(c){if(step===0)c.enqueue(encoder.encode('#EXTM3U\n'));else if(step<=1100)c.enqueue(comment);else if(step===1101)c.enqueue(encoder.encode('#EXTINF:-1,Test\nhttps://example.test/live'));else c.close();step++;}});
 const result=await parsePlaylistStream(input);assert.equal(result.channels.length,1);
 await assert.rejects(parsePlaylistStream(stream([]),undefined,{total:MAX_PLAYLIST_BYTES+1}),/256 MB/);
});

test('declared length must match before a playlist or text is accepted',async()=>{
 const {parsePlaylistStream}=await import('../src/playlist-import.js');
 const bytes=new TextEncoder().encode('#EXTM3U\n#EXTINF:-1,Example\nhttps://example.test/1\n');
 for(const reader of [parsePlaylistStream, (s,_base,options)=>readTextStream(s,options)]){
  for(const total of [bytes.length-1,bytes.length+100])await assert.rejects(reader(stream([bytes]),undefined,{total}),/incompleto/);
 }
 assert.equal((await parsePlaylistStream(stream([bytes]),undefined,{total:0})).channels.length,1);
});
