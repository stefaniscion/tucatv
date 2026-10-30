package it.stefaniscion.onda;

import java.io.*;

/** Bounded transfer to private cache; no full playlist byte array or JSON string. */
final class PlaylistTransfer {
 static final long MAX_BYTES=256L*1024*1024;
 interface Progress { void update(long received); }
 static long copy(InputStream input,OutputStream output,Progress progress) throws IOException {
  byte[] block=new byte[32768];long received=0,start=System.nanoTime(),last=0;
  int n;while((n=input.read(block))!=-1){
   if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
   received+=n;if(received>MAX_BYTES)throw new IOException("La playlist supera il limite di 256 MB.");
   if((System.nanoTime()-start)/1000000>120000)throw new IOException("Tempo di attesa scaduto.");
   output.write(block,0,n);long now=System.nanoTime();if(now-last>=100000000){progress.update(received);last=now;}
  }
  progress.update(received);return received;
 }
}
