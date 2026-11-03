<script>
 import {t,locale} from './i18n.js';
 import {onMount} from 'svelte';
 let {ondone}= $props();
 onMount(()=>{const t=setTimeout(ondone,matchMedia('(prefers-reduced-motion: reduce)').matches?200:3900);return()=>clearTimeout(t);});
</script>
<div class="startup" role="status" aria-label={$t("Benvenuto in TucaTV")}>
 <div class="startup-glow"></div><div class="startup-logo"><img src="/tucatv-mark.svg" alt=""/><strong>Tuca<span>TV</span></strong><p>{$t("LA TUA TV. IL TUO RITMO.")}</p></div>
 <button onclick={ondone}>{$t("Salta intro →")}</button>
</div>
