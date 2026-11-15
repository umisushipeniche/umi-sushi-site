#!/usr/bin/env python3
"""Run at root of a checked-out umi-sushi-site test-v3 repo after unzipping images."""
import json
from pathlib import Path
file=Path('content/site.json')
if not file.exists(): raise SystemExit('Please run from repo root')
with file.open(encoding='utf-8') as f: data=json.load(f)
data['gallery']=[{'image': 'assets/ambiente/umi-ambiente-01.webp', 'caption_pt': 'Ambiente UMI 1', 'caption_en': 'UMI atmosphere 1'}, {'image': 'assets/ambiente/umi-ambiente-02.webp', 'caption_pt': 'Ambiente UMI 2', 'caption_en': 'UMI atmosphere 2'}, {'image': 'assets/ambiente/umi-ambiente-03.webp', 'caption_pt': 'Ambiente UMI 3', 'caption_en': 'UMI atmosphere 3'}, {'image': 'assets/ambiente/umi-ambiente-04.webp', 'caption_pt': 'Ambiente UMI 4', 'caption_en': 'UMI atmosphere 4'}, {'image': 'assets/ambiente/umi-ambiente-05.webp', 'caption_pt': 'Ambiente UMI 5', 'caption_en': 'UMI atmosphere 5'}, {'image': 'assets/ambiente/umi-ambiente-06.webp', 'caption_pt': 'Ambiente UMI 6', 'caption_en': 'UMI atmosphere 6'}, {'image': 'assets/ambiente/umi-ambiente-07.webp', 'caption_pt': 'Ambiente UMI 7', 'caption_en': 'UMI atmosphere 7'}, {'image': 'assets/ambiente/umi-ambiente-08.webp', 'caption_pt': 'Ambiente UMI 8', 'caption_en': 'UMI atmosphere 8'}, {'image': 'assets/ambiente/umi-ambiente-09.webp', 'caption_pt': 'Ambiente UMI 9', 'caption_en': 'UMI atmosphere 9'}]
with file.open('w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2);f.write('\n')
print('Replaced gallery with 9 new UMI environment photos.')
