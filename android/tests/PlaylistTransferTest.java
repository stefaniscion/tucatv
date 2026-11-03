package it.stefaniscion.tucatv;
import java.io.*;
public class PlaylistTransferTest {
 public static void main(String[] args)throws Exception{
  final long[] count={0};OutputStream sink=new OutputStream(){public void write(int b){count[0]++;}public void write(byte[] b,int offset,int length){count[0]+=length;}};
  InputStream source=new InputStream(){long remaining=128L*1024*1024;public int read(){throw new AssertionError("Must read bounded blocks");}public int read(byte[] b){int n=(int)Math.min(b.length,remaining);if(n==0)return -1;remaining-=n;return n;}};
  final long[] progress={0};long size=PlaylistTransfer.copy(source,sink,n->{if(n<progress[0])throw new AssertionError();progress[0]=n;});
  if(size!=128L*1024*1024||count[0]!=size||progress[0]!=size)throw new AssertionError();
  try{PlaylistTransfer.copy(new InputStream(){public int read(){return 0;}public int read(byte[] b){return b.length;}},sink,n->{});throw new AssertionError("Missing size guard");}catch(IOException expected){}
  Thread.currentThread().interrupt();try{PlaylistTransfer.copy(new ByteArrayInputStream(new byte[1]),sink,n->{});throw new AssertionError("Missing cancellation");}catch(InterruptedIOException expected){}finally{Thread.interrupted();}
  System.out.println("Playlist transfer: 128 MiB with 16 MiB heap, size limit and interruption OK");
 }
}
