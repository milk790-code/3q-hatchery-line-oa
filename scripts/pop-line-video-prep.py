#!/usr/bin/env python3
"""pop-line-oa v6:把自家一剪到底影片轉成 LINE 影片訊息用的檔(2026-10-30)
讀 videos.json(line_map 裡的片;每支帶工作流影片席驗證過的 transcode 配方),產出
  assets/pop/video/<id>.mp4  720×1280、H.264 High、兩段式 loudnorm -14 LUFS、右下角三行浮水印、+faststart
  assets/pop/video/<id>.jpg  preview_ts 那一幀(LINE previewImageUrl ≤1MB)
配方欄位(videos.json → videos[].transcode):inputs(1 或 2 個來源)、audio(keep|none|from_<id>:畫面用第一個、聲音用第二個)、
vf、af(已帶 measured_* 的 loudnorm)、v_args、a_args、preview_cmd 不用(預覽從成品抓)。沒配方就退回單段 loudnorm 預設。
只收白名單內一剪到底片(fb one-take-verified.txt ＋ polish one-take-verified.tsv);任何輸入不在白名單就停。
用法:python3 scripts/pop-line-video-prep.py data/pop-line/videos.json [outdir]
"""
import json, os, shlex, subprocess, sys, tempfile, shutil, hashlib

WM = os.path.expanduser('~/.local/bin/carcare-watermark.py')
WL_FB = os.path.expanduser('~/.local/share/fb-personal-publisher/one-take-verified.txt')
WL_POLISH = os.path.expanduser('~/.local/share/polish-tiktok-2x/lib/one-take-verified.tsv')
TW, TH = 720, 1280
DEF_VF = f'scale={TW}:{TH}:flags=lanczos,setsar=1,format=yuv420p'
DEF_AF = 'loudnorm=I=-14:TP=-1.5:LRA=11'
DEF_V = '-c:v libx264 -preset slow -profile:v high -level:v 4.0 -crf 21 -maxrate 3000k -bufsize 6000k -g 60 -pix_fmt yuv420p'
DEF_A = '-c:a aac -b:a 128k -ar 48000 -ac 2'


def whitelisted(src):
    base = os.path.basename(src)
    stem = os.path.splitext(base)[0]
    if os.path.exists(WL_FB) and stem in [l.strip() for l in open(WL_FB, encoding='utf-8') if l.strip() and not l.startswith('#')]:
        return True
    if os.path.exists(WL_POLISH):
        for l in open(WL_POLISH, encoding='utf-8'):
            if l.split('\t')[0].strip() == base:
                return True
    return False


def probe(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                                   '-of', 'json', path], text=True)
    j = json.loads(out)
    st = j['streams'][0]
    return int(st['width']), int(st['height']), float(j['format']['duration'])


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    vj = json.load(open(sys.argv[1], encoding='utf-8'))
    outdir = sys.argv[2] if len(sys.argv) > 2 else 'assets/pop/video'
    os.makedirs(outdir, exist_ok=True)
    ids = []
    for line_ids in vj['line_map'].values():
        for i in line_ids:
            if i not in ids:
                ids.append(i)
    byid = {v['id']: v for v in vj['videos']}
    tmp = tempfile.mkdtemp()
    wm = os.path.join(tmp, 'wm.png')
    subprocess.run([sys.executable, WM, '--png', str(TW), str(TH), wm], check=True, capture_output=True)
    rows, manifest = [], {}
    for vid in ids:
        v = byid[vid]
        t = v.get('transcode') or {}
        inputs = t.get('inputs') or [v['src']]
        for src in inputs:
            if not os.path.exists(src):
                print(f'⛔ {vid} 來源不存在:{src}'); sys.exit(2)
            if not whitelisted(src):
                print(f'⛔ {vid} 不在一剪到底白名單,停:{src}'); sys.exit(2)
        audio = t.get('audio') or 'keep'
        vf = t.get('vf') or DEF_VF
        af = t.get('af') if 'af' in t else DEF_AF
        v_args = shlex.split(t.get('v_args') or DEF_V)
        a_args = shlex.split(t.get('a_args') or DEF_A)
        # 浮水印接在 vf 之後、右下角(G02/G03 開頭左上有字卡、右上有品牌小標、片尾左下有 QR;右下最安全)
        fc = f'[0:v]{vf}[v];[v][{len(inputs)}:v]overlay=W-w-{round(TW*0.04)}:H-h-{round(TH*0.05)}:format=auto[vo]'
        cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y']
        for src in inputs:
            cmd += ['-i', src]
        cmd += ['-i', wm, '-filter_complex', fc, '-map', '[vo]']
        if audio == 'none' or '-an' in a_args:
            cmd += ['-an']
        else:
            a_src = 0
            if audio.startswith('from_'):
                if len(inputs) < 2:
                    print(f'⛔ {vid} audio={audio} 但 inputs 只有一個'); sys.exit(2)
                a_src = 1
            cmd += ['-map', f'{a_src}:a:0']
            if af:
                cmd += ['-af', af]
            cmd += a_args
            if a_src == 1:
                cmd += ['-shortest']
        out_mp4 = os.path.join(outdir, f'{vid}.mp4')
        cmd += v_args + ['-movflags', '+faststart', out_mp4]
        print(f'▶ {vid} {v.get("line")} audio={audio} inputs={len(inputs)}', flush=True)
        subprocess.run(cmd, check=True)
        W, H, dur = probe(out_mp4)
        size_mb = os.path.getsize(out_mp4) / 1e6
        ts = min(float(v.get('preview_ts') or dur * 0.5), max(dur - 0.5, 0))
        out_jpg = os.path.join(outdir, f'{vid}.jpg')
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', f'{ts:.2f}', '-i', out_mp4, '-frames:v', '1', '-q:v', '3', out_jpg], check=True)
        jpg_kb = os.path.getsize(out_jpg) / 1e3
        if jpg_kb > 1000:
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', f'{ts:.2f}', '-i', out_mp4, '-frames:v', '1', '-q:v', '8', out_jpg], check=True)
            jpg_kb = os.path.getsize(out_jpg) / 1e3
        rows.append((vid, v.get('line', ''), f'{dur:.0f}s', f'{W}x{H}', f'{size_mb:.1f}MB', f'{jpg_kb:.0f}KB'))
        manifest[vid] = {'line': v.get('line'), 'slot': v.get('slot'), 'caption': v.get('caption'), 'duration_s': round(dur, 2), 'bytes': os.path.getsize(out_mp4),
                         'preview_bytes': os.path.getsize(out_jpg), 'audio': audio, 'inputs': [os.path.basename(i) for i in inputs], 'sha256': sha256(out_mp4)}
        print(f'✅ {vid} {v.get("line")} {dur:.0f}s → {size_mb:.1f}MB, preview {jpg_kb:.0f}KB @{ts:.1f}s', flush=True)
        if size_mb > 95:
            print(f'⛔ {vid} 超過 GitHub 單檔 100MB 安全線'); sys.exit(3)
        if jpg_kb > 1000:
            print(f'⛔ {vid} 預覽圖超過 LINE 1MB 上限'); sys.exit(3)
    shutil.rmtree(tmp, ignore_errors=True)
    json.dump(manifest, open(os.path.join(outdir, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n' + '\n'.join('\t'.join(r) for r in rows))


if __name__ == '__main__':
    main()
