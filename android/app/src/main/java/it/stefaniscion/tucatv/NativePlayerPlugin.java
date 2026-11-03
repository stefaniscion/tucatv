package it.stefaniscion.tucatv;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    private String tr(String key) {
        return I18n.text(getContext(), key);
    }

    @PluginMethod
    public void setLanguage(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                I18n.setLanguage(getContext(), call.getString("language", "en"));
                if (PlaybackService.current != null) PlaybackService.current.languageChanged();
                call.resolve();
            } catch (Exception e) {
                call.reject(tr("Unsupported language"));
            }
        });
    }

    private static final java.util.Map<String, PlaybackQueue> queues = new java.util.concurrent.ConcurrentHashMap<>();

    static PlaybackQueue takeQueue(String handle) {
        return handle == null ? null : queues.remove(handle);
    }

    @PluginMethod
    public void beginQueue(PluginCall call) {
        textPool.execute(() -> {
            try {
                for (PlaybackQueue queue : queues.values()) queue.close();
                queues.clear();
                String handle = java.util.UUID.randomUUID().toString();
                queues.put(handle, new PlaybackQueue(new java.io.File(getContext().getCacheDir(), "playback-queues")));
                JSObject result = new JSObject();
                result.put("handle", handle);
                call.resolve(result);
            } catch (Exception e) {
                call.reject(tr("Unable to prepare the playback queue."));
            }
        });
    }

    @PluginMethod
    public void appendQueue(PluginCall call) {
        textPool.execute(() -> {
            try {
                PlaybackQueue queue = queues.get(call.getString("handle", ""));
                if (queue == null) throw new IllegalArgumentException();
                JSArray items = call.getArray("items", new JSArray());
                if (items.length() > 100) throw new IllegalArgumentException();
                for (int i = 0; i < items.length(); i++) {
                    org.json.JSONObject item = items.getJSONObject(i);
                    String scheme = Uri.parse(item.optString("url")).getScheme();
                    if (!"http".equals(scheme) && !"https".equals(scheme)) throw new IllegalArgumentException();
                    queue.append(item.toString());
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(tr("Invalid playback queue."));
            }
        });
    }

    @PluginMethod
    public void closeQueue(PluginCall call) {
        textPool.execute(() -> {
            PlaybackQueue queue = takeQueue(call.getString("handle", ""));
            if (queue != null) queue.close();
            call.resolve();
        });
    }

    private final java.util.concurrent.ExecutorService textPool =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    private final java.util.concurrent.ExecutorService downloadPool = java.util.concurrent.Executors.newFixedThreadPool(
        2
    );
    private final java.util.concurrent.ExecutorService imagePool = java.util.concurrent.Executors.newFixedThreadPool(4);
    private volatile boolean downloadsClosed = false;
    private final java.util.Map<String, java.io.File> playlistFiles = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<String, java.io.InputStream> playlistStreams =
        new java.util.concurrent.ConcurrentHashMap<>();

    @Override
    public void load() {
        if (PlaybackService.current == null && PlaybackService.preparedQueues.isEmpty()) {
            java.io.File qdir = new java.io.File(getContext().getCacheDir(), "playback-queues");
            java.io.File[] old = qdir.listFiles();
            if (old != null) for (java.io.File q : old) q.delete();
        }
        java.io.File dir = new java.io.File(getContext().getCacheDir(), "playlist-import");
        dir.mkdirs();
        java.io.File[] stale = dir.listFiles();
        if (stale != null) for (java.io.File f : stale) f.delete();
    }

    private void closePlaylistHandle(String handle) {
        java.io.InputStream input = playlistStreams.remove(handle);
        if (input != null) try {
            input.close();
        } catch (java.io.IOException ignored) {}
        java.io.File file = playlistFiles.remove(handle);
        if (file != null) file.delete();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        downloadsClosed = true;
        for (String handle : playlistFiles.keySet()) closePlaylistHandle(handle);
        imagePool.shutdownNow();
        downloadPool.shutdownNow();
        textPool.shutdownNow();
        for (PlaybackQueue queue : queues.values()) queue.close();
        queues.clear();
        super.handleOnDestroy();
    }

    private void progress(String id, long received, long total) {
        JSObject event = new JSObject();
        event.put("requestId", id);
        event.put("received", received);
        event.put("total", total);
        notifyListeners("downloadProgress", event);
    }

    private static String conditionalHeader(String value) {
        return value != null && value.length() <= 1024 && value.indexOf('\r') < 0 && value.indexOf('\n') < 0
            ? value
            : "";
    }

    @PluginMethod
    public void text(PluginCall call) {
        String value = call.getString("url", "");
        String id = call.getString("requestId", "");
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            call.reject(tr("Invalid URL"));
            return;
        }
        downloadPool.execute(() -> {
            java.net.HttpURLConnection connection = null;
            try {
                connection = HttpRequest.open(
                    value,
                    15000,
                    30000,
                    "text/xml, text/plain;q=0.9, application/octet-stream;q=0.8"
                );
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject(tr("The source returned HTTP ") + status);
                    return;
                }
                long total = connection.getContentLengthLong();
                if (connection.getContentEncoding() != null) total = 0;
                if (total < 0) total = 0;
                if (total > 67108864) {
                    call.reject(tr("The XMLTV guide exceeds the 64 MB limit."));
                    return;
                }
                progress(id, 0, total);
                long last = 0,
                    start = android.os.SystemClock.elapsedRealtime();
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                try (java.io.InputStream input = connection.getInputStream()) {
                    byte[] block = new byte[32768];
                    int n;
                    while ((n = input.read(block)) != -1) {
                        if (bytes.size() + n > 67108864) throw new java.io.IOException("limit");
                        bytes.write(block, 0, n);
                        long now = android.os.SystemClock.elapsedRealtime();
                        if (now - start > 120000) throw new java.io.IOException("timeout");
                        if (now - last >= 100) {
                            progress(id, bytes.size(), total);
                            last = now;
                        }
                    }
                }
                if (total > 0 && bytes.size() != total) throw new java.io.IOException("Download incompleto");
                progress(id, bytes.size(), total);
                JSObject result = new JSObject();
                result.put("data", bytes.toString("UTF-8"));
                call.resolve(result);
            } catch (Exception e) {
                call.reject(tr("Download failed: check the connection, file size and access to the source."));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    @PluginMethod
    public void downloadPlaylist(PluginCall call) {
        String value = call.getString("url", "");
        String id = call.getString("requestId", "");
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            call.reject(tr("Invalid URL"));
            return;
        }
        downloadPool.execute(() -> {
            java.net.HttpURLConnection connection = null;
            java.io.File file = null;
            String handle = null;
            boolean retained = false;
            try {
                // Playlist import and EPG downloads may overlap; never invalidate another reader.
                if (playlistFiles.size() >= 4) throw new java.io.IOException("Too many downloads");
                connection = HttpRequest.open(
                    value,
                    15000,
                    30000,
                    "application/octet-stream, application/x-xz, application/xml;q=0.9, text/xml;q=0.9"
                );
                String etag = conditionalHeader(call.getString("etag", ""));
                String lastModified = conditionalHeader(call.getString("lastModified", ""));
                if (!etag.isEmpty()) connection.setRequestProperty("If-None-Match", etag);
                if (!lastModified.isEmpty()) connection.setRequestProperty("If-Modified-Since", lastModified);
                int status = connection.getResponseCode();
                if (status == java.net.HttpURLConnection.HTTP_NOT_MODIFIED) {
                    JSObject result = new JSObject();
                    result.put("notModified", true);
                    call.resolve(result);
                    return;
                }
                if (status < 200 || status >= 300) {
                    call.reject(tr("The source returned HTTP ") + status);
                    return;
                }
                long length = connection.getContentLengthLong();
                final long total = connection.getContentEncoding() == null && length > 0 ? length : 0;
                if (total > PlaylistTransfer.MAX_BYTES) {
                    call.reject(tr("The playlist exceeds the 256 MB limit."));
                    return;
                }
                file = java.io.File.createTempFile(
                    "playlist-",
                    ".tmp",
                    new java.io.File(getContext().getCacheDir(), "playlist-import")
                );
                progress(id, 0, total);
                long size;
                try (
                    java.io.InputStream input = connection.getInputStream();
                    java.io.OutputStream output = new java.io.FileOutputStream(file)
                ) {
                    size = PlaylistTransfer.copy(input, output, n -> progress(id, n, total));
                }
                if (total > 0 && size != total) throw new java.io.IOException("Download incompleto.");
                synchronized (this) {
                    if (downloadsClosed || playlistFiles.size() >= 4) throw new java.io.IOException(
                        "Downloads closed or full"
                    );
                    handle = java.util.UUID.randomUUID().toString();
                    playlistFiles.put(handle, file);
                    playlistStreams.put(handle, new java.io.FileInputStream(file));
                }
                JSObject result = new JSObject();
                result.put("handle", handle);
                result.put("size", size);
                String responseEtag = connection.getHeaderField("ETag");
                String responseLastModified = connection.getHeaderField("Last-Modified");
                result.put("etag", responseEtag == null ? "" : responseEtag);
                result.put("lastModified", responseLastModified == null ? "" : responseLastModified);
                call.resolve(result);
                retained = true;
            } catch (Exception error) {
                call.reject(tr("Playlist download failed. Check the connection, available space and link validity."));
            } finally {
                if (connection != null) connection.disconnect();
                if (!retained) {
                    if (handle != null) closePlaylistHandle(handle);
                    if (file != null) file.delete();
                }
            }
        });
    }

    @PluginMethod
    public void readPlaylistChunk(PluginCall call) {
        String handle = call.getString("handle", "");
        textPool.execute(() -> {
            try {
                java.io.InputStream input = playlistStreams.get(handle);
                if (input == null) {
                    call.reject(tr("Import expired: please try again."));
                    return;
                }
                byte[] block = new byte[262144];
                int count = input.read(block);
                JSObject result = new JSObject();
                result.put("done", count == -1);
                if (count > 0) result.put(
                    "data",
                    android.util.Base64.encodeToString(block, 0, count, android.util.Base64.NO_WRAP)
                );
                call.resolve(result);
            } catch (Exception error) {
                closePlaylistHandle(handle);
                call.reject(tr("Unable to read the playlist."));
            }
        });
    }

    @PluginMethod
    public void closePlaylist(PluginCall call) {
        String handle = call.getString("handle", "");
        textPool.execute(() -> {
            closePlaylistHandle(handle);
            call.resolve();
        });
    }

    @PluginMethod
    public void image(PluginCall call) {
        String value = call.getString("url", "");
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            call.reject(tr("Invalid logo URL"));
            return;
        }
        imagePool.execute(() -> {
            java.net.HttpURLConnection connection = null;
            try {
                connection = HttpRequest.open(value, 8000, 8000, "image/*");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new java.io.IOException();
                if (connection.getContentLengthLong() > 2097152) throw new java.io.IOException();
                String type = connection.getContentType();
                if (type == null) type = "image/png";
                type = type.split(";")[0].trim();
                if (!type.startsWith("image/")) throw new java.io.IOException();
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                try (java.io.InputStream stream = connection.getInputStream()) {
                    byte[] block = new byte[8192];
                    int n;
                    while ((n = stream.read(block)) != -1) {
                        if (bytes.size() + n > 2097152) throw new java.io.IOException();
                        bytes.write(block, 0, n);
                    }
                }
                JSObject result = new JSObject();
                result.put(
                    "data",
                    "data:" +
                        type +
                        ";base64," +
                        android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.NO_WRAP)
                );
                call.resolve(result);
            } catch (Exception e) {
                call.reject(tr("Logo unavailable"));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private JSObject playbackState() {
        JSObject result = new JSObject();
        PlaybackService service = PlaybackService.current;
        boolean available = service != null && service.hasSession();
        result.put("available", available);
        if (available) {
            result.put("title", service.title);
            result.put("playing", service.player.isPlaying());
            result.put("status", tr(service.status));
        }
        android.content.SharedPreferences saved = getContext().getSharedPreferences("playback-history", 0);
        String owner = saved.getString("playlistId", "");
        if (!owner.isEmpty()) {
            JSObject last = new JSObject();
            last.put("playlistId", owner);
            last.put("url", saved.getString("url", ""));
            last.put("at", saved.getLong("at", 0));
            result.put("lastPlayed", last);
        }
        return result;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners("playbackState", playbackState());
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(playbackState()));
    }

    @PluginMethod
    public void resumePlayback(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            PlaybackService service = PlaybackService.current;
            if (service == null || !service.hasSession()) {
                call.reject(tr("No playback in progress."));
                return;
            }
            Intent intent = new Intent(getActivity(), PlayerActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            getActivity().startActivity(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            PlaybackService service = PlaybackService.current;
            if (service != null) service.stopPlayback();
            call.resolve(playbackState());
        });
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        android.app.UiModeManager mode = (android.app.UiModeManager) getContext().getSystemService(
            android.content.Context.UI_MODE_SERVICE
        );
        JSObject result = new JSObject();
        result.put(
            "tv",
            mode != null && mode.getCurrentModeType() == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION
        );
        call.resolve(result);
    }

    @PluginMethod
    public void exitToHome(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().moveTaskToBack(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url", "");
        String scheme = Uri.parse(url).getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            call.reject(tr("Unsupported URL"));
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(getActivity(), PlayerActivity.class);
                intent.putExtra("url", url);
                intent.putExtra("title", call.getString("title", "TucaTV"));
                String handle = call.getString("queueHandle", "");
                PlaybackQueue queue = takeQueue(handle);
                if (queue == null) throw new IllegalArgumentException();
                // Transfer ownership before resolving: JS can now dispose its upload handle.
                String token = java.util.UUID.randomUUID().toString();
                PlaybackService.preparedQueues.put(token, queue);
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    PlaybackQueue abandoned = PlaybackService.preparedQueues.remove(token);
                    if (abandoned != null) abandoned.close();
                }, 30000);
                intent.putExtra("queueHandle", token);
                intent.putExtra("playlistId", call.getString("playlistId", ""));
                intent.putExtra("index", call.getInt("index", 0));
                try {
                    getActivity().startActivity(intent);
                } catch (Exception error) {
                    PlaybackService.preparedQueues.remove(token);
                    queue.close();
                    throw error;
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(tr("Unable to open the native player"));
            }
        });
    }
}
