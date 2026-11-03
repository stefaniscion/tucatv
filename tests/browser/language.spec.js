import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{if(!localStorage.getItem('tucatv-epg-settings'))localStorage.setItem('tucatv-epg-settings',JSON.stringify({automatic:false,disabled:[]}));});});
async function start(page){await page.goto('/');await page.getByRole('button',{name:'Salta intro'}).click();}
test('settings language switches immediately and survives reload; device mode follows languagechange',async({page})=>{
 await start(page);
 await expect(page.locator('header select')).toHaveCount(0);
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Lingua',exact:true})).toHaveValue('device');
 await page.getByRole('combobox',{name:'Lingua',exact:true}).selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByRole('heading',{name:'Settings.'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Skip intro'}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveValue('en');
 await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('device');
 await expect(page.locator('html')).toHaveAttribute('lang','it');
 await page.evaluate(()=>{Object.defineProperty(navigator,'languages',{value:['en-US'],configurable:true});window.dispatchEvent(new Event('languagechange'));});
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveValue('device');
});
test('unsupported device languages fall back to English',async({browser})=>{
 const context=await browser.newContext({locale:'fr-FR'});await context.addInitScript(()=>localStorage.setItem('tucatv-epg-settings',JSON.stringify({automatic:false})));const page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'Skip intro'}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveValue('device');await context.close();
});
test('settings persist and apply startup catalogue defaults without losing favorites',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Esplora la demo',exact:true}).click();
 await page.locator('.card-favorite').first().click();
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
 await page.getByRole('combobox',{name:'Vista iniziale',exact:true}).selectOption('list');
 await page.getByRole('combobox',{name:'Sezione iniziale',exact:true}).selectOption('vod');
 await page.getByRole('combobox',{name:'Aggiorna playlist all’avvio',exact:true}).selectOption('false');
 await page.reload();await page.getByRole('button',{name:'Salta intro'}).click();
 await expect(page.locator('.tv-tile')).toHaveCount(2);
 await page.getByRole('button',{name:'Preferiti',exact:true}).click();await expect(page.locator('.tv-tile')).toHaveCount(1);
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Aggiorna playlist all’avvio',exact:true})).toHaveValue('false');
 await page.getByRole('combobox',{name:'Lingua',exact:true}).selectOption('en');
 await page.getByRole('button',{name:'Catalogue',exact:true}).click();
 await expect(page.locator('.tv-tile')).toHaveCount(1);
 await expect(page.locator('.tv-title strong')).toHaveText('Big Buck Bunny');
});
