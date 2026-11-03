package it.stefaniscion.tucatv;
import java.io.*;
import java.nio.file.Files;
public class PlaybackQueueTest {
 public static void main(String[] args)throws Exception{
  File directory=Files.createTempDirectory("tucatv-queue-test").toFile();
  try(PlaybackQueue queue=new PlaybackQueue(directory)){
   for(int i=0;i<12000;i++)queue.append("Città "+i);
   if(queue.length()!=12000)throw new AssertionError();
   for(int index:new int[]{0,100,101,11999,50})if(!queue.get(index).equals("Città "+index))throw new AssertionError();
   try{queue.append(new String(new char[65537]));throw new AssertionError();}catch(IOException expected){}
  }
  if(directory.list().length!=0)throw new AssertionError("Temporary queue leaked");
  directory.delete();System.out.println("Playback queue: random access beyond 101 entries and cleanup OK");
 }
}
