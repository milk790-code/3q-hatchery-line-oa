#!/usr/bin/env python3
"""泡泡怪獸 LINE OA 封面／基本檔案背景圖 v7(2026-10-30)

規格(LINE 官方手冊 oa-manager:帳號設定→封面圖片「建議尺寸 1080px × 878px、JPG/PNG、3MB 以下」;
基本檔案→背景圖片「200px×200px 以上、10MB 以下」,同一張兩處都用)。
安全區:手機上帳號大頭貼與名稱會壓在圖的下緣、狀態列壓上緣,所以所有文字收在 y 180–660、左右各留 100。
視覺系統跟圖文選單 v7 同一套(黑金、Songti TC Bold 標題＋Heiti TC 說明、鹵素燈暈、顆粒),
不放 AI 奢華臉、不放他的名字、不寫免費試用。
2026-10-30 實測:page.line.biz 基本檔案→背景圖片的裁切框固定 2:1(394×197),所以另外產 cover-v7-wide.jpg(1600×800)
整張剛好等於裁切框、不用裁;文字區上下各留 ≥19%,左下 20% 高留給 app 裡壓上來的大頭貼。
用法: python3 scripts/pop-cover-build.py  → assets/pop/cover-v7.jpg(1080×878)+ cover-v7-wide.jpg(1600×800)+ 手機預覽
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 878
INK       = (11, 11, 12)
GOLD      = (202, 166, 74)
GOLD_SOFT = (150, 122, 56)
TEXT      = (245, 243, 238)
MUTED     = (170, 170, 175)
SONGTI  = '/System/Library/Fonts/Supplemental/Songti.ttc'
HEITI_M = '/System/Library/Fonts/STHeiti Medium.ttc'
HEITI_L = '/System/Library/Fonts/STHeiti Light.ttc'
song = lambda s: ImageFont.truetype(SONGTI, s, index=2)
heiM = lambda s: ImageFont.truetype(HEITI_M, s, index=0)
heiL = lambda s: ImageFont.truetype(HEITI_L, s, index=0)

KICKER = '汽車美容耗材　台灣出貨'
BRAND  = '泡泡怪獸'
LATIN  = 'POP MONSTER'
LINES  = ['研磨拋光', '天使塗層', '洗車泡沫', '內裝玻璃輪圈']
CTA    = '加入好友，第一則就收到價格表'


def assert_glyphs(*pairs):
    from fontTools.ttLib import TTCollection
    cache, bad = {}, []
    for s_, path, idx in pairs:
        key = (path, idx)
        if key not in cache:
            cache[key] = set(TTCollection(path).fonts[idx].getBestCmap().keys())
        for ch in s_:
            if ch not in ' 　' and ord(ch) not in cache[key]:
                bad.append(f'{ch}({hex(ord(ch))}) 不在 {path.split("/")[-1]}#{idx}')
    if bad:
        raise SystemExit('❌ 字型缺字(會印成豆腐方塊):' + '、'.join(bad))
    print('  ✓ 缺字檢查通過')


def spaced(d, xy, s, f, fill, sp):
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + sp


def width(d, s, f, sp):
    return sum(d.textlength(ch, font=f) for ch in s) + sp * (len(s) - 1)


def base(W=W, H=H):
    k = W / 1080
    img = Image.new('RGB', (W, H), INK)
    # 左上鹵素燈暈
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for i in range(50):
        r = int((900 - i * 17) * k)
        cx_, cy_ = int(120 * k), int(-330 * k)
        gd.ellipse([cx_ - r, cy_ - r // 2, cx_ + r, cy_ + r], fill=int(i * 1.4))
    img = Image.composite(Image.new('RGB', (W, H), (52, 43, 22)), img, glow.point(lambda v: min(v, 46)))
    # 右下一道極斜拉絲光
    streak = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(streak)
    for i in range(80):
        sd.line([(int((560 + i * 5) * k), H), (int((1180 + i * 5) * k), int(H * 0.48))], fill=max(0, 12 - abs(i - 40) // 3), width=6)
    img = Image.composite(Image.new('RGB', (W, H), (255, 240, 205)), img, streak)
    rng = np.random.default_rng(20261030)
    arr = np.clip(np.asarray(img, np.float32) + rng.normal(0, 4.4, (H, W, 1)).repeat(3, 2), 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def draw_all(img, bsize, L=100, top=176):
    """從上往下用實際字框排;回傳(文字下緣, 文字右緣)。bsize 是品牌字級,其餘字級跟著它走;外層挑最大還塞得進安全區的。"""
    d = ImageDraw.Draw(img)
    fk = heiL(round(bsize * 0.195))
    spaced(d, (L, top), KICKER, fk, GOLD_SOFT, 6)
    d.line([L, top + 56, L + 70, top + 56], fill=GOLD, width=3)

    fb = song(bsize)
    by = top + 64
    spaced(d, (L - 8, by), BRAND, fb, TEXT, 14)
    yb = d.textbbox((L - 8, by), BRAND, font=fb)[3]

    fl = heiM(round(bsize * 0.23))
    yl = yb + 18
    spaced(d, (L, yl), LATIN, fl, GOLD, 9)
    yl2 = d.textbbox((L, yl), LATIN, font=fl)[3]

    # 產品線:細體,中間用畫的小金點隔開(不用「・」字元,v5 那次就是它變豆腐)
    fs = heiL(round(bsize * 0.23))
    x = L; y = yl2 + 36
    for i, s_ in enumerate(LINES):
        d.text((x, y), s_, font=fs, fill=MUTED)
        x += d.textlength(s_, font=fs)
        if i < len(LINES) - 1:
            x += 26
            d.ellipse([x, y + 24, x + 7, y + 31], fill=GOLD)
            x += 7 + 26
    ys2 = d.textbbox((L, y), LINES[0], font=fs)[3]

    fc = heiM(round(bsize * 0.26))
    yc = ys2 + 34
    d.text((L, yc), CTA, font=fc, fill=GOLD)
    cw = d.textlength(CTA, font=fc)
    cx, cy = L + cw + 34, yc + 30
    d.line([cx, cy - 16, cx + 16, cy], fill=GOLD, width=4)
    d.line([cx, cy + 16, cx + 16, cy], fill=GOLD, width=4)
    bottom = d.textbbox((L, yc), CTA, font=fc)[3]
    right = max(L + width(d, KICKER, fk, 6), L - 8 + width(d, BRAND, fb, 14), L + width(d, LATIN, fl, 9), x, cx + 16)
    return bottom, right


def build():
    assert_glyphs((KICKER + CTA + ''.join(LINES), HEITI_L, 0), (CTA + LATIN, HEITI_M, 0), (BRAND, SONGTI, 2))
    bg = base()
    for bsize in range(184, 140, -4):
        img = bg.copy()
        bottom, right = draw_all(img, bsize)
        if bottom <= 672 and right <= W - 60:
            break
    else:
        raise SystemExit(f'排不進安全區:下緣 {bottom} 右緣 {right}')
    out = os.path.join(ROOT, 'assets/pop/cover-v7.jpg')
    img.save(out, quality=90, subsampling=0, optimize=True)
    img.resize((390, int(390 * H / W)), Image.LANCZOS).save(os.path.join(ROOT, 'assets/pop/cover-v7-phone.jpg'), quality=88)
    kb = os.path.getsize(out) // 1024
    assert kb < 3000, f'超過 3MB: {kb}KB'
    print(f'  ✓ {out} {W}x{H} {kb}KB  品牌字級 {bsize}  文字右緣 {int(right)}  下緣 {bottom}')
    build_wide()


def build_wide(WW=1600, HH=800, bsize=200, L=120):
    """2:1 橫幅:整張＝LINE 裁切框。先量文字塊高度,再垂直置中(往上偏 2%),上下各留 ≥19%。"""
    bg = base(WW, HH)
    for bsize in range(bsize, 140, -4):
        probe = bg.copy()
        bottom, right = draw_all(probe, bsize, L, 0)
        top = round((HH - bottom) / 2 - HH * 0.02)
        img = bg.copy()
        bottom, right = draw_all(img, bsize, L, top)
        if top >= HH * 0.19 and bottom <= HH * 0.81 and right <= WW - 100:
            break
    else:
        raise SystemExit(f'2:1 排不進安全區:top {top} 下緣 {bottom} 右緣 {int(right)}')
    out = os.path.join(ROOT, 'assets/pop/cover-v7-wide.jpg')
    img.save(out, quality=90, subsampling=0, optimize=True)
    img.resize((780, 390), Image.LANCZOS).save(os.path.join(ROOT, 'assets/pop/cover-v7-wide-phone.jpg'), quality=88)
    kb = os.path.getsize(out) // 1024
    assert kb < 10000, f'超過 10MB: {kb}KB'
    print(f'  ✓ {out} {WW}x{HH} {kb}KB  品牌字級 {bsize}  上緣 {top}  下緣 {bottom}  右緣 {int(right)}')


if __name__ == '__main__':
    build()
