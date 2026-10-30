package it.stefaniscion.onda;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="NativePlayer")
public class NativePlayerPlugin extends Plugin {
 private final java.util.concurrent.ExecutorService textPool=java.util.concurrent.Executors.newSingleThreadExecutor();
 private final java.util.concurrent.ExecutorService imagePool=java.util.concurrent.Executors.newFixedThreadPool(4);
 @Override protected void handleOnDestroy(){imagePool.shutdownNow();textPool.shutdownNow();super.handleOnDestroy();}
 private void progress(String id,long received,long total){JSObject event=new JSObject();event.put("requestId",id);event.put("received",received);event.put("total",total);notifyListeners("downloadProgress",event);}
 @PluginMethod public void text(PluginCall call){
  String value=call.getString("url","");String id=call.getString("requestId","");
  if(!value.startsWith("http://")&&!value.startsWith("https://")){call.reject("URL non valido");return;}
  textPool.execute(()->{java.net.HttpURLConnection connection=null;try{
   connection=(java.net.HttpURLConnection)new java.net.URL(value).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept-Encoding","identity");
   int status=connection.getResponseCode();if(status<200||status>=300){call.reject("La sorgente ha risposto con errore HTTP "+status);return;}
   long total=connection.getContentLengthLong();if(connection.getContentEncoding()!=null)total=0;if(total<0)total=0;if(total>67108864){call.reject("La playlist supera il limite di 64 MB.");return;}
   progress(id,0,total);long last=0,start=android.os.SystemClock.elapsedRealtime();java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
   try(java.io.InputStream input=connection.getInputStream()){byte[] block=new byte[32768];int n;while((n=input.read(block))!=-1){if(bytes.size()+n>67108864)throw new java.io.IOException("limit");bytes.write(block,0,n);long now=android.os.SystemClock.elapsedRealtime();if(now-start>120000)throw new java.io.IOException("timeout");if(now-last>=100){progress(id,bytes.size(),total);last=now;}}}
   progress(id,bytes.size(),total);JSObject result=new JSObject();result.put("data",bytes.toString("UTF-8"));call.resolve(result);
  }catch(Exception e){call.reject("Download non riuscito: controlla connessione, dimensione del file e accesso alla sorgente.");}finally{if(connection!=null)connection.disconnect();}});
 }
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
