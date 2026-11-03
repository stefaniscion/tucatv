import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import tailwind from '@tailwindcss/vite';
import {readdirSync,readFileSync} from 'node:fs';

// Native hosts read the same catalogues as the JavaScript bundle.
const localeAssets={
 name:'tucatv-locales',
 generateBundle(){
  const directory=new URL('./src/locales/',import.meta.url);
  for(const name of readdirSync(directory).filter(name=>name.endsWith('.json'))){
   this.emitFile({type:'asset',fileName:'locales/'+name,source:readFileSync(new URL(name,directory))});
  }
 }
};
export default defineConfig({plugins:[svelte(),tailwind(),localeAssets]});
