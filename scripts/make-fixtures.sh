#!/bin/sh
# Synthetic media so `npm run remotion:studio` has something to play.
set -e
cd "$(dirname "$0")/.."
FF=./node_modules/ffmpeg-static/ffmpeg
OUT=remotion/fixtures
mkdir -p "$OUT"
$FF -hide_banner -loglevel error -y -f lavfi -i "testsrc2=duration=26:size=720x1280:rate=30" -pix_fmt yuv420p -c:v libx264 -crf 30 "$OUT/talking.mp4"
$FF -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=220:duration=25" -c:a libmp3lame -q:a 6 "$OUT/speech.mp3"
$FF -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=110:duration=28" -af "volume=0.3" -c:a libmp3lame -q:a 6 "$OUT/music.mp3"
$FF -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=880:duration=0.7" -af "afade=t=out:st=0.2:d=0.5" -c:a libmp3lame "$OUT/sfx-whoosh.mp3"
$FF -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=1320:duration=0.5" -af "afade=t=out:st=0.1:d=0.4" -c:a libmp3lame "$OUT/sfx-pop.mp3"
echo "fixtures written to $OUT"
