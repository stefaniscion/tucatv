import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from playback_queue import PlaybackQueue

class QueueTests(unittest.TestCase):
 def test_reads_across_old_101_boundary_and_releases_file(self):
  queue=PlaybackQueue()
  try:
   for start in range(0,12000,100):queue.append([{'url':f'https://example.test/{i}','title':f'Città {i}'} for i in range(start,start+100)])
   self.assertEqual(len(queue),12000)
   for i in (0,100,101,11999,50):self.assertEqual(queue[i]['title'],f'Città {i}')
   with self.assertRaises(IndexError):queue[12000]
  finally:queue.close()
  self.assertTrue(queue.file.closed)
 def test_rejects_oversized_batches_and_invalid_urls(self):
  queue=PlaybackQueue()
  try:
   with self.assertRaises(ValueError):queue.append([{'url':'https://example.test'}]*101)
   with self.assertRaises(ValueError):queue.append([{'url':'file:///private'}])
   self.assertEqual(len(queue),0)
  finally:queue.close()
