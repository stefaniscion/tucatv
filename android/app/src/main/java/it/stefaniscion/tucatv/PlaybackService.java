package it.stefaniscion.tucatv;
import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.*;
import org.json.*;
import org.videolan.libvlc.*;
import java.util.ArrayList;

/** Owns playback independently of the Activity and its video surface. */
public class PlaybackService extends Service {
 private String tr(String key){return I18n.text(this,key);}
 public void languageChanged(){if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("playback",tr("TucaTV playback"),NotificationManager.IMPORTANCE_LOW));updateSession();}

 public static volatile PlaybackService current;
 private boolean stopped=false,confirmed=false;
 static final java.util.Map<String,PlaybackQueue> preparedQueues=new java.util.concurrent.ConcurrentHashMap<>();
 private String playlistId="",currentUrl="";
 public boolean hasSession(){return !stopped&&player!=null&&queue!=null&&queue.length()>0;}
 public static final String TOGGLE="it.stefaniscion.tucatv.TOGGLE", STOP="it.stefaniscion.tucatv.STOP";
 public MediaPlayer player; private LibVLC engine; private MediaSession session; private AudioManager audio;
 private AudioFocusRequest focusRequest; private boolean resumeAfterFocus=false,hasFocus=false;
 private PowerManager.WakeLock wakeLock;
 private boolean foreground=false;public String title="TucaTV",status="Ready";public PlaybackQueue queue;public int index=0;
 public MediaPlayer.EventListener uiListener;
 private final Handler main=new Handler(Looper.getMainLooper());
 public class LocalBinder extends Binder{public PlaybackService getService(){return PlaybackService.this;}}
 private final LocalBinder binder=new LocalBinder();
 private final AudioManager.OnAudioFocusChangeListener focus=change->{
  if(player==null)return;
  if(change==AudioManager.AUDIOFOCUS_GAIN){hasFocus=true;player.setVolume(100);if(resumeAfterFocus){resumeAfterFocus=false;if(!wakeLock.isHeld())wakeLock.acquire();player.play();}}
  else if(change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){player.setVolume(20);}
  else {boolean playing=player.isPlaying();resumeAfterFocus=change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT&&playing;hasFocus=false;player.pause();if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();updateSession();}
 };
 private final BroadcastReceiver noisy=new BroadcastReceiver(){public void onReceive(Context c,Intent i){pausePlayback();}};
 @Override public void onCreate(){super.onCreate();current=this;
  audio=(AudioManager)getSystemService(AUDIO_SERVICE);wakeLock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"TucaTV:Playback");wakeLock.setReferenceCounted(false);
  ArrayList<String> options=new ArrayList<>();options.add("--network-caching=1500");engine=new LibVLC(this,options);player=new MediaPlayer(engine);player.setAudioOutput("audiotrack");
  session=new MediaSession(this,"TucaTV");session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS|MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
  session.setCallback(new MediaSession.Callback(){public void onPlay(){playPlayback();}public void onPause(){pausePlayback();}public void onStop(){stopPlayback();}public void onSkipToNext(){change(1);}public void onSkipToPrevious(){change(-1);}public void onSeekTo(long pos){if(player!=null&&player.isSeekable())player.setTime(pos);}});session.setActive(true);
  if(Build.VERSION.SDK_INT>=26){((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("playback",tr("TucaTV playback"),NotificationManager.IMPORTANCE_LOW));focusRequest=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build()).setOnAudioFocusChangeListener(focus,main).build();}
  IntentFilter filter=new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);if(Build.VERSION.SDK_INT>=33)registerReceiver(noisy,filter,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(noisy,filter);
  player.setEventListener(event->{if(player==null)return;switch(event.type){case MediaPlayer.Event.Playing:status="Playing";if(!confirmed){confirmed=true;getSharedPreferences("playback-history",0).edit().putString("playlistId",playlistId).putString("url",currentUrl).putLong("at",System.currentTimeMillis()).apply();}break;case MediaPlayer.Event.Paused:status="Paused";break;case MediaPlayer.Event.Buffering:status=event.getBuffering()<100?"Loading…":"Playing";break;case MediaPlayer.Event.EncounteredError:status="Connection failed. Press ↻ to retry.";abandonFocus();break;case MediaPlayer.Event.EndReached:status="Playback ended";abandonFocus();break;}if(event.type!=MediaPlayer.Event.TimeChanged&&event.type!=MediaPlayer.Event.PositionChanged&&event.type!=MediaPlayer.Event.Buffering)updateSession();if(uiListener!=null)uiListener.onEvent(event);});
 }
 @Override public int onStartCommand(Intent intent,int flags,int startId){ensureForeground();String action=intent==null?null:intent.getAction();if(STOP.equals(action)){stopPlayback();return START_NOT_STICKY;}if(TOGGLE.equals(action))toggle();return START_NOT_STICKY;}
 @Override public IBinder onBind(Intent intent){return binder;}
 public void ensureForeground(){if(!foreground){startForeground(5,notification());foreground=true;}}
 private boolean requestFocus(){ensureForeground();if(hasFocus)return true;int result=Build.VERSION.SDK_INT>=26?audio.requestAudioFocus(focusRequest):audio.requestAudioFocus(focus,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN);hasFocus=result==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;return hasFocus;}
 private void abandonFocus(){if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();if(Build.VERSION.SDK_INT>=26)audio.abandonAudioFocusRequest(focusRequest);else audio.abandonAudioFocus(focus);hasFocus=false;resumeAfterFocus=false;}
 public void setSource(String handle,String owner,int selected){PlaybackQueue next=preparedQueues.remove(handle);if(next==null)return;if(queue!=null)queue.close();queue=next;playlistId=owner;index=Math.max(0,Math.min(selected,queue.length()-1));open();}
 public void open(){stopped=false;JSONObject item;try{if(queue==null)return;item=new JSONObject(queue.get(index));}catch(Exception e){status="Playback queue unavailable";return;}if(player==null)return;String url=item.optString("url");String scheme=Uri.parse(url).getScheme();if(!"http".equals(scheme)&&!"https".equals(scheme))return;ensureForeground();player.stop();confirmed=false;currentUrl=url;title=item.optString("title","TucaTV");status="Connecting…";Media media=new Media(engine,Uri.parse(url));media.setHWDecoderEnabled(true,false);player.setMedia(media);media.release();playPlayback();}
 public void change(int step){if(queue!=null&&index+step>=0&&index+step<queue.length()){index+=step;open();}}
 public void playPlayback(){if(player!=null&&requestFocus()){session.setActive(true);if(!wakeLock.isHeld())wakeLock.acquire();player.setVolume(100);player.play();updateSession();}else status="Another app is using audio. Press Play to try again.";}
 public void pausePlayback(){if(player!=null){resumeAfterFocus=false;player.pause();abandonFocus();updateSession();}}
 public void toggle(){if(player!=null){if(player.isPlaying())pausePlayback();else playPlayback();}}
 public void stopPlayback(){stopped=true;if(player!=null)player.stop();abandonFocus();session.setActive(false);stopForeground(true);foreground=false;stopSelf();}
 private void updateSession(){if(session==null||player==null)return;int state=player.isPlaying()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED;if(player.getPlayerState()==org.videolan.libvlc.interfaces.IMedia.State.Error)state=PlaybackState.STATE_ERROR;
  session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,title).putString(MediaMetadata.METADATA_KEY_ARTIST,"TucaTV").putLong(MediaMetadata.METADATA_KEY_DURATION,Math.max(0,player.getLength())).build());
  long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_STOP|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS;if(player.isSeekable())actions|=PlaybackState.ACTION_SEEK_TO;
  session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(state,Math.max(0,player.getTime()),player.isPlaying()?1:0).build());if(foreground)((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(5,notification());
 }
 private PendingIntent action(String value,int id){return PendingIntent.getService(this,id,new Intent(this,PlaybackService.class).setAction(value),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private Notification notification(){Intent open=new Intent(this,PlayerActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent content=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"playback"):new Notification.Builder(this);return builder.setSmallIcon(R.drawable.tuca_beak).setContentTitle(title).setContentText("TucaTV · "+tr(status)).setContentIntent(content).setOngoing(player!=null&&player.isPlaying()).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PUBLIC).addAction(android.R.drawable.ic_media_pause,player!=null&&player.isPlaying()?tr("Pause"):tr("Play"),action(TOGGLE,1)).addAction(android.R.drawable.ic_menu_close_clear_cancel,tr("Stop"),action(STOP,2)).setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1)).build();
 }
 @Override public void onDestroy(){if(current==this)current=null;main.removeCallbacksAndMessages(null);uiListener=null;try{unregisterReceiver(noisy);}catch(Exception e){}abandonFocus();if(player!=null){player.setEventListener(null);player.stop();player.detachViews();player.release();player=null;}if(queue!=null){queue.close();queue=null;}if(engine!=null)engine.release();if(session!=null)session.release();super.onDestroy();}
}
