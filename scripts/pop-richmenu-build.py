#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""泡泡怪獸 LINE 圖文選單 v6 底圖(車主／店家雙分頁)

設計方向(2026-08-23 學誼指定):高級、精緻、視覺張力、每一格都要抓住眼球、飽滿不空。
做法:
  · 雜誌式交錯網格——A 列 1436/1064、B 列 1064/1436,兩列的直線刻意錯開,不是 grid
  · 字級拉大到手機上真的讀得到(標題 96–130px;上一版 84/46px 在 375pt 螢幕只有 12pt/7pt)
  · 每格右緣一個金色細線 chevron = 可點的暗示(這是「讓人不自覺點擊」的關鍵)
  · 三段明度分層(A 列/B 列/CTA 面板)把版面填滿,避免大片死黑
  · 金色只出現在:分頁指示、眉標、chevron、CTA 上緣線與數字箭頭——吝嗇用才貴
色票出處:自家 worker SHOP_FLEX 已定版黑金(workers/pop-line-oa/worker.js)
字體:標題 Songti TC Bold(襯線)＋說明 Heiti TC Light(無襯線)= 兩種家族,不是只換字重
     ⚠️ 一律指定 TC 字面 index;PingFang 這台沒裝,不指定會靜默掉成簡體字形
輸出:assets/pop/richmenu-{driver,shop}-v6.jpg(2500x1686,JPEG ≤1MB)
"""
import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

W, H = 2500, 1686
INK       = (11, 11, 12)
BAND_A    = (17, 17, 20)
BAND_B    = (12, 12, 14)
PANEL     = (23, 23, 27)
GOLD      = (202, 166, 74)
GOLD_SOFT = (150, 122, 56)
TEXT      = (245, 243, 238)
MUTED     = (156, 156, 161)
DIM       = (104, 104, 110)

# ⚠️ Songti 在 Supplemental 底下。PIL 給錯路徑會自己去別的字型目錄找到它、完全不報錯,
#    fontTools 則直接 FileNotFoundError —— 寫死真實路徑,別靠任何一邊的自動解析。
SONGTI  = '/System/Library/Fonts/Supplemental/Songti.ttc'
HEITI_M = '/System/Library/Fonts/STHeiti Medium.ttc'
HEITI_L = '/System/Library/Fonts/STHeiti Light.ttc'
song = lambda s: ImageFont.truetype(SONGTI, s, index=2)    # Songti TC Bold
heiM = lambda s: ImageFont.truetype(HEITI_M, s, index=0)   # Heiti TC Medium
heiL = lambda s: ImageFont.truetype(HEITI_L, s, index=0)   # Heiti TC Light

TAB_H = 214
A_Y, A_Y2 = TAB_H, 700
B_Y, B_Y2 = 700, 1120
C_Y = 1120
A_LEFT = 1436          # A 列左格寬
B_LEFT = 1064          # B 列左格寬(刻意跟 A 列錯開)
PAD = 72


def assert_glyphs(*pairs):
    """字型缺字會靜默印成豆腐方塊(v5 第一版的「・」就是這樣爆的)。上線前逐字驗 cmap。"""
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


def base_canvas():
    img = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(img)
    d.rectangle([0, A_Y, W, A_Y2], fill=BAND_A)     # 三段明度分層,填滿版面
    d.rectangle([0, B_Y, W, B_Y2], fill=BAND_B)
    d.rectangle([0, C_Y, W, H], fill=PANEL)

    # 左上鹵素燈暈(真實車庫參照),不是紫藍漸層
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for i in range(50):
        r = 1620 - i * 30
        gd.ellipse([260 - r, -600 - r // 2, 260 + r, -600 + r], fill=int(i * 1.4))
    img = Image.composite(Image.new('RGB', (W, H), (52, 43, 22)), img, glow.point(lambda v: min(v, 44)))

    # CTA 面板一道極斜的拉絲光(給金屬感的深度,不是玻璃擬態)
    streak = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(streak)
    for i in range(90):
        sd.line([(1500 + i * 6, H), (2500 + i * 6, C_Y - 60)], fill=max(0, 13 - abs(i - 45) // 3), width=7)
    img = Image.composite(Image.new('RGB', (W, H), (255, 240, 205)), img, streak)

    # 顆粒:真實印刷品不會是乾淨平面色
    rng = np.random.default_rng(20260823)
    arr = np.clip(np.asarray(img, np.float32) + rng.normal(0, 4.6, (H, W, 1)).repeat(3, 2), 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def text(d, xy, s, f, fill, sp=0):
    """逐字繪製以控字距。中文字距一律 >= 0(負值會黏在一起)。"""
    if sp <= 0:
        d.text(xy, s, font=f, fill=fill); return
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + sp


def fit(d, s, family, cap, maxw):
    """字太長就降級字級,寧可小一點也不要溢出格子(溢出是最廉價的破綻)"""
    size = cap
    while size > 60 and d.textlength(s, font=family(size)) + 2 * (len(s) - 1) > maxw:
        size -= 4
    return family(size), size


def chevron(d, x, y, h=46, col=GOLD, w=7):
    """可點的暗示。細線 chevron,不用 emoji、不用圓角方塊 icon。"""
    d.line([x, y - h // 2, x + h // 2, y], fill=col, width=w)
    d.line([x, y + h // 2, x + h // 2, y], fill=col, width=w)


def tabbar(d, active):
    for label, x0, x1, key in [('車主', 0, A_LEFT, 'driver'), ('店家老闆', A_LEFT, W, 'shop')]:
        on = key == active
        f = heiM(60) if on else heiL(56)
        col = GOLD if on else DIM
        tw = d.textlength(label, font=f) + 12 * (len(label) - 1)
        text(d, ((x0 + x1) / 2 - tw / 2, 66), label, f, col, sp=12)
        d.rectangle([x0 + 84, TAB_H - 8, x1 - 84, TAB_H - 2],
                    fill=GOLD if on else (58, 55, 49))
    d.line([A_LEFT, 34, A_LEFT, TAB_H - 42], fill=(70, 70, 74), width=2)


def cell(d, box, title, caption, kicker=None, title_cap=118):
    x0, y0, x1, y1 = box
    maxw = (x1 - x0) - PAD * 2 - 160                   # 右邊留 chevron 的位置＋不讓它貼到字尾像標點
    ft, _ = fit(d, title, song, title_cap, maxw)
    fc, _ = fit(d, caption, heiL, 54, maxw)
    KICK = 74                                          # 每格都預留,有沒有眉標都一樣高 → 基線齊、置中真
    block = KICK + ft.size + 34 + fc.size
    ty = y0 + (y1 - y0 - block) / 2 + KICK
    if kicker:
        text(d, (x0 + PAD, ty - KICK), kicker, heiL(36), GOLD_SOFT, sp=9)
    text(d, (x0 + PAD, ty), title, ft, TEXT, sp=2)
    text(d, (x0 + PAD, ty + ft.size + 34), caption, fc, MUTED, sp=1)
    chevron(d, x1 - 62, (y0 + y1) / 2)


def build(active, cells, cta, out):
    img = base_canvas()
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    tabbar(d, active)
    d.rectangle([0, C_Y, W, C_Y + 6], fill=GOLD + (255,))          # CTA 上緣金線
    for y in (A_Y - 2, A_Y2, B_Y2):
        d.line([0, y, W, y], fill=(255, 255, 255, 26), width=2)
    d.line([A_LEFT, A_Y + 54, A_LEFT, A_Y2 - 54], fill=(255, 255, 255, 26), width=2)
    d.line([B_LEFT, B_Y + 50, B_LEFT, B_Y2 - 50], fill=(255, 255, 255, 26), width=2)

    cell(d, (0, A_Y, A_LEFT, A_Y2), *cells[0])
    cell(d, (A_LEFT, A_Y, W, A_Y2), *cells[1])
    cell(d, (0, B_Y, B_LEFT, B_Y2), *cells[2])
    cell(d, (B_LEFT, B_Y, W, B_Y2), *cells[3])

    # ── CTA:全圖最重的一塊 ──
    kicker, title, ticker = cta
    text(d, (PAD, C_Y + 60), kicker, heiM(40), GOLD, sp=11)
    ft, _ = fit(d, title, song, 132, W - PAD * 2 - 260)
    text(d, (PAD, C_Y + 132), title, ft, TEXT, sp=2)
    # 效益跑馬燈:白字 + 金箭頭,像盤面報價。這是「飽滿」的來源,也是店家最在意的語言
    x, y = PAD, C_Y + 132 + ft.size + 44
    fT, fA = heiM(52), heiM(52)
    for word, arrow in ticker:
        text(d, (x, y), word, fT, TEXT, sp=1)
        x += d.textlength(word, font=fT) + len(word) - 1 + 12
        d.text((x, y - 4), arrow, font=fA, fill=GOLD)
        x += d.textlength(arrow, font=fA) + 46
    # 大箭頭:面板垂直中線,把視線壓到「按這裡」。不加角標裝飾(浮在半空跟箭頭沒關係)
    ax, ay = W - 280, (C_Y + H) / 2
    d.line([ax, ay, ax + 186, ay], fill=GOLD, width=9)
    d.line([ax + 128, ay - 58, ax + 186, ay], fill=GOLD, width=9)
    d.line([ax + 128, ay + 58, ax + 186, ay], fill=GOLD, width=9)

    img = Image.alpha_composite(img.convert('RGBA'), ov).convert('RGB')
    # JPEG 不是 PNG:顆粒讓 PNG 爆到 2.5MB,LINE 硬限 1MB。q=88 目視無損且遠低於上限。
    img.save(out, 'JPEG', quality=88, optimize=True, progressive=True)
    kb = os.path.getsize(out) / 1024
    print(f'  {os.path.basename(out)}  {W}x{H}  {kb:.0f} KB' + ('  ⚠ 超過 1MB' if kb > 1024 else ''))


ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'pop')
os.makedirs(OUT, exist_ok=True)

# 店家版文案＝學誼 2026-08-23 在截圖上親自標紅的字,逐字採用
SHOP_CELLS = [
    ('輕鬆贏過同行的黑科技', '同行都在用的回店系統，不用註冊先看', '汽美店專用'),
    ('免繳費限量搶先體驗', '月付 799 起，不綁約', '名額 10 家'),   # 10 家＝KV COCREATE 真實計數,成交要減量
    ('耗材批發好價格', '店家價與零售價分開算', '母料直供'),
    ('城市限定唯一扶持方案', '想了解怎麼幫門店提升來客數，填三行就好', '一次一個城市'),
]
SHOP_CTA = ('店家必問', '幫你算一個月少賺多少錢',
            [('接車數', '↑'), ('營業額', '↑'), ('客單價', '↑'), ('利潤', '↑'), ('工時', '↓'), ('工位周轉', '↑')])

DRIVER_CELLS = [
    # 眉標刻意不用全大寫英文:那是 AI hero 的招牌動作(anti-ai-craft 一票否決條)
    ('官網品項與教學', '每一支都有實作影片，跟著做就會', '母料直供'),
    ('蝦皮商城', '5.0 分，864 則評價', '官方賣場'),
    ('找真人', '不想跟 AI 聊就按這裡', '真人接手'),
    ('施工教學影片', '跟著做，自己也弄得出來', '零經驗可做'),
]
DRIVER_CTA = ('選品', '我的車該用什麼？',
              [('省時間', '↑'), ('免試錯', '↑'), ('花的錢', '↓')])

_song = [c[0] for c in SHOP_CELLS + DRIVER_CELLS] + [SHOP_CTA[1], DRIVER_CTA[1]]
_hei = [c[1] for c in SHOP_CELLS + DRIVER_CELLS] + [c[2] or '' for c in SHOP_CELLS + DRIVER_CELLS] \
     + [SHOP_CTA[0], DRIVER_CTA[0], '車主', '店家老闆'] \
     + [w + a for w, a in SHOP_CTA[2] + DRIVER_CTA[2]]
assert_glyphs(*[(s, SONGTI, 2) for s in _song], *[(s, HEITI_L, 0) for s in _hei],
              *[(s, HEITI_M, 0) for s in _hei])

print('產生圖文選單底圖 v6:')
build('driver', DRIVER_CELLS, DRIVER_CTA, os.path.join(OUT, 'richmenu-driver-v6.jpg'))
build('shop', SHOP_CELLS, SHOP_CTA, os.path.join(OUT, 'richmenu-shop-v6.jpg'))
