import sys, shutil, subprocess, json
from pathlib import Path
binary=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();root=out/'deb-root';repo=Path(__file__).resolve().parents[1]
version=json.loads((repo/'package.json').read_text())['version']
if root.exists():shutil.rmtree(root)
for folder in ['DEBIAN','opt','usr/bin','usr/share/applications','usr/share/icons/hicolor/scalable/apps','usr/share/doc/tucatv']: (root/folder).mkdir(parents=True,exist_ok=True)
shutil.copytree(binary,root/'opt/tucatv')
(root/'DEBIAN/control').write_text(f'Package: tucatv\nVersion: {version}\nArchitecture: amd64\nMaintainer: TucaTV\nSection: video\nPriority: optional\nDepends: libc6 (>= 2.39), libvlc5, vlc-plugin-base, vlc-plugin-video-output, libxtst6, libxkbfile1, libxcb-cursor0, libxkbcommon-x11-0, libnss3, libasound2t64 | libasound2, xwayland\nDescription: TucaTV Desktop beta\n Shared local playlist interface with an embedded VLC player.\n')
launcher=root/'usr/bin/tucatv';launcher.write_text('#!/bin/sh\nexec /opt/tucatv/tucatv "$@"\n');launcher.chmod(0o755)
(root/'usr/share/applications/tucatv.desktop').write_text('[Desktop Entry]\nType=Application\nName=TucaTV\nComment=La tua TV. Il tuo ritmo.\nExec=tucatv\nIcon=tucatv\nTerminal=false\nCategories=AudioVideo;Player;\n')
shutil.copy(repo/'public/tucatv-mark.svg',root/'usr/share/icons/hicolor/scalable/apps/tucatv.svg')
shutil.copy(repo/'desktop/README.md',root/'usr/share/doc/tucatv/README')
for name in ['main.py','network.py','requirements.txt']:shutil.copy(repo/'desktop'/name,root/'usr/share/doc/tucatv'/name)
subprocess.run(['dpkg-deb','--root-owner-group','-Zxz','--build',str(root),str(out/f'TucaTV-{version}-Linux-amd64.deb')],check=True)
