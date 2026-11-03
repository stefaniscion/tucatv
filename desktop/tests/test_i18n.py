import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from i18n import Translator

class TranslationTests(unittest.TestCase):
 def test_shared_catalogue_and_live_language_change(self):
  translator=Translator(Path(__file__).resolve().parents[2]/'src','it')
  self.assertEqual(translator.text('Subtitles'),'Sottotitoli')
  translator.set_language('en')
  self.assertEqual(translator.text('Subtitles'),'Subtitles')
  self.assertEqual(translator.text('Provider channel'),'Provider channel')
  with self.assertRaises(ValueError):translator.set_language('fr')
 def test_missing_assets_fall_back_without_crashing(self):
  translator=Translator('/missing/tucatv/assets','en')
  self.assertEqual(translator.text('Pause'),'Pause')
