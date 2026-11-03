<script>
 import {t,locale} from './i18n.js';
 import {onDestroy} from 'svelte';
 let {error='',onexternal,video,channel,programme,onback,onprevious,onnext,onretry,onfavorite,favorite=false,mode='auto',onmode,children}= $props();
 let shell,visible=$state(true),paused=$state(true),muted=$state(false),volume=$state(1),duration=$state(0),position=$state(0),buffering=$state(true),settings=$state(false),hideTimer;
 const stamp=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
 function wake(){visible=true;clearTimeout(hideTimer);if(!paused&&!settings)hideTimer=setTimeout(()=>visible=false,4500);}
 function toggle(){if(!video)return;if(video.paused)video.play().catch(()=>{});else video.pause();wake();}
 function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else if(shell.requestFullscreen)shell.requestFullscreen().catch(()=>{});else video?.webkitEnterFullscreen?.();}
 function seek(value){if(video&&Number.isFinite(duration))video.currentTime=Number(value);}
 function keys(e){if(['INPUT','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'||e.key==='k'){e.preventDefault();e.stopPropagation();toggle();}if(e.key==='f'){e.stopPropagation();fullscreen();}wake();}
 $effect(()=>{if(!video)return;const v=video;const update=()=>{paused=v.paused;muted=v.muted;volume=v.volume;duration=v.duration;position=v.currentTime;};const waiting=()=>buffering=true;const ready=()=>{buffering=false;update();wake();};['timeupdate','durationchange','play','pause','volumechange'].forEach(e=>v.addEventListener(e,update));v.addEventListener('waiting',waiting);v.addEventListener('loadstart',waiting);v.addEventListener('loadeddata',ready);v.addEventListener('playing',ready);v.addEventListener('error',ready);update();return()=>{['timeupdate','durationchange','play','pause','volumechange'].forEach(e=>v.removeEventListener(e,update));v.removeEventListener('waiting',waiting);v.removeEventListener('loadstart',waiting);v.removeEventListener('loadeddata',ready);v.removeEventListener('playing',ready);v.removeEventListener('error',ready);};});
 onDestroy(()=>clearTimeout(hideTimer));
</script>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="cinema" class:failed={!!error} bind:this={shell} onpointermove={wake} onfocusin={wake} onkeydown={keys} aria-label={$t("Video player")}>
 <div class="video-slot">{@render children()}</div>
 <button class="video-tap" aria-label={$t("Show controls")} onclick={()=>{visible=!visible;if(visible)wake()}} tabindex="-1"></button>
 {#if error}<div class="player-failure" role="alert"><span class="failure-icon">!</span><h3>{$t("Playback unavailable")}</h3><p>{$t(error)}</p><div class="actions"><button class="primary" onclick={onexternal}>{$t("Download stream for VLC")}</button><button onclick={onretry}>{$t("Retry")}</button></div><small>{$t("Open the downloaded M3U file in VLC. It contains the private source link: do not share it.")}</small></div>{:else if buffering}<div class="loading-video"><span class="spinner"></span><span>{$t("Connecting to channel…")}</span></div>{/if}
 <div class="cinema-ui" class:concealed={!visible&&!settings}>
  <div class="cinema-top"><button onclick={onback} aria-label={$t("Back to channels")}>←</button><div class="player-brand"><img src="/tucatv-mark.svg" alt=""/>Tuca<span>TV</span></div><div class="top-spacer"></div><button aria-label={$t("Favorite")} aria-pressed={favorite} onclick={onfavorite}>{favorite?'♥':'♡'}</button><button onclick={()=>{settings=!settings;wake()}} aria-label={$t("Player settings")}>⚙</button></div>
  {#if settings}<div class="player-settings"><label>{$t("Format")}<select value={mode} onchange={e=>onmode(e.target.value)}><option value="auto">{$t("Automatic")}</option><option value="hls">HLS</option><option value="native">{$t("Native video")}</option></select></label><button onclick={onretry}>{$t("↻ Retry connection")}</button><button onclick={()=>{settings=false;wake()}}>{$t("Close")}</button></div>{/if}
  <div class="cinema-bottom" class:has-error={!!error}><p class="eyebrow">{channel.group||$t("YOUR CHANNEL")}</p><h2>{channel.name}</h2><p class="programme">{programme?.title||$t("TV guide unavailable")}</p>
   {#if Number.isFinite(duration)&&duration>0}<div class="timeline"><span>{stamp(position)}</span><input aria-label={$t("Video position")} type="range" min="0" max={duration} value={position} oninput={e=>seek(e.target.value)}/><span>{stamp(duration)}</span></div>{:else}<div class="live-line"></div>{/if}
   <div class="playback-controls"><button onclick={onprevious} aria-label={$t("Previous channel")}>|◀</button><button class="main-play" onclick={toggle} aria-label={paused?$t("Play"):$t("Pause")}>{paused?'▶':'Ⅱ'}</button><button onclick={onnext} aria-label={$t("Next channel")}>▶|</button><span class="control-divider"></span><button aria-label={muted?$t("Unmute"):$t("Mute")} onclick={()=>{video.muted=!video.muted}}>{muted?'♪ ×':'♪'}</button><input class="volume" aria-label="Volume" type="range" min="0" max="1" step=".05" value={volume} oninput={e=>video.volume=Number(e.target.value)}/><div class="top-spacer"></div><span class="status-pill">{paused?$t("PAUSED"):Number.isFinite(duration)&&duration>0?'VIDEO':$t("NOW PLAYING")}</span><button onclick={fullscreen} aria-label={$t("Full screen")}>⛶</button></div>
  </div>
 </div>
</section>
