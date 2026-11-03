<script>
 import {t,locale} from './i18n.js';
 import {onMount} from 'svelte';
 import {loadLogo} from './logos.js';
 let {src='',name='',hero=false}= $props();
 let host,visible=$state(false),resolved=$state(''),failed=$state(false);
 onMount(()=>{if(!('IntersectionObserver' in window)){visible=true;return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){visible=true;observer.disconnect();}},{rootMargin:'120px'});observer.observe(host);return()=>observer.disconnect();});
 $effect(()=>{const url=src;resolved='';failed=false;if(!visible||!url)return;let disposed=false;loadLogo(url).then(result=>{if(!disposed){resolved=result;failed=!result;}}).catch(()=>{if(!disposed)failed=true;});return()=>{disposed=true};});
</script>
<span class="logo-frame" class:hero-logo={hero} bind:this={host}>
 {#if resolved&&!failed}<img src={resolved} alt="" decoding="async" onerror={()=>failed=true}/>{:else if hero}<img src="/tucatv-mark.svg" alt=""/>{:else}<span class="logo-initials" aria-hidden="true">{name.replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'TV'}</span>{/if}
</span>
