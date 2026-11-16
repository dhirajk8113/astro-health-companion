#!/usr/bin/env python3
"""Turns the recorded takes of Astro's lines into the files the app plays.

  python3 tools/build-voice.py <bundle file> "<voice name>"

The bundle is one file holding every take: a count, then for each take its
line number and its MP3 bytes. Each take is re-encoded small (mono MP3) into
media/voice/, and js/data/voice-lines.js is written to map each line to its file.

AI disclosure: written by an AI coding assistant (Claude). The recordings are
AI-generated speech (ElevenLabs). See AI-USE.md.
"""
import json
import pathlib
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
bundle = pathlib.Path(sys.argv[1]).read_bytes()
voice = sys.argv[2]
lines = json.loads(subprocess.run(['node', str(ROOT / 'tools' / 'voice-lines.mjs')], check=True, capture_output=True, text=True).stdout)

out = ROOT / 'media' / 'voice'
out.mkdir(parents=True, exist_ok=True)
tmp = pathlib.Path('/tmp/voice-raw')
tmp.mkdir(exist_ok=True)

count, = struct.unpack_from('<I', bundle, 0)
at = 4
takes = {}
for _ in range(count):
    index, size = struct.unpack_from('<II', bundle, at)
    at += 8
    takes[index] = bundle[at:at + size]
    at += size
assert at == len(bundle), 'the bundle has bytes left over'
missing = [i for i in range(len(lines)) if i not in takes]
assert not missing, f'no take for lines {missing}'

entries = {}
for i, text in enumerate(lines):
    raw = tmp / f'{i:02d}.mp3'
    raw.write_bytes(takes[i])
    name = f'line-{i + 1:02d}.mp3'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', str(out / name)], check=True)
    seconds = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out / name)], check=True, capture_output=True, text=True).stdout)
    # A take far from the usual pace is a sign something other than the line was spoken.
    pace = len(text) / seconds
    flag = '' if 9 <= pace <= 22 else '   <-- check this one'
    print(f'{name}  {seconds:5.1f} s  {pace:4.1f} chars/s  {text[:60]}{flag}')
    entries[text] = {'file': name, 'seconds': round(seconds, 2)}

body = ',\n'.join(f'  {json.dumps(text)}: {{ file: {json.dumps(e["file"])}, seconds: {e["seconds"]} }}' for text, e in entries.items())
(ROOT / 'js' / 'data' / 'voice-lines.js').write_text(f"""// Astro's recorded lines: each line Astro can say, and the audio file that says it.
// Written by tools/build-voice.py. Empty means no recordings: Astro then uses the tablet's own voice.
//
// AI disclosure: the recordings are AI-generated speech (ElevenLabs, voice {json.dumps(voice)}). See AI-USE.md.

export const VOICE_NAME = {json.dumps(voice)};
export const VOICE_LINES = {{
{body},
}};
""")
total = sum(f.stat().st_size for f in out.glob('line-*.mp3'))
print(f'{len(entries)} lines, {total / 1e6:.1f} MB, {sum(e["seconds"] for e in entries.values()):.0f} s')
