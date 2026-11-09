#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""泡泡怪獸 LINE 圖文選單 v9 底圖:跟價格表 pricelist-1028.jpg 同風格(2026-11-03 學誼指定)

方向:淺色紙底、雜誌式印刷 DM、商品實拍去背小圖、痛點問句、每格一條分區色標。黑金全丟。
色票出處:直接從 assets/pop/pricelist-1028.jpg 取樣(四種紙色＋深棕墨色)。
字體:Songti TC Bold(標題)＋Heiti TC(說明),跟 v8 同兩家族。
區域座標與 v8 完全相同(TAB_H/A_LEFT/B_LEFT/C_Y),postback 不動。
商品圖:Drive 商品去背PNG-原尺寸(Apple Vision 遮罩、RGB 原檔),不做 AI 生圖。
輸出:assets/pop/richmenu-{driver,shop}-v9.jpg(2500x1686,JPEG ≤1MB)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

W, H = 2500, 1686
# 價格表取樣的四種紙色(輪替用)＋墨色
PAPER = [(229, 221, 207)] * 4
PAPER_TAB = (229, 221, 207)
INK = (28, 23, 17)        # 墨黑,不是純黑
BROWN = (90, 70, 50)      # 格線與小標
GREY = (107, 91, 75)      # 說明
LINE = (90, 70, 50)
# 分區色標(照價格表的分區邏輯:棕/綠/洋紅/藍/青)
BAR = {'brown': (122, 82, 50), 'green': (64, 122, 84), 'magenta': (168, 62, 108),
       'blue': (74, 92, 168), 'teal': (62, 132, 140)}

SONGTI  = '/System/Library/Fonts/Supplemental/Songti.ttc'
HEITI_M = '/System/Library/Fonts/STHeiti Medium.ttc'
HEITI_L = '/System/Library/Fonts/STHeiti Light.ttc'
song = lambda s: ImageFont.truetype(SONGTI, s, index=2)
heiM = lambda s: ImageFont.truetype(HEITI_M, s, index=0)
heiL = lambda s: ImageFont.truetype(HEITI_L, s, index=0)

TAB_H = 214
A_Y, A_Y2 = TAB_H, 700
B_Y, B_Y2 = 700, 1120
C_Y = 1120
A_LEFT = 1436
B_LEFT = 1064
PAD = 64

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'pop')
PNG = ('/Users/mac/Library/CloudStorage/GoogleDrive-milk790@gmail.com/我的雲端硬碟/'
       '00-收件匣-手機電腦都丟這/_待我看一眼/泡泡怪獸DM-v5-兩張-20261022/商品去背PNG-原尺寸')


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
        raise SystemExit('❌ 字型缺字:' + '、'.join(bad))
    print('  ✓ 缺字檢查通過')


def text(d, xy, s, f, fill, sp=0):
    if sp <= 0:
        d.text(xy, s, font=f, fill=fill); return
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + sp


def vtext(d, xy, s, f, fill, gap=10):
    """直排:一字一行,價格表的直排大標做法"""
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        y += f.size + gap


def fit(d, s, family, cap, maxw, sp=2):
    size = cap
    while size > 48 and d.textlength(s, font=family(size)) + sp * (len(s) - 1) > maxw:
        size -= 4
    return family(size)


def paper_canvas():
    img = Image.new('RGB', (W, H), PAPER[1])
    rng = np.random.default_rng(20261103)
    arr = np.asarray(img, np.float32)
    # 紙纖維:低頻斑駁＋細顆粒,紙感不是平面色
    coarse = Image.fromarray(np.clip(128 + rng.normal(0, 40, (H // 24 + 1, W // 24 + 1)), 0, 255).astype(np.uint8))
    coarse = coarse.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(30))
    arr += ((np.asarray(coarse, np.float32) - 128) / 40 * 2.0)[..., None] + rng.normal(0, 2.4, (H, W, 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


_PCACHE = {}
def product(name):
    if name not in _PCACHE:
        _PCACHE[name] = Image.open(os.path.join(PNG, name + '.png')).convert('RGBA')
    return _PCACHE[name]


def radial(w, h, color, amax):
    """背後聚光:橢圓形的柔光(賣場佈置每張商品背後都有一圈光,商品才不會像貼紙)"""
    g = Image.new('L', (w, h), 0)
    gd = ImageDraw.Draw(g)
    n = 40
    for i in range(n):
        f = i / n
        gd.ellipse([w * f / 2, h * f / 2, w - w * f / 2, h - h * f / 2], fill=int(amax * (f ** 1.6)))
    g = g.filter(ImageFilter.GaussianBlur(w // 18))
    layer = Image.new('RGBA', (w, h), color + (0,))
    layer.putalpha(g)
    return layer


def compose_group(items, zone_w, zone_h):
    """items = [(png, x_frac, h_frac, z)]:x_frac 相對 zone 寬的中心位置,h_frac 相對 zone 高的高度。
    照蝦皮賣場 N1_hero / kit_menu 的做法:商品成組、前後錯落、同一條地平線、地面倒影、後排略淡。"""
    base_y = int(zone_h * 0.86)
    layer = Image.new('RGBA', (zone_w, zone_h + int(zone_h * 0.25)), (0, 0, 0, 0))
    for png, xf, hf, z in sorted(items, key=lambda t: t[3]):
        im = product(png).copy()
        im.thumbnail((zone_w, int(zone_h * hf)), Image.LANCZOS)
        if z < 0:   # 後排:略淡一點,做景深
            a = im.getchannel('A').point(lambda v: int(v * 0.92))
            im.putalpha(a)
        x = int(zone_w * xf - im.width / 2); y = base_y - im.height
        # 倒影:翻轉後 alpha 由 30% 漸變到 0,只留上 28%
        refl = im.transpose(Image.FLIP_TOP_BOTTOM)
        rh = int(im.height * 0.28)
        grad = Image.linear_gradient('L').resize((im.width, rh)).transpose(Image.FLIP_TOP_BOTTOM)
        grad = grad.point(lambda v: int(v * 0.30))
        ra = refl.getchannel('A').crop((0, 0, im.width, rh))
        from PIL import ImageChops
        refl = refl.crop((0, 0, im.width, rh)); refl.putalpha(ImageChops.multiply(ra, grad))
        refl = refl.filter(ImageFilter.GaussianBlur(1.2))
        layer.alpha_composite(refl, (x, base_y + 2))
        # 接觸陰影
        sh = Image.new('RGBA', (im.width + 120, 70), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([20, 18, sh.width - 20, 52], fill=(40, 30, 20, 90))
        sh = sh.filter(ImageFilter.GaussianBlur(16))
        layer.alpha_composite(sh, (x - 60, base_y - 34))
        layer.alpha_composite(im, (x, y))
    return layer


def paste_group(img, items, zone_box, clip_box):
    """商品組合先畫在一張跟格子同大的透明層上,再整層貼回——光暈與倒影都不會溢出格子"""
    x0, y0, x1, y1 = zone_box
    cx0, cy0, cx1, cy1 = clip_box
    zw, zh = x1 - x0, y1 - y0
    tmp = Image.new('RGBA', (cx1 - cx0, cy1 - cy0), (0, 0, 0, 0))
    glow = radial(int(zw * 1.2), int(zh * 1.2), (255, 250, 240), 150)
    tmp.alpha_composite(glow, (int(x0 - cx0 - zw * 0.2), int(y0 - cy0 - zh * 0.15)))
    tmp.alpha_composite(compose_group(items, zw, zh), (x0 - cx0, y0 - cy0))
    img.alpha_composite(tmp, (cx0, cy0))


def tabbar(img, d, active):
    d.rectangle([0, 0, W, TAB_H], fill=PAPER_TAB)
    for label, x0, x1, key in [('車主', 0, A_LEFT, 'driver'), ('店家老闆', A_LEFT, W, 'shop')]:
        on = key == active
        f = song(62) if on else heiL(54)
        col = INK if on else (150, 138, 125)
        tw = d.textlength(label, font=f) + 10 * (len(label) - 1)
        text(d, ((x0 + x1) / 2 - tw / 2, 60), label, f, col, sp=10)
        # 價格表的分區色條做法:目前頁籤壓一條深棕色條,另一頁淡灰
        d.rectangle([x0, TAB_H - 8, x1, TAB_H], fill=INK if on else (205, 196, 182))
    d.line([A_LEFT, 40, A_LEFT, TAB_H - 30], fill=LINE, width=2)
    text(d, (PAD, 24), '泡泡怪獸', heiL(26), BROWN, sp=6)
    text(d, (PAD, 24 + 34), 'LINE 官方選單', heiL(22), (150, 138, 125), sp=3)


def hair(d, box, inset, alpha=70):
    x0, y0, x1, y1 = box
    d.rectangle([x0 + inset, y0 + inset, x1 - inset, y1 - inset], outline=LINE + (alpha,), width=1)


def cell(img, d, box, spec, paper, bar):
    """spec = (title, caption, kicker, pain, side)  side = 右緣直排小字"""
    x0, y0, x1, y1 = box
    title, caption, kicker, pain, side = spec
    d.rectangle([x0, y0, x1, y1], fill=paper)
    tx = x0 + PAD
    maxw = (x1 - x0) - PAD * 2 - 150
    ft = fit(d, title, song, 118, maxw)
    fc = fit(d, caption, heiL, 40, maxw, sp=1)
    fp = heiM(34)
    block = 46 + ft.size + 40 + fc.size + 44 + fp.size
    ty = y0 + (y1 - y0 - block) / 2
    text(d, (tx, ty), kicker, heiL(28), BROWN, sp=6)
    d.line([tx, ty + 38, tx + 72, ty + 38], fill=INK, width=2)
    ty += 46
    text(d, (tx, ty), title, ft, INK, sp=4)
    ty += ft.size + 40
    text(d, (tx, ty), caption, fc, GREY, sp=1)
    ty += fc.size + 44
    d.rectangle([tx, ty + 10, tx + 10, ty + 20], fill=BROWN)
    text(d, (tx + 26, ty - 2), pain, fp, BROWN, sp=2)
    # 右緣:一條直線＋直排小字(價格表欄邊的做法),填滿右側不留死空
    sx = x1 - 26 - 74
    d.line([sx - 22, y0 + 60, sx - 22, y1 - 60], fill=LINE + (90,), width=1)
    vtext(d, (sx, y0 + 64), side, heiL(30), BROWN, gap=14)
    # 右下角一個細線箭頭 = 可點
    ax, ay = x1 - 26 - 70, y1 - 26 - 56
    d.line([ax, ay, ax + 44, ay], fill=INK, width=3)
    d.line([ax + 28, ay - 14, ax + 44, ay], fill=INK, width=3)
    d.line([ax + 28, ay + 14, ax + 44, ay], fill=INK, width=3)


def build(active, cells, cta, out):
    base = paper_canvas().convert('RGBA')
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    tabbar(img, d, active)
    boxes = [(0, A_Y, A_LEFT, A_Y2), (A_LEFT, A_Y, W, A_Y2), (0, B_Y, B_LEFT, B_Y2), (B_LEFT, B_Y, W, B_Y2)]
    bars = ['brown', 'green', 'teal', 'blue']
    for i, (box, spec) in enumerate(zip(boxes, cells)):
        cell(img, d, box, spec, PAPER[i], BAR[bars[i]])

    # ── CTA 底格:價格表「直排大標」做法 ──
    kicker, title, ticker, pngs = cta
    d.rectangle([0, C_Y, W, H], fill=(221, 212, 196))
    vt = song(138)
    vtext(d, (PAD + 10, C_Y + 66), title[:3], vt, INK, gap=10)
    vx = PAD + 10 + 138 + 60
    d.line([vx - 24, C_Y + 60, vx - 24, H - 60], fill=LINE, width=2)
    text(d, (vx, C_Y + 70), kicker, heiL(30), BROWN, sp=6)
    ft = fit(d, title[3:].lstrip('，, '), song, 112, W - vx - 900)
    text(d, (vx, C_Y + 120), title[3:].lstrip('，, '), ft, INK, sp=2)
    x, y = vx, C_Y + 120 + ft.size + 40
    fT = heiM(46)
    for word, arrow in ticker:
        text(d, (x, y), word, fT, INK, sp=1)
        x += d.textlength(word, font=fT) + len(word) + 10
        d.text((x, y - 2), arrow, font=fT, fill=BROWN)
        x += d.textlength(arrow, font=fT) + 44
    # 右側商品實拍:一支藥劑＋一片拋光盤,站在同一條地平線
    # 右側:直排的提醒句＋大箭頭,呼應左側直排標題
    rx = W - 26 - 60 - 44
    d.line([rx - 30, C_Y + 70, rx - 30, H - 70], fill=LINE + (90,), width=1)
    vtext(d, (rx, C_Y + 76), pngs, heiL(34), BROWN, gap=12)
    ax, ay = W - 440, (C_Y + H) / 2 + 20
    d.line([ax, ay, ax + 180, ay], fill=INK, width=5)
    d.line([ax + 128, ay - 50, ax + 180, ay], fill=INK, width=5)
    d.line([ax + 128, ay + 50, ax + 180, ay], fill=INK, width=5)
    d.line([0, C_Y, W, C_Y], fill=LINE, width=2)

    # 格線(1px 深棕,跟價格表欄線同粗細)
    for y in (A_Y2, B_Y2):
        d.line([0, y, W, y], fill=LINE, width=2)
    d.line([A_LEFT, A_Y, A_LEFT, A_Y2], fill=LINE, width=2)
    d.line([B_LEFT, B_Y, B_LEFT, B_Y2], fill=LINE, width=2)

    # 紙色格子用 multiply 疊在紙紋上,顆粒才會透出來
    flat = Image.alpha_composite(Image.new('RGBA', (W, H), PAPER[1] + (255,)), img).convert('RGB')
    a = np.asarray(flat, np.float32); b = np.asarray(base.convert('RGB'), np.float32) - np.array(PAPER[1], np.float32)
    outimg = Image.fromarray(np.clip(a + b, 0, 255).astype(np.uint8))
    outimg.save(out, 'JPEG', quality=88, optimize=True, progressive=True)
    kb = os.path.getsize(out) / 1024
    print(f'  {os.path.basename(out)}  {W}x{H}  {kb:.0f} KB' + ('  ⚠ 超過 1MB' if kb > 1024 else ''))


# (標題, 說明, 小標, 痛點問句, 商品去背 PNG)——標題與說明逐字沿用 v8
DRIVER_CELLS = [
    ('價格表', '最新定價一張圖，點開就看', '最新定價', '想先看價再問？', '點開就看'),
    ('蝦皮賣場', '全世界統一零售價，點進去下單', '官方賣場', '想直接下單？', '官方直營'),
    ('找真人', '直接把人叫來，不用重講一遍', '不想跟 AI 聊', '講不清楚？', '真人接手'),
    ('施工影片', '選你要處理的部位，影片直接傳給你', '自家實拍', '不知道怎麼下手？', '一剪到底'),
]
DRIVER_CTA = ('拍照選品', '拍張照，我告訴你該用哪一支',
              [('效果', '↑'), ('買錯', '↓'), ('花的錢', '↓')],
              '拍照就好')

SHOP_CELLS = [
    ('拋不亮的漆，拍來看', '拍一張，告訴你該切幾番、用哪一支', '店家判漆', '切幾番拿不準？', '拍照判漆'),
    ('盤劑怎麼配', '講你的機型，配到番數', '施工配方', '盤跟劑配不對？', '配到番數'),   # v9:免繳費體驗下架(11-03 他說「沒有免費體驗」)
    ('耗材批發好價格', '店家價，跟零售完全分開算', '母料直供', '零售價進貨太貴？', '母料直供'),
    ('城市限定唯一扶持方案', '幫你把來客數做起來，填三行就好', '一個城市只找一家', '來客數上不來？', '一城一家'),
]
SHOP_CTA = ('店家叫貨', '傳訊息，大量叫貨直接問我們',  # 11-09 本人:把少賺多少錢拿掉
            [('接車數', '↑'), ('營業額', '↑'), ('客單價', '↑'), ('利潤', '↑'), ('工時', '↓')],
            '要幾罐說一聲')

_song = [c[0] for c in SHOP_CELLS + DRIVER_CELLS] + [SHOP_CTA[1], DRIVER_CTA[1], '車主', '店家老闆']
_hei = [c[1] + c[2] + c[3] + c[4] for c in SHOP_CELLS + DRIVER_CELLS] + [SHOP_CTA[3], DRIVER_CTA[3]] + [SHOP_CTA[0], DRIVER_CTA[0], '店家老闆', '泡泡怪獸LINE 官方選單'] \
     + [w + a for w, a in SHOP_CTA[2] + DRIVER_CTA[2]]
assert_glyphs(*[(s, SONGTI, 2) for s in _song], *[(s, HEITI_L, 0) for s in _hei], *[(s, HEITI_M, 0) for s in _hei])

VER = 'v9'
print('產生圖文選單底圖 ' + VER + '(價格表同風格):')
build('driver', DRIVER_CELLS, DRIVER_CTA, os.path.join(OUT, 'richmenu-driver-' + VER + '.jpg'))
build('shop', SHOP_CELLS, SHOP_CTA, os.path.join(OUT, 'richmenu-shop-' + VER + '.jpg'))
