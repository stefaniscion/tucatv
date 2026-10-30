package it.stefaniscion.onda;
import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import org.videolan.libvlc.*;
import org.videolan.libvlc.util.VLCVideoLayout;
import java.util.ArrayList;
public class PlayerActivity extends Activity {
 private LibVLC engine;private MediaPlayer player;private TextView status;private boolean resume;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.BLACK);
  LinearLayout bar=new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);
  Button back=new Button(this);back.setText("← Canali");back.setOnClickListener(v->finish());bar.addView(back);
  TextView title=new TextView(this);title.setText(getIntent().getStringExtra("title"));title.setTextColor(Color.WHITE);bar.addView(title);
  root.addView(bar);VLCVideoLayout video=new VLCVideoLayout(this);root.addView(video,new LinearLayout.LayoutParams(-1,0,1));
  status=new TextView(this);status.setTextColor(Color.WHITE);status.setPadding(20,12,20,12);status.setText("Connessione…");root.addView(status);
  LinearLayout controls=new LinearLayout(this);
  Button pause=new Button(this);pause.setText("Pausa / Play");pause.setOnClickListener(v->{if(player!=null){if(player.isPlaying())player.pause();else player.play();}});controls.addView(pause);
  Button retry=new Button(this);retry.setText("Riprova");retry.setOnClickListener(v->open());controls.addView(retry);root.addView(controls);setContentView(root);
  ArrayList<String> options=new ArrayList<>();options.add("--network-caching=1500");
  engine=new LibVLC(this,options);player=new MediaPlayer(engine);player.attachViews(video,null,false,false);
  player.setEventListener(event->runOnUiThread(()->{switch(event.type){case MediaPlayer.Event.Playing:status.setText("In riproduzione");break;case MediaPlayer.Event.Buffering:status.setText(event.getBuffering()<100?"Caricamento…":"");break;case MediaPlayer.Event.EncounteredError:status.setText("Sorgente non riproducibile. Verifica connessione e accesso alla playlist.");break;}}));open();
 }
 private void open(){if(player==null)return;player.stop();status.setText("Connessione…");Media media=new Media(engine,Uri.parse(getIntent().getStringExtra("url")));media.setHWDecoderEnabled(true,false);player.setMedia(media);media.release();player.play();}
 @Override protected void onPause(){super.onPause();if(player!=null){resume=player.isPlaying();player.pause();}}
 @Override protected void onResume(){super.onResume();if(player!=null&&resume){player.play();resume=false;}}
 @Override protected void onDestroy(){if(player!=null){player.setEventListener(null);player.stop();player.detachViews();player.release();player=null;}if(engine!=null)engine.release();super.onDestroy();}
}
