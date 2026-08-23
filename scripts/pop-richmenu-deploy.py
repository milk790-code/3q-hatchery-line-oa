#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""泡泡怪獸 LINE 圖文選單 v5.3 部署(車主／店家雙分頁,冪等可重跑)

用法:
  python3 scripts/pop-richmenu-deploy.py                # 只建立+上圖+設 alias(使用者還看不到,零風險)
  python3 scripts/pop-richmenu-deploy.py --set-default  # 再把「車主版」設成全員預設 → 這一步才會對外生效
  python3 scripts/pop-richmenu-deploy.py --status       # 只看現況

⚠️ 上線順序不可顛倒:先部署好帶 postback 處理的 worker,再 --set-default。
   反過來做,客人點下去完全沒反應(舊 worker 的 handleEvent 直接丟棄 postback)。

⚠️ 圖片一經設定就不能替換(LINE 硬限)。改版=建新選單→傳新圖→alias 重指→刪舊,
   本腳本每次重跑就是走這條路,所以 alias 名字固定、選單 id 每次都會換。
"""
import json, os, sys, urllib.request, urllib.error

API, DATA_API = 'https://api.line.me', 'https://api-data.line.me'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
NAME_PREFIX = 'popmonster v5.3'
ALIAS = {'driver': 'pop-driver', 'shop': 'pop-shop'}
CHATBAR = '泡泡怪獸選單'          # ≤14 字

# 版面座標必須跟 pop-richmenu-build.py 的常數一致,否則點擊區會對不到畫面上的字
W, H, TAB_H = 2500, 1686, 214
A_LEFT = 1436                 # A 列左格寬
B_LEFT = 1064                 # B 列左格寬(雜誌式交錯網格,兩列的直線刻意錯開)
A_Y, A_H = TAB_H, 700 - TAB_H
B_Y, B_H = 700, 1120 - 700
C_Y, C_H = 1120, H - 1120

def area(x, y, w, h, action):
    return {'bounds': {'x': x, 'y': y, 'width': w, 'height': h}, 'action': action}
def pb(data, display=None, **kw):
    a = {'type': 'postback', 'data': data}
    if display: a['displayText'] = display
    a.update(kw); return a
def uri(u):     return {'type': 'uri', 'uri': u}
def switch(alias, data): return {'type': 'richmenuswitch', 'richMenuAliasId': alias, 'data': data}

SHOPEE = 'https://shopee.tw/milk790'          # 完整網址,不用 s.shopee.tw 短碼(可能夾帶別人的分潤參數)
GO_FREE = 'https://popmonster.vip/go?src=line-free-first'   # src 必須是 /go 白名單內的值
POPCARD_DEMO = 'https://popcard-saas-preview.milk790.workers.dev/s/jilin'
# 靜態版走 GitHub Pages(carcare-shop Worker 要 wrangler,本機 token 已過期)。
# wrangler 恢復後可改回 https://carcare-shop.milk790.workers.dev/s/pop/plan(同一份內容)。
PLAN_PAGE = 'https://milk790-code.github.io/3q-hatchery-line-oa/pop-card-plan/'   # 現在由 AI 在對話中給,不直接掛鈕
JOIN_TEMPLATE = '店名：\n城市：\n最想解決：'

MENUS = {
  'driver': {
    'size': {'width': W, 'height': H}, 'selected': True,
    'name': NAME_PREFIX + ' driver', 'chatBarText': CHATBAR,
    # ⚠️ 「目前所在的那一頁」刻意不放任何 area:放了 postback 的話,老闆再點一次同一個分頁
    #    就會再觸發一次,同一則招呼發兩遍(2026-08-23 實機截圖抓到)。沒有 area = 點了沒事。
    'areas': [
      area(A_LEFT, 0, W - A_LEFT, TAB_H, switch(ALIAS['shop'], 'm=tab&b=shop')),
      area(0, A_Y, A_LEFT, A_H, uri(GO_FREE)),                                  # 官網品項與教學
      area(A_LEFT, A_Y, W - A_LEFT, A_H, uri(SHOPEE)),                           # 蝦皮商城
      area(0, B_Y, B_LEFT, B_H, pb('m=car&b=human', '我想找真人')),               # 找真人
      area(B_LEFT, B_Y, W - B_LEFT, B_H, pb('m=car&b=howto', '我想看施工教學')),   # 施工教學影片
      area(0, C_Y, W, C_H, pb('m=car&b=pick', '我想知道我的車該用什麼產品')),
    ],
    'image': 'assets/pop/richmenu-driver-v6.jpg',
  },
  'shop': {
    'size': {'width': W, 'height': H}, 'selected': True,
    'name': NAME_PREFIX + ' shop', 'chatBarText': CHATBAR,
    'areas': [
      area(0, 0, A_LEFT, TAB_H, switch(ALIAS['driver'], 'm=tab&b=car')),
      area(0, A_Y, A_LEFT, A_H, uri(POPCARD_DEMO)),                              # 輕鬆贏過同行的黑科技
      # 「免繳費限量搶先體驗」走對話不丟價格頁:落地頁寫月付 799,跟按鈕承諾對不上,點進去會直接跳走。
      # 改成 AI 先確認資格與城市,條件頁由 AI 在對話裡給。
      area(A_LEFT, A_Y, W - A_LEFT, A_H, pb('m=shop&b=trial', '我想了解免繳費限量搶先體驗')),
      area(0, B_Y, B_LEFT, B_H, pb('m=shop&b=wholesale', '我想問耗材批發的店家價')),
      # 鍵盤預填三行範本 = 零前端成本的半結構化表單(不必蓋 LIFF 頁)
      area(B_LEFT, B_Y, W - B_LEFT, B_H, pb('m=shop&b=join', '我想了解城市限定的扶持方案',
                                            inputOption='openKeyboard', fillInText=JOIN_TEMPLATE)),
      area(0, C_Y, W, C_H, pb('m=shop&b=audit', '幫我算一下我的店一個月少賺多少錢')),
    ],
    'image': 'assets/pop/richmenu-shop-v6.jpg',
  },
}

def token():
    p = os.path.expanduser('~/.config/line-oa/.env')
    if not os.path.exists(p): sys.exit('✗ 找不到 ~/.config/line-oa/.env')
    for line in open(p):
        if '=' in line and 'TOKEN' in line.split('=', 1)[0].upper():
            # 貼上的 token 常夾帶空白,用 strip 不用 shell source(source 會靜默把值截斷)
            t = line.split('=', 1)[1].strip().strip('"').strip("'")
            t = ''.join(t.split())
            if len(t) > 100: return t
    sys.exit('✗ .env 裡沒有看起來像 access token 的值(要 170+ 字,不是 32 字的 channel secret)')

def call(method, url, tok, body=None, ctype='application/json', raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'Authorization': 'Bearer ' + tok, **({'Content-Type': ctype} if data else {})})
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode()
            return r.status, (json.loads(t) if t.strip().startswith(('{', '[')) else t)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def status(tok):
    _, menus = call('GET', API + '/v2/bot/richmenu/list', tok)
    _, al = call('GET', API + '/v2/bot/richmenu/alias/list', tok)
    _, dflt = call('GET', API + '/v2/bot/user/all/richmenu', tok)
    print('現有選單:')
    for m in (menus.get('richmenus', []) if isinstance(menus, dict) else []):
        print('  ', m['richMenuId'], '|', m['name'], '|', m['size'], '|', len(m['areas']), '格')
    print('alias:', al)
    print('全員預設:', dflt)
    return menus, al, dflt

def main():
    tok = token()
    args = sys.argv[1:]
    if '--status' in args:
        status(tok); return

    # 1) 清掉自己上一版(冪等);別人手動建的選單不動
    _, menus = call('GET', API + '/v2/bot/richmenu/list', tok)
    for m in (menus.get('richmenus', []) if isinstance(menus, dict) else []):
        if m['name'].startswith(NAME_PREFIX):
            c, _ = call('DELETE', API + '/v2/bot/richmenu/' + m['richMenuId'], tok)
            print(f"  清掉舊版 {m['richMenuId']} ({m['name']}) → {c}")

    ids = {}
    for key, spec in MENUS.items():
        img = os.path.join(ROOT, spec.pop('image'))
        c, r = call('POST', API + '/v2/bot/richmenu', tok, spec)
        if c != 200: sys.exit(f'✗ 建立 {key} 失敗 {c}: {r}')
        rid = r['richMenuId']; ids[key] = rid
        print(f'  建立 {key} → {rid}')
        with open(img, 'rb') as f: blob = f.read()
        c, r = call('POST', f'{DATA_API}/v2/bot/richmenu/{rid}/content', tok, ctype='image/jpeg', raw=blob)
        if c != 200: sys.exit(f'✗ 上傳 {key} 圖失敗 {c}: {r}')
        print(f'  上圖 {key} ({len(blob)//1024} KB) → {c}')

    # 2) alias:有就更新指向(其他分頁的切換鈕指的是 alias,所以鈕不用重做)
    for key, alias in ALIAS.items():
        c, r = call('POST', API + '/v2/bot/richmenu/alias', tok, {'richMenuAliasId': alias, 'richMenuId': ids[key]})
        if c != 200:
            c, r = call('POST', f'{API}/v2/bot/richmenu/alias/{alias}', tok, {'richMenuId': ids[key]})
        print(f'  alias {alias} → {ids[key]} ({c})')

    if '--set-default' in args:
        c, r = call('POST', f"{API}/v2/bot/user/all/richmenu/{ids['driver']}", tok)
        print(f'  設為全員預設(車主版) → {c} {r}')
        if c != 200: sys.exit('✗ 設定預設失敗')
        print('\n✅ 已對外生效。所有好友的聊天室底部現在是新選單。')
    else:
        print('\n✅ 選單已建好、圖已上傳、alias 已設 —— 但**還沒對外**(沒設成預設,使用者看不到)。')
        print('   worker 部署完成後,再跑一次加 --set-default 才會上線。')
    print('\n選單 ID:', json.dumps(ids, indent=1))

if __name__ == '__main__':
    main()
