import unittest, sys
from pathlib import Path
from unittest.mock import patch
from email.message import Message
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from network import valid_url, download
class Reply:
 def __init__(self, body, mime):
  self.body=body;self.pos=0;self.url='https://example.test/logo';self.headers=Message();self.headers['Content-Type']=mime
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):
  chunk=self.body[self.pos:self.pos+n];self.pos+=len(chunk);return chunk
class NetworkTests(unittest.TestCase):
 def test_url_validation(self):
  for value in ['file:///etc/passwd','javascript:alert(1)','https://','x',None]:
   with self.assertRaises(ValueError):valid_url(value)
  self.assertEqual(valid_url('http://example.test/live/1'),'http://example.test/live/1')
 def test_image_encoded_for_webview(self):
  with patch('network.urlopen',return_value=Reply(b'png','image/png')):
   self.assertEqual(download('http://example.test/logo',True),'data:image/png;base64,cG5n')
 def test_reject_html_instead_of_logo(self):
  with patch('network.urlopen',return_value=Reply(b'<html>login</html>','text/html')):
   with self.assertRaises(ValueError):download('https://example.test/logo',True)
 def test_bound_image_size(self):
  with patch('network.urlopen',return_value=Reply(b'x'*(2*1024*1024+1),'image/png')):
   with self.assertRaises(ValueError):download('https://example.test/logo',True)
if __name__=='__main__':unittest.main()

class ProgressTests(unittest.TestCase):
 def test_native_download_reports_received_and_total(self):
  response=Reply(b'x'*70000,'text/plain');response.headers['Content-Length']='70000';events=[]
  with patch('network.urlopen',return_value=response):
   data=download('http://example.test/list',on_progress=lambda received,total:events.append((received,total)))
  self.assertEqual(len(data),70000);self.assertEqual(events[0],(0,70000));self.assertEqual(events[-1],(70000,70000));self.assertTrue(any(0<received<70000 for received,total in events))
