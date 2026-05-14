#!/usr/bin/env python3
"""Try multiple body shapes to set LINE default rich menu.

LINE's /v2/bot/user/all/richmenu/{id} endpoint is fronted by Akamai which
rejects empty-body POSTs with 411 in some configurations. We try 5 shapes
in order until one returns 200.
"""
import os, sys, json, requests

keep  = os.environ["KEEP"]
token = os.environ["LINE_TOKEN"]
url   = f"https://api.line.me/v2/bot/user/all/richmenu/{keep}"

attempts = [
    ("requests-no-data",   None, None,                None),
    ("requests-empty-str", "",   None,                None),
    ("empty-json",         "{}", "application/json",  None),
    ("space-body",         " ",  "text/plain",        None),
    ("explicit-cl-zero",   "",   None,                "0"),
]

out = {}
for name, body, ctype, cl in attempts:
    headers = {"Authorization": f"Bearer {token}"}
    if ctype: headers["Content-Type"]   = ctype
    if cl:    headers["Content-Length"] = cl
    try:
        r = requests.post(url, headers=headers, data=body, timeout=15)
        out[name] = {"http": r.status_code, "body": r.text[:500]}
        if r.status_code == 200:
            out["winner"] = name
            break
    except Exception as e:
        out[name] = {"error": str(e)}

json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
