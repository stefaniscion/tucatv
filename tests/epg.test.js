import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import xz from 'xz-decompress';
const {XzReadableStream}=xz;
import {xmltvParser,xmltvDate} from '../src/epg/xmltv.js';
import sources from '../src/epg/rytec.json' with {type:'json'};
const now=Date.parse('2026-11-03T13:00:00Z');
test('complete Rytec catalogue has stable unique IDs and HTTP mirrors',()=>{
 assert.equal(sources.length,56);assert.equal(new Set(sources.map(s=>s.id)).size,56);
 for(const s of sources){assert.ok(s.urls.length>=2);for(const url of s.urls)assert.match(url,/^https?:\/\//);}
 assert.equal(sources.filter(s=>s.group==='Rytec Italia XMLTV').length,3);
});
test('XZ decompression and incremental XMLTV parsing preserve programmes',async()=>{
 const stream=new XzReadableStream(new Blob([readFileSync(new URL('./fixtures/guide.xml.xz',import.meta.url))]).stream());
 const text=await new Response(stream).text(),programmes=[],parser=xmltvParser(p=>programmes.push(p),{now});
 for(let i=0;i<text.length;i+=7)parser.write(text.slice(i,i+7));assert.equal(parser.close(),2);
 assert.equal(programmes.length,2);assert.equal(programmes[0].title,'Rytec attuale');assert.equal(programmes[0].channel,'channel-0');
 assert.equal(xmltvDate('20261103140000 +0100'),now);
});
test('malformed, empty and entity-defined XML cannot become a successful guide',()=>{
 for(const text of ['<html/>','<tv/>','<tv><programme></tv>','<!DOCTYPE tv [<!ENTITY x "hello">]><tv/>']){
  assert.throws(()=>{const parser=xmltvParser(()=>{},{now});parser.write(text);parser.close();});
 }
});
test('old programmes and invalid times are discarded and CDATA survives',()=>{
 const items=[],parser=xmltvParser(p=>items.push(p),{now});
 parser.write('<!DOCTYPE tv SYSTEM "xmltv.dtd"><tv><programme channel="a" start="20200101000000 +0000" stop="20200101010000 +0000"><title>Old</title></programme><programme channel="a" start="20261103120000 +0000" stop="20261103140000 +0000"><title><![CDATA[A & B]]></title></programme></tv>');
 parser.close();assert.equal(items.length,1);assert.equal(items[0].title,'A & B');
});
