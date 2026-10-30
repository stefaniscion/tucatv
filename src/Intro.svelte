<script>
 import {onMount} from 'svelte';
 let {ondone}= $props();
 onMount(()=>{const t=setTimeout(ondone,matchMedia('(prefers-reduced-motion: reduce)').matches?200:2400);return()=>clearTimeout(t);});
</script>
<div class="startup" role="status" aria-label="Benvenuto in TucaTV">
 <div class="startup-glow"></div><div class="startup-logo"><img src="/tucatv-mark.svg" alt=""/><strong>Tuca<span>TV</span></strong><p>LA TUA TV. IL TUO RITMO.</p></div>
 <button onclick={ondone}>Salta intro →</button>
</div>
