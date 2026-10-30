package it.stefaniscion.onda;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="NativePlayer")
public class NativePlayerPlugin extends Plugin {
 private final java.util.concurrent.ExecutorService textPool=java.util.concurrent.Executors.newSingleThreadExecutor();
 private final java.util.concurrent.ExecutorService imagePool=java.util.concurrent.Executors.newFixedThreadPool(4);
 private final java.util.Map<String,java.io.File> playlistFiles=new java.util.concurrent.ConcurrentHashMap<>();
 private final java.util.Map<String,java.io.InputStream> playlistStreams=new java.util.concurrent.ConcurrentHashMap<>();
 @Override public void load(){java.io.File dir=new java.io.File(getContext().getCacheDir(),"playlist-import");dir.mkdirs();java.io.File[] stale=dir.listFiles();if(stale!=null)for(java.io.File f:stale)f.delete();}
 private void closePlaylistHandle(String handle){java.io.InputStream input=playlistStreams.remove(handle);if(input!=null)try{input.close();}catch(java.io.IOException ignored){}java.io.File file=playlistFiles.remove(handle);if(file!=null)file.delete();}
 @Override protected void handleOnDestroy(){for(String handle:playlistFiles.keySet())closePlaylistHandle(handle);imagePool.shutdownNow();textPool.shutdownNow();super.handleOnDestroy();}
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
 @PluginMethod public void downloadPlaylist(PluginCall call){
  String value=call.getString("url","");String id=call.getString("requestId","");
  if(!value.startsWith("http://")&&!value.startsWith("https://")){call.reject("URL non valido");return;}
  textPool.execute(()->{java.net.HttpURLConnection connection=null;java.io.File file=null;String handle=null;boolean retained=false;try{
   // Only one import is kept; abandoned handles cannot accumulate large cache files.
   for(String old:playlistFiles.keySet())closePlaylistHandle(old);
   connection=(java.net.HttpURLConnection)new java.net.URL(value).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept-Encoding","identity");
   int status=connection.getResponseCode();if(status<200||status>=300){call.reject("La sorgente ha risposto con errore HTTP "+status);return;}
   long length=connection.getContentLengthLong();final long total=connection.getContentEncoding()==null&&length>0?length:0;
   if(total>PlaylistTransfer.MAX_BYTES){call.reject("La playlist supera il limite di 64 MB.");return;}
   file=java.io.File.createTempFile("playlist-",".tmp",new java.io.File(getContext().getCacheDir(),"playlist-import"));progress(id,0,total);
   long size;try(java.io.InputStream input=connection.getInputStream();java.io.OutputStream output=new java.io.FileOutputStream(file)){size=PlaylistTransfer.copy(input,output,n->progress(id,n,total));}
   if(total>0&&size!=total)throw new java.io.IOException("Download incompleto.");
   handle=java.util.UUID.randomUUID().toString();playlistFiles.put(handle,file);playlistStreams.put(handle,new java.io.FileInputStream(file));
   JSObject result=new JSObject();result.put("handle",handle);result.put("size",size);call.resolve(result);retained=true;
  }catch(Exception error){call.reject("Download della playlist non riuscito. Controlla connessione, spazio disponibile e validità del link.");}
  finally{if(connection!=null)connection.disconnect();if(!retained){if(handle!=null)closePlaylistHandle(handle);if(file!=null)file.delete();}}});
 }
 @PluginMethod public void readPlaylistChunk(PluginCall call){String handle=call.getString("handle","");textPool.execute(()->{try{
  java.io.InputStream input=playlistStreams.get(handle);if(input==null){call.reject("Importazione scaduta: riprova.");return;}
  byte[] block=new byte[65536];int count=input.read(block);JSObject result=new JSObject();result.put("done",count==-1);
  if(count>0)result.put("data",android.util.Base64.encodeToString(block,0,count,android.util.Base64.NO_WRAP));
  call.resolve(result);
 }catch(Exception error){closePlaylistHandle(handle);call.reject("Lettura della playlist non riuscita.");}});}
 @PluginMethod public void closePlaylist(PluginCall call){String handle=call.getString("handle","");textPool.execute(()->{closePlaylistHandle(handle);call.resolve();});}
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
