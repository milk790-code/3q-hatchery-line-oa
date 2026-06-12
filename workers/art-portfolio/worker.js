// 3q-art-portfolio v2 (proxy+inject+allowlist edition)
// Serves the repo static site from GitHub raw (main), applies the 3 staging-verified
// funnel cuts at the edge (Result.jsx LINE CTA, launch-plan /seats, site-wide UTM beacon),
// and exposes /seats (KV-backed) + /ai (reverse proxy to 3q-ai-subsidy, same-origin /api/lead).
// v2 over stg: deny-by-default allowlist — only the published surface is reachable;
// unpublished repo files (client PDFs, internal manuals, drafts) stay dark.
const REPO = "https://raw.githubusercontent.com/milk790-code/3q-hatchery-line-oa/main/";
const AI_ORIGIN = "https://3q-ai-subsidy.milk790.workers.dev";
const SEATS_DEFAULT = 2;
const CT = {
  html:"text/html; charset=utf-8", css:"text/css; charset=utf-8",
  js:"text/javascript; charset=utf-8", mjs:"text/javascript; charset=utf-8",
  jsx:"text/javascript; charset=utf-8", json:"application/json; charset=utf-8",
  svg:"image/svg+xml", png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg",
  webp:"image/webp", gif:"image/gif", ico:"image/x-icon",
  txt:"text/plain; charset=utf-8", xml:"application/xml; charset=utf-8",
  woff2:"font/woff2", woff:"font/woff", webmanifest:"application/manifest+json", map:"application/json"
};
var UTM = '<script>(function(){try{var p=new URLSearchParams(location.search);var s=p.get("utm_source");if(!s)return;var i=new Image();i.src="https://3q-track.milk790.workers.dev/t?event_type=pageview&ref="+encodeURIComponent(location.pathname)+"&utm_source="+encodeURIComponent(s)+"&utm_medium="+encodeURIComponent(p.get("utm_medium")||"")+"&utm_campaign="+encodeURIComponent(p.get("utm_campaign")||"")+"&utm_content="+encodeURIComponent(p.get("utm_content")||"");}catch(e){}})();<\/script>';

// Published surface only — everything else in the repo 404s.
var ALLOW_EXACT = {
  "index.html":1, "launch-plan.html":1, "ai-subsidy-landing.html":1,
  "landing-styles.css":1, "colors_and_type.css":1, "tweaks-panel.jsx":1,
  "robots.txt":1, "sitemap.xml":1, "manifest.json":1
};
var ALLOW_PREFIX = ["assets/", "experience/"];
function allowed(rel){
  if(ALLOW_EXACT[rel]) return true;
  for(var i=0;i<ALLOW_PREFIX.length;i++){ if(rel.indexOf(ALLOW_PREFIX[i]) === 0) return true; }
  return false;
}

function ext(p){ var m = p.split("?")[0].match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ""; }

function fixResult(t){
  return t.replace(
    'href="#" onClick={(e) => e.preventDefault()}',
    'href="https://line.me/R/ti/p/@121lkspe" target="_blank" rel="noopener" onClick={()=>{try{new Image().src="https://3q-track.milk790.workers.dev/t?utm_source=experience&utm_medium=quiz&utm_campaign=result_cta&event_type=line_click&utm_content="+encodeURIComponent(((persona&&persona.en)||"")+"_"+((stage&&stage.id)||""));}catch(e){}}}'
  );
}
function fixLaunch(t){
  var NEW = "function __seats(left){left=Math.max(0,Math.min(5,left));var taken=5-left;var el=document.getElementById('slotsLeft');if(el)el.textContent=left;document.querySelectorAll('.slot-block').forEach(function(b,i){b.className='slot-block '+(i<taken?'filled':'empty');});}\n  __seats(2);\n  fetch('/seats').then(function(r){return r.json();}).then(function(d){if(d&&typeof d.left==='number')__seats(d.left);}).catch(function(){});";
  return t.replace(/const key = '3q-launch-slots';[\s\S]*?\}\);/, NEW);
}

async function grab(u){
  return fetch(u, { cf: { cacheTtl: 30, cacheEverything: true } });
}
function hdr(ctype){
  return { "Content-Type": ctype, "Cache-Control": "public, max-age=30", "X-3q-proxy": "2", "Access-Control-Allow-Origin": "*" };
}

export default {
  async fetch(req, env){
    var url = new URL(req.url);
    var path = url.pathname;

    if(path === "/seats"){
      var left = SEATS_DEFAULT;
      try { var v = env.KV ? await env.KV.get("seats_left") : null; if(v != null){ var n = parseInt(v,10); if(!isNaN(n)) left = n; } } catch(e){}
      return new Response(JSON.stringify({left:left}), {headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}});
    }
    if(path === "/health"){
      return new Response(JSON.stringify({ok:true,worker:"3q-art-portfolio",mode:"proxy-allowlist",v:2,ts:Date.now()}), {headers:{"Content-Type":"application/json"}});
    }

    // /ai → AI 補助落地頁 via service binding env.AI (workers.dev→workers.dev fetch is
    // blocked with error 1042, so the subsidy worker is invoked directly). Keeping the
    // page's relative /api/lead same-origin; query string passes through so the subsidy
    // worker's UTM visit log stays accurate.
    if(path === "/ai" || path === "/ai/"){
      if(!env.AI){ return new Response("AI binding missing", {status:503, headers:{"Content-Type":"text/plain; charset=utf-8"}}); }
      var ar = await env.AI.fetch(new Request(AI_ORIGIN + "/" + url.search, { headers: { "User-Agent": req.headers.get("User-Agent") || "", "Referer": req.headers.get("Referer") || "" } }));
      var abody = await ar.text();
      return new Response(abody, { status: ar.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", "X-3q-proxy": "ai" } });
    }
    if(path === "/api/lead" && req.method === "POST"){
      if(!env.AI){ return new Response(JSON.stringify({ok:false,err:"AI binding missing"}), {status:503, headers:{"Content-Type":"application/json"}}); }
      var fr = await env.AI.fetch(new Request(AI_ORIGIN + "/api/lead", { method: "POST", headers: { "Content-Type": req.headers.get("Content-Type") || "application/json", "User-Agent": req.headers.get("User-Agent") || "" }, body: req.body }));
      return new Response(fr.body, { status: fr.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    var candidates;
    if(path === "/"){ candidates = ["index.html"]; }
    else {
      var rel = path.replace(/^\/+/, "");
      if(path.charAt(path.length-1) === "/"){ candidates = [rel + "index.html"]; }
      else if(ext(path) === ""){ candidates = [rel + ".html", rel + "/index.html"]; }
      else { candidates = [rel]; }
    }
    candidates = candidates.filter(allowed);
    if(candidates.length === 0){ return new Response("Not found", {status:404, headers:{"Content-Type":"text/plain; charset=utf-8"}}); }

    var resp = null, hit = null;
    for(var idx=0; idx<candidates.length; idx++){
      var r = await grab(REPO + candidates[idx]);
      if(r && r.status === 200){ resp = r; hit = candidates[idx]; break; }
    }
    if(!resp){ return new Response("Not found", {status:404, headers:{"Content-Type":"text/plain; charset=utf-8"}}); }

    var e = ext(hit);
    var ctype = CT[e] || resp.headers.get("Content-Type") || "application/octet-stream";

    if(e === "html" || e === "jsx" || e === "js" || e === "mjs" || e === "css"){
      var body = await resp.text();
      if(e === "html"){
        if(hit === "launch-plan.html") body = fixLaunch(body);
        if(body.indexOf("</body>") !== -1){ body = body.replace("</body>", UTM + "</body>"); }
        else { body = body + UTM; }
      }
      if(hit === "experience/Result.jsx"){ body = fixResult(body); }
      return new Response(body, {headers: hdr(ctype)});
    }
    var buf = await resp.arrayBuffer();
    return new Response(buf, {headers: hdr(ctype)});
  }
};
