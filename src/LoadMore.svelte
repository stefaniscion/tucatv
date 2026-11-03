<script>
 import {t,locale} from './i18n.js';
 import {onMount} from 'svelte';
 let {remaining,onmore,label='Carica altri'}=$props();
 let button;
 onMount(()=>{
  if(!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(e=>e.isIntersecting))onmore(document.activeElement===button);
  },{rootMargin:'180px'});
  observer.observe(button);
  return()=>observer.disconnect();
 });
</script>
<button class="load-more" bind:this={button} onclick={()=>onmore(true)}>{$t(label)} · {remaining.toLocaleString($locale)} {$t("rimanenti")}</button>
