#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pop-line-copy-gate.py — LINE 談單腦資料正本(data/pop-line/*.json)的對客文字機械閘(唯讀只報不改)。
為什麼有這支(2026-10-30):worker 的產品卡、歡迎包、逐輪指令的字都從 JSON 來,gen-data --check 只擋「有沒有同步」,
不擋「字寫得對不對」。學誼定過的規則:每支商品要有明顯痛點與賣點、不准保守自限(sellpoint_gate 修改三十)、
對客字不放他的名字、稱呼用「你」不用「您」(AI_EMPLOYEE 揭露句逐字除外)、不寫未查證數字、蝦皮連結要帶 openExternalBrowser=1。
用法: python3 scripts/pop-line-copy-gate.py [--data-dir data/pop-line] [--warn-only]
不過 = exit 1(KILL);WARN 只印。
"""
import json, re, sys, argparse, pathlib

# 保守／自我設限字(抄自 ~/.local/bin/sellpoint_gate.py HEDGE,修改三十定版;這裡複製一份是因為 CI 沒有 ~/.local/bin)
HEDGE = ['先試', '小範圍', '先問', '保守', '比例看瓶身', '不是保養品', '僅供', '效果因', '視情況', '不保證']
OWNER_NAME = re.compile(r'學誼|陳學誼')
UNVERIFIED = re.compile(r'5\.0 ?分|864|只收 ?10 ?家|30 ?秒內|\d+ ?萬 ?(粉絲|瀏覽|觀看)|\d+ ?家 ?店家(使用|在用)|評分 ?\d')
BARE_SHOPEE = re.compile(r'https://shopee\.tw/[^\s"\']*')
# 路徑裡出現這些字＝內部註記欄位,不當對客字檢查
INTERNAL = re.compile(r'(^|/)_|note|source|why|evidence|diff|removed|before|after_gate|do_not_say|needs_owner|go_live|status|rule|reason|how_to|steps|changelog|_vs_', re.I)

def texts_of(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from texts_of(v, f'{path}/{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from texts_of(v, f'{path}[{i}]')
    elif isinstance(o, str):
        yield path, o

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data-dir', default=str(pathlib.Path(__file__).resolve().parents[1] / 'data/pop-line'))
    ap.add_argument('--warn-only', action='store_true')
    a = ap.parse_args()
    d = pathlib.Path(a.data_dir)
    kills, warns = [], []
    def K(m): kills.append(m)
    def W(m): warns.append(m)

    cat = json.load(open(d / 'catalog.json', encoding='utf-8'))
    items = cat.get('items', [])
    if len(items) < 30: K(f'catalog 只有 {len(items)} 支(價格表至少 30 支)')
    for it in items:
        sku = it.get('sku', '?')
        pain = (it.get('pain') or '').strip()
        sp = [s for s in (it.get('sellpoints') or []) if s and s.strip()]
        if not pain: K(f'{sku} 沒有痛點(pain 空)——他的規則:每支第一行要是客人痛點')
        elif len(pain) > 60: W(f'{sku} 痛點 {len(pain)} 字,卡片上會折三行以上:{pain[:30]}…')
        if len(sp) < 2: K(f'{sku} 賣點少於 2 條(現在 {len(sp)})')
        if not it.get('dm_price') and it.get('price_status') not in ('quote', 'ask', 'b2b'): K(f'{sku} 沒價格也沒標 price_status')
        if not it.get('shopee_item_id'): K(f'{sku} 沒 shopee_item_id(產品卡「蝦皮購買」會壞)')
        if not it.get('image_id') and not it.get('image_url'): K(f'{sku} 沒圖(image_id/image_url 都空)')
        for field in ('pain', 'name_short', 'usage'):
            t = it.get(field) or ''
            for h in HEDGE:
                if h in t: K(f'{sku}.{field} 有保守字「{h}」:{t[:40]}')
        for s in sp:
            for h in HEDGE:
                if h in s: K(f'{sku}.sellpoints 有保守字「{h}」:{s[:40]}')

    files = {'catalog.json': cat}
    for fn in ('oa.json', 'videos.json', 'brain-directives.json'):
        p = d / fn
        if p.exists(): files[fn] = json.load(open(p, encoding='utf-8'))
    disclosure = ''
    for fn, obj in files.items():
        for path, t in texts_of(obj):
            if INTERNAL.search(path):
                continue   # 內部註記(來源、為什麼、改前版本、禁語表)不是對客字
            if OWNER_NAME.search(t): K(f'{fn}{path} 出現他的名字(對客字永不放):{t[:40]}')
            body = t.replace('我是超級 AI 人工客服', '')
            if '您' in body and '殭屍客服' not in t: W(f'{fn}{path} 有「您」(揭露句以外一律「你」):{t[:40]}')
            m = UNVERIFIED.search(t)
            if m and fn != 'brain-directives.json': K(f'{fn}{path} 疑似未查證數字「{m.group(0)}」:{t[:40]}')
            for u in BARE_SHOPEE.findall(t):
                if 'openExternalBrowser=1' not in u and fn != 'catalog.json':
                    W(f'{fn}{path} 蝦皮連結沒帶 openExternalBrowser=1(worker 會補,但正本最好就帶):{u}')
    oa = files.get('oa.json', {})
    msgs = (oa.get('welcome_package') or {}).get('messages') or []
    if not msgs: K('oa.json 歡迎包是空的')
    elif msgs[0].get('type') != 'image': K(f'歡迎包第一則不是價格表圖(是 {msgs[0].get("type")})——他的規則:加好友第一時間先發價格表')
    txt = [m for m in msgs if m.get('type') == 'text']
    if txt and '我是超級 AI 人工客服' not in txt[0].get('text', ''): K('歡迎包第一則文字沒有 AI 揭露句')
    for m in msgs:
        if m.get('type') == 'text' and len(m.get('text', '')) > 500: W(f'歡迎文字 {len(m["text"])} 字,手機要滑兩屏')

    for w in warns: print('  ⚠ WARN', w)
    for k in kills: print('  ✗ KILL', k)
    print(f'pop-line-copy-gate: {len(items)} 支商品、{len(msgs)} 則歡迎包;KILL {len(kills)}、WARN {len(warns)}')
    sys.exit(0 if (not kills or a.warn_only) else 1)

if __name__ == '__main__':
    main()
