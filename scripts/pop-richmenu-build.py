#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""泡泡怪獸 LINE 圖文選單 v5.3 底圖產生器(車主版／店家版雙分頁)

色票出處:自家 worker SHOP_FLEX 已定版的黑金(workers/pop-line-oa/worker.js)
  #0E0E10 底(非純黑)／#caa64a 金(全圖唯一敢亮的顏色)／#9A9A9E 灰
字體:標題 Songti TC Bold(襯線)＋說明 Heiti TC Light(無襯線)= 兩種不同家族,不是只換字重
     ⚠️ 一律指定 TC 字面 index,PingFang 這台沒裝,不指定會靜默掉成簡體字形
版面:非對稱 1436/1064 分割,不是 repeat(2,1fr);主 CTA 佔滿下排(拇指區)
輸出:assets/pop/richmenu-driver-v5.jpg / richmenu-shop-v5.jpg(2500x1686,≤1MB)
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFont
import numpy as np

W, H = 2500, 1686
INK        = (14, 14, 16)
PANEL      = (20, 20, 23)
GOLD       = (202, 166, 74)
GOLD_DIM   = (122, 100, 46)
TEXT       = (242, 240, 236)
MUTED      = (154, 154, 158)
MUTED_DIM  = (108, 108, 113)
HAIR       = (255, 255, 255, 36)

# ⚠️ Songti 在 Supplemental 底下。PIL 給錯路徑會自己去別的字型目錄找到它、完全不報錯,
#    但 fontTools 就直接 FileNotFoundError —— 寫死真實路徑,別靠任何一邊的自動解析。
SONGTI = '/System/Library/Fonts/Supplemental/Songti.ttc'
HEITI_M = '/System/Library/Fonts/STHeiti Medium.ttc'
HEITI_L = '/System/Library/Fonts/STHeiti Light.ttc'
def song(sz):  return ImageFont.truetype(SONGTI, sz, index=2)   # Songti TC Bold
def heiM(sz):  return ImageFont.truetype(HEITI_M, sz, index=0)  # Heiti TC Medium
def heiL(sz):  return ImageFont.truetype(HEITI_L, sz, index=0)  # Heiti TC Light

# 版面:分頁列 / A 列 / B 列 / 主 CTA。刻意不等高,也刻意不對半分。
TAB_H  = 236
A_Y0, A_Y1 = TAB_H, 754
B_Y0, B_Y1 = 754, 1148
C_Y0, C_Y1 = 1148, H
SPLIT  = 1436          # 1.35fr : 1fr

def assert_glyphs(*pairs):
    """字型缺字會靜默印成豆腐方塊(第一版的「・」就是這樣爆的)。上線前逐字驗 cmap。"""
    from fontTools.ttLib import TTCollection
    cache = {}
    bad = []
    for s_, path, idx in pairs:
        key = (path, idx)
        if key not in cache:
            cache[key] = set().union(*(t.getBestCmap().keys() for t in [TTCollection(path).fonts[idx]]))
        for ch in s_:
            if ch == ' ':
                continue
            if ord(ch) not in cache[key]:
                bad.append((ch, hex(ord(ch)), path.split('/')[-1], idx))
    if bad:
        raise SystemExit('❌ 字型缺字(會印成豆腐方塊):' + ', '.join(f'{c}({u}) 不在 {f}#{i}' for c, u, f, i in bad))
    print('  ✓ 缺字檢查通過')


def base_canvas():
    img = Image.new('RGB', (W, H), INK)
    # 左上一道極淡的鹵素燈暈(真實車庫參照),不是紫藍漸層
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for i in range(46):
        r = 1500 - i * 30
        gd.ellipse([300 - r, -520 - r // 2, 300 + r, -520 + r], fill=int(i * 1.5))
    img = Image.composite(Image.new('RGB', (W, H), (46, 38, 20)), img, glow.point(lambda v: min(v, 40)))
    # 顆粒:真實印刷品不會是乾淨平面色(opacity 控在 .05 以下,不當插畫用)
    rng = np.random.default_rng(20260823)
    noise = rng.normal(0, 5.0, (H, W, 1)).repeat(3, axis=2)
    arr = np.clip(np.asarray(img, dtype=np.float32) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def hairline(d, x0, y0, x1, y1, a=36, w=2):
    d.line([x0, y0, x1, y1], fill=(255, 255, 255, a), width=w)

def text(d, xy, s, f, fill, spacing=0):
    """逐字繪製以控字距。中文字距一律 >= 0(負值會黏在一起)。"""
    if spacing <= 0:
        d.text(xy, s, font=f, fill=fill); return
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + spacing

def draw_tabbar(d, active):
    """active: 'driver' | 'shop'"""
    labels = [('車主', 0, SPLIT), ('店家老闆', SPLIT, W)]
    keys = ['driver', 'shop']
    for (label, x0, x1), key in zip(labels, keys):
        on = (key == active)
        f = heiM(64) if on else heiL(60)
        col = TEXT if on else MUTED
        tw = d.textlength(label, font=f) + 10 * (len(label) - 1)
        cx = (x0 + x1) / 2 - tw / 2
        text(d, (cx, 78), label, f, col, spacing=10)
        if on:
            # 亮起來的那一頁:底下一道金線(全圖只有三處敢用金,這是第一處)
            d.rectangle([x0 + 90, TAB_H - 8, x1 - 90, TAB_H - 2], fill=GOLD)
        else:
            # 沒選中的那頁也要看得出可以點:一道暗線,不放符號
            d.rectangle([x0 + 90, TAB_H - 6, x1 - 90, TAB_H - 3], fill=(74, 70, 62))
    hairline(d, 0, TAB_H - 2, W, TAB_H - 2, a=28)
    hairline(d, SPLIT, 40, SPLIT, TAB_H - 40, a=22)

def draw_cell(d, box, title, caption, tag=None):
    x0, y0, x1, y1 = box
    pad = 74
    ft, fc = song(84), heiL(46)
    # 眉標浮在標題上方,但**不計入**垂直置中的區塊高度——否則有眉標的格子標題會被推低,
    # 跟同一列旁邊那格的基線對不齊,看起來像失誤而不是刻意的不對稱。
    block = 118 + 52
    ty = y0 + (y1 - y0 - block) / 2
    if tag:
        text(d, (x0 + pad, ty - 66), tag, heiL(34), GOLD_DIM, spacing=8)
    text(d, (x0 + pad, ty), title, ft, TEXT, spacing=2)
    text(d, (x0 + pad, ty + 118), caption, fc, MUTED, spacing=1)

def draw_arrow(d, x, y, w=118, col=GOLD):
    """手繪細線箭頭,取代圓角方塊 icon"""
    d.line([x, y, x + w, y], fill=col, width=6)
    d.line([x + w - 36, y - 26, x + w, y], fill=col, width=6)
    d.line([x + w - 36, y + 26, x + w, y], fill=col, width=6)

def build(active, cells, cta, out):
    img = base_canvas()
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    # 主 CTA 面板:比周圍亮一階,上緣一道金線(第二處金)
    d.rectangle([0, C_Y0, W, H], fill=PANEL + (255,))
    d.rectangle([0, C_Y0, W, C_Y0 + 5], fill=GOLD + (255,))

    draw_tabbar(d, active)
    # A/B 兩列的分隔:1px 細線,不是卡片邊框
    hairline(d, 0, A_Y1, W, A_Y1, a=26)
    hairline(d, SPLIT, A_Y0 + 60, SPLIT, A_Y1 - 60, a=26)
    hairline(d, SPLIT, B_Y0 + 50, SPLIT, B_Y1 - 50, a=26)
    hairline(d, 0, B_Y1, W, B_Y1, a=26)

    draw_cell(d, (0, A_Y0, SPLIT, A_Y1), *cells[0])
    draw_cell(d, (SPLIT, A_Y0, W, A_Y1), *cells[1])
    draw_cell(d, (0, B_Y0, SPLIT, B_Y1), *cells[2])
    draw_cell(d, (SPLIT, B_Y0, W, B_Y1), *cells[3])

    text(d, (74, C_Y0 + 74), cta[0], heiL(38), GOLD, spacing=10)      # 第三處金
    text(d, (74, C_Y0 + 146), cta[1], song(122), TEXT, spacing=2)
    text(d, (74, C_Y0 + 320), cta[2], heiL(52), MUTED, spacing=1)
    draw_arrow(d, W - 250, C_Y0 + 392)

    img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
    # JPEG 不是 PNG:顆粒讓 PNG 爆到 2.5MB,LINE 硬限 1MB。q=88 目視無損且遠低於上限。
    img.save(out, 'JPEG', quality=88, optimize=True, progressive=True)
    kb = os.path.getsize(out) / 1024
    print(f'  {os.path.basename(out)}  {img.size[0]}x{img.size[1]}  {kb:.0f} KB' + ('  ⚠ 超過 1MB' if kb > 1024 else ''))

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'pop')
os.makedirs(OUT, exist_ok=True)

print('產生圖文選單底圖:')
DRIVER_CELLS = [
    # 眉標刻意留空:全大寫英文小標籤壓在大標上方是 AI hero 的招牌動作(anti-ai-craft 一票否決條)
    ('官網品項與教學', '母料直供，每支都有實作影片', None),
    ('蝦皮商城', '5.0 分，864 則評價', None),
    ('施工教學', '跟著做，自己也弄得出來', None),
    ('找真人', '不想跟 AI 聊就按這裡', None),
]
DRIVER_CTA = ('選品', '我的車該用什麼？', '講一下症狀或傳張照片，30 秒幫你選')
SHOP_CELLS = [
    ('同行的店怎麼用', 'POP CARD 公開展示，不用註冊', '汽美老闆專區'),
    ('方案與價格', '月付 799 起，不綁約', None),
    ('母料批發進貨價', '店家價與零售價分開算', None),
    ('登記合作店家', '填三行就好', None),
]
SHOP_CTA = ('免費健檢', '你的店少賺多少回頭錢？', '三個問題，答完我直接算給你看')

# 缺字先驗:所有要印的字都得在對應字面的 cmap 裡
_song = [t for c in (DRIVER_CELLS + SHOP_CELLS) for t in [c[0]]] + [DRIVER_CTA[1], SHOP_CTA[1]]
_hei = [t for c in (DRIVER_CELLS + SHOP_CELLS) for t in [c[1], c[2] or '']] + \
       [DRIVER_CTA[0], DRIVER_CTA[2], SHOP_CTA[0], SHOP_CTA[2], '車主', '店家老闆']
assert_glyphs(*[(s_, SONGTI, 2) for s_ in _song], *[(s_, HEITI_L, 0) for s_ in _hei],
              *[(s_, HEITI_M, 0) for s_ in ['車主', '店家老闆']])

build('driver', DRIVER_CELLS, DRIVER_CTA, os.path.join(OUT, 'richmenu-driver-v5.jpg'))
build('shop', SHOP_CELLS, SHOP_CTA, os.path.join(OUT, 'richmenu-shop-v5.jpg'))
