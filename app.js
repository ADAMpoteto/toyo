/* =====================================================================
   東洋大姫路 栄冠ナイン記録（西川記録から独立）
   ===================================================================== */
/* ---------- ユーティリティ ---------- */
const WD=["日","月","火","水","木","金","土"];
function pd(s){ if(!s) return null; const m=String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m?new Date(+m[1], +m[2]-1, +m[3]):null; }
function fmtMD(dt){ return `${dt.getMonth()+1}/${dt.getDate()}(${WD[dt.getDay()]})`; }
function prefersReduced(){ return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function escHtml(s){ return String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function F(o,k){ return (o && o[k]!=null) ? String(o[k]).trim() : ""; }
function cleanRows(rows){
  return (rows||[]).map(o=>{ const n={}; Object.keys(o).forEach(k=>{ n[k.replace(/^\uFEFF/,"").replace(/\s+/g,"").trim()]=o[k]; }); return n; });
}
function fetchCSV(url){
  return new Promise((resolve,reject)=>{
    if(typeof Papa==="undefined"){ reject(new Error("PapaParse 未読み込み")); return; }
    Papa.parse(url, { download:true, header:true, skipEmptyLines:"greedy", complete:resolve, error:reject });
  });
}
function fetchCSVRaw(url){
  return new Promise((resolve,reject)=>{
    if(typeof Papa==="undefined"){ reject(new Error("PapaParse 未読み込み")); return; }
    Papa.parse(url, { download:true, header:false, skipEmptyLines:false, complete:resolve, error:reject });
  });
}
/* "1,234" "1234P" → 1234 / 空欄 → null（0 は 0 のまま） */
function num(s){ const t=String(s==null?"":s).replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[,，\sPpｐ円km]/gi,""); if(t==="") return null; const n=Number(t); return isFinite(n)?n:null; }
const nf=n=>Math.round(n).toLocaleString("ja-JP");
/* トリマは10ポイント単位なので、計算で出た値は10の位に切り上げる */
const ceil10=n=>Math.ceil(n/10)*10;
function today0(){ const t=new Date(); t.setHours(0,0,0,0); return t; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function ymKey(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; }
function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
function errBox(msg){ return `<div class="loading">${escHtml(msg)}</div>`; }

/* 縦棒グラフ（HTML/CSSで描くので画面幅に追従）。items: [{label, value, sub, cls, tip}] */
function barChartHtml(id, items, opt){
  opt=opt||{};
  const vals=items.map(i=>i.value||0);
  const lines=(opt.lines||[]).filter(l=>l.value>0);
  const max=Math.max(1, ...vals, ...lines.map(l=>l.value))*1.08;
  const cols=items.map((it,i)=>{
    const h=it.value==null?0:Math.max(it.value>0?1.5:0, it.value/max*100);
    return `<button type="button" class="bc-col ${it.cls||""}" data-i="${i}" aria-label="${escHtml(it.tip||"")}">
      <span class="bc-bar" style="height:${h}%"></span>
      <span class="bc-lbl">${it.label||""}</span>
    </button>`;
  }).join("");
  const lineHtml=lines.map(l=>`<div class="bc-line ${l.cls||""}" style="bottom:${l.value/max*100}%"><span>${escHtml(l.label)}</span></div>`).join("");
  return `<div class="bc" id="${id}">
    <div class="bc-readout" aria-live="polite"></div>
    <div class="bc-plot">${lineHtml}<div class="bc-cols">${cols}</div></div>
  </div>`;
}
function bindBarChart(id, items, defIdx){
  const root=document.getElementById(id); if(!root) return;
  const out=root.querySelector(".bc-readout");
  const pick=i=>{
    root.querySelectorAll(".bc-col").forEach(c=>c.classList.toggle("on", +c.dataset.i===i));
    out.innerHTML=items[i] ? items[i].tip : "";
  };
  root.querySelectorAll(".bc-col").forEach(c=>{
    c.addEventListener("click", ()=>pick(+c.dataset.i));
    c.addEventListener("mouseenter", ()=>pick(+c.dataset.i));
  });
  if(defIdx!=null && defIdx>=0) pick(defIdx);
}

/* =====================================================================
   栄冠ナイン
   スプレッドシートの5シート（試合ログ／イニングスコア／スタメン／選手成績／卒業生）を読み込みます。
   どのURLがどのシートかは、1行目の見出しから自動で判定するので、順番は気にしなくてOK。
   ===================================================================== */
const URL_EIKAN = [
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=773705402&single=true&output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=2012687169&single=true&output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=397796211&single=true&output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=667454139&single=true&output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=1031304553&single=true&output=csv",  // 選手成績
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS4iBoUmfbNovsRGs-ynY9WyQZKBMivhCTVklD7MdmUFVZ2Y4O4AalW_wwXtddE6tkBFhxDwO8qMzn/pub?gid=130539493&single=true&output=csv"    // 能力
].filter(Boolean);
const ES_SCHOOL = "東洋大姫路";   // 自校名（ページの見出しに使います）
const ES_BAT_MIN = 40;           // 打者ランキングの規定打席（打数＋四死球＋犠打）
const ES_PIT_IP_MIN = 50;        // 投手ランキングの規定投球回（投球回が空欄の選手は登板・試合10以上で判定）

const ES_TAIKAI = [
  {k:"夏の都道府県大会", s:"夏・県"}, {k:"夏の甲子園", s:"夏・甲子園"},
  {k:"秋の都道府県大会", s:"秋・県"}, {k:"秋の地区大会", s:"秋・地区"},
  {k:"神宮大会", s:"神宮"}, {k:"春の甲子園", s:"春・甲子園"}
];
const ES_B9_SLOTS = ["投","捕","一","二","三","遊","外","外","外"];
const ES = { games:[], inn:{}, lineup:[], grads:[], years:[], sel:null, b9:"star", team:"", rk:"star", lineupSeason:"夏", oppPref:"", draftTeam:"", decade:null, pane:"year" };

/* 全角数字→半角、"－" などは空扱い */
const esHalf = s => String(s==null?"":s).replace(/[０-９]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
function esNum(s){ const t=esHalf(s).replace(/[，,]/g,".").replace(/[^\d.\-]/g,""); if(t===""||t==="-"||t==="."||/^-?\.?$/.test(t)) return null; const n=Number(t); return isFinite(n)?n:null; }
function esInt(s){ const t=esHalf(s).replace(/[,，\s]/g,""); if(!/^-?\d+(\.\d+)?$/.test(t)) return null; return Number(t); }
const esYear = s => { const m=esHalf(s).match(/(\d{4})/); return m?+m[1]:null; };
const esMark = s => /[〇○◯●✓✔1]/.test(String(s||""));
function esIP(s){ const t=esHalf(s).trim(); if(!t) return null; const m=t.match(/^(\d+)(?:\.(\d))?$/); if(!m) return esNum(t); return +m[1] + (m[2]?(+m[2])/3:0); }
const esIPfmt = v => { const w=Math.floor(v+1e-9), f=Math.round((v-w)*3); return f?`${w}.${f}`:`${w}`; };
const esAvgFmt = v => v.toFixed(3).replace(/^0/,"");

/* 見出しからシートの種類を判定 */
function esKind(fields){
  const has = k => fields.includes(k);
  if(has("打順")) return "lineup";
  if(has("試合No") && (has("打数") || has("投球回"))) return "box";
  if(has("試合No") && (has("1") || has("R"))) return "inn";
  if(has("相手校") && has("得点")) return "games";
  if(has("時点") && has("名前")) return "abil";
  if(has("卒業時★") || (has("入学年度") && has("名前"))) return "grads";
  return null;
}

async function loadEikan(){
  const hero=document.getElementById("es-hero");
  const res=await Promise.allSettled(URL_EIKAN.map(u=>fetchCSV(u)));
  const got={};
  res.forEach(r=>{
    if(r.status!=="fulfilled") return;
    const fields=(r.value.meta.fields||[]).map(k=>String(k).replace(/^﻿/,"").replace(/\s+/g,"").trim());
    const kind=esKind(fields);
    if(kind && !got[kind]) got[kind]=cleanRows(r.value.data);
  });
  if(!got.games && !got.grads){ hero.innerHTML=errBox("栄冠ナインのデータを読み込めませんでした（シートの見出しを確認してください）。"); return; }

  /* 試合ログ */
  ES.games=(got.games||[]).map((o,i)=>{
    const year=esYear(F(o,"年度")), opp=F(o,"相手校"), rs=esInt(F(o,"得点")), ra=esInt(F(o,"失点"));
    if(!year || !opp || rs==null || ra==null) return null;
    let wl=F(o,"勝敗"); if(!/^[勝負分]$/.test(wl)) wl = rs>ra?"勝":rs<ra?"負":"分";
    return { no:esInt(F(o,"No"))||i+1, year, taikai:F(o,"大会"), round:esHalf(F(o,"回戦")), myPref:F(o,"自校都道府県"),
      side:F(o,"先攻後攻"), opp, oppPref:F(o,"相手都道府県"), power:F(o,"相手戦力").toUpperCase(), rs, ra, wl, note:F(o,"補足") };
  }).filter(Boolean).sort((a,b)=>a.no-b.no);

  /* イニングスコア */
  ES.inn={};
  (got.inn||[]).forEach(o=>{
    const no=esInt(F(o,"試合No")); if(!no) return;
    const inns=[]; for(let k=1;k<=15;k++) inns.push(F(o,String(k)));
    if(inns.every(v=>v==="") && !F(o,"R") && !F(o,"H") && !F(o,"E")) return;   // 試合No・先攻後攻だけ自動で並んだ未入力の行
    (ES.inn[no]=ES.inn[no]||[]).push({ side:F(o,"先攻後攻"), team:F(o,"高校名"), inns, R:F(o,"R"), H:F(o,"H"), E:F(o,"E") });
  });

  /* 選手成績（1試合×1選手） */
  ES.box=(got.box||[]).map(o=>{
    const no=esInt(F(o,"試合No")), name=F(o,"名前"); if(!no||!name) return null;
    const dec=F(o,"決定")||F(o,"勝敗");
    return { no, name, ab:esInt(F(o,"打数")), r:esInt(F(o,"得点")), h:esInt(F(o,"安打")), d2:esInt(F(o,"二塁打")), d3:esInt(F(o,"三塁打")), hr:esInt(F(o,"本塁打")), rbi:esInt(F(o,"打点")),
      so:esInt(F(o,"三振")), bb:esInt(F(o,"四死球")), sh:esInt(F(o,"犠打")), sb:esInt(F(o,"盗塁")), dp:esInt(F(o,"併殺")), e:esInt(F(o,"失策")),
      ip:esIP(F(o,"投球回")), np:esInt(F(o,"球数")), bf:esInt(F(o,"打者")), ha:esInt(F(o,"被安打")), k:esInt(F(o,"奪三振")), pbb:esInt(F(o,"与四死球")),
      pr:esInt(F(o,"失点")), er:esInt(F(o,"自責点")), wp:esInt(F(o,"暴投")), hra:esInt(F(o,"被本塁打")),
      dec: /^(勝|敗)$/.test(dec) ? dec : /^(S|Ｓ|セーブ)$/.test(dec) ? "S" : /^(H|Ｈ|ホールド)$/.test(dec) ? "H" : "" };
  }).filter(b=>b && (b.ab!=null || b.ip!=null));   // 数字が何も入っていない行（出場なし）は無視

  /* スタメン */
  ES.lineup=(got.lineup||[]).map(o=>{
    const year=esYear(F(o,"年度")), name=F(o,"名前"); if(!year||!name) return null;
    return { year, season:F(o,"時期")||"夏", order:esHalf(F(o,"打順")), name, grade:esHalf(F(o,"学年")), num:esHalf(F(o,"背番号")), pos:F(o,"守備"),
      games:esInt(F(o,"試合")), avg:esNum(F(o,"打率")), hr:esInt(F(o,"本塁打")), rbi:esInt(F(o,"打点")), sb:esInt(F(o,"盗塁")),
      app:esInt(F(o,"登板")), gs:esInt(F(o,"先発")), w:esInt(F(o,"勝")), l:esInt(F(o,"敗")), sv:esInt(F(o,"セーブ")),
      cg:esInt(F(o,"完投")), sho:esInt(F(o,"完封")), nh:esInt(F(o,"ノーノー")), ip:esIP(F(o,"投球回")), k:esInt(F(o,"奪三振")),
      bb:esInt(F(o,"与四死球")), era:esNum(F(o,"防御率")) };
  }).filter(Boolean);

  /* 卒業生 */
  ES.grads=(got.grads||[]).map(o=>{
    const name=F(o,"名前"); if(!name) return null;
    const g={ name, year:esYear(F(o,"入学年度")), from:F(o,"出身"), scout:esMark(F(o,"スカウト")), tensei:esMark(F(o,"転生")), transfer:esMark(F(o,"転校生")),
      pos0:F(o,"入学時守備"), star0:esInt(F(o,"入学時★")), pos:F(o,"卒業時守備")||F(o,"入学時守備"), star:esInt(F(o,"卒業時★")),
      games:esInt(F(o,"試合")), avg:esNum(F(o,"打率")), hr:esInt(F(o,"本塁打")), rbi:esInt(F(o,"打点")), sb:esInt(F(o,"盗塁")),
      app:esInt(F(o,"登板")), gs:esInt(F(o,"先発")), w:esInt(F(o,"勝")), l:esInt(F(o,"敗")), sv:esInt(F(o,"セーブ")),
      cg:esInt(F(o,"完投")), sho:esInt(F(o,"完封")), nh:esInt(F(o,"ノーノー")), ip:esIP(F(o,"投球回")), k:esInt(F(o,"奪三振")),
      bb:esInt(F(o,"与四死球")), era:esNum(F(o,"防御率")),
      course:F(o,"進路"), team:F(o,"球団").replace(/^[-－ー]$/,""), rank:esHalf(F(o,"順位")).replace(/^[-－ー]$/,""),
      /* 卒業時の能力 */
      kana:F(o,"よみがな"), birth:F(o,"誕生日"), chara:F(o,"性格"), th:F(o,"投"), bt:F(o,"打") };
    if(g.avg!=null && g.avg>1) g.avg=null;               // 打率の入力ミス（2.810 など）は除外
    g.grow = (g.star!=null && g.star0!=null) ? g.star-g.star0 : null;
    g.pro = g.course==="プロ野球選手" || !!g.team;
    return g;
  }).filter(Boolean);

  /* 能力（入学時・卒業時）：名前＋入学年度で卒業生につなぐ。ランキング等は卒業時（なければ入学時）の値を使う */
  ES.abilLoaded = !!got.abil;
  (got.abil||[]).forEach(o=>{
    const name=F(o,"名前"), when=F(o,"時点"); if(!name || !/^(入学時|卒業時)$/.test(when)) return;
    const yr=esYear(F(o,"入学年度"));
    const g=ES.grads.find(x=>x.name===name && (yr==null || x.year===yr)) || ES.grads.find(x=>x.name===name);
    if(!g) return;
    const a=esParseAbil(o);
    /* 利き腕（投げ・打ち）は能力シートの時点ごと。空欄なら卒業生シートの値を使う */
    const th=F(o,"投げ"), bt=F(o,"打ち"), ch=F(o,"性格"); if(th) a.th=th; if(bt) a.bt=bt; if(ch) a.chara=ch;
    (g.ab=g.ab||{})[when]=a;
  });
  const esMainPos = p => /^[左中右]$/.test(p) ? "外" : p;
  ES.grads.forEach(g=>{
    Object.values(g.ab||{}).forEach(a=>{ a.fld = a.def ? (a.def[esMainPos(g.pos)] ?? null) : null; });
    if(g.ab) Object.assign(g, g.ab["卒業時"]||g.ab["入学時"]);
  });
  ES.gameByNo={}; ES.games.forEach(g=>{ ES.gameByNo[g.no]=g; g.season = /^夏/.test(g.taikai) ? "夏" : "秋春"; });
  /* 1人で投げ切った試合は、勝敗が空欄なら試合の結果から勝ち／負けを付ける */
  ES.box.forEach(b=>{
    if(b.ip==null || b.dec) return;
    const gm=ES.gameByNo[b.no]; if(!gm) return;
    if(ES.box.filter(x=>x.no===b.no && x.ip!=null).length===1) b.dec = gm.wl==="勝"?"勝":gm.wl==="負"?"敗":"";
  });
  esBuildMvp();
  /* 卒業生の成績が空欄なら、選手成績シートから自動計算する */
  ES.grads.forEach(g=>{ esFillFromBox(g); esGradDerived(g); });
  esBuildYears();
  esInitSubnav();
  esRenderHero(); esRenderYears(); esInitYearSel(); esRenderB9Tabs(); esRenderB9();
  esRenderRoster(); esRenderRkTabs(); esRenderRk(); esRenderRecords(); esRenderRivals(); esRenderDraft();
}

/* ---------- 集計 ---------- */
/* 大会ごとの成績の呼び方。秋の県大会・地区大会はゲーム上2試合なので、2回戦が決勝扱い */
const ES_FINAL = { "秋の都道府県大会":"2回戦", "秋の地区大会":"2回戦" };
const ES_LOSS = {
  "秋の都道府県大会": {"1回戦":"ベスト4", "2回戦":"準優勝"},
  "秋の地区大会":     {"1回戦":"ベスト4", "2回戦":"準優勝"},
  "神宮大会":         {"1回戦":"ベスト8", "2回戦":"ベスト8"},
  "春の甲子園":       {"1回戦":"ベスト32", "2回戦":"ベスト16"},
  "夏の甲子園":       {"1回戦":"1回戦敗退", "2回戦":"ベスト32", "3回戦":"ベスト16"}
};
function esResult(games, taikai){
  if(!games.length) return "";
  const last=games[games.length-1], r=last.round.replace(/\s/g,"");
  const fin=ES_FINAL[taikai]||"決勝";
  if(last.wl==="勝") return r===fin ? "優勝" : "勝ち上がり中";
  if(r===fin) return "準優勝";
  const m=ES_LOSS[taikai]||{};
  if(m[r]) return m[r];
  if(r==="準決勝") return "ベスト4";
  if(r==="準々決勝") return "ベスト8";
  return `${r}敗退`;
}
function esBuildYears(){
  const m={};
  ES.games.forEach(g=>{ (m[g.year]=m[g.year]||[]).push(g); });
  ES.lineup.forEach(l=>{ m[l.year]=m[l.year]||[]; });
  ES.years=Object.keys(m).map(Number).sort((a,b)=>b-a).map(y=>{
    const G=m[y], res={};
    ES_TAIKAI.forEach(t=>{ res[t.k]=esResult(G.filter(g=>g.taikai===t.k), t.k); });
    const w=G.filter(g=>g.wl==="勝").length, l=G.filter(g=>g.wl==="負").length;
    const pref=(G.find(g=>g.myPref)||{}).myPref||"";
    return { y, games:G, res, w, l, pref, rs:G.reduce((a,g)=>a+g.rs,0), ra:G.reduce((a,g)=>a+g.ra,0) };
  });
}
function esStreaks(){
  let cur=0, best={n:0}, run=[];
  ES.games.forEach(g=>{
    if(g.wl==="勝"){ cur++; run.push(g); if(cur>best.n) best={n:cur, from:run[0], to:g, stop:null}; }
    else { if(best.to && best.to===run[run.length-1] && !best.stop) best.stop=g; cur=0; run=[]; }
  });
  return { best, cur };
}
const esBadgeCls = r => r==="優勝"?"v" : r==="準優勝"?"s" : r==="ベスト4"?"b4" : r==="勝ち上がり中"?"live" : "";
const esGameLbl = g => `${g.year}年度 ${g.taikai} ${g.round}`;

/* ---------- ヒーロー ---------- */
function esRenderHero(){
  const G=ES.games, w=G.filter(g=>g.wl==="勝").length, l=G.filter(g=>g.wl==="負").length, d=G.length-w-l;
  const cnt=k=>ES.years.filter(y=>y.res[k]==="優勝").length;
  const st=esStreaks(), pro=ES.grads.filter(g=>g.pro).length;
  const rs=G.reduce((a,g)=>a+g.rs,0), ra=G.reduce((a,g)=>a+g.ra,0);
  document.getElementById("es-hero").innerHTML=`
    <div class="tm-hero-label">${escHtml(ES_SCHOOL)}　通算成績</div>
    <div class="tm-big es-big">${nf(w)}<small>勝</small>${nf(l)}<small>敗</small>${d?`${d}<small>分</small>`:""}</div>
    <div class="gm-hero-sub">${G.length}試合・勝率 ${w+l?esAvgFmt(w/(w+l)):"-"}・総得点 ${nf(rs)}／総失点 ${nf(ra)}</div>
    <div class="hero-meta">
      <span class="hero-chip es-gold">夏の甲子園優勝 <strong>${cnt("夏の甲子園")}</strong> 回</span>
      <span class="hero-chip es-gold">春の甲子園優勝 <strong>${cnt("春の甲子園")}</strong> 回</span>
      <span class="hero-chip">神宮大会優勝 <strong>${cnt("神宮大会")}</strong> 回</span>
      <span class="hero-chip accent">最長 <strong>${st.best.n}</strong> 連勝</span>
      ${st.cur>1?`<span class="hero-chip">現在 <strong>${st.cur}</strong> 連勝中</span>`:""}
      ${pro?`<span class="hero-chip">プロ入り <strong>${pro}</strong> 人</span>`:""}
    </div>`;
}

/* ---------- 表示の切り替え（年度／選手／記録・対戦校） ---------- */
function esInitSubnav(){
  const tabs=document.querySelectorAll("#es-subnav .day-tab");
  tabs.forEach(b=>b.onclick=()=>{
    ES.pane=b.dataset.pane;
    tabs.forEach(x=>{ const on=x===b; x.classList.toggle("active", on); x.setAttribute("aria-selected", on?"true":"false"); });
    document.querySelectorAll("#eikan .es-pane").forEach(p=>p.hidden = p.dataset.pane!==ES.pane);
  });
}

/* ---------- 年度別成績（年代ごとに表示） ---------- */
function esRenderYears(){
  const el=document.getElementById("es-years");
  if(!ES.years.length){ el.innerHTML=errBox("まだ試合の記録がありません。"); return; }
  const decades=[...new Set(ES.years.map(Y=>Math.floor(Y.y/10)*10))].sort((a,b)=>b-a);
  if(ES.decade==null || !decades.includes(ES.decade)) ES.decade=decades[0];
  const D=ES.years.filter(Y=>Math.floor(Y.y/10)*10===ES.decade);
  const v=D.reduce((a,Y)=>a+ES_TAIKAI.filter(t=>Y.res[t.k]==="優勝").length,0);
  el.innerHTML=`
    ${decades.length>1?`<div class="day-tabs es-decs" id="es-dec">${decades.map(d=>{
      const n=ES.years.filter(Y=>Math.floor(Y.y/10)*10===d).length;
      return `<button type="button" class="day-tab${d===ES.decade?" active":""}" data-d="${d}">${d}年代<span class="tab-sub">${n}</span></button>`; }).join("")}</div>`:""}
    <div class="es-tbl-wrap"><table class="es-tbl">
    <thead><tr><th class="es-sticky">年度</th>${ES_TAIKAI.map(t=>`<th>${t.s}</th>`).join("")}<th>勝敗</th></tr></thead>
    <tbody>${D.map(Y=>`
      <tr data-y="${Y.y}" tabindex="0" aria-label="${Y.y}年度の記録を見る"${Y.y===ES.sel?' class="on"':""}>
        <th class="es-sticky"><span class="es-y">${Y.y}</span><span class="es-pref">${escHtml(Y.pref)}</span></th>
        ${ES_TAIKAI.map(t=>{ const r=Y.res[t.k]; return `<td>${r?`<span class="es-res ${esBadgeCls(r)}">${escHtml(r)}</span>`:`<span class="es-none">－</span>`}</td>`; }).join("")}
        <td class="es-wl">${Y.w}-${Y.l}</td>
      </tr>`).join("")}</tbody></table></div>
    <p class="kk-note-s">${ES.decade}年代：${D.length}年度・優勝 ${v} 回。年度をタップすると下に詳しい記録が出ます</p>`;
  el.querySelectorAll("#es-dec .day-tab").forEach(b=>b.onclick=()=>{ ES.decade=+b.dataset.d; esRenderYears(); });
  el.querySelectorAll("tbody tr").forEach(tr=>{
    const go=()=>{ esShowYear(+tr.dataset.y);
      const a=document.getElementById("es-year-anchor"), nav=document.querySelector("nav");
      window.scrollTo({ top:Math.max(0, window.scrollY+a.getBoundingClientRect().top-(nav?nav.offsetHeight:0)-8), behavior:prefersReduced()?"auto":"smooth" }); };
    tr.addEventListener("click", go);
    tr.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } });
  });
}

/* ---------- 年度の記録 ---------- */
function esInitYearSel(){
  const sel=document.getElementById("es-year-sel");
  sel.parentElement.hidden = !ES.years.length;   // 試合がないときは空の選択欄を出さない
  if(!ES.years.length){ sel.innerHTML=""; document.getElementById("es-year").innerHTML=errBox("まだ記録がありません。"); return; }
  sel.innerHTML=ES.years.map(Y=>`<option value="${Y.y}">${Y.y}年度${Y.pref?`（${escHtml(Y.pref)}）`:""}</option>`).join("");
  sel.onchange=()=>esShowYear(+sel.value);
  esShowYear(ES.years[0].y);
}
function esShowYear(y){
  ES.sel=y;
  document.getElementById("es-year-sel").value=String(y);
  const dec=Math.floor(y/10)*10;
  if(ES.decade!=null && dec!==ES.decade){ ES.decade=dec; esRenderYears(); }
  document.querySelectorAll(".es-tbl tbody tr").forEach(tr=>tr.classList.toggle("on", +tr.dataset.y===y));
  const Y=ES.years.find(v=>v.y===y); if(!Y) return;
  const groups=ES_TAIKAI.map(t=>({t, G:Y.games.filter(g=>g.taikai===t.k)})).filter(x=>x.G.length);
  const other=Y.games.filter(g=>!ES_TAIKAI.some(t=>t.k===g.taikai));
  if(other.length) groups.push({t:{k:"その他", s:"その他"}, G:other});
  const seasons=["夏","秋春"].filter(s=>ES.lineup.some(l=>l.year===y && l.season===s));
  if(!seasons.includes(ES.lineupSeason)) ES.lineupSeason=seasons[0]||"夏";
  document.getElementById("es-year").innerHTML=`
    <div class="stats-row">
      <div class="stat-chip"><strong>${Y.w}</strong> 勝 <strong>${Y.l}</strong> 敗</div>
      <div class="stat-chip">得点 <strong>${Y.rs}</strong>／失点 <strong>${Y.ra}</strong></div>
      ${Y.pref?`<div class="stat-chip">${escHtml(Y.pref)}代表</div>`:""}
    </div>
    <div class="es-fold">
    ${groups.length?groups.map(({t,G})=>{ const r=esResult(G, t.k), w=G.filter(g=>g.wl==="勝").length, l=G.filter(g=>g.wl==="負").length; return `
      <details class="es-tk">
        <summary class="es-tk-head"><span class="es-tk-name">${escHtml(t.k)}</span><span class="es-tk-wl">${w}勝${l}敗</span>${r?`<span class="es-res ${esBadgeCls(r)}">${escHtml(r)}</span>`:""}</summary>
        <div class="es-tk-body">${G.map(esGameHtml).join("")}</div>
      </details>`; }).join(""):errBox("この年度の試合はまだありません。")}
      <details class="es-tk">
        <summary class="es-tk-head"><span class="es-tk-name">スタメン</span><span class="es-tk-wl">${seasons.length?seasons.map(s=>s==="夏"?"夏":"秋・春").join("／"):"記録なし"}</span></summary>
        <div class="es-tk-body">
        ${seasons.length?`<div class="day-tabs" id="es-lu-tabs">${seasons.map(s=>`<button type="button" class="day-tab${s===ES.lineupSeason?" active":""}" data-s="${s}">${s==="夏"?"夏":"秋・春"}</button>`).join("")}</div>
          <div id="es-lu"></div>`:`<p class="kk-info-empty">この年度のスタメンはまだありません。</p>`}
        </div>
      </details>
    </div>`;
  document.querySelectorAll("#es-lu-tabs .day-tab").forEach(b=>b.onclick=()=>{
    ES.lineupSeason=b.dataset.s;
    document.querySelectorAll("#es-lu-tabs .day-tab").forEach(x=>x.classList.toggle("active", x===b));
    esRenderLineup();
  });
  if(seasons.length) esRenderLineup();
}
/* ---------- 試合のMVP（打撃・投手それぞれ1人。勝っても負けても選手成績から自動で選ぶ） ---------- */
/*
  評価のしかた
  打撃：①打席の中身を「得点の価値」で数える（単打0.47・二塁打0.78・三塁打1.09・本塁打1.40・四死球0.33点、凡打は−0.27点、
          併殺・三振・失策は追加でマイナス、盗塁＋0.2）
        ②チームの得点のうち、自分が絡んだ割合（打点は6割・ホームインは4割の手柄）を加点。1−0の決勝打は大きく、大差の試合の1打点は小さい
        ③2点差以内の接戦なら②を1.5倍
  投手：①平均的な投手ならこの回数で何点取られるか（全試合の失点率から計算）と比べて、何点防いだか
        ②奪三振を少し加点
        ③接戦（2点差以内）で勝ち投手・セーブなら加点、完投も少し加点
*/
/* その試合の先発投手：スタメンで投手として入っている選手（打順あり、またはDHの「投」）。いなければ最初に入力した投手 */
function esStarterOf(no){
  const P=ES.box.filter(b=>b.no===no && b.ip!=null); if(!P.length) return null;
  const gm=ES.gameByNo[no];
  const L=gm ? ES.lineup.filter(l=>l.year===gm.year && l.season===gm.season && l.pos==="投" && (/^\d+$/.test(l.order)||l.order==="投")) : [];
  return P.find(b=>L.some(l=>esSameName(l.name,b.name))) || P[0];
}
function esGameMargin(no){ const g=ES.gameByNo[no]; return g ? Math.abs(g.rs-g.ra) : 99; }
function esBatScore(b){
  if(b.ab==null) return -Infinity;
  const n=k=>b[k]||0, single=Math.max(0, n("h")-n("d2")-n("d3")-n("hr")), outs=Math.max(0, n("ab")-n("h"));
  const lw = 0.47*single + 0.78*n("d2") + 1.09*n("d3") + 1.40*n("hr") + 0.33*n("bb") + 0.2*n("sb") + 0.05*n("sh")
           - 0.27*outs - 0.37*n("dp") - 0.05*n("so") - 0.5*n("e");
  const gm=ES.gameByNo[b.no], team=gm ? gm.rs : 0;
  /* 得点への関与：打点は6割、ホームインは4割の手柄として数える（本塁打は自分で還るので打点＋得点で1点ぶん） */
  const share = team>0 ? Math.min(1, (0.6*n("rbi") + 0.4*Math.max(n("r"), n("hr")))/team) : 0;
  return lw + share*2*(esGameMargin(b.no)<=2 ? 1.5 : 1);
}
function esRaPerOut(){
  if(ES._raOut!=null) return ES._raOut;
  let o=0, r=0; ES.box.forEach(b=>{ if(b.ip==null) return; o+=Math.round(b.ip*3); r+= b.pr!=null?b.pr:(b.er||0); });
  return ES._raOut = o>0 ? r/o : 4/27;
}
function esPitScore(b, nP){
  if(b.ip==null) return -Infinity;
  const outs=Math.round(b.ip*3), ra=b.pr!=null?b.pr:(b.er||0), close=esGameMargin(b.no)<=2;
  const saved = outs*esRaPerOut() - ra;
  return saved + 0.08*(b.k||0) + ((b.dec==="勝"||b.dec==="S") ? (close?1:0.3) : b.dec==="H" ? (close?0.7:0.2) : 0) + (nP===1?0.5:0);
}
function esBuildMvp(){
  ES.mvp={}; ES._raOut=null;
  const by={}; ES.box.forEach(b=>(by[b.no]=by[b.no]||[]).push(b));
  Object.keys(by).forEach(no=>{
    const B=by[no], nP=B.filter(b=>b.ip!=null).length;
    const top=f=>{ let best=null, bs=-Infinity; B.forEach(b=>{ const v=f(b); if(v>bs){ bs=v; best=b; } }); return {best, bs}; };
    const bt=top(esBatScore), pt=top(b=>esPitScore(b,nP));
    ES.mvp[no]={ bat: bt.best && bt.bs>0 && (bt.best.h||bt.best.rbi||bt.best.bb) ? bt.best : null, pit: pt.best && pt.bs>-Infinity ? pt.best : null };
  });
}
const esIsMvp = (b, kind) => !!(ES.mvp && ES.mvp[b.no] && ES.mvp[b.no][kind]===b);
function esMvpDesc(b, kind){
  const P=[];
  if(kind==="pit"){
    const nP=ES.box.filter(x=>x.no===b.no && x.ip!=null).length, ra=b.pr!=null?b.pr:b.er;
    P.push(`${esIPfmt(b.ip)}回`); if(b.k) P.push(`${b.k}奪三振`); if(ra!=null) P.push(`${ra}失点`);
    if(nP===1) P.push(ra===0?"完封":"完投");
    if(b.dec) P.push(b.dec==="勝"?"勝利":b.dec==="敗"?"敗戦":b.dec==="H"?"ホールド":"セーブ");
  } else {
    P.push(`${b.ab}打数${b.h||0}安打`); if(b.hr) P.push(`${b.hr}本塁打`); if(b.d3) P.push(`三塁打${b.d3>1?b.d3:""}`); if(b.d2) P.push(`二塁打${b.d2>1?b.d2:""}`);
    if(b.rbi) P.push(`${b.rbi}打点`); if(b.sb) P.push(`${b.sb}盗塁`);
  }
  return P.join(" ");
}
/* MVPの見出し（新聞の見出し風のひとこと） */
function esMvpTitle(b, kind){
  const gm=ES.gameByNo[b.no], lost=gm && gm.wl==="負";
  if(kind==="pit"){
    const nP=ES.box.filter(x=>x.no===b.no && x.ip!=null).length, ra=b.pr!=null?b.pr:b.er, cg=nP===1;
    if(cg && b.ha===0) return "ノーヒットノーラン達成！";
    if(cg && ra===0) return `${b.ha!=null?b.ha+"安打":""}完封`;
    if((b.k||0)>=10) return lost ? `${b.k}奪三振も実らず` : `${b.k}奪三振の快投`;
    if(cg && b.ip>9) return `延長${Math.floor(b.ip)}回を一人で投げ抜く`;
    if(cg) return lost ? "最後まで一人で投げ抜いた" : "完投で勝利をつかむ";
    const ipT = (()=>{ const o=Math.round(b.ip*3), w=Math.floor(o/3), f=o%3; return `${w}回${f?`${f}/3`:""}`; })();
    const raT = ra==null ? "" : ra===0 ? "無失点" : `${ra}失点`;
    if(esStarterOf(b.no)===b){
      if(b.dec==="勝") return raT ? `先発${ipT}を${raT}で勝利` : `先発${ipT}で勝利`;
      if(lost) return "負けはしたが粘りの投球";
      return raT ? `先発${ipT}を${raT}` : `先発として${ipT}`;
    }
    if(b.dec==="S") return "最後を締めた守護神";
    if(b.dec==="H") return "リードを守ってつないだ";
    if(b.dec==="勝") return "流れを変えた好リリーフ";
    if(lost) return "負けはしたが粘りのリリーフ";
    return raT ? `${ipT}を${raT}の好救援` : `${ipT}の好救援`;
  }
  const h=b.h||0, hr=b.hr||0, d2=b.d2||0, d3=b.d3||0, single=h-d2-d3-hr;
  const pre = lost ? "意地の" : "";
  if(single>0 && d2>0 && d3>0 && hr>0) return "サイクルヒット達成！";
  if(hr>=2) return `1試合${hr}本のアーチ`;
  if(h>=4) return lost ? `意地の${h}安打` : `${h}安打の固め打ち`;
  if((b.rbi||0)>=4) return `${b.rbi}打点の大暴れ`;
  if(hr===1 && (b.rbi||0)>=2) return `${pre}一発含む${b.rbi}打点`;
  if(h===3) return `${pre}猛打賞`;
  if(hr===1) return lost ? "意地の一発" : "一発で流れを呼ぶ";
  if((b.sb||0)>=2) return "足でかき回す";
  if((b.rbi||0)>=2) return `${pre}${b.rbi}打点の勝負強さ`;
  if((b.bb||0)>=2) return "しぶとく出塁";
  if(h<=1) return lost ? "意地の一打" : "チームを勢いづける一打";
  return lost ? `意地の${h}安打` : `${h}安打の活躍`;
}
function esMvpHtml(no){
  const M=ES.mvp && ES.mvp[no]; if(!M || (!M.bat && !M.pit)) return "";
  const gm=ES.gameByNo[no];
  const one=(b,kind,lbl)=>{
    if(!b) return "";
    const l=gm && ES.lineup.find(x=>x.year===gm.year && x.season===gm.season && esSameName(x.name,b.name));
    const sub=l ? [l.grade?escHtml(l.grade)+"年":"", l.num?escHtml(esCircled(l.num)):""].filter(Boolean).join(" ") : "";
    return `<div class="es-mvp-row"><span class="es-mvp-b ${kind}">${lbl}</span>${l&&l.pos?`<span class="es-pos sm ${esPosCls(l.pos, kind==="pit"&&esStarterOf(b.no)!==b?"rp":"")}">${escHtml(l.pos)}</span>`:""}<b>${escHtml(b.name)}</b>${sub?`<small>${sub}</small>`:""}<span class="es-mvp-d"><b class="es-mvp-t">${escHtml(esMvpTitle(b,kind))}</b>${escHtml(esMvpDesc(b,kind))}</span></div>`;
  };
  return `<div class="es-mvp">${one(M.bat,"bat","打撃MVP")}${one(M.pit,"pit","投手MVP")}</div>`;
}
function esGameHtml(g){
  const ls=ES.inn[g.no];
  const mv=(ES.mvp && ES.mvp[g.no]) || {};
  const mvs=[mv.bat?`打 ${mv.bat.name}`:"", mv.pit?`投 ${mv.pit.name}`:""].filter(Boolean).join("／");
  const meta=[g.oppPref, g.power?`戦力${g.power}`:"", g.note].filter(Boolean).join("・");
  const row=`<span class="es-rd">${escHtml(g.round)}</span>
    <span class="es-opp"><span class="es-opp-name">${escHtml(g.opp)}</span><span class="es-opp-meta">${escHtml(meta)}</span>${mvs?`<span class="es-opp-meta es-opp-mvp">MVP ${escHtml(mvs)}</span>`:""}</span>
    <span class="es-score ${g.wl==="勝"?"w":g.wl==="負"?"l":""}"><span class="es-wlb">${g.wl}</span>${g.rs}-${g.ra}</span>`;
  const box=esBoxScore(g.no);
  if((!ls || !ls.length) && !box) return `<div class="es-game">${row}</div>`;
  return `<details class="es-game"><summary>${row}</summary>${esMvpHtml(g.no)}${ls&&ls.length?esLineScore(ls):""}${box}</details>`;
}
function esLineScore(rows){
  const ord=s=>s==="先攻"?0:s==="後攻"?1:2;
  const R=rows.slice().sort((a,b)=>ord(a.side)-ord(b.side));
  let n=9; R.forEach(r=>r.inns.forEach((v,i)=>{ if(v!=="" && i+1>n) n=i+1; }));
  const cell=v=>{ const t=String(v||"").trim(); return /^[xX✕×]$/.test(t)?"✕":escHtml(esHalf(t)); };
  return `<div class="es-ls-wrap"><table class="es-ls">
    <thead><tr><th></th>${Array.from({length:n},(_,i)=>`<th>${i+1}</th>`).join("")}<th class="es-ls-r">R</th><th>H</th><th>E</th></tr></thead>
    <tbody>${R.map(r=>`<tr class="${r.team===ES_SCHOOL?"me":""}"><th>${escHtml(r.team||r.side)}</th>${r.inns.slice(0,n).map(v=>`<td>${cell(v)}</td>`).join("")}
      <td class="es-ls-r">${cell(r.R)}</td><td>${cell(r.H)}</td><td>${cell(r.E)}</td></tr>`).join("")}</tbody></table></div>`;
}
/* スタメンの名前（名字だけでもOK）から卒業生を探す：名字＋入学年度（年度−学年+1）、同じ名字が複数なら守備で絞る */
const esPosN = p => /^[左中右外]$/.test(p) ? "外" : p;
function esFindGrad(l){
  const ent = /^\d$/.test(l.grade) ? l.year-(+l.grade)+1 : null;
  const sur = n => String(n||"").split(/[\s　]+/)[0];
  let c=ES.grads.filter(g=>(g.name===l.name || sur(g.name)===l.name) && (ent==null || g.year===ent));
  if(c.length>1){ const c2=c.filter(g=>esPosN(l.pos)===esPosN(g.pos) || esPosN(l.pos)===esPosN(g.pos0)); if(c2.length) c=c2; }
  return c[0]||null;
}
/* 守備位置アイコンの色分け：投手=赤、捕手=青、内野=黄、外野=緑 */
/* 守備位置アイコンの色（パワプロに合わせる）：先発=赤、中継ぎ・抑え=ピンク、捕手=青、内野=黄、外野=黄緑
   role に "rp" を渡すと、投手を中継ぎ色（ピンク）にする（控えの投手・救援で投げた投手） */
function esPosCls(p, role){
  p=String(p||"");
  if(p==="投") return role==="rp" ? "p-rel" : "p-pit";
  if(p==="捕") return "p-cat";
  if(/^[一二三遊]$/.test(p)) return "p-inf";
  if(/^[左中右外]$/.test(p)) return "p-of";
  return "p-etc";
}
/* 背番号を丸数字に（1〜50。それ以上は #番号） */
function esCircled(n){
  n=+n; if(!n) return "";
  if(n<=20) return String.fromCharCode(0x2460+n-1);
  if(n<=35) return String.fromCharCode(0x3251+n-21);
  if(n<=50) return String.fromCharCode(0x32B1+n-36);
  return `#${n}`;
}
/* ===== 選手の成績（選手成績シートを足し算して出す） ===== */
const esSur = n => String(n||"").split(/[\s　]+/)[0];
const esSameName = (a,b) => a===b || esSur(a)===b || a===esSur(b);
const esSeasonKey = r => r.year*2 + (r.season==="夏"?0:1);
const esPeriodLbl = (y,s) => `${y}${s==="夏"?"夏":"秋春"}`;
/* 選手を「名前＋入学年度」で特定。卒業生 g があればその名前と入学年度を使う */
function esIdent(l, g){
  if(g) return { name:g.name, entry:g.year };
  const entry = /^\d$/.test(l.grade) ? l.year-(+l.grade)+1 : null;
  return { name:l.name, entry };
}
/* その選手の試合ごとの記録（古い順） */
function esBoxOf(id){
  return ES.box.filter(b=>{
    if(!esSameName(b.name, id.name)) return false;
    const gm=ES.gameByNo[b.no]; if(!gm) return false;
    return id.entry==null || (gm.year>=id.entry && gm.year<=id.entry+2);
  }).sort((a,b)=>a.no-b.no);
}
/* 卒業生の通算：空欄の項目だけ、選手成績の合計で埋める */
function esFillFromBox(g){
  const B=esBoxOf({name:g.name, entry:g.year}); if(!B.length) return;
  const t=esAgg(B);
  /* 先発＝その試合で最初に入力した投手、完投＝1人で投げ切った、完封＝完投で失点0、ノーノー＝完投で被安打0 */
  let gs=0, cg=0, sho=0, nh=0;
  B.forEach(b=>{
    if(b.ip==null) return;
    const P=ES.box.filter(x=>x.no===b.no && x.ip!=null), gm=ES.gameByNo[b.no];
    const sp=gm && ES.lineup.find(l=>l.year===gm.year && l.season===gm.season && (/^\d+$/.test(l.order)||l.order==="投") && l.pos==="投");
    const starter=(sp && P.find(x=>esSameName(x.name, sp.name))) || P[0];
    if(starter===b) gs++;
    if(P.length===1){ cg++; if(gm && gm.ra===0) sho++; if(b.ha===0) nh++; }
  });
  const set=(k,v)=>{ if(g[k]==null && v!=null){ g[k]=v; g.auto=true; } };
  if(t.bat){ set("games",t.g); set("avg",t.avg); set("hr",t.hr); set("rbi",t.rbi); set("sb",t.sb); set("ops",t.ops);
    set("pa",t.ab+t.bb+t.sh); set("h",t.h); set("r",t.r); set("d2",t.d2); set("d3",t.d3); set("bbb",t.bb); set("sh",t.sh); set("obp",t.obp); set("slg",t.slg); }
  else set("games",t.g);
  set("mvpB", B.filter(b=>esIsMvp(b,"bat")).length || null);
  set("mvpP", B.filter(b=>esIsMvp(b,"pit")).length || null);
  if(t.pit){ set("app",t.app); set("gs",gs); set("w",t.w); set("l",t.l); set("sv",t.sv); set("cg",cg); set("sho",sho); set("nh",nh);
    set("ip",t.ip); set("k",t.k); set("bb",t.pbb); set("era",t.era); set("ha",t.ha); set("hd",t.hd||null);
    if(t.outs>0){ set("k9",t.k*27/t.outs); set("whip",(t.ha+t.pbb)*3/t.outs); } }
}
/* 打率などの規定：打席（打数＋四死球＋犠打）が ES_BAT_MIN 以上の野手 */
function esBatQ(g){ return (g.pa!=null ? g.pa : (g.games||0)*4) >= ES_BAT_MIN && g.pos!=="投"; }
function esGradDerived(g){
  g.batScore = (esBatQ(g) && g.avg!=null)
    ? g.avg*100 + (g.hr||0)*3 + (g.rbi||0) + (g.sb||0) : null;
  g.pitQual = g.era!=null && (g.ip!=null ? g.ip>=ES_PIT_IP_MIN : ((g.app||g.games||0)>=10));
}
const esDecCls = d => d==="勝"?"w":d==="敗"?"l":d==="H"?"h":"s";
/* 勝敗の表示：12-3 2S 5H */
const esWLtxt = t => `${t.w}-${t.l}${t.sv?` ${t.sv}S`:""}${t.hd?` ${t.hd}H`:""}`;
function esAgg(B){
  const t={ g:0, ab:0, r:0, h:0, d2:0, d3:0, hr:0, rbi:0, so:0, sb:0, bb:0, sh:0, dp:0, e:0, app:0, outs:0, ha:0, er:0, k:0, pbb:0, w:0, l:0, sv:0, hd:0, bat:false, pit:false };
  B.forEach(b=>{
    t.g++;
    if(b.ab!=null){ t.bat=true; t.ab+=b.ab; t.h+=b.h||0; t.hr+=b.hr||0; t.rbi+=b.rbi||0; t.sb+=b.sb||0; t.bb+=b.bb||0;
      t.r+=b.r||0; t.d2+=b.d2||0; t.d3+=b.d3||0; t.so+=b.so||0; t.sh+=b.sh||0; t.dp+=b.dp||0; t.e+=b.e||0; }
    if(b.ip!=null){ t.pit=true; t.app++; t.outs+=Math.round(b.ip*3); t.ha+=b.ha||0; t.er+=b.er||0; t.k+=b.k||0; t.pbb+=b.pbb||0;
      if(b.dec==="勝") t.w++; else if(b.dec==="敗") t.l++; else if(b.dec==="S") t.sv++; else if(b.dec==="H") t.hd++; }
  });
  t.avg = t.ab>0 ? t.h/t.ab : null;
  /* 出塁率は (安打+四死球)/(打数+四死球)、長打率は 塁打/打数（犠飛は記録しないので含めない） */
  t.obp = (t.ab+t.bb)>0 ? (t.h+t.bb)/(t.ab+t.bb) : null;
  t.slg = t.ab>0 ? (t.h + t.d2 + t.d3*2 + t.hr*3)/t.ab : null;
  t.ops = (t.obp!=null && t.slg!=null) ? t.obp+t.slg : null;
  t.era = t.outs>0 ? t.er*27/t.outs : null;
  t.ip = t.outs/3;
  return t;
}
const esF = (v,fn) => v==null ? "-" : (fn?fn(v):v);
function esCellsHtml(cells){ return `<div class="es-cells">${cells.map(([k,v])=>`<div class="es-cell"><span>${k}</span><b>${escHtml(v)}</b></div>`).join("")}</div>`; }
function esAggCells(t, pit){
  return esCellsHtml(pit
    ? [["防御率", esF(t.era,v=>v.toFixed(2))], ["勝敗", esWLtxt(t)], ["奪三振", t.k], ["投球回", esIPfmt(t.ip)]]
    : [["打率", esF(t.avg,esAvgFmt)], ["本塁打", t.hr], ["打点", t.rbi], ["盗塁", t.sb]]);
}
/* 時期ごとの表 */
function esPeriodTable(B, pit, curKey){
  const per={}; B.forEach(b=>{ const gm=ES.gameByNo[b.no], k=gm.year*2+(gm.season==="夏"?0:1); (per[k]=per[k]||{y:gm.year,s:gm.season,B:[]}).B.push(b); });
  const P=Object.keys(per).map(Number).sort((a,b)=>a-b).map(k=>({k, ...per[k], t:esAgg(per[k].B)}));
  if(!P.length) return "";
  const head = pit ? ["登板","勝敗","投球回","奪三振","防御率"] : ["試合","打率","OPS","本","点","盗"];
  const row = t => pit
    ? [t.app, esWLtxt(t), esIPfmt(t.ip), t.k, esF(t.era,v=>v.toFixed(2))]
    : [t.g, `${esF(t.avg,esAvgFmt)}<small>${t.h}/${t.ab}</small>`, esF(t.ops,esAvgFmt), t.hr, t.rbi, t.sb];
  return `<div class="es-car-sub">時期ごとの成績</div>
    <div class="es-st-wrap"><table class="es-st-tbl"><thead><tr><th>時期</th>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${P.map(p=>`<tr${p.k===curKey?' class="cur"':""}><th>${esPeriodLbl(p.y,p.s)}</th>${row(p.t).map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
/* 試合ごとの成績（折りたたみ） */
/* 相手の戦力（S〜G）別の成績 */
const ES_PW = ["S","A","B","C","D","E","F","G"];
function esRankTable(B, pit){
  const per={}; B.forEach(b=>{ const gm=ES.gameByNo[b.no]; if(!gm || !gm.power) return; (per[gm.power]=per[gm.power]||[]).push(b); });
  const ks=ES_PW.filter(k=>per[k]); if(!ks.length) return "";
  const head = pit ? ["登板","勝敗","投球回","奪三振","防御率"] : ["試合","打率","OPS","本","点"];
  const row = t => pit
    ? [t.app, esWLtxt(t), esIPfmt(t.ip), t.k, esF(t.era,v=>v.toFixed(2))]
    : [t.g, `${esF(t.avg,esAvgFmt)}<small>${t.h}/${t.ab}</small>`, esF(t.ops,esAvgFmt), t.hr, t.rbi];
  return `<div class="es-car-sub">相手の戦力別の成績</div>
    <div class="es-st-wrap"><table class="es-st-tbl es-rank-tbl"><thead><tr><th>戦力</th>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${ks.map(k=>`<tr><th><span class="es-pw pw-${k}">${k}</span></th>${row(esAgg(per[k])).map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function esGameLog(B, pit, title){
  if(!B.length) return "";
  const line = b => pit && b.ip!=null
    ? `${esIPfmt(b.ip)}回 ${b.er!=null?b.er:"-"}自責 ${b.k!=null?b.k:"-"}K${b.dec?`<b class="es-dec ${esDecCls(b.dec)}">${b.dec}</b>`:""}`
    : b.ab!=null ? `${b.ab}打数${b.h||0}安打${b.hr?` <b>${b.hr}本</b>`:""}${b.d3?` 三塁打${b.d3>1?b.d3:""}`:""}${b.d2?` 二塁打${b.d2>1?b.d2:""}`:""}${b.rbi?` ${b.rbi}打点`:""}${b.bb?` ${b.bb}四死球`:""}${b.sb?` ${b.sb}盗塁`:""}` : "出場";
  return `<details class="es-glog"><summary>${escHtml(title)}（${B.length}試合）</summary>
    <ul>${B.map(b=>{ const gm=ES.gameByNo[b.no]; return `<li><span class="es-glog-g">${escHtml(`${gm.year} ${gm.taikai.replace(/^(夏の|秋の|春の)/,"")} ${gm.round}`)}<small>vs ${escHtml(gm.opp)}</small></span><span class="es-glog-s">${esIsMvp(b, pit && b.ip!=null ? "pit" : "bat")?`<span class="es-mvp-b sm">MVP</span>`:""}${line(b)}</span></li>`; }).join("")}</ul></details>`;
}
/* 選手カード。l=スタメンの行（年度タブから開いたとき）、g=卒業生 */
/* ---------- 卒業時の能力（パワプロ風） ---------- */
/* ランク：S 90〜／A 80〜／B 70〜／C 60〜／D 50〜／E 40〜／F 20〜／G 1〜 */
function esRankOf(v){ return v>=90?"S":v>=80?"A":v>=70?"B":v>=60?"C":v>=50?"D":v>=40?"E":v>=20?"F":"G"; }
const esSplitList = t => String(t||"").split(/[、,，・\/／\s]+/).map(x=>x.trim()).filter(Boolean);
/* 変化球の方向（右投げ基準）：up=ストレート系 L=シュート DL=シンカー D=フォーク DR=カーブ R=スライダー */
function esPitchDir(n){
  if(/ナックルカーブ|Dスライダー|スラーブ|カーブ|ドロップ/.test(n)) return "DR";
  if(/Vスライダー|フォーク|SFF|スプリット|チェンジアップ|パーム|ナックル/.test(n)) return /サークル/.test(n) ? "DL" : "D";
  if(/スライダー|カット|スラッター/.test(n)) return "R";
  if(/シュート/.test(n)) return "L";
  if(/シンカー|スクリュー|サークル/.test(n)) return "DL";
  return "UP";   // ツーシーム・ムービング・ジャイロ・超スローなど（第2ストレート）
}
function esPitchChart(P, lefty){
  const dirs={ L:[], DL:[], D:[], DR:[], R:[], UP:[] };
  P.forEach(p=>{ let d=p.dir||esPitchDir(p.name); if(lefty) d={L:"R",R:"L",DL:"DR",DR:"DL"}[d]||d; dirs[d].push(p); });
  const cx=160, cy=42, cell=11, gap=2, r0=14;
  const vec={ L:[-1,0], R:[1,0], D:[0,1], DL:[-0.7071,0.7071], DR:[0.7071,0.7071] };
  let svg="";
  Object.keys(vec).forEach(d=>{
    const [vx,vy]=vec[d], L=dirs[d], lv=Math.max(0,...L.map(p=>p.lv)), ang=Math.atan2(vy,vx)*180/Math.PI;
    for(let i=0;i<7;i++){
      const t=r0+i*(cell+gap)+cell/2, x=cx+vx*t, y=cy+vy*t;
      const on=i<lv, col= on ? (i>=5?"#e8343f":i>=3?"#f0602a":"#f59b16") : "#5c9ef0";
      svg+=`<rect x="${(x-cell/2).toFixed(1)}" y="${(y-5).toFixed(1)}" width="${cell}" height="10" rx="2" fill="${col}" stroke="${on?"#b8371b":"#2a64c8"}" stroke-width="1" transform="rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    if(L.length){
      /* 横の腕は先端の上、斜め・下は先端の外側に名前 */
      const horiz=Math.abs(vy)<0.1, t=r0+7*(cell+gap)+(horiz?-4:0); let x=cx+vx*t; const y=cy+vy*t+(horiz?-10:16);
      const anchor = horiz ? (vx<0?"start":"end") : "middle";
      /* 斜め・下は先端の下に中央ぞろえ。長い名前でも枠からはみ出さないように寄せる */
      if(!horiz){ const hw=L.map(p=>p.name).join("・").length*5.6+2; x=Math.max(hw, Math.min(320-hw, x)); }
      svg+=`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="es-pc-t">${escHtml(L.map(p=>p.name).join("・"))}</text>`;
    }
  });
  const up=dirs.UP.map(p=>p.name);
  svg+=`<path d="M${cx-6} ${cy-14} L${cx} ${cy-22} L${cx+6} ${cy-14} Z" fill="#f08a24"/><text x="${cx}" y="${cy-27}" text-anchor="middle" class="es-pc-t">ストレート${up.length?"・"+escHtml(up.join("・")):""}</text>`;
  svg+=`<circle cx="${cx}" cy="${cy}" r="9" fill="#fff" stroke="#4a8fe0" stroke-width="2"/>`;
  return `<svg class="es-pc" viewBox="0 0 320 182" role="img" aria-label="変化球">${svg}</svg>`;
}
function esParseAbil(o){
  /* 守備力は位置ごと（投〜外）、変化球は方向ごとの列 */
  const def={}; ["投","捕","一","二","三","遊","外"].forEach(p=>{ const v=esInt(F(o,p)); if(v!=null) def[p]=v; });
  const pitches=[]; const st2=F(o,"第2ストレート"); if(st2) pitches.push({dir:"UP", name:st2, lv:0});
  /* 変化球：系統ごとに「球種」と「変化量」の2列（例：カーブ系＝Dスライダー、カーブ変化量＝2） */
  [["スライダー","R"],["カーブ","DR"],["フォーク","D"],["シンカー","DL"],["シュート","L"]].forEach(([k,dir])=>{
    const nm=F(o,k+"系"), lv=esInt(F(o,k+"変化量"));
    if(nm || lv) pitches.push({dir, name:nm||k, lv:lv||1});
  });
  return { apt:F(o,"適性"), def,
    traj:esInt(F(o,"弾道")), meet:esInt(F(o,"ミート")), pow:esInt(F(o,"パワー")), run:esInt(F(o,"走力")),
    arm:esInt(F(o,"肩力")), catch_:esInt(F(o,"捕球")),
    velo:esInt(F(o,"球速")), ctl:esInt(F(o,"コントロール")), sta:esInt(F(o,"スタミナ")),
    pitches, skillsF:F(o,"野手特能")||F(o,"特能"), skillsP:F(o,"投手特能"),
    skills:[F(o,"野手特能")||F(o,"特能"), F(o,"投手特能")].filter(Boolean).join("、"),
    /* ランク特能は A〜G。それ以外の文字（例：チャンスの列に「勝負師」）は金特として「★勝負師」で持つ */
    rk:Object.fromEntries(ES_RANK_SK.map(k=>{ const v=esHalf(F(o,k)).trim();
      return [k, /^[A-Ga-g]$/.test(v) ? v.toUpperCase() : v ? "★"+v.replace(/^[★☆]/,"") : ""]; }).filter(([,v])=>v)) };
}
/* ランクで記録する特能（能力シートの列名） */
const ES_RANK_P = ["対ピンチ","対左打者","打たれ強さ","ケガしにくさ","ノビ","クイック","回復"];
const ES_RANK_F = ["チャンス","対左投手","キャッチャー","ケガしにくさ","盗塁","走塁","送球","回復"];
const ES_RANK_SK = [...new Set([...ES_RANK_F, ...ES_RANK_P])];
/* 「特能」セルの赤特（よくあるもの）。ここにない赤特は先頭に▼か末尾に×を付ければ赤になる */
const ES_RED_SK = /^(四球|寸前|一発|乱調|負け運|軽い球|短気|抜け球|シュート回転|スロースターター|調子極端|三振|併殺|エラー|扇風機|チャンス×|ムード×|ケガしやすい|鈍足|速球中心|変化球中心|調子不安定|ムラッ気|ノミの心臓|ランナー×|送球×|守備職人×|対ストレート×|対変化球×|初球×|三振男|悪球打ち|退場癖|拙攻|打球反応×|ピンチ×|内角×|外角×|チキン)$/;
/* ランク特能の色：A・Bは青特、C〜Eはふつう、F・Gは赤特、文字なら金特 */
const esRankCls = r => /^★/.test(r) ? "gold" : /^[AB]$/.test(r) ? "blue" : /^[FG]$/.test(r) ? "red" : "";
function esRankGrid(g, keys){
  const L=keys.filter(k=>g.rk && g.rk[k]); if(!L.length) return "";
  return `<div class="es-rks">${L.map(k=>`<div class="es-rkc"><span>${k}</span><b class="rkt-${g.rk[k]}">${g.rk[k]}</b></div>`).join("")}</div>`;
}
/* 特能チップ：★付き＝金、赤特＝赤、末尾のランク／記号で色分け（A・B・◎・◯＝青、C・D＝灰、E〜G・×＝赤） */
function esSkillChips(list, base){
  return esSplitList(list).map(x=>{
    let cls=base; if(/^[★☆]/.test(x)){ x=x.slice(1); cls="gold"; } else if(ES_RED_SK.test(x)) cls="red";
    const m=x.match(/^(.*?)([A-GＡ-Ｇ◎◯○〇×✕])$/); let nm=x, rk="";
    if(m){ nm=m[1]; rk=m[2].replace(/[Ａ-Ｇ]/,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
      if(cls!=="gold") cls = /[AB◎◯○〇]/.test(rk) ? "blue" : /[CD]/.test(rk) ? "plain" : "red"; }
    return `<span class="es-sk ${cls}">${escHtml(nm)}${rk?`<b class="es-sk-r rk-${/[A-G]/.test(rk)?rk:"x"}">${escHtml(rk)}</b>`:""}</span>`;
  }).join("");
}
/* ---------- 選手カード（パワプロの選手画面風）：成績・能力・守備・プロフィール ---------- */
function esPwNum(g){   // スタメン表から背番号（最後の時期のもの）
  const L=ES.lineup.filter(l=>l.num && esFindGrad(l)===g).sort((a,b)=>a.year-b.year||(a.season==="夏"?0:1)-(b.season==="夏"?0:1));
  return L.length ? L[L.length-1].num : "";
}
const ES_ABIL_KEYS=["apt","def","traj","meet","pow","run","arm","fld","catch_","velo","ctl","sta","pitches","skills","skillsF","skillsP","rk"];
const esPwRk = (r, sm) => `<b class="pw2-rk rk-${r}${sm?" sm":""}">${r}</b>`;
/* 能力タブの中身。prev があれば入学時からの伸びを小さく出す */
function esAbilityParts(g, prev){
  const dif=k=> (prev && prev[k]!=null && g[k]!=null && g[k]!==prev[k]) ? `<small class="${g[k]>prev[k]?"up":"dn"}">${g[k]>prev[k]?"+":""}${g[k]-prev[k]}</small>` : "";
  const row=(lbl,k)=>{ const v=g[k]; if(v==null) return ""; return `<div class="pw2-row"><span class="pw2-lbl">${lbl}</span>${esPwRk(esRankOf(v))}<span class="pw2-v">${v}${dif(k)}</span></div>`; };
  /* 野手の初期値（球速120・コントロール1・スタミナ1で変化球なし）は投手能力として出さない */
  const pitDefault = g.pos!=="投" && !g.apt && (g.ctl||0)<=1 && (g.sta||0)<=1 && !(g.pitches&&g.pitches.length) && !g.skillsP;
  const hasP = !pitDefault && (g.velo!=null || g.ctl!=null || g.sta!=null || (g.pitches&&g.pitches.length) || ["対ピンチ","対左打者","打たれ強さ","ノビ","クイック"].some(k=>g.rk&&g.rk[k]) || !!g.skillsP);
  const hasF = [g.traj,g.meet,g.pow,g.run,g.arm,g.fld,g.catch_].some(v=>v!=null) || ["チャンス","対左投手","キャッチャー","盗塁","走塁","送球"].some(k=>g.rk&&g.rk[k]) || !!g.skillsF;
  const hasD = g.def && Object.keys(g.def).length;
  const mainP = /^[左中右]$/.test(g.pos) ? "外" : g.pos;
  /* 特能欄：ランク特能＋「特能」セル。空きマスで4の倍数（スマホは2の倍数）にそろえる */
  const grid=(keys, list)=>{
    /* 固定の項目は空欄でも項目名だけ出す（並びも固定）。null は空きマス */
    const cells=keys.map(k=>{ if(k==null) return `<div class="pw2-sk empty gap"></div>`; const r=(g.rk&&g.rk[k])||"";
      if(/^★/.test(r)) return `<div class="pw2-sk gold" title="${k}"><span>${escHtml(r.slice(1))}</span></div>`;
      return `<div class="pw2-sk ${esRankCls(r)}"><span>${k}</span><b class="pw2-skr${r?"":" none"}">${r||"-"}</b></div>`; });
    esSplitList(list).forEach(x=>{
      let cls="blue"; if(/^[★☆]/.test(x)){ x=x.slice(1); cls="gold"; } else if(/^[▼▽]/.test(x)){ x=x.slice(1); cls="red"; } else if(ES_RED_SK.test(x)) cls="red";
      const m=x.match(/^(.*?)([A-GＡ-Ｇ◎◯○〇×✕])$/); let nm=x, rk="";
      if(m && m[1]){ nm=m[1]; rk=m[2]; if(cls==="blue") cls=/[ABＡＢ◎◯○〇]/.test(rk)?"blue":/[CDEＣＤＥ]/.test(rk)?"":"red"; }
      cells.push(`<div class="pw2-sk ${cls}"><span>${escHtml(nm)}</span>${rk?`<b class="pw2-skr">${escHtml(rk)}</b>`:""}</div>`);
    });
    while(cells.length<8 || cells.length%2) cells.push(`<div class="pw2-sk empty"></div>`);
    while(cells.length%4) cells.push(`<div class="pw2-sk empty pad4"></div>`);  // PC（4列）用の穴埋め。スマホでは出さない
    return `<div class="pw2-sks">${cells.join("")}</div>`;
  };
  const out={};
  if(hasP) out.p=`<div class="pw2-cols"><div class="pw2-left">
      ${g.velo!=null?`<div class="pw2-row"><span class="pw2-lbl">球速</span><span class="pw2-v velo">${g.velo}<em>km/h</em>${dif("velo")}</span></div>`:""}
      ${row("コントロール","ctl")}${row("スタミナ","sta")}
      ${g.pitches&&g.pitches.length?`<div class="pw2-pc">${esPitchChart(g.pitches, g.th==="左")}</div>`:""}
    </div><div class="pw2-right">${grid(["対ピンチ","対左打者","打たれ強さ","ケガしにくさ","ノビ","クイック",null,"回復"], g.skillsP)}</div></div>`;
  if(hasF) out.f=`<div class="pw2-cols"><div class="pw2-left">
      ${g.traj!=null?`<div class="pw2-row"><span class="pw2-lbl">弾道</span><svg class="pw2-traj traj-${g.traj}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 L23 12 H16.5 V23 H7.5 V12 H1 Z" transform="rotate(${[0,60,40,20,0][g.traj]||0} 12 12)"/></svg><span class="pw2-v">${g.traj}${dif("traj")}</span></div>`:""}
      ${row("ミート","meet")}${row("パワー","pow")}${row("走力","run")}${row("肩力","arm")}${row("守備力","fld")}${row("捕球","catch_")}
    </div><div class="pw2-right">${grid(ES_RANK_F, g.skillsF)}</div></div>`;
  if(hasD) out.d=`<div class="pw2-left pw2-full"><div class="pw2-row pw2-defrow"><span class="pw2-lbl">守備力</span><div class="pw2-defs">
      ${(()=>{ const top=Math.max(...Object.values(g.def).filter(v=>v!=null));
        return ["投","捕","一","二","三","遊","外"].map(p=>{ const v=g.def[p];
        /* 一番高い守備力より低い位置は薄く */
        return `<div class="pw2-def ${esPosCls(p)}${p===mainP?" main":""}${v==null?" none":v<top?" low":""}"><span class="pw2-dp">${p}</span>${v!=null?`${esPwRk(esRankOf(v),1)}<i>${v}</i>`:`<i>--</i>`}</div>`; }).join(""); })()}
    </div></div></div>`;
  return out;
}
/* 入学時／卒業時の切り替え（同じカードの中の能力タブがまとめて切り替わる） */
document.addEventListener("click", e=>{
  const b=e.target.closest(".es-abseg-b"); if(!b) return;
  const card=b.closest(".pw2"); if(!card) return;
  card.querySelectorAll(".es-abseg-b").forEach(x=>x.classList.toggle("active", x.dataset.w===b.dataset.w));
  card.querySelectorAll(".es-abview").forEach(v=>v.hidden = v.dataset.w!==b.dataset.w);
});
/* タブの切り替え（枠の色もタブに合わせる） */
document.addEventListener("click", e=>{
  const b=e.target.closest(".pw2-tab"); if(!b) return;
  const card=b.closest(".pw2"); if(!card) return;
  card.dataset.tab=b.dataset.t;
  card.querySelectorAll(":scope > .pw2-tabs .pw2-tab").forEach(x=>x.classList.toggle("active", x===b));
  card.querySelectorAll(".pw2-pane").forEach(p=>p.hidden = p.dataset.t!==b.dataset.t);
});
/* 誕生日を「2008年6月9日」の形に */
function esBirthFmt(v){
  const m=String(v||"").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${+m[1]}年${+m[2]}月${+m[3]}日` : (v||"");
}
function esPlayerCard(l, g){
  const id=esIdent(l||{}, g); const B=id.name?esBoxOf(id):[];
  const all=esAgg(B);
  const pit = l ? (l.pos==="投" && all.pit) : (g ? (g.pos==="投" && all.pit) || (!all.bat && all.pit) : all.pit && !all.bat);
  const pos = (g && g.pos) || (l && l.pos) || "";
  const name = g ? g.name : (l ? l.name : "");

  /* --- 成績 --- */
  let st="";
  if(l){
    const cur=B.filter(b=>{ const gm=ES.gameByNo[b.no]; return gm.year===l.year && gm.season===l.season; });
    if(cur.length){
      st+=`<div class="es-car-sub">${l.year}年度 ${l.season==="夏"?"夏":"秋・春"}の成績</div>${esAggCells(esAgg(cur), pit)}`;
      st+=esGameLog(cur, pit, "この時期の試合ごとの成績");
    } else st+=`<p class="es-car-note">この時期の試合ごとの記録はまだありません。</p>`;
  }
  if(B.length){
    st+=`<div class="es-car-sub">通算（記録した試合）</div>${esAggCells(all, pit)}`;
    if(all.pit && all.bat) st+=esAggCells(all, !pit);
    st+=esPeriodTable(B, pit, l?esSeasonKey(l):null);
    st+=esRankTable(B, pit);
    if(!l) st+=esGameLog(B, pit, "試合ごとの成績");
  }
  if(!st) st=`<p class="es-car-note">まだ試合の記録がありません。</p>`;

  /* --- 能力（入学時／卒業時） --- */
  const A=(g&&g.ab)||{}, ws=["入学時","卒業時"].filter(w=>A[w]);
  const base=g?{...g}:{}; ES_ABIL_KEYS.forEach(k=>delete base[k]);
  const views = ws.map(w=>[w, esAbilityParts({...base, ...A[w]}, w==="卒業時"?A["入学時"]:null)]);
  const cur = ws[ws.length-1];
  const wl = w => (w==="入学時" && g && g.transfer) ? "転校時" : w;   // 転校生は「入学時」を「転校時」と表示
  const seg = ws.length>1 ? `<div class="es-abseg">${ws.map(w=>`<button type="button" class="es-abseg-b${w===cur?" active":""}" data-w="${w}">${wl(w)}</button>`).join("")}</div>`
            : (cur ? `<div class="es-abseg one"><span>${wl(cur)}</span></div>` : "");
  const abPane = k => { const vs=views.filter(([,o])=>o[k]); if(!vs.length) return "";
    return seg + vs.map(([w,o])=>`<div class="es-abview" data-w="${w}"${w===cur?"":" hidden"}>${o[k]}</div>`).join(""); };

  /* --- プロフィール --- */
  const pro = g ? (g.team ? `${g.team}${g.rank?` ${g.rank}位`:""}` : g.course) : "";
  const prof = g ? [["氏名", escHtml(g.name)], ["よびかた", escHtml(g.kana)], ["誕生日", escHtml(esBirthFmt(g.birth))], ["出身", escHtml(g.from)], ["性格", (()=>{ const c0=A["入学時"]&&A["入学時"].chara, c1=A["卒業時"]&&A["卒業時"].chara;
      return c0&&c1&&c0!==c1 ? `${escHtml(c0)}<small class="pw2-arrow">→</small>${escHtml(c1)}` : escHtml(c1||c0||g.chara); })()],
    ["スカウト", [g.scout?"スカウト":"", g.tensei?"転生":"", g.transfer?"転校生":""].filter(Boolean).join("・")], ["進路", escHtml(pro)]].filter(([,v])=>v) : [];

  /* --- 上段（ゲームの選手画面の上の部分） --- */
  const num = (l && l.num) || (g ? esPwNum(g) : "");
  const apt = (A["卒業時"]||A["入学時"]||{}).apt;
  const handOf = o => o && (o.th||o.bt) ? `${o.th?escHtml(o.th)+"投":""}${o.bt?escHtml(o.bt==="両"?"両打":o.bt+"打"):""}` : "";
  /* 投打も入学時／卒業時の切り替えに合わせる */
  const hands = ws.map(w=>[w, handOf({...base, th:g.th, bt:g.bt, ...A[w]})]);
  const hand = hands.length>1 && hands[0][1]!==hands[1][1]
    ? hands.map(([w,h])=>`<span class="es-abview" data-w="${w}"${w===cur?"":" hidden"}>${h||"-"}</span>`).join("")
    : (hands.length ? hands[hands.length-1][1] : handOf(g));
  const star = g ? (g.star!=null ? g.star : g.star0) : null;
  const sur = String(name).split(/[\s　]+/)[0];
  const isPit = pos==="投";
  const stat = isPit
    ? `防${all.pit?esF(all.era,v=>v.toFixed(2)):"----"}　${all.pit?all.w:"--"}勝${all.pit?all.l:"--"}敗　${all.pit?all.hd:"--"}H　${all.pit?all.sv:"--"}S`
    : `率${all.bat?esF(all.avg,esAvgFmt):"----"}　${all.bat?all.hr:"--"}本　${all.bat?all.rbi:"--"}点　${all.bat?all.sb:"--"}盗`;
  /* 上段：左右の行の高さをそろえるため、4つの箱を2列のグリッドに並べる */
  const head=`<div class="pw2-head">
      <div class="pw2-hname">
        <div class="pw2-plate ${esPosCls(pos)}">${escHtml(sur)}</div>
        <div class="pw2-nobox">${num?`<span class="pw2-no">${escHtml(num)}</span>`:""}${star!=null?`<span class="pw2-star">★${star}</span>`:""}</div>
      </div>
      <div class="pw2-hbox h-stat"><span class="pw2-lbl">成績</span><b class="stat">${stat}</b></div>
      <div class="pw2-hbox h-pos"><span class="pw2-lbl">${isPit?"適性":"守備位置"}</span><b>${escHtml(isPit?(apt||"-"):(pos||"-"))}</b></div>
      <div class="pw2-hbox h-hand"><span class="pw2-lbl">投打</span><b>${hand||"-"}</b></div>
    </div>`;

  const tabs=[["s","選手成績", `<div class="pw2-stats">${st}</div>`]];
  const pP=abPane("p"), pF=abPane("f"), pD=abPane("d");
  if(pP) tabs.push(["p","投手能力", pP]);
  if(pF) tabs.push(["f","野手能力", pF]);
  if(pD) tabs.push(["d","守備・起用", pD]);
  if(prof.length) tabs.push(["i","プロフィール", `<div class="pw2-left pw2-full pw2-prof">${prof.map(([k,v])=>`<div class="pw2-row"><span class="pw2-lbl">${k}</span><b class="pw2-pv">${v}</b></div>`).join("")}</div>`]);
  const first = (l || B.length) ? "s" : (pP && isPit ? "p" : pF ? "f" : tabs[0][0]);
  return `<div class="pw2" data-tab="${first}">
    <div class="pw2-tabs">${tabs.map(([k,t])=>`<button type="button" class="pw2-tab t-${k}${k===first?" active":""}" data-t="${k}">${t}</button>`).join("")}</div>
    <div class="pw2-panel">
      ${head}
      ${tabs.map(([k,,h])=>`<div class="pw2-pane" data-t="${k}"${k===first?"":" hidden"}>${h}</div>`).join("")}
    </div>
  </div>`;
}
/* 試合のボックススコア（その試合の自校の選手成績） */
function esBoxScore(no){
  const B=ES.box.filter(b=>b.no===no); if(!B.length) return "";
  /* その試合の時期のスタメン表から、打順・守備・背番号を引く（打順が数字＝スタメン、補欠＝途中出場） */
  const gm=ES.gameByNo[no];
  const L=gm ? ES.lineup.filter(l=>l.year===gm.year && l.season===gm.season) : [];
  const luOf=b=>L.find(l=>esSameName(l.name,b.name)) || null;
  const isBat=l=>l && /^\d+$/.test(l.order);
  const tag=(b,l,sub,role)=>`<span class="es-bx-pl">${l&&l.pos?`<span class="es-pos sm ${esPosCls(l.pos,role)}">${escHtml(l.pos)}</span>`:""}<span class="es-bx-nm">${escHtml(b.name)}</span>${l&&(l.grade||l.num)?`<small>${[l.grade?escHtml(l.grade)+"年":"", l.num?escHtml(esCircled(l.num)):""].filter(Boolean).join(" ")}</small>`:""}${sub?`<em class="es-bx-sub">途中</em>`:""}</span>`;

  const bat=B.filter(b=>b.ab!=null).map((b,i)=>({b, l:luOf(b), i}));
  bat.sort((x,y)=>(isBat(x.l)?+x.l.order:100+x.i)-(isBat(y.l)?+y.l.order:100+y.i));
  /* 投手：先発（スタメンの投手）を先頭に、あとは入力順 */
  const pit=B.filter(b=>b.ip!=null).map((b,i)=>({b, l:luOf(b), i}));
  const sp=esStarterOf(no), spIdx=Math.max(0, pit.findIndex(x=>x.b===sp));
  pit.forEach((x,i)=>x.k = i===spIdx ? -1 : x.i);
  pit.sort((x,y)=>x.k-y.k);

  const T=esAgg(bat.map(x=>x.b));
  /* [見出し, 項目, 0でも表示するか] */
  const BC=[["打数","ab",1],["得点","r"],["安打","h",1],["二","d2"],["三","d3"],["本","hr"],["打点","rbi"],["三振","so"],["四死","bb"],["犠打","sh"],["盗塁","sb"],["併殺","dp"],["失策","e"]];
  const PC=[["回","ip",1],["球数","np",1],["打者","bf",1],["安打","ha",1],["本","hra"],["三振","k",1],["四死","pbb"],["失点","pr",1],["自責","er",1],["暴投","wp"]];
  return `<div class="es-box">
    ${bat.length?`<div class="es-st-wrap"><table class="es-box-tbl"><thead><tr><th class="es-bx-no">打順</th><th>打撃</th>${BC.map(c=>`<th>${c[0]}</th>`).join("")}</tr></thead>
      <tbody>${bat.map(({b,l})=>{ const st=isBat(l), sub=!st && !(l && l.order==="投"); return `<tr class="${sub?"sub":""}"><td class="es-bx-no">${st?escHtml(l.order):sub?"途中":""}</td><th>${tag(b,l,false, st||(l&&l.order==="投")?"":"rp")}</th>${BC.map(c=>`<td>${c[2]?esF(b[c[1]]):(b[c[1]]||"")}</td>`).join("")}</tr>`; }).join("")}
      <tr class="tot"><td class="es-bx-no"></td><th>計</th>${BC.map(c=>`<td>${c[2]?T[c[1]]:(T[c[1]]||"")}</td>`).join("")}</tr></tbody></table></div>`:""}
    ${pit.length?`<div class="es-st-wrap"><table class="es-box-tbl"><thead><tr><th class="es-bx-no"></th><th>投手</th>${PC.map(c=>`<th>${c[0]}</th>`).join("")}<th></th></tr></thead>
      <tbody>${pit.map(({b,l},i)=>`<tr class="${i?"sub":""}"><td class="es-bx-no">${i?"":"先発"}</td><th>${tag(b,l,false,i?"rp":"")}</th>${PC.map(c=>`<td>${c[1]==="ip"?esIPfmt(b.ip):c[2]?esF(b[c[1]]):(b[c[1]]||"")}</td>`).join("")}<td>${b.dec?`<b class="es-dec ${esDecCls(b.dec)}">${b.dec}</b>`:""}</td></tr>`).join("")}</tbody></table></div>`:""}
  </div>`;
}
function esLuRow(l, starter){
  const g=esFindGrad(l);
  return `<details class="es-lu-row${starter?"":" bench"}">
    <summary>
      <span class="es-lu-no">${starter?escHtml(l.order==="投"?"先":l.order):"控"}</span>
      <span class="es-pos ${esPosCls(l.pos, starter?"":"rp")}">${escHtml(l.pos)}</span>
      <span class="es-lu-main"><span class="es-lu-name">${escHtml(g?g.name:l.name)}${g?esTags(g):""}</span><span class="es-lu-meta">${[l.grade?escHtml(l.grade)+"年":"", l.num?escHtml(esCircled(l.num)):""].filter(Boolean).join(" ")}</span></span>
      <span class="es-lu-chev" aria-hidden="true"></span>
    </summary>
    ${esPlayerCard(l, g)}
  </details>`;
}
function esRenderLineup(){
  const L=ES.lineup.filter(l=>l.year===ES.sel && l.season===ES.lineupSeason);
  /* 指名打者（DH）制：先発投手は打順「投」で入力 → 9番の後ろに並べる */
  const isSt=l=>/^\d+$/.test(l.order)||l.order==="投", ord=l=>l.order==="投"?99:+l.order;
  const starters=L.filter(isSt).sort((a,b)=>ord(a)-ord(b)), bench=L.filter(l=>!isSt(l));
  document.getElementById("es-lu").innerHTML=`
    <div class="es-lu">${starters.map(l=>esLuRow(l,true)).join("")}</div>
    ${bench.length?`<div class="es-bench-lbl">控え</div><div class="es-lu">${bench.map(l=>esLuRow(l,false)).join("")}</div>`:""}
    <p class="kk-note-s">選手をタップすると、この時期の成績・試合ごとの成績・時期ごとの成績が見られます。</p>`;
}

/* ---------- ベスト9 ---------- */
function esRenderB9Tabs(){
  const tabs=[["star","★"],["stats","成績"],["team","球団別"],["amateur","プロ以外"]];
  document.getElementById("es-b9-tabs").innerHTML=tabs.map(([k,t])=>`<button type="button" class="day-tab${k===ES.b9?" active":""}" data-k="${k}">${t}</button>`).join("");
  document.querySelectorAll("#es-b9-tabs .day-tab").forEach(b=>b.onclick=()=>{
    ES.b9=b.dataset.k;
    document.querySelectorAll("#es-b9-tabs .day-tab").forEach(x=>x.classList.toggle("active", x===b));
    esRenderB9();
  });
  const teams=[...new Set(ES.grads.filter(g=>g.team).map(g=>g.team))]
    .sort((a,b)=>ES.grads.filter(g=>g.team===b).length-ES.grads.filter(g=>g.team===a).length);
  ES.team=teams[0]||"";
  const sel=document.getElementById("es-team-sel");
  sel.innerHTML=teams.map(t=>`<option value="${escHtml(t)}">${escHtml(t)}（${ES.grads.filter(g=>g.team===t).length}人）</option>`).join("");
  sel.onchange=()=>{ ES.team=sel.value; esRenderB9(); };
}
function esPick(pool, key, asc){
  const used=new Set();
  return ES_B9_SLOTS.map(p=>{
    const c=pool.filter(g=>g.pos===p && !used.has(g) && key(g)!=null).sort((a,b)=>asc?key(a)-key(b):key(b)-key(a))[0];
    if(c) used.add(c); return {p, g:c||null};
  });
}
function esRenderB9(){
  document.getElementById("es-b9-team").hidden = ES.b9!=="team";
  let picks, note="", val;
  if(ES.b9==="stats"){
    const bat=esPick(ES.grads.filter(g=>g.pos!=="投"), g=>g.batScore);
    const pit=ES.grads.filter(g=>g.pos==="投" && g.pitQual).sort((a,b)=>a.era-b.era)[0]||null;
    picks=bat.map(x=>x.p==="投"?{p:"投", g:pit}:x);
    val=(x)=> x.p==="投" ? `<b>${x.g.era.toFixed(2)}</b><small>防御率</small>`
      : `<b>${esAvgFmt(x.g.avg)}</b><small>${x.g.hr||0}本 ${x.g.rbi||0}点 ${x.g.sb||0}盗</small>`;
    note=`打者は「打率×100＋本塁打×3＋打点＋盗塁」の点数で守備ごとに1位（${ES_BAT_MIN}打席以上）。投手は防御率1位（投球回${ES_PIT_IP_MIN}以上、投球回が空欄なら登板10以上）。`;
  } else {
    const pool = ES.b9==="team" ? ES.grads.filter(g=>g.team===ES.team)
               : ES.b9==="amateur" ? ES.grads.filter(g=>!g.pro) : ES.grads;
    picks=esPick(pool, g=>g.star);
    val=x=>`<b>${x.g.star}</b><small>★</small>`;
    note = ES.b9==="team" ? "その球団に進んだ卒業生の中で、卒業時の★が一番高い選手（守備は卒業時）。"
         : ES.b9==="amateur" ? "プロ野球選手にならなかった卒業生の中で、卒業時の★が一番高い選手（守備は卒業時）。"
         : "卒業時の★が一番高い選手（守備は卒業時）。";
  }
  /* 1人もいないときは「該当なし」を9行並べず、ひとことだけ */
  if(!picks.some(x=>x.g)){
    document.getElementById("es-b9").innerHTML=errBox(ES.b9==="stats" ? "まだ規定の試合数・投球回に届いた選手がいません。" : "まだ卒業時の★が入った卒業生がいません。");
    document.getElementById("es-b9-note").textContent=note; return;
  }
  document.getElementById("es-b9").innerHTML=`<div class="es-b9">${picks.map(x=>{
    const inner=`
      <span class="es-pos lg ${esPosCls(x.p)}">${x.p}</span>
      <span class="es-b9-main">${x.g?`<span class="es-b9-name">${escHtml(x.g.name)}${esTags(x.g)}</span>
        <span class="es-b9-meta">${escHtml(esGradMeta(x.g))}</span>`:`<span class="es-b9-meta">該当なし</span>`}</span>
      <span class="es-b9-val">${x.g?val(x):""}</span>`;
    return x.g ? esPl("es-b9-row", inner, x.g) : `<div class="es-b9-row empty">${inner}</div>`;
  }).join("")}</div>`;
  document.getElementById("es-b9-note").textContent=note+" 選手をタップすると年度ごとの成績と通算が見られます。";
}
/* 選手の行をタップで開けるようにする（中身は卒業生カード） */
function esPl(cls, inner, g){
  return `<details class="es-pl"><summary class="${cls}">${inner}</summary>${esPlayerCard(null, g)}</details>`;
}
function esTags(g){ return (g.tensei?`<span class="es-tag t">転生</span>`:"") + (g.transfer?`<span class="es-tag tr">転校生</span>`:"") + (g.scout?`<span class="es-tag">スカウト</span>`:""); }
/* ---------- 選手名鑑：入学年度ごとに全選手（在学中も）。タップで成績と能力カード ---------- */
function esRenderRoster(){
  const sel=document.getElementById("es-roster-sel"), box=document.getElementById("es-roster"); if(!sel||!box) return;
  const years=[...new Set(ES.grads.map(g=>g.year).filter(y=>y!=null))].sort((a,b)=>b-a);
  if(!years.length){ box.innerHTML=errBox("まだ卒業生シートに選手がいません。"); sel.parentElement.hidden=true; return; }
  if(!years.includes(ES.rosterYear)) ES.rosterYear=years[0];
  sel.innerHTML=years.map(y=>`<option value="${y}"${y===ES.rosterYear?" selected":""}>${y}年度入学（${ES.grads.filter(g=>g.year===y).length}人）</option>`).join("");
  const posOrd=p=>"投捕一二三遊左中右外".indexOf(p);
  const draw=()=>{
    const L=ES.grads.filter(g=>g.year===ES.rosterYear).sort((a,b)=>posOrd(a.pos)-posOrd(b.pos)||(b.star||b.star0||0)-(a.star||a.star0||0));
    box.innerHTML=`<div class="mlist">${L.map(g=>esPl("gm-row", `
      <div class="gm-pos"><span class="es-pos ${esPosCls(g.pos)}">${escHtml(g.pos||"-")}</span></div>
      <div class="gm-main">
        <div class="gm-title">${escHtml(g.name)}${esTags(g)}${g.ab?`<span class="es-tag ab">能力</span>`:""}</div>
        <div class="gm-meta">${escHtml([g.from, g.team?`${g.team}${g.rank?` ${g.rank}位`:""}`:g.course].filter(Boolean).join("・"))}</div>
      </div>
      <div class="gm-score es-val">★${g.star!=null?g.star:(g.star0!=null?g.star0:"-")}</div>`, g)).join("")}</div>
      <p class="kk-note-s">選手をタップすると成績と能力（入学時／卒業時）が見られます。</p>
      ${ES.abilLoaded?"":`<p class="kk-note-s" style="color:#d9453f">※「能力」シートを読み込めていません（ウェブ公開の設定を確認してください。公開してから反映まで数分かかることがあります）。</p>`}`;
  };
  sel.onchange=()=>{ ES.rosterYear=+sel.value; draw(); };
  draw();
}
function esGradMeta(g){
  const pro = g.team ? `${g.team}${g.rank?` ${g.rank}位`:""}` : g.course;
  return [g.year?`${g.year}年度入学`:"", g.from, pro].filter(Boolean).join("・");
}

/* ---------- 歴代ランキング ---------- */

const ES_BAT_NOTE = `${ES_BAT_MIN}打席以上の野手`, ES_PIT_NOTE = `投球回${ES_PIT_IP_MIN}以上（投球回が空欄なら登板10以上）`;
/* 投手の能力ランキングは投手（守備位置が投、または適性が入っている選手）だけ */
const esIsPit = g => g.pos==="投" || !!g.apt;
const esCnt = u => v => `${v}<small>${u}</small>`;
/* g: 総合／打撃／投手 */
const ES_RK=[
  {g:"総合", k:"star", t:"卒業時★", get:g=>g.star, fmt:v=>v},
  {g:"総合", k:"star0",t:"入学時★", get:g=>g.transfer?null:g.star0, fmt:v=>v, note:"新入生として入学した選手だけ（転校生は「転校生★」で別に並べる）"},
  {g:"総合", k:"trans",t:"転校生★", get:g=>g.transfer?g.star0:null, fmt:v=>v, note:"転校してきた時点の★（卒業生シートの入学時★）"},
  {g:"総合", k:"grow", t:"★の伸び", get:g=>g.grow, fmt:v=>`+${v}`},
  {g:"総合", k:"games",t:"出場試合", get:g=>g.games||null, fmt:esCnt("試合")},
  {g:"能力", k:"velo", t:"球速", get:g=>esIsPit(g)&&g.velo||null, fmt:v=>`${v}<small>km/h</small>`},
  {g:"能力", k:"ctl",  t:"コントロール", get:g=>esIsPit(g)&&g.ctl||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"sta",  t:"スタミナ", get:g=>esIsPit(g)&&g.sta||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"meet", t:"ミート", get:g=>g.meet||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"pow",  t:"パワー", get:g=>g.pow||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"run",  t:"走力", get:g=>g.run||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"arm",  t:"肩力", get:g=>g.arm||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"fld",  t:"守備力", get:g=>g.fld||null, fmt:v=>`<span class="es-ab-r rk-${esRankOf(v)} in">${esRankOf(v)}</span>${v}`},
  {g:"能力", k:"gold", t:"金特の数", get:g=>(esSplitList(g.skills).filter(x=>/^[★☆]/.test(x)).length + Object.values(g.rk||{}).filter(v=>/^★/.test(v)).length)||null, fmt:esCnt("個")},
  {g:"打撃", k:"mvpB", t:"打撃MVP", get:g=>g.mvpB||null, fmt:esCnt("回"), note:"試合ごとの打撃MVPに選ばれた回数。打席の中身を得点の価値で数え、チームの得点に絡んだ割合（接戦ほど重く）を足して選ぶ"},
  {g:"打撃", k:"avg",  t:"打率", get:g=>esBatQ(g)?g.avg:null, fmt:esAvgFmt, note:ES_BAT_NOTE},
  {g:"打撃", k:"ops",  t:"OPS", get:g=>esBatQ(g)?g.ops:null, fmt:esAvgFmt, note:ES_BAT_NOTE},
  {g:"打撃", k:"obp",  t:"出塁率", get:g=>esBatQ(g)?g.obp:null, fmt:esAvgFmt, note:ES_BAT_NOTE},
  {g:"打撃", k:"slg",  t:"長打率", get:g=>esBatQ(g)?g.slg:null, fmt:esAvgFmt, note:ES_BAT_NOTE},
  {g:"打撃", k:"h",    t:"安打", get:g=>g.h||null, fmt:esCnt("本")},
  {g:"打撃", k:"hr",   t:"本塁打", get:g=>g.hr||null, fmt:esCnt("本")},
  {g:"打撃", k:"d2",   t:"二塁打", get:g=>g.d2||null, fmt:esCnt("本")},
  {g:"打撃", k:"d3",   t:"三塁打", get:g=>g.d3||null, fmt:esCnt("本")},
  {g:"打撃", k:"rbi",  t:"打点", get:g=>g.rbi||null, fmt:esCnt("点")},
  {g:"打撃", k:"r",    t:"得点", get:g=>g.r||null, fmt:esCnt("点")},
  {g:"打撃", k:"sb",   t:"盗塁", get:g=>g.sb||null, fmt:esCnt("個")},
  {g:"打撃", k:"bbb",  t:"四死球", get:g=>g.bbb||null, fmt:esCnt("個")},
  {g:"打撃", k:"sh",   t:"犠打", get:g=>g.sh||null, fmt:esCnt("個")},
  {g:"投手", k:"mvpP", t:"投手MVP", get:g=>g.mvpP||null, fmt:esCnt("回"), note:"試合ごとの投手MVPに選ばれた回数。平均的な投手と比べて何点防いだかに、奪三振と接戦での勝ち・セーブを足して選ぶ"},
  {g:"投手", k:"era",  t:"防御率", get:g=>g.pitQual?g.era:null, fmt:v=>v.toFixed(2), asc:true, note:ES_PIT_NOTE},
  {g:"投手", k:"whip", t:"WHIP", get:g=>g.pitQual?g.whip:null, fmt:v=>v.toFixed(2), asc:true, note:`1イニングあたりに出した走者（被安打＋与四死球）。${ES_PIT_NOTE}`},
  {g:"投手", k:"k9",   t:"奪三振率", get:g=>g.pitQual?g.k9:null, fmt:v=>v.toFixed(2), note:`9イニングあたりの奪三振。${ES_PIT_NOTE}`},
  {g:"投手", k:"w",    t:"勝利", get:g=>g.w||null, fmt:esCnt("勝")},
  {g:"投手", k:"k",    t:"奪三振", get:g=>g.k||null, fmt:esCnt("個")},
  {g:"投手", k:"ip",   t:"投球回", get:g=>g.ip||null, fmt:v=>esIPfmt(v)},
  {g:"投手", k:"cg",   t:"完投", get:g=>g.cg||null, fmt:esCnt("回")},
  {g:"投手", k:"sho",  t:"完封", get:g=>g.sho||null, fmt:esCnt("回")},
  {g:"投手", k:"nh",   t:"ノーノー", get:g=>g.nh||null, fmt:esCnt("回")},
  {g:"投手", k:"hd",   t:"ホールド", get:g=>g.hd||null, fmt:esCnt("H")},
  {g:"投手", k:"sv",   t:"セーブ", get:g=>g.sv||null, fmt:esCnt("S")},
  {g:"投手", k:"app",  t:"登板", get:g=>g.app||null, fmt:esCnt("試合")}
];
function esRenderRkTabs(){
  const avail=ES_RK.filter(r=>ES.grads.some(g=>r.get(g)!=null));
  if(!avail.some(r=>r.k===ES.rk)) ES.rk=(avail[0]||{}).k;
  const cur=avail.find(r=>r.k===ES.rk), grp=cur?cur.g:"総合";
  const groups=["総合","打撃","投手","能力"].filter(x=>avail.some(r=>r.g===x));
  const box=document.getElementById("es-rk-tabs");
  box.classList.add("es-rk-tabbox");
  box.innerHTML=`<div class="es-rk-grp">${groups.map(x=>`<button type="button" class="es-rk-g${x===grp?" active":""}" data-g="${x}">${x}</button>`).join("")}</div>
    <div class="es-rk-items">${avail.filter(r=>r.g===grp).map(r=>`<button type="button" class="day-tab${r.k===ES.rk?" active":""}" data-k="${r.k}">${r.t}</button>`).join("")}</div>`;
  box.querySelectorAll(".es-rk-g").forEach(b=>b.onclick=()=>{
    ES.rk=avail.find(r=>r.g===b.dataset.g).k; esRenderRkTabs(); esRenderRk();
  });
  box.querySelectorAll(".day-tab").forEach(b=>b.onclick=()=>{
    ES.rk=b.dataset.k;
    box.querySelectorAll(".day-tab").forEach(x=>x.classList.toggle("active", x===b));
    esRenderRk();
  });
}
function esRenderRk(){
  const R=ES_RK.find(r=>r.k===ES.rk);
  if(!R){ document.getElementById("es-rk").innerHTML=errBox("まだ卒業生の記録がありません。"); return; }
  const L=ES.grads.filter(g=>R.get(g)!=null).sort((a,b)=>R.asc?R.get(a)-R.get(b):R.get(b)-R.get(a)).slice(0,10);
  const medal=["🥇","🥈","🥉"];
  document.getElementById("es-rk").innerHTML=L.map((g,i)=>esPl("gm-row", `
      <div class="gm-pos">${i<3?`<span class="rk-medal" aria-label="${i+1}位">${medal[i]}</span>`:i+1}</div>
      <div class="gm-main">
        <div class="gm-title">${escHtml(g.name)}<span class="es-pos sm ${esPosCls(g.pos)}">${escHtml(g.pos)}</span>${esTags(g)}</div>
        <div class="gm-meta">${escHtml(esGradMeta(g))}</div>
      </div>
      <div class="gm-score es-val">${R.fmt(R.get(g))}</div>`, g)).join("");
  document.getElementById("es-rk-note").textContent=[R.note, "選手をタップすると年度ごとの成績と通算が見られます。"].filter(Boolean).join("　");
}

/* ---------- 記録 ---------- */
function esRenderRecords(){
  const G=ES.games, el=document.getElementById("es-records");
  if(!G.length){ el.innerHTML=errBox("まだ試合の記録がありません。"); document.getElementById("es-pw").innerHTML=errBox("相手戦力が入った試合がまだありません。"); return; }
  const st=esStreaks().best;
  const W=G.filter(g=>g.wl==="勝");
  const most=G.slice().sort((a,b)=>b.rs-a.rs||a.no-b.no)[0];
  const big=W.slice().sort((a,b)=>(b.rs-b.ra)-(a.rs-a.ra)||a.no-b.no)[0];
  const has=(g,w)=>g.note.includes(w);
  /* 延長・サヨナラは補足の文字に加えて、イニングスコアからも判定する */
  const num=v=>{ const n=parseInt(String(v).replace(/[^0-9]/g,""),10); return isNaN(n)?0:n; };
  const lastIdx=r=>{ let i=-1; (r.inns||[]).forEach((v,k)=>{ if(String(v).trim()!=="") i=k; }); return i; };
  const isExt=g=>has(g,"延長") || (ES.inn[g.no]||[]).some(r=>lastIdx(r)>=9);
  /* サヨナラ：後攻が最終回（9回以降）の裏に、同点か負けている状態から勝ち越して終わった試合 */
  const isSayo=g=>{ if(has(g,"サヨナラ")) return true; if(has(g,"コールド")) return false;
    const L=ES.inn[g.no]||[], home=L.find(r=>r.side==="後攻"), away=L.find(r=>r.side==="先攻"); if(!home||!away) return false;
    const k=lastIdx(home); if(k<8 || lastIdx(away)>k) return false;
    const lastV=String(home.inns[k]); if(/[✕×xX]/.test(lastV)) return false;
    const hr=home.inns.reduce((a,v)=>a+num(v),0), ar=away.inns.reduce((a,v)=>a+num(v),0);
    return hr>ar && hr-num(lastV)<=ar; };
  const ext=G.filter(isExt), sayo=G.filter(isSayo);
  const recs=[
    {t:"最長連勝", v:`${st.n}<small>連勝</small>`, s: st.from?`${esGameLbl(st.from)}〜${st.to.year}年度 ${st.to.taikai} ${st.to.round}${st.stop?`／止めたのは ${st.stop.opp}`:"／継続中"}`:""},
    {t:"最多得点", v:`${most.rs}<small>点</small>`, s:`vs ${most.opp}（${esGameLbl(most)}・${most.rs}-${most.ra}）`},
    big?{t:"最大点差の勝利", v:`${big.rs-big.ra}<small>点差</small>`, s:`vs ${big.opp}（${esGameLbl(big)}・${big.rs}-${big.ra}）`}:null,
    {t:"完封勝利", v:`${W.filter(g=>g.ra===0).length}<small>試合</small>`, s:"相手を0点に抑えた勝利"},
    {t:"コールド勝ち", v:`${W.filter(g=>has(g,"コールド")).length}<small>試合</small>`, s:"補足に「コールド」とある試合"},
    ext.length?{t:"延長戦", v:`${ext.filter(g=>g.wl==="勝").length}<small>勝</small>${ext.filter(g=>g.wl==="負").length}<small>敗</small>`, s:"10回以上まで行った試合"}:null,
    sayo.length?{t:"サヨナラ", v:`${sayo.filter(g=>g.wl==="勝").length}<small>勝</small>${sayo.filter(g=>g.wl==="負").length}<small>敗</small>`, s:"最終回の裏で決着した試合"}:null,
    G.some(g=>g.power==="S")?{t:"戦力Sの相手", v:`${W.filter(g=>g.power==="S").length}<small>勝</small>${G.filter(g=>g.power==="S"&&g.wl==="負").length}<small>敗</small>`, s:"格上相手の成績"}:null
  ].filter(Boolean);
  el.innerHTML=`<div class="es-recs">${recs.map(r=>`
    <div class="es-rec"><div class="es-rec-t">${r.t}</div><div class="es-rec-v">${r.v}</div><div class="es-rec-s">${escHtml(r.s)}</div></div>`).join("")}</div>`;
  document.getElementById("es-pw").innerHTML = esTeamRankHtml() || errBox("相手戦力が入った試合がまだありません。");
}

/* チームの相手戦力別成績：勝敗・勝率・平均得失点・チーム打率・チーム防御率 */
function esTeamRankHtml(){
  const ks=ES_PW.filter(k=>ES.games.some(g=>g.power===k)); if(!ks.length) return "";
  const rows=ks.map(k=>{
    const G=ES.games.filter(g=>g.power===k), w=G.filter(g=>g.wl==="勝").length, l=G.filter(g=>g.wl==="負").length, d=G.length-w-l;
    const nos=new Set(G.map(g=>g.no)), B=ES.box.filter(b=>nos.has(b.no)), t=esAgg(B);
    const rs=G.reduce((a,g)=>a+g.rs,0), ra=G.reduce((a,g)=>a+g.ra,0);
    return `<tr><th><span class="es-pw pw-${k}">${k}</span></th><td>${G.length}</td><td>${w}-${l}${d?`-${d}`:""}</td>
      <td>${w+l?esAvgFmt(w/(w+l)):"-"}</td><td>${(rs/G.length).toFixed(1)}</td><td>${(ra/G.length).toFixed(1)}</td>
      <td>${esF(t.avg,esAvgFmt)}</td><td>${esF(t.era,v=>v.toFixed(2))}</td></tr>`;
  }).join("");
  return `<div class="es-st-wrap"><table class="es-st-tbl es-pw-tbl es-rank-tbl"><thead><tr><th>戦力</th><th>試合</th><th>勝敗</th><th>勝率</th><th>平均得点</th><th>平均失点</th><th>打率</th><th>防御率</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <p class="kk-note-s">打率・防御率は選手成績を入れた試合から計算。</p>`;
}
/* 長いリストは最初の10件だけ見せて、残りは折りたたむ */
function esFoldList(items, render, n, unit){
  n=n||10;
  if(items.length<=n) return items.map(render).join("");
  return items.slice(0,n).map(render).join("") +
    `<details class="es-more"><summary>残り ${items.length-n} ${unit||"件"}を見る</summary>${items.slice(n).map(render).join("")}</details>`;
}
/* ---------- 対戦校 ---------- */
const ES_PREF_ORDER=["北北海道","南北海道","北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東東京","西東京","東京","神奈川",
  "新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口",
  "徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];
function esOppStats(){
  const m={};
  ES.games.forEach(g=>{ const k=g.opp+"\u0001"+g.oppPref;
    const s=(m[k]=m[k]||{opp:g.opp, pref:g.oppPref, n:0, w:0, l:0, rs:0, ra:0, last:0});
    s.n++; s.rs+=g.rs; s.ra+=g.ra; if(g.wl==="勝") s.w++; if(g.wl==="負") s.l++; if(g.year>s.last) s.last=g.year; });
  return Object.values(m);
}
function esRenderRivals(){
  const el=document.getElementById("es-rivals"), S=esOppStats();
  if(!S.length){ el.innerHTML=errBox("まだ試合の記録がありません。"); return; }
  const top=S.slice().sort((a,b)=>b.n-a.n||b.l-a.l).slice(0,10), max=top[0].n;
  const beat=S.filter(s=>s.l>0).sort((a,b)=>b.l-a.l||a.n-b.n);
  const byPref={}; S.forEach(s=>{ (byPref[s.pref||"不明"]=byPref[s.pref||"不明"]||[]).push(s); });
  const prefs=Object.keys(byPref).sort((a,b)=>{ const ia=ES_PREF_ORDER.indexOf(a), ib=ES_PREF_ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
  if(!prefs.includes(ES.oppPref)) ES.oppPref=prefs[0];
  el.innerHTML=`
    <div class="kk-sub es-sub0">よく戦った高校 TOP10</div>
    <div class="mlist">${top.map(s=>esOppRow(s, max)).join("")}</div>
    ${beat.length?`<div class="kk-sub es-sub">黒星をつけられた高校</div>
      <div class="kk-chips">${beat.map(s=>`<span class="kk-chip">${escHtml(s.opp)}<small>${escHtml(s.pref)}・${s.l}敗</small></span>`).join("")}</div>`:""}
    <div class="kk-sub es-sub">都道府県ごとの対戦校</div>
    <div class="trip-selbox"><select id="es-opp-sel" aria-label="都道府県を選ぶ">${prefs.map(p=>{
      const L=byPref[p], n=L.reduce((a,s)=>a+s.n,0);
      return `<option value="${escHtml(p)}"${p===ES.oppPref?" selected":""}>${escHtml(p)}（${L.length}校・${n}試合）</option>`; }).join("")}</select></div>
    <div id="es-opp-list"></div>`;
  const draw=()=>{
    const L=(byPref[ES.oppPref]||[]).slice().sort((a,b)=>b.n-a.n||b.last-a.last), mx=Math.max(1,...L.map(s=>s.n));
    const w=L.reduce((a,s)=>a+s.w,0), l=L.reduce((a,s)=>a+s.l,0);
    document.getElementById("es-opp-list").innerHTML=`
      <div class="stats-row"><div class="stat-chip">対戦校 <strong>${L.length}</strong> 校</div><div class="stat-chip"><strong>${w}</strong> 勝 <strong>${l}</strong> 敗</div></div>
      <div class="mlist">${esFoldList(L, s=>esOppRow(s, mx, true), 10, "校")}</div>`;
  };
  document.getElementById("es-opp-sel").onchange=e=>{ ES.oppPref=e.target.value; draw(); };
  draw();
}
function esOppRow(s, max, detail){
  return `<div class="mlist-row static es-riv">
    <span class="mlist-name"><span class="es-riv-name">${escHtml(s.opp)}</span><span class="mlist-y">${escHtml(detail?`最後の対戦 ${s.last}年度`:s.pref)}</span></span>
    <span class="mlist-bar es"><span style="width:${s.n/max*100}%"></span></span>
    <span class="mlist-val">${s.n}戦<small>${s.w}勝${s.l}敗${detail?`・${s.rs}-${s.ra}`:""}</small></span>
  </div>`;
}

/* ---------- ドラフト ---------- */
function esRenderDraft(){
  const el=document.getElementById("es-draft");
  const P=ES.grads.filter(g=>g.team);
  if(!P.length){ el.innerHTML=errBox("まだプロ入りした卒業生の記録がありません。"); return; }
  const m={}; P.forEach(g=>{ const s=(m[g.team]=m[g.team]||{t:g.team, n:0, first:0}); s.n++; if(g.rank==="1") s.first++; });
  const S=Object.values(m).sort((a,b)=>b.n-a.n||b.first-a.first), max=S[0].n;
  const first=P.filter(g=>g.rank==="1").length;
  if(!ES.draftTeam) ES.draftTeam=S[0].t;
  el.innerHTML=`
    <div class="stats-row">
      <div class="stat-chip">プロ入り <strong>${P.length}</strong> 人</div>
      <div class="stat-chip">ドラフト1位 <strong>${first}</strong> 人</div>
      <div class="stat-chip">卒業生 <strong>${ES.grads.length}</strong> 人</div>
    </div>
    <div class="mlist">${S.map(s=>`
      <button type="button" class="mlist-row es-riv" data-team="${escHtml(s.t)}">
        <span class="mlist-name"><span class="es-riv-name">${escHtml(s.t)}</span></span>
        <span class="mlist-bar es"><span style="width:${s.n/max*100}%"></span></span>
        <span class="mlist-val">${s.n}人<small>1位 ${s.first}人</small></span>
      </button>`).join("")}</div>
    <div class="kk-sub es-sub" id="es-draft-anchor">指名された選手</div>
    <div class="trip-selbox"><select id="es-draft-sel" aria-label="球団を選ぶ">
      <option value="すべて">すべての球団（${P.length}人）</option>
      <option value="1位">ドラフト1位だけ（${first}人）</option>
      ${S.map(s=>`<option value="${escHtml(s.t)}">${escHtml(s.t)}（${s.n}人）</option>`).join("")}
    </select></div>
    <div id="es-draft-list"></div>`;
  const sel=document.getElementById("es-draft-sel");
  const draw=()=>{
    sel.value=ES.draftTeam;
    el.querySelectorAll(".mlist-row[data-team]").forEach(b=>b.classList.toggle("on", b.dataset.team===ES.draftTeam));
    const L=P.filter(g=>ES.draftTeam==="すべて" || (ES.draftTeam==="1位" ? g.rank==="1" : g.team===ES.draftTeam))
      .sort((a,b)=>(a.year||0)-(b.year||0) || (+a.rank||99)-(+b.rank||99));
    document.getElementById("es-draft-list").innerHTML=L.length?esFoldList(L, g=>esPl("gm-row es-dr", `
        <div class="gm-pos es-dr-rank">${g.rank?`${escHtml(g.rank)}<small>位</small>`:"-"}</div>
        <div class="gm-main">
          <div class="gm-title">${escHtml(g.name)}<span class="es-pos sm ${esPosCls(g.pos)}">${escHtml(g.pos)}</span>${esTags(g)}</div>
          <div class="gm-meta">${escHtml([g.year?`${g.year}年度入学`:"", g.from, ES.draftTeam==="すべて"||ES.draftTeam==="1位"?g.team:""].filter(Boolean).join("・"))}</div>
        </div>
        <div class="gm-score es-val">${g.star!=null?`${g.star}<small>★</small>`:""}</div>`, g), 10, "人"):errBox("該当する選手がいません。");
  };
  sel.onchange=()=>{ ES.draftTeam=sel.value; draw(); };
  el.querySelectorAll(".mlist-row[data-team]").forEach(b=>b.onclick=()=>{
    ES.draftTeam=b.dataset.team; draw();
    const a=document.getElementById("es-draft-anchor"), nav=document.querySelector("nav");
    window.scrollTo({ top:Math.max(0, window.scrollY+a.getBoundingClientRect().top-(nav?nav.offsetHeight:0)-8), behavior:prefersReduced()?"auto":"smooth" });
  });
  draw();
}


/* ---------- 初期化 ---------- */
window.addEventListener("scroll", ()=>{ document.querySelector("nav").classList.toggle("scrolled", window.scrollY>4); }, {passive:true});
loadEikan().catch(e=>{ console.error("eikan", e); document.getElementById("es-hero").innerHTML=errBox("読み込み中にエラーが発生しました。"); });
