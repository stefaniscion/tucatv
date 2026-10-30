package it.stefaniscion.onda;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="NativePlayer")
public class NativePlayerPlugin extends Plugin {
 @PluginMethod public void play(PluginCall call) {
  String url=call.getString("url","");
  String scheme=Uri.parse(url).getScheme();
  if(!"http".equals(scheme)&&!"https".equals(scheme)){call.reject("URL non supportato");return;}
  getActivity().runOnUiThread(()->{
   try{
    Intent intent=new Intent(getActivity(),PlayerActivity.class);
    intent.putExtra("url",url);intent.putExtra("title",call.getString("title","TucaTV"));
    intent.putExtra("queue",call.getArray("queue",new JSArray()).toString());intent.putExtra("index",call.getInt("index",0));
    getActivity().startActivity(intent);call.resolve();
   }catch(Exception e){call.reject("Impossibile aprire il player nativo");}
  });
 }
}
