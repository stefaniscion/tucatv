import {test,expect} from '@playwright/test';

async function skip(page,name){await page.goto('/');await page.getByRole('button',{name}).click();}

test('language switches immediately, translates existing errors and survives reload',async({page})=>{
 await skip(page,'Salta intro');
 await page.getByLabel('Link M3U').fill('not-a-url');
 await page.getByRole('button',{name:/^Aggiungi playlist/}).click();
 await expect(page.getByText('Inserisci un URL HTTP o HTTPS valido.')).toBeVisible();
 await page.getByRole('combobox',{name:'Lingua',exact:true}).selectOption('en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByText('Enter a valid HTTP or HTTPS URL.')).toBeVisible();
 await expect(page.getByRole('heading',{name:'My playlists.'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Add playlist/})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Skip intro'}).click();
 await expect(page.getByRole('combobox',{name:'Language'})).toHaveValue('en');
 await page.getByRole('combobox',{name:'Language'}).selectOption('it');
 await expect(page.getByRole('button',{name:'Le mie playlist',exact:true})).toBeVisible();
});

test('English and unsupported device languages start in English',async({browser})=>{
 for(const language of ['en-US','fr-FR']){
  const context=await browser.newContext({locale:language});const page=await context.newPage();
  await page.goto('http://127.0.0.1:4173/');await page.getByRole('button',{name:'Skip intro'}).click();
  await expect(page.getByRole('combobox',{name:'Language'})).toHaveValue('en');await context.close();
 }
});

test('language changes preserve catalogue filters and favorites',async({page})=>{
 await skip(page,'Salta intro');
 await page.getByRole('button',{name:'Esplora la demo',exact:true}).click();
 await page.locator('.card-favorite').first().click();
 await page.getByRole('button',{name:'Preferiti',exact:true}).click();
 await expect(page.locator('.tv-tile')).toHaveCount(1);
 await page.getByRole('combobox',{name:'Lingua'}).selectOption('en');
 await expect(page.locator('.tv-tile')).toHaveCount(1);
 await expect(page.locator('.catalog-filters select')).toHaveValue('__favorites');
 await expect(page.locator('.catalog-filters select option:checked')).toHaveText('Favorites');
 await expect(page.locator('.tv-favorite')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.tv-title strong')).toHaveText('Big Buck Bunny');
});
