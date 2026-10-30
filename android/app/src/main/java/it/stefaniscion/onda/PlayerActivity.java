package it.stefaniscion.onda;
import android.app.*;
import android.os.*;
import android.net.Uri;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import org.json.*;
import org.videolan.libvlc.*;
import org.videolan.libvlc.util.VLCVideoLayout;
import java.util.ArrayList;
public class PlayerActivity extends Activity {
 private LibVLC engine;private MediaPlayer player;private TextView status,title,time;private Button pause;private SeekBar seek;private LinearLayout overlay;private boolean resume,seeking,failed;private JSONArray queue;private int index;private final Handler handler=new Handler(Looper.getMainLooper());private final int orange=Color.rgb(255,138,36);
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density);}
 private GradientDrawable background(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(12));return d;}
 private Button button(String label,Runnable action){Button b=new Button(this);b.setText(label);b.setTextColor(Color.WHITE);b.setTextSize(15);b.setAllCaps(false);b.setMinWidth(dp(48));b.setMinimumHeight(dp(48));b.setPadding(dp(14),0,dp(14),0);b.setBackground(background(0xcc202020));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,dp(50));lp.setMargins(dp(4),0,dp(4),0);b.setLayoutParams(lp);b.setOnClickListener(v->{action.run();wake();});b.setOnFocusChangeListener((v,focus)->{b.setBackground(background(focus?orange:0xcc202020));if(focus)wake();});return b;}
 private final Runnable hide=()->{if(player!=null&&player.isPlaying()&&!seeking&&!failed)overlay.setVisibility(View.GONE);};
 private void wake(){overlay.setVisibility(View.VISIBLE);handler.removeCallbacks(hide);handler.postDelayed(hide,5000);}
 private String stamp(long ms){long sec=Math.max(0,ms/1000);return String.format(java.util.Locale.ROOT,"%d:%02d",sec/60,sec%60);}
 private final Runnable update=new Runnable(){public void run(){if(player!=null){long length=player.getLength();seek.setVisibility(length>0&&player.isSeekable()?View.VISIBLE:View.GONE);if(!seeking&&length>0)seek.setProgress((int)(1000*player.getTime()/length));time.setText(length>0?stamp(player.getTime())+" / "+stamp(length):"STREAM");pause.setText(player.isPlaying()?"Ⅱ":"▶");handler.postDelayed(this,700);}}};
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
  try{queue=new JSONArray(getIntent().getStringExtra("queue"));}catch(Exception e){queue=new JSONArray();}
  index=getIntent().getIntExtra("index",0);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);VLCVideoLayout video=new VLCVideoLayout(this);root.addView(video,new FrameLayout.LayoutParams(-1,-1));video.setOnClickListener(v->{if(overlay.getVisibility()==View.VISIBLE)overlay.setVisibility(View.GONE);else wake();});
  overlay=new LinearLayout(this);overlay.setOrientation(LinearLayout.VERTICAL);overlay.setPadding(dp(16),dp(20),dp(16),dp(20));overlay.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0xdd000000,0x00000000,0xee000000}));root.addView(overlay,new FrameLayout.LayoutParams(-1,-1));
  LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.addView(button("←",()->finish()));ImageView mark=new ImageView(this);mark.setImageResource(R.drawable.tuca_beak);top.addView(mark,new LinearLayout.LayoutParams(dp(40),dp(40)));TextView brand=new TextView(this);brand.setText("TucaTV");brand.setTextColor(orange);brand.setTextSize(22);brand.setTypeface(null,1);top.addView(brand,new LinearLayout.LayoutParams(0,-2,1));top.addView(button("Audio",()->tracks(false)));top.addView(button("CC",()->tracks(true)));overlay.addView(top);
  Space gap=new Space(this);overlay.addView(gap,new LinearLayout.LayoutParams(1,0,1));
  title=new TextView(this);title.setTextColor(Color.WHITE);title.setTextSize(getResources().getConfiguration().smallestScreenWidthDp>=600?32:23);title.setTypeface(null,1);title.setMaxLines(2);overlay.addView(title);
  status=new TextView(this);status.setTextColor(0xffbbbbbb);status.setTextSize(12);status.setPadding(0,dp(8),0,dp(12));overlay.addView(status);
  seek=new SeekBar(this);seek.setMax(1000);seek.setProgressTintList(android.content.res.ColorStateList.valueOf(orange));seek.setThumbTintList(android.content.res.ColorStateList.valueOf(orange));seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int p,boolean user){if(user&&player!=null&&player.isSeekable())player.setPosition(p/1000f);}public void onStartTrackingTouch(SeekBar b){seeking=true;wake();}public void onStopTrackingTouch(SeekBar b){seeking=false;wake();}});overlay.addView(seek);
  HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);LinearLayout controls=new LinearLayout(this);controls.setGravity(Gravity.CENTER_VERTICAL);
  controls.addView(button("|◀",()->change(-1)));pause=button("Ⅱ",()->toggle());controls.addView(pause);controls.addView(button("▶|",()->change(1)));controls.addView(button("↻",()->open()));controls.addView(button("Adatta",()->{if(player!=null)player.setVideoScale(player.getVideoScale()==MediaPlayer.ScaleType.SURFACE_BEST_FIT?MediaPlayer.ScaleType.SURFACE_FILL:MediaPlayer.ScaleType.SURFACE_BEST_FIT);}));
  time=new TextView(this);time.setTextColor(0xffaaaaaa);time.setPadding(dp(12),0,0,0);controls.addView(time);scroll.addView(controls);overlay.addView(scroll);setContentView(root);
  ArrayList<String> options=new ArrayList<>();options.add("--network-caching=1500");engine=new LibVLC(this,options);player=new MediaPlayer(engine);player.attachViews(video,null,false,false);
  player.setEventListener(event->runOnUiThread(()->{if(player==null)return;switch(event.type){case MediaPlayer.Event.Playing:failed=false;status.setText("In riproduzione");wake();break;case MediaPlayer.Event.Buffering:if(!failed)status.setText(event.getBuffering()<100?"Caricamento…":"In riproduzione");break;case MediaPlayer.Event.EncounteredError:failed=true;status.setText("Connessione non riuscita. Premi ↻ per riprovare.");wake();break;}}));open();handler.post(update);pause.requestFocus();
 }
 private void toggle(){if(player!=null){if(player.isPlaying())player.pause();else player.play();}}
 private void change(int step){if(index+step<0||index+step>=queue.length()){status.setText("Torna ai canali per continuare la selezione.");return;}index+=step;open();}
 private void open(){if(player==null)return;String url=getIntent().getStringExtra("url"),name=getIntent().getStringExtra("title");JSONObject item=queue.optJSONObject(index);if(item!=null){url=item.optString("url",url);name=item.optString("title",name);}player.stop();failed=false;title.setText(name);status.setText("Connessione…");Media media=new Media(engine,Uri.parse(url));media.setHWDecoderEnabled(true,false);player.setMedia(media);media.release();player.play();wake();}
 private void tracks(boolean subtitles){if(player==null)return;MediaPlayer.TrackDescription[] entries=subtitles?player.getSpuTracks():player.getAudioTracks();if(entries==null||entries.length==0){status.setText(subtitles?"Nessun sottotitolo disponibile":"Nessuna traccia audio disponibile");return;}handler.removeCallbacks(hide);String[] names=new String[entries.length];for(int i=0;i<entries.length;i++)names[i]=entries[i].name;new AlertDialog.Builder(this).setTitle(subtitles?"Sottotitoli":"Traccia audio").setItems(names,(d,n)->{if(subtitles)player.setSpuTrack(entries[n].id);else player.setAudioTrack(entries[n].id);}).setOnDismissListener(d->wake()).show();}
 @Override public boolean dispatchKeyEvent(KeyEvent e){if(e.getAction()==KeyEvent.ACTION_DOWN){if(e.getKeyCode()==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE){toggle();wake();return true;}if(e.getKeyCode()==KeyEvent.KEYCODE_CHANNEL_UP){change(1);return true;}if(e.getKeyCode()==KeyEvent.KEYCODE_CHANNEL_DOWN){change(-1);return true;}if(e.getKeyCode()>=KeyEvent.KEYCODE_DPAD_UP&&e.getKeyCode()<=KeyEvent.KEYCODE_DPAD_CENTER){if(overlay.getVisibility()!=View.VISIBLE){wake();pause.requestFocus();return true;}wake();}}return super.dispatchKeyEvent(e);}
 @Override public void onBackPressed(){finish();}
 @Override protected void onPause(){super.onPause();handler.removeCallbacks(hide);if(player!=null){resume=player.isPlaying();player.pause();}}
 @Override protected void onResume(){super.onResume();if(player!=null&&resume){player.play();resume=false;}}
 @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(player!=null){player.setEventListener(null);player.stop();player.detachViews();player.release();player=null;}if(engine!=null)engine.release();super.onDestroy();}
}
