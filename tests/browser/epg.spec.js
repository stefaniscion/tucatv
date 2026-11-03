import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import sources from '../../src/epg/rytec.json' with {type:'json'};
const fixture=readFileSync(new URL('../fixtures/guide.xml.xz',import.meta.url));
const xml='<tv><programme channel="channel-0" start="20261103120000 +0000" stop="20261103140000 +0000"><title>Rytec attuale</title></programme></tv>';
const masks=['http://www.xmltvepg.nl/**','http://rytecepg.wanwizard.eu/**','http://epg.vuplus-community.net/**'];
async function setup(page,options={}){
 await page.clock.setFixedTime(new Date('2026-11-03T13:00:00Z'));
 await page.addInitScript(options=>{
  if(!localStorage.getItem('tucatv-epg-settings'))localStorage.setItem('tucatv-epg-settings',JSON.stringify(options));
  if(!localStorage.getItem('epg-test-seeded')){localStorage.setItem('epg-test-seeded','yes');localStorage.setItem('tucatv',JSON.stringify({lists:[{id:'a',name:'Lista',channels:[{name:'Canale',tvg:'channel-0',group:'TV',url:'https://example.test/live/1'}],source:'',epg:'',updated:Date.now()}],favorites:[]}));}
 },options);
}
async function start(page){await page.goto('/');await page.getByRole('button',{name:'Salta intro'}).click();}
async function settings(page){await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Gestione EPG'}).click();}
async function counts(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('tucatv-epg',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('sources').objectStore('sources').count();q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
test('all 56 Rytec sources import automatically, including XZ and gzip, then use fresh cache',async({page})=>{
 let calls=0;await setup(page,{automatic:true,disabled:[]});
 for(const mask of masks)await page.route(mask,route=>{calls++;return route.fulfill({body:calls===1?fixture:gzipSync(xml),contentType:'application/octet-stream',headers:{'access-control-allow-origin':'*'}});});
 await start(page);await settings(page);
 await expect(page.getByRole('button',{name:'Aggiorna EPG ora'})).toBeEnabled({timeout:30000});
 await expect.poll(()=>counts(page)).toBe(56);expect(calls).toBe(56);
 await page.getByRole('button',{name:'Catalogo',exact:true}).click();await expect(page.locator('.hero-content')).toContainText('Rytec attuale');
 await expect(page.locator('.epgbutton')).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'Salta intro'}).click();await expect(page.locator('.hero-content')).toContainText('Rytec attuale');
 await settings(page);await expect(page.getByRole('button',{name:'Aggiorna EPG ora'})).toBeEnabled();expect(calls).toBe(56);
});
test('failed mirror falls back; malformed refresh retains the last complete guide',async({page})=>{
 const selected=sources[0];await setup(page,{automatic:true,disabled:sources.slice(1).map(s=>s.id)});
 let broken=false,calls=0;
 for(let i=0;i<masks.length;i++)await page.route(masks[i],route=>{calls++;return route.fulfill({status:i===0?503:200,body:broken?'<tv><programme':fixture,headers:{'access-control-allow-origin':'*'}});});
 await start(page);await expect(page.locator('.hero-content')).toContainText('Rytec attuale');expect(calls).toBe(2);
 broken=true;await settings(page);await page.getByRole('button',{name:'Aggiorna EPG ora'}).click();await expect(page.getByRole('button',{name:'Aggiorna EPG ora'})).toBeEnabled();
 await expect(page.locator('.epg-error')).toContainText('non valido');expect(await counts(page)).toBe(1);
 await page.getByRole('button',{name:'Catalogo',exact:true}).click();await expect(page.locator('.hero-content')).toContainText('Rytec attuale');
 await settings(page);await page.getByRole('button',{name:'Disabilita tutte'}).click();await page.getByRole('button',{name:'Catalogo',exact:true}).click();await expect(page.locator('.hero-content')).not.toContainText('Rytec attuale');
});
test('sources are searchable and progressive; cancellation leaves no published partial guide',async({page})=>{
 await page.addInitScript(()=>{delete window.IntersectionObserver;});await setup(page,{automatic:false,disabled:[]});
 for(const mask of masks)await page.route(mask,async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.fulfill({body:fixture,headers:{'access-control-allow-origin':'*'}}).catch(()=>{});});
 await start(page);await settings(page);await expect(page.locator('.epg-source')).toHaveCount(24);
 await page.getByRole('button',{name:/Carica altre sorgenti/}).click();await expect(page.locator('.epg-source')).toHaveCount(48);
 await page.getByRole('searchbox',{name:'Cerca sorgenti EPG'}).fill('Italia');await expect(page.locator('.epg-source')).toHaveCount(3);
 await page.getByRole('button',{name:'Aggiorna EPG ora'}).click();
 const progress=page.getByRole('region',{name:'Avanzamento aggiornamento EPG'});await expect(progress).toBeVisible();await expect(progress).toContainText('0 / 56');await expect(progress).toContainText(sources[0].name);
 await page.getByRole('button',{name:'Catalogo',exact:true}).click();await expect(progress).toBeVisible();
 await settings(page);await page.getByRole('button',{name:'Interrompi aggiornamento'}).click();await expect(page.getByRole('button',{name:'Aggiorna EPG ora'})).toBeEnabled();await expect(progress).toBeHidden();expect(await counts(page)).toBe(0);
});
