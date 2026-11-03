package it.stefaniscion.tucatv;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/** Private disk queue. Only offsets and a requested record are held in memory. */
final class PlaybackQueue implements Closeable {

    private final File file;
    private final RandomAccessFile stream;
    private final ArrayList<Long> offsets = new ArrayList<>();

    PlaybackQueue(File directory) throws IOException {
        directory.mkdirs();
        file = File.createTempFile("queue-", ".tmp", directory);
        stream = new RandomAccessFile(file, "rw");
    }

    synchronized void append(String record) throws IOException {
        byte[] bytes = record.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 65536) throw new IOException("Queue record too large");
        stream.seek(stream.length());
        long offset = stream.getFilePointer();
        stream.writeInt(bytes.length);
        stream.write(bytes);
        offsets.add(offset);
    }

    synchronized String get(int index) throws IOException {
        stream.seek(offsets.get(index));
        int size = stream.readInt();
        if (size < 0 || size > 65536) throw new IOException("Invalid queue record");
        byte[] bytes = new byte[size];
        stream.readFully(bytes);
        return new String(bytes, StandardCharsets.UTF_8);
    }

    synchronized int length() {
        return offsets.size();
    }

    @Override
    public synchronized void close() {
        try {
            stream.close();
        } catch (IOException ignored) {}
        file.delete();
        offsets.clear();
    }
}
