import unittest, sys
from pathlib import Path
from unittest.mock import patch
from email.message import Message
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from network import valid_url, download
class Reply:
 def __init__(self, body, mime):
  self.body=body;self.url='https://example.test/logo';self.headers=Message();self.headers['Content-Type']=mime
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,n):return self.body[:n]
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
