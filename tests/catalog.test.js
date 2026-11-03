import {test} from 'node:test';import assert from 'node:assert/strict';import {kind,catalogue,shelves} from '../src/catalog.js';
test('classifies files, provider paths and explicit overrides without guessing from title',()=>{for(const url of ['https://x/a.MKV?token=1','http://x/movie/u/p/42','http://x/series/u/p/42'])assert.equal(kind({url}),'vod');assert.equal(kind({name:'Cinema channel',url:'https://x/42',group:'Italia'}),'live');assert.equal(kind({url:'https://x/a.mp4',kind:'live'}),'live');});
test('filters separators, mode, category, search and favorites',()=>{const items=[{name:'---Italia---',url:'https://x/1',group:'Italia'},{name:'Rai 1',url:'https://x/2',group:'Italia'},{name:'Film',url:'https://x/a.mp4',group:'Film'}];assert.equal(catalogue(items,'live',' RAI ','__all',[]).length,1);assert.equal(catalogue(items,'vod','','__favorites',['https://x/a.mp4']).length,1);assert.equal(catalogue(items,'live','','__favorites',[]).length,0);});
test('large libraries render bounded shelves while full search remains available',()=>{const items=Array.from({length:134388},(_,i)=>({name:'Item '+i,url:'https://x/'+i+'.mp4',group:'Group '+i%30}));const rows=shelves(items);assert.equal(rows.length,12);assert.ok(rows.every(r=>r.items.length===20));assert.equal(catalogue(items,'vod','Item 134387','__all',[]).length,1);});
test('indexed catalogue preserves mode, categories, favorites and case-insensitive search',async()=>{const {indexCatalogue,filterCatalogue,currentGuide}=await import('../src/catalog.js');const items=[{name:'---Italia---',url:'https://x/1',group:'Italia'},{name:'Rai 1',url:'https://x/2',group:'Italia'},{name:'Film',url:'https://x/film.mp4',group:'Cinema'}];const index=indexCatalogue(items);assert.equal(index.live.length,1);assert.equal(index.vod.length,1);assert.deepEqual(index.liveGroups,['Italia']);assert.equal(filterCatalogue(index.live,'','__all',[]),index.live);assert.equal(filterCatalogue(index.live,'RAI','__favorites',['https://x/2']).length,1);assert.equal(filterCatalogue(index.live,'','Cinema',[]).length,0);const current={channel:'a',start:10,end:30},next={channel:'a',start:31,end:60};const guide=currentGuide([{channel:'a',start:100,end:110},next,current],20);assert.equal(guide.now.get('a'),current);assert.equal(guide.next.get('a'),next);});
test('genre categories never turn live cinema channels into VOD',()=>{
 for(const group of ['Sky Cinema','Cinema','Film','Movies','Serie','Series'])
  for(const url of ['https://x/123','https://x/stream.ts','https://x/stream.m3u8'])
   assert.equal(kind({name:'Sky Cinema Uno HD',group,url}),'live');
 assert.equal(kind({group:'VOD',url:'https://x/live/u/p/1'}),'live');
 assert.equal(kind({group:'VOD Italia',url:'https://x/123'}),'vod');
 for(const url of ['https://x/movie/u/p/123','https://x/series/u/p/123','https://x/vod/123','https://x/movie.mp4?token=test'])
  assert.equal(kind({group:'Cinema',url}),'vod');
 const channels=[{name:'Sky Cinema',group:'Cinema',url:'https://x/123'},{name:'Film',group:'Cinema',url:'https://x/movie/u/p/456'}];
 assert.equal(catalogue(channels,'live','','__all',[])[0].name,'Sky Cinema');
 assert.equal(catalogue(channels,'vod','','__all',[])[0].name,'Film');
});
