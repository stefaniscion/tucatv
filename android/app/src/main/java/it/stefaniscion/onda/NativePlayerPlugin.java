package it.stefaniscion.onda;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="NativePlayer")
public class NativePlayerPlugin extends Plugin {
 private final java.util.concurrent.ExecutorService imagePool=java.util.concurrent.Executors.newFixedThreadPool(4);
 @Override protected void handleOnDestroy(){imagePool.shutdownNow();super.handleOnDestroy();}
 @PluginMethod public void image(PluginCall call){
  String value=call.getString("url","");
  if(!value.startsWith("http://")&&!value.startsWith("https://")){call.reject("URL logo non valido");return;}
  imagePool.execute(()->{
   java.net.HttpURLConnection connection=null;
   try{
    connection=(java.net.HttpURLConnection)new java.net.URL(value).openConnection();
    connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setRequestProperty("Accept","image/*");
    int status=connection.getResponseCode();if(status<200||status>=300)throw new java.io.IOException();
    if(connection.getContentLengthLong()>2097152)throw new java.io.IOException();
    String type=connection.getContentType();if(type==null)type="image/png";type=type.split(";")[0].trim();
    if(!type.startsWith("image/"))throw new java.io.IOException();
    java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
    try(java.io.InputStream stream=connection.getInputStream()){byte[] block=new byte[8192];int n;while((n=stream.read(block))!=-1){if(bytes.size()+n>2097152)throw new java.io.IOException();bytes.write(block,0,n);}}
    JSObject result=new JSObject();result.put("data","data:"+type+";base64,"+android.util.Base64.encodeToString(bytes.toByteArray(),android.util.Base64.NO_WRAP));call.resolve(result);
   }catch(Exception e){call.reject("Logo non disponibile");}finally{if(connection!=null)connection.disconnect();}
  });
 }

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
