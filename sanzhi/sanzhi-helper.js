// sanzhi-helper.js — 三指×3Q 對接區小幫手(麥子專用)。
// 後端:3q-hatchery-webhook /api/chat(brain=sanzhi),金鑰在 server,前端零密鑰。
(function(){
  var BRAND='#E8581E',DARK='#1C2128',PAPER='#FFFFFF',API='https://3q-hatchery-webhook.milk790.workers.dev/api/chat';
  var msgs=[],open=false,busy=false;
  var css='#sz-b{position:fixed;right:16px;bottom:16px;z-index:99999;width:58px;height:58px;border-radius:50%;background:'+BRAND+';border:none;color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(232,88,30,.35)}'+
    '#sz-p{position:fixed;right:16px;bottom:84px;z-index:99999;width:330px;max-width:92vw;height:440px;max-height:68vh;background:'+PAPER+';border:1px solid #F0D9CC;border-radius:16px;display:none;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif;box-shadow:0 12px 40px rgba(28,33,40,.18)}'+
    '#sz-h{padding:12px 14px;color:#fff;background:'+BRAND+';font-weight:700;font-size:14px}'+
    '#sz-m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#FBF8F6}'+
    '.sz-u,.sz-a{max-width:84%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-wrap}'+
    '.sz-u{align-self:flex-end;background:'+BRAND+';color:#fff}.sz-a{align-self:flex-start;background:#fff;color:'+DARK+';border:1px solid #EFE3DB}'+
    '#sz-f{display:flex;border-top:1px solid #F0E5DE;background:#fff}#sz-i{flex:1;background:transparent;border:0;color:'+DARK+';padding:12px;font-size:14px;outline:none}'+
    '#sz-s{background:transparent;border:0;color:'+BRAND+';padding:0 14px;cursor:pointer;font-size:14px;font-weight:700}';
  function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
  function add(role,text){msgs.push({role:role,content:text});var m=document.getElementById('sz-m');var b=document.createElement('div');b.className=role==='user'?'sz-u':'sz-a';b.textContent=text;m.appendChild(b);m.scrollTop=m.scrollHeight;}
  function fallback(){add('assistant','這題我幫你留給學誼回,你直接在這裡或 LINE 留言就好,他會批次回覆你。');}
  async function send(){var i=document.getElementById('sz-i');var t=(i.value||'').trim();if(!t||busy)return;i.value='';add('user',t);busy=true;
    try{var r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brain:'sanzhi',messages:msgs})});
      if(!r.ok){fallback();return;}var d=await r.json();if(d&&d.reply){add('assistant',d.reply);}else{fallback();}
    }catch(e){fallback();}finally{busy=false;}}
  function init(){
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    var btn=el('<button id="sz-b" aria-label="小幫手">問我</button>');
    var p=el('<div id="sz-p"><div id="sz-h">三指 × 3Q · 小幫手</div><div id="sz-m"></div><div id="sz-f"><input id="sz-i" placeholder="進度、文件、素材怎麼給,都能問"/><button id="sz-s">送出</button></div></div>');
    document.body.appendChild(btn);document.body.appendChild(p);
    btn.onclick=function(){open=!open;p.style.display=open?'flex':'none';if(open&&msgs.length===0){add('assistant','麥子你好,我是對接區的小幫手。\n進度到哪、文件在哪、素材怎麼給,直接問我。\n要找學誼的話留言就好,他會批次回。');}};
    document.getElementById('sz-s').onclick=send;
    document.getElementById('sz-i').addEventListener('keydown',function(e){if(e.key==='Enter')send();});
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
