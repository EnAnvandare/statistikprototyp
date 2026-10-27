const D = __DATA__;
const NOTES = [
  {month:"2026-03", branch:"Lindängenbiblioteket", note:"Stängt cirka tre veckor för renovering av barnavdelningen (exempelanteckning)."},
  {month:"2025-09", branch:"Limhamnsbiblioteket", note:"Söndagsöppet 11–16 startade som försök (exempelanteckning)."},
  {month:"2024-01", branch:"Hylliebiblioteket", note:"Nyare bibliotek; användningen byggdes fortfarande upp under 2024 (exempelanteckning)."}
];
const BM = D.bm.map(r=>({month:r[0],year:+r[0].slice(0,4),m:+r[0].slice(5),branch:r[1],area:r[2],loans_physical:r[3],loans_children:r[4],visits:r[5],events:r[6],event_participants:r[7],open_hours:r[8]}));
const DIG = D.dig.map(r=>({month:r[0],year:+r[0].slice(0,4),eloans_ebook:r[1],eloans_audiobook:r[2],web_sessions:r[3],catalogue_searches:r[4]}));
const AB = D.ab.map(r=>({year:r[0],area:r[1],age_band:r[2],active:r[3]}));
const POP = D.pop.map(r=>({area:r[0],age_band:r[1],population:r[2]}));
const KOL = D.kol.map(r=>({kpi:r[0],kommun:r[1],year:r[2],value:r[3]}));
const KN = D.kolNames;
const BRANCHES = [...new Set(BM.map(r=>r.branch))];
const AREAS = ["Innerstaden","Norr","Öster","Söder","Väster"];
const BANDS = ["0-12","13-19","20-64","65+"];
const METRICS = ["loans_physical","loans_children","visits","events","event_participants","open_hours"];
const MLABEL = {loans_physical:"Fysiska lån",loans_children:"Barnlån",visits:"Besök",events:"Program",event_participants:"Deltagare i program",open_hours:"Öppettimmar"};
const LOC = d3.formatLocale({decimal:",",thousands:"\u00a0",grouping:[3],currency:["","\u00a0kr"],percent:"\u00a0%",minus:"−"});
const TLOC = d3.timeFormatLocale({dateTime:"%A %e %B %Y %X",date:"%Y-%m-%d",time:"%H:%M:%S",periods:["fm","em"],days:["söndag","måndag","tisdag","onsdag","torsdag","fredag","lördag"],shortDays:["sön","mån","tis","ons","tor","fre","lör"],months:["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"],shortMonths:["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]});
const dec = (v,n) => v.toFixed(n).replace(".",",");
const fmt = LOC.format(","), fmtC = n => Intl.NumberFormat("sv",{notation:"compact",maximumFractionDigits:1}).format(n);
const pct = (a,b) => b ? (a/b-1) : null;
const fmtPct = v => v==null ? "–" : (v>0?"+":v<0?"−":"±") + dec(Math.abs(v*100),1) + "\u00a0%";
const cls = v => v==null||Math.abs(v)<0.005 ? "flat" : v>0 ? "up" : "down";
const LAST = "2026-09", YTD_M = 9;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function agg(rows, metric){ return d3.sum(rows, r=>r[metric]); }
function ytd(year, filt=()=>true){ return BM.filter(r=>r.year===year && r.m<=YTD_M && filt(r)); }

/* ---------- Tabs ---------- */
const tabs=[...document.querySelectorAll(".tab")];
function showTab(id){
  tabs.forEach(t=>{const on=t.getAttribute("aria-controls")===id;t.setAttribute("aria-selected",on);document.getElementById(t.getAttribute("aria-controls")).hidden=!on;});
  drawAll();
}
tabs.forEach(t=>t.addEventListener("click",()=>showTab(t.getAttribute("aria-controls"))));
{ const h=location.hash.slice(1); if(["overview","reach","compare","future"].includes(h)) showTab(h); }

/* ---------- Tooltip helper ---------- */
function tip(container){
  let el=container.querySelector(".tip"); if(!el){el=document.createElement("div");el.className="tip";el.hidden=true;container.appendChild(el);}
  return {show(x,y,nodes){el.replaceChildren(...nodes);el.hidden=false;const w=container.clientWidth, tw=el.offsetWidth;let left=x+12;if(left+tw>w)left=Math.max(0,x-tw-12);el.style.left=left+"px";el.style.top=Math.max(0,y-10)+"px";},hide(){el.hidden=true;}};
}
function line(text, color){const d=document.createElement("div");if(color){const s=document.createElement("span");s.className="sw";s.style.background=color;d.append(s);}d.append(text);return d;}
function tline(text){const d=document.createElement("div");d.className="t";d.textContent=text;return d;}

/* ---------- Overview ---------- */
const brSel=document.getElementById("ov-branch");
brSel.append(new Option("Alla bibliotek",""),...BRANCHES.map(b=>new Option(b,b)));
let metric="loans_physical";
document.querySelectorAll("#ov-metric button").forEach(b=>b.addEventListener("click",()=>{metric=b.dataset.m;document.querySelectorAll("#ov-metric button").forEach(x=>x.setAttribute("aria-pressed",x===b));drawTrend();}));
brSel.addEventListener("change",drawTrend);

function drawOverview(){
  const L26=agg(ytd(2026),"loans_physical"),L25=agg(ytd(2025),"loans_physical");
  const V26=agg(ytd(2026),"visits"),V25=agg(ytd(2025),"visits");
  const P26=agg(ytd(2026),"event_participants"),P25=agg(ytd(2025),"event_participants");
  const e=y=>d3.sum(DIG.filter(r=>r.year===y&&+r.month.slice(5)<=YTD_M),r=>r.eloans_ebook+r.eloans_audiobook);
  const E26=e(2026),E25=e(2025);
  const tiles=[["Fysiska lån",L26,pct(L26,L25)],["Besök",V26,pct(V26,V25)],["E-lån (e-böcker + ljud)",E26,pct(E26,E25)],["Deltagare i program",P26,pct(P26,P25)]];
  const box=document.getElementById("ov-tiles"); box.replaceChildren();
  tiles.forEach(([k,v,d])=>{const t=document.createElement("div");t.className="tile";
    const a=document.createElement("div");a.className="k";a.textContent=k+", jan–sep 2026";
    const b=document.createElement("div");b.className="v";b.textContent=fmtC(v);b.title=fmt(v);
    const c=document.createElement("div");c.className="d "+cls(d);c.textContent=fmtPct(d)+" mot 2025";
    t.append(a,b,c);box.append(t);});
  const lead=document.getElementById("ov-lead"); lead.replaceChildren();
  const ld=pct(L26,L25), vd=pct(V26,V25);
  lead.append("Hittills under 2026 har Malmös bibliotek ",bold(fmtPct(vd))," besök och ",bold(fmtPct(ld))," fysiska lån jämfört med samma månader förra året, medan e-lånen ligger på ",bold(fmtPct(pct(E26,E25))),".");
  drawTrend(); drawBranchTable();
}
function bold(t){const b=document.createElement("b");b.textContent=t;return b;}

function drawTrend(){
  const host=document.getElementById("trend-chart"); if(!host.clientWidth) return;
  const br=brSel.value;
  const months=[...new Set(BM.map(r=>r.month))];
  const data=months.map(mo=>({date:new Date(mo+"-01T00:00:00Z"),month:mo,v:d3.sum(BM.filter(r=>r.month===mo&&(!br||r.branch===br)),r=>r[metric])}));
  const W=host.clientWidth,H=Math.max(220,Math.min(300,W*0.42));
  host.querySelector("svg")?.remove();
  const svg=d3.select(host).insert("svg",":first-child").attr("viewBox",`0 0 ${W} ${H}`).attr("width","100%");
  const y=d3.scaleLinear([0,d3.max(data,d=>d.v)*1.1],[H-24,10]).nice();
  const tmp=svg.append("text").text(fmtC(y.domain()[1])); const ml=tmp.node().getComputedTextLength()+12; tmp.remove();
  const x=d3.scaleBand(data.map(d=>d.month),[ml,W-4]).padding(0.22);
  svg.append("g").attr("class","grid").attr("transform",`translate(${ml},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W-ml-4)).tickFormat(fmtC)).call(g=>g.selectAll("text").attr("x",-8)).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove());
  const xt=data.filter(d=>d.month.endsWith("-01")||d.month.endsWith("-07"));
  const xa=svg.append("g").attr("transform",`translate(0,${H-24})`).call(d3.axisBottom(x).tickValues(xt.map(d=>d.month)).tickSize(0).tickFormat(m=>(m.endsWith("-01")?"jan ":"jul ")+m.slice(2,4))).attr("font-size",null).attr("font-family",null);
  xa.select(".domain").attr("stroke",css("--line")); xa.selectAll("text").attr("dy","1.2em");
  const acc=css("--accent"), mut=css("--peer");
  const bars=svg.append("g").selectAll("rect").data(data).join("rect")
    .attr("x",d=>x(d.month)).attr("width",x.bandwidth()).attr("y",d=>y(d.v)).attr("height",d=>y(0)-y(d.v))
    .attr("rx",Math.min(3,x.bandwidth()/2)).attr("fill",d=>d.month.startsWith("2026")?acc:mut);
  const T=tip(host);
  bars.on("mousemove",(ev,d)=>{const [px,py]=d3.pointer(ev,host);
      const pm=(+d.month.slice(0,4)-1)+d.month.slice(4);const prev=data.find(p=>p.month===pm);
      const nodes=[tline(TLOC.utcFormat("%B %Y")(d.date)+(br?" · "+br:"")),line(MLABEL[metric]+": "+fmt(d.v),d.month.startsWith("2026")?acc:mut)];
      if(prev) nodes.push(tline("Samma månad året före: "+fmt(prev.v)+" ("+fmtPct(pct(d.v,prev.v))+")"));
      const n=NOTES.find(n=>n.month===d.month&&(!br||n.branch===br)); if(n) nodes.push(tline("Anteckning: "+n.branch+". "+n.note));
      T.show(px,py,nodes);})
    .on("mouseleave",()=>T.hide());
}

let sortKey="L26", sortDir=-1;
function drawBranchTable(){
  const rows=BRANCHES.map(b=>{const a=ytd(2026,r=>r.branch===b), p=ytd(2025,r=>r.branch===b);
    const L26=agg(a,"loans_physical"),L25=agg(p,"loans_physical"),V26=agg(a,"visits"),V25=agg(p,"visits");
    return {branch:b,area:a[0].area,L26,L25,Ld:pct(L26,L25),V26,V25,Vd:pct(V26,V25),lpv:L26/V26,kid:agg(a,"loans_children")/L26,ph:V26/agg(a,"open_hours")};});
  rows.sort((p,q)=>{const a=p[sortKey],b=q[sortKey];return (typeof a==="string"?a.localeCompare(b,"sv"):a-b)*sortDir;});
  const maxL=d3.max(rows,r=>r.L26);
  const cols=[["branch","Bibliotek"],["area","Stadsområde"],["L26","Lån"],["Ld","mot 2025"],["V26","Besök"],["Vd","mot 2025"],["lpv","Lån per besök"],["kid","Andel barnlån"],["ph","Besök per öppettimme"]];
  const t=document.getElementById("branch-table"); t.replaceChildren();
  const th=t.createTHead().insertRow();
  cols.forEach(([k,l])=>{const c=document.createElement("th");const b=document.createElement("button");b.type="button";b.textContent=l;
    if(k===sortKey)c.setAttribute("aria-sort",sortDir>0?"ascending":"descending");
    b.addEventListener("click",()=>{sortDir=k===sortKey?-sortDir:(k==="branch"||k==="area"?1:-1);sortKey=k;drawBranchTable();});c.append(b);th.append(c);});
  const tb=t.createTBody();
  rows.forEach(r=>{const tr=tb.insertRow();
    const td=(txt,c)=>{const x=tr.insertCell();x.textContent=txt;if(c)x.className=c;return x;};
    td(r.branch);td(r.area);
    const lc=tr.insertCell();lc.className="num";const bc=document.createElement("div");bc.className="bar-cell";const i=document.createElement("i");i.style.width=Math.round(60*r.L26/maxL)+"px";const s=document.createElement("span");s.textContent=fmt(r.L26);bc.append(s,i);lc.append(bc);
    const cell=(d,before,after,m)=>{const z=assessChange({before,after,branch:r.branch,metric:m,months:YTD_M});const c=td(fmtPct(d),"num "+(z.rating===0?"noise":cls(d)));c.title=z.reasons.join(" ");};
    cell(r.Ld,r.L25,r.L26,"loans_physical");td(fmt(r.V26),"num");cell(r.Vd,r.V25,r.V26,"visits");
    td(dec(r.lpv,2),"num");td(Math.round(r.kid*100)+"\u00a0%","num");td(r.ph.toFixed(0),"num");});
}

/* ---------- Reach ---------- */
const rcYear=document.getElementById("rc-year"); rcYear.addEventListener("change",drawReach);
function reachRows(year){return AB.filter(r=>r.year===year).map(r=>{const p=POP.find(x=>x.area===r.area&&x.age_band===r.age_band).population;return {...r,population:p,reach:r.active/p};});}
function drawReach(){
  const y=+rcYear.value, rows=reachRows(y);
  const t=document.getElementById("heat"); t.replaceChildren();
  const h=t.createTHead().insertRow(); ["Stadsområde",...BANDS.map(b=>b+" år"),"Alla åldrar"].forEach(x=>{const c=document.createElement("th");c.textContent=x;h.append(c);});
  const ext=d3.extent(rows,r=>r.reach); const col=d3.scaleLinear(ext,[0,1]);
  const c0=d3.color(css("--heat0")),c1=d3.color(css("--heat1")),ip=d3.interpolateRgb(c0,c1);
  const tb=t.createTBody();
  AREAS.forEach(a=>{const tr=tb.insertRow();const n=tr.insertCell();n.textContent=a;
    BANDS.forEach(b=>{const r=rows.find(x=>x.area===a&&x.age_band===b);const c=tr.insertCell();c.className="h";c.textContent=(r.reach*100).toFixed(0)+"%";const k=col(r.reach);c.style.background=ip(k*0.85);c.style.color=k>0.55?css("--bg"):css("--fg");c.title=fmt(r.active)+" av "+fmt(r.population)+" invånare";});
    const ar=rows.filter(x=>x.area===a);const c=tr.insertCell();c.className="h";c.style.fontWeight="600";c.textContent=(d3.sum(ar,x=>x.active)/d3.sum(ar,x=>x.population)*100).toFixed(0)+"%";});
  // lead
  const teen=y2=>{const r=AB.filter(x=>x.year===y2&&x.age_band==="13-19");return d3.sum(r,x=>x.active);};
  const lead=document.getElementById("rc-lead");lead.replaceChildren();
  lead.append("Tonåringarna är gruppen att hålla ögonen på: aktiva låntagare i åldern 13–19 förändrades med ",bold(fmtPct(pct(teen(2025),teen(2024))))," mellan 2024 och 2025, medan övriga åldersgrupper låg stilla. Öster har lägst räckvidd bland vuxna.");
  drawAge();
}
function drawAge(){
  const host=document.getElementById("age-chart"); if(!host.clientWidth) return;
  const series=BANDS.map(b=>({band:b,values:[2024,2025,2026].map(y=>{const a=AB.filter(r=>r.year===y&&r.age_band===b),p=POP.filter(r=>r.age_band===b);return {year:y,v:d3.sum(a,r=>r.active)/d3.sum(p,r=>r.population)};})}));
  const W=host.clientWidth,H=230; host.querySelector("svg")?.remove();
  const svg=d3.select(host).insert("svg",":first-child").attr("viewBox",`0 0 ${W} ${H}`).attr("width","100%");
  const lbl=svg.append("text").text("13-19 år 00 %");const er=lbl.node().getComputedTextLength()+10;lbl.remove();
  const x=d3.scalePoint([2024,2025,2026],[40,W-er]).padding(0.1), y=d3.scaleLinear([0,0.55],[H-24,10]);
  svg.append("g").attr("class","grid").attr("transform","translate(40,0)").call(d3.axisLeft(y).ticks(4).tickSize(-(W-er-40)).tickFormat(LOC.format(".0%"))).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).call(g=>g.selectAll("text").attr("x",-6));
  svg.append("g").attr("transform",`translate(0,${H-24})`).call(d3.axisBottom(x).tickSize(0).tickFormat(v=>v===2026?"2026 (jan–sep)":v)).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).selectAll("text").attr("dy","1.2em");
  const acc=css("--bad"),mut=css("--peer");
  const ends=[];
  series.forEach(s=>{const c=s.band==="13-19"?acc:mut;
    svg.append("path").datum(s.values).attr("fill","none").attr("stroke",c).attr("stroke-width",s.band==="13-19"?2.5:1.5).attr("stroke-linecap","round").attr("stroke-linejoin","round").attr("d",d3.line(d=>x(d.year),d=>y(d.v)));
    svg.append("g").selectAll("circle").data(s.values).join("circle").attr("cx",d=>x(d.year)).attr("cy",d=>y(d.v)).attr("r",3).attr("fill",c);
    const l=s.values[2]; ends.push({y:y(l.v),t:s.band+" år "+Math.round(l.v*100)+"\u00a0%",c});});
  ends.sort((a,b)=>a.y-b.y); for(let i=1;i<ends.length;i++) if(ends[i].y-ends[i-1].y<13) ends[i].y=ends[i-1].y+13;
  ends.forEach(e=>svg.append("text").attr("x",x(2026)+8).attr("y",e.y+4).text(e.t).style("fill",e.c===mut?css("--muted"):e.c));
}

/* ---------- Compare ---------- */
const KORDER=["N09801","N09807","N09809","N09811","N09805","N09026","N09810"];
const cpSel=document.getElementById("cp-kpi"); KORDER.forEach(k=>cpSel.append(new Option(KN[k],k))); cpSel.addEventListener("change",drawCompare);
const KOMM=["Malmö","Eslöv","Lund","Helsingborg","Göteborg","Stockholm","Uppsala"];
const kfmt=k=>k==="N09026"?LOC.format(",.0f"):k==="N09809"?(v=>dec(v,1)+"\u00a0%"):k==="N09805"||k==="N09811"?LOC.format(".1f"):LOC.format(".2f");
function drawCompare(){
  const k=cpSel.value; document.getElementById("cp-title").textContent=KN[k];
  const host=document.getElementById("cp-chart");
  const rows=KOL.filter(r=>r.kpi===k&&r.year>=2019);
  const kom=KOMM.filter(m=>rows.some(r=>r.kommun===m));
  const f=kfmt(k);
  // lead
  const m25=rows.find(r=>r.kommun==="Malmö"&&r.year===2025), e25=rows.find(r=>r.kommun==="Eslöv"&&r.year===2025);
  const rank=[...rows.filter(r=>r.year===2025)].sort((a,b)=>b.value-a.value).map(r=>r.kommun);
  const lead=document.getElementById("cp-lead");lead.replaceChildren();
  if(m25){lead.append("År 2025 hade Malmö ",bold(f(m25.value))," på detta nyckeltal, plats ",bold(String(rank.indexOf("Malmö")+1)+" av "+rank.length)," bland de visade kommunerna.");
    if(e25) lead.append(" Eslöv hade ",bold(f(e25.value)),".");}
  // table
  const t=document.getElementById("cp-table");t.replaceChildren();
  const h=t.createTHead().insertRow();["Kommun","2019","2025","Förändring"].forEach(x=>{const c=document.createElement("th");c.textContent=x;h.append(c);});
  const tb=t.createTBody();
  rank.forEach(m=>{const a=rows.find(r=>r.kommun===m&&r.year===2019),b=rows.find(r=>r.kommun===m&&r.year===2025);const tr=tb.insertRow();
    const n=tr.insertCell();n.textContent=m;if(m==="Malmö"||m==="Eslöv")n.style.fontWeight="600";
    [a?f(a.value):"–",b?f(b.value):"–"].forEach(v=>{const c=tr.insertCell();c.className="num";c.textContent=v;});
    const d=a&&b?pct(b.value,a.value):null;const c=tr.insertCell();c.className="num "+cls(k==="N09026"?null:d);c.textContent=fmtPct(d);});
  if(!host.clientWidth) return;
  const W=host.clientWidth,H=Math.max(240,Math.min(320,W*0.45)); host.querySelector("svg")?.remove();
  const svg=d3.select(host).insert("svg",":first-child").attr("viewBox",`0 0 ${W} ${H}`).attr("width","100%");
  const tmp=svg.append("text").text("Helsingborg 00,00");const er=tmp.node().getComputedTextLength()+12;tmp.remove();
  const y=d3.scaleLinear([0,d3.max(rows,r=>r.value)*1.08],[H-24,10]).nice();
  const tl=svg.append("text").text(f(y.domain()[1]));const ml=tl.node().getComputedTextLength()+12;tl.remove();
  const years=d3.range(2019,2026), x=d3.scalePoint(years,[ml,W-er]);
  svg.append("g").attr("class","grid").attr("transform",`translate(${ml},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W-er-ml)).tickFormat(f)).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).call(g=>g.selectAll("text").attr("x",-8));
  svg.append("g").attr("transform",`translate(0,${H-24})`).call(d3.axisBottom(x).tickSize(0).tickValues(W<500?[2019,2021,2023,2025]:years)).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).selectAll("text").attr("dy","1.2em");
  const col=m=>m==="Malmö"?css("--accent"):m==="Eslöv"?css("--ochre"):css("--peer");
  const order=[...kom.filter(m=>m!=="Malmö"&&m!=="Eslöv"),"Eslöv","Malmö"].filter(m=>kom.includes(m));
  const ends=[];
  order.forEach(m=>{const s=years.map(yr=>rows.find(r=>r.kommun===m&&r.year===yr)).filter(Boolean);const hi=m==="Malmö"||m==="Eslöv";
    svg.append("path").datum(s).attr("fill","none").attr("stroke",col(m)).attr("stroke-width",hi?2.5:1.25).attr("stroke-linecap","round").attr("stroke-linejoin","round").attr("d",d3.line(d=>x(d.year),d=>y(d.value)));
    if(hi) svg.append("g").selectAll("circle").data(s).join("circle").attr("cx",d=>x(d.year)).attr("cy",d=>y(d.value)).attr("r",3).attr("fill",col(m));
    const l=s[s.length-1]; if(l) ends.push({y:y(l.value),t:m+" "+f(l.value),c:hi?col(m):css("--muted"),hi});});
  ends.sort((a,b)=>a.y-b.y); for(let i=1;i<ends.length;i++) if(ends[i].y-ends[i-1].y<12) ends[i].y=ends[i-1].y+12;
  const over=ends.length?ends[ends.length-1].y-(H-30):0; if(over>0) ends.forEach(e=>e.y-=over);
  ends.forEach(e=>svg.append("text").attr("x",x(2025)+8).attr("y",e.y+4).text(e.t).style("fill",e.c).style("font-weight",e.hi?"600":"400"));
  const T=tip(host);
  const rule=svg.append("line").attr("y1",10).attr("y2",H-24).attr("stroke",css("--line")).attr("hidden",true);
  svg.append("rect").attr("x",ml).attr("y",0).attr("width",W-er-ml).attr("height",H-24).attr("fill","transparent")
    .on("mousemove",ev=>{const [px,py]=d3.pointer(ev,host);const yr=years[d3.leastIndex(years,v=>Math.abs(x(v)-px))];rule.attr("x1",x(yr)).attr("x2",x(yr)).attr("hidden",null);
      const vals=rows.filter(r=>r.year===yr).sort((a,b)=>b.value-a.value);
      T.show(px,py,[tline(String(yr)),...vals.map(r=>line(r.kommun+": "+f(r.value),col(r.kommun)))]);})
    .on("mouseleave",()=>{T.hide();rule.attr("hidden",true);});
}

/* ---------- Future ---------- */
const PROJ=D.proj, FG=PROJ.groups, FY=PROJ.years;
const REACH0={"0–4 år":.30,"5–14 år":.52,"15–19 år":.24,"20–64 år":.21,"65–79 år":.25,"80+ år":.16};
const TREND={"15–19 år":-0.08};
const GCOL={"0–4 år":"--s2","5–14 år":"--s3","15–19 år":"--s4","20–64 år":"--s6","65–79 år":"--s5","80+ år":"--s1"};
let fuScen="same";const fuGoals={...REACH0};
function reachAt(g,y,scen=fuScen,goals=fuGoals){const r0=REACH0[g];if(scen==="trend"){const k=Math.min(y,2030)-2025;return r0*Math.pow(1+(TREND[g]||0),k);}
  if(scen==="goal"){const t=Math.min(1,(y-2025)/5);return r0+((goals[g]??r0)-r0)*t;}return r0;}
function revisionPct(g){const p=PROJ.proj2022_malmo[g];if(!p)return null;const now=PROJ.proj2024["Malmö"][g];return Math.max(Math.abs(now[1]/p["2030"]-1),Math.abs(now[3]/p["2040"]-1));}
function futureRating(g,y,kom){const h=y-2025;let r=h<=5?2:1;const why=[];
  if(h>5)why.push("Mer än fem år fram.");
  const rv=revisionPct(g);
  if(rv!=null&&rv>0.10){r=0;why.push(`SCB har ändrat framskrivningen för gruppen med upp till ${Math.round(rv*100)} % mellan 2022 och 2024.`);}
  else if(rv!=null&&rv>0.05){r=Math.min(r,1);why.push(`SCB har ändrat framskrivningen för gruppen med upp till ${Math.round(rv*100)} % mellan 2022 och 2024.`);}
  if(kom!=="Malmö"){r=Math.min(r,1);why.push("Liten kommun; framskrivningen är osäkrare.");}
  if(!why.length)why.push("Nära i tiden och stabil mellan SCB:s framskrivningar.");
  return {rating:r,label:REL_LABEL.sv[r],reasons:why};}
function futureRow(g,y,kom,scen,goals){const i=FY.indexOf(y);const pop=PROJ.proj2024[kom][g][i];const reach=reachAt(g,y,scen,goals);const v=pop*reach;
  const h=y-2025,band=Math.max((revisionPct(g)||0)*Math.min(1,h/5),0.02*h/5);return {group:g,year:y,population:pop,reach_pct:+(reach*100).toFixed(1),expected_borrowers:Math.round(v),low:Math.round(v*(1-band)),high:Math.round(v*(1+band)),reliability:futureRating(g,y,kom)};}
const fuKom=document.getElementById("fu-kommun");fuKom.addEventListener("change",drawFuture);
document.querySelectorAll("#fu-scen button").forEach(b=>b.addEventListener("click",()=>{fuScen=b.dataset.s;document.querySelectorAll("#fu-scen button").forEach(x=>x.setAttribute("aria-pressed",x===b));drawFuture();}));
(function buildGoals(){const box=document.getElementById("fu-goals");FG.forEach(g=>{const id="goal-"+FG.indexOf(g);const l=document.createElement("label");l.htmlFor=id;
  const s=document.createElement("span");s.textContent="Mål 2030, "+g;const o=document.createElement("output");o.textContent=Math.round(fuGoals[g]*100)+"\u00a0%";
  const inp=document.createElement("input");inp.type="range";inp.id=id;inp.min="0";inp.max="80";inp.step="1";inp.value=String(Math.round(fuGoals[g]*100));
  inp.addEventListener("input",()=>{fuGoals[g]=+inp.value/100;o.textContent=inp.value+"\u00a0%";drawFutureTable();});l.append(s,o,inp);box.append(l);});})();
const pctChg=(a,b)=>fmtPct(b/a-1);
function drawFuture(){
  const kom=fuKom.value,P=PROJ.proj2024[kom];
  const lead=document.getElementById("fu-lead");lead.replaceChildren();
  const tot=FY.map((y,i)=>d3.sum(FG,g=>P[g][i]));
  lead.append("Enligt SCB:s framskrivning växer "+kom+" från ",bold(fmt(Math.round(tot[0]/100)*100))," till ",bold(fmt(Math.round(tot[3]/100)*100))," invånare 2040. Skolbarnen (5–14 år) förändras med ",bold(pctChg(P["5–14 år"][0],P["5–14 år"][2]))," till 2035, medan gruppen 80+ förändras med ",bold(pctChg(P["80+ år"][0],P["80+ år"][2])),".");
  // implications
  const ul=document.getElementById("fu-impl");ul.replaceChildren();
  const li=(head,txt)=>{const e=document.createElement("li");e.append(bold(head)," ",txt);ul.append(e);};
  li("Småbarn (0–4):",`${pctChg(P["0–4 år"][0],P["0–4 år"][1])} till 2030, sedan ${pctChg(P["0–4 år"][1],P["0–4 år"][3])} till 2040. Sagostunder och Bokstart: en tillfällig dipp snarare än en varaktig minskning.`);
  li("Skolbarn (5–14):",`${pctChg(P["5–14 år"][0],P["5–14 år"][2])} till 2035. Skolsamarbetet når färre elever per årskull de närmaste tio åren.`);
  li("Tonåringar (15–19):",`${pctChg(P["15–19 år"][0],P["15–19 år"][1])} till 2030, sedan ${pctChg(P["15–19 år"][1],P["15–19 år"][3])} till 2040. Behovet av studieplatser toppar runt 2030.`);
  li("80 år och äldre:",`${pctChg(P["80+ år"][0],P["80+ år"][3])} till 2040. Boken kommer, talböcker och digital hjälp växer i betydelse.`);
  // revision table (Malmö only)
  const rt=document.getElementById("fu-rev");rt.replaceChildren();const rh=rt.createTHead().insertRow();["Åldersgrupp","2030 enl. 2022","2030 enl. 2024","Ändring"].forEach(x=>{const c=document.createElement("th");c.textContent=x;rh.append(c);});
  const rb=rt.createTBody();FG.forEach(g=>{const tr=rb.insertRow();const a=PROJ.proj2022_malmo[g]["2030"],b=PROJ.proj2024["Malmö"][g][1];[g,fmt(a),fmt(b)].forEach((v,i)=>{const c=tr.insertCell();c.textContent=v;if(i)c.className="num";});const c=tr.insertCell();const d=b/a-1;c.textContent=fmtPct(d);c.className="num "+(Math.abs(d)<0.02?"flat":d>0?"up":"down");});
  drawFuturePop();drawFutureTable();
}
function drawFuturePop(){
  const host=document.getElementById("fu-pop-chart");if(!host.clientWidth)return;const kom=fuKom.value,P=PROJ.proj2024[kom];
  const W=host.clientWidth,H=Math.max(230,Math.min(300,W*0.42));host.querySelector("svg")?.remove();
  const svg=d3.select(host).insert("svg",":first-child").attr("viewBox",`0 0 ${W} ${H}`).attr("width","100%");
  const series=FG.map(g=>({g,vals:FY.map((y,i)=>({y,v:100*P[g][i]/P[g][0]}))}));
  const tmp=svg.append("text").text("65–79 år 100");const er=tmp.node().getComputedTextLength()+14;tmp.remove();
  const x=d3.scalePoint(FY,[40,W-er]).padding(0.05);const lo=d3.min(series,s=>d3.min(s.vals,d=>d.v)),hi=d3.max(series,s=>d3.max(s.vals,d=>d.v));
  const y=d3.scaleLinear([Math.min(80,lo-4),Math.max(120,hi+4)],[H-24,10]).nice();
  svg.append("g").attr("class","grid").attr("transform","translate(40,0)").call(d3.axisLeft(y).ticks(5).tickSize(-(W-er-40))).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).call(g=>g.selectAll("text").attr("x",-6));
  svg.append("g").attr("transform",`translate(0,${H-24})`).call(d3.axisBottom(x).tickSize(0)).attr("font-size",null).attr("font-family",null).call(g=>g.select(".domain").remove()).selectAll("text").attr("dy","1.2em");
  svg.append("line").attr("x1",40).attr("x2",W-er).attr("y1",y(100)).attr("y2",y(100)).attr("stroke",css("--muted")).attr("stroke-dasharray","3 3");
  const ends=[];
  series.forEach(s=>{const c=css(GCOL[s.g]);svg.append("path").datum(s.vals).attr("fill","none").attr("stroke",c).attr("stroke-width",2).attr("stroke-linecap","round").attr("stroke-linejoin","round").attr("d",d3.line(d=>x(d.y),d=>y(d.v)));
    svg.append("g").selectAll("circle").data(s.vals).join("circle").attr("cx",d=>x(d.y)).attr("cy",d=>y(d.v)).attr("r",3).attr("fill",c);
    const l=s.vals[s.vals.length-1];ends.push({y:y(l.v),t:s.g+" "+Math.round(l.v),c});});
  ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<13)ends[i].y=ends[i-1].y+13;
  const over=ends.length?ends[ends.length-1].y-(H-30):0;if(over>0)ends.forEach(e=>e.y-=over);
  ends.forEach(e=>svg.append("text").attr("x",x(2040)+8).attr("y",e.y+4).text(e.t).style("fill",e.c));
  const T=tip(host);const rule=svg.append("line").attr("y1",10).attr("y2",H-24).attr("stroke",css("--line")).attr("hidden",true);
  svg.append("rect").attr("x",40).attr("y",0).attr("width",W-er-40).attr("height",H-24).attr("fill","transparent")
    .on("mousemove",ev=>{const [px,py]=d3.pointer(ev,host);const yr=FY[d3.leastIndex(FY,v=>Math.abs(x(v)-px))];const i=FY.indexOf(yr);rule.attr("x1",x(yr)).attr("x2",x(yr)).attr("hidden",null);
      T.show(px,py,[tline(String(yr)+" · "+kom),...FG.map(g=>line(g+": "+fmt(P[g][i])+" ("+Math.round(100*P[g][i]/P[g][0])+")",css(GCOL[g])))]);})
    .on("mouseleave",()=>{T.hide();rule.attr("hidden",true);});
}
function drawFutureTable(){
  const kom=fuKom.value;
  const note=document.getElementById("fu-scen-note");
  note.textContent={same:"Dagens räckvidd per åldersgrupp gäller hela perioden. Bara befolkningen förändras.",trend:"Räckvidden bland tonåringar fortsätter att sjunka som mellan 2024 och 2025 (−8 % per år) fram till 2030 och ligger sedan stilla. Övriga grupper oförändrade.",goal:"Räckvidden går stegvis mot de mål du sätter för 2030 och ligger sedan kvar där."}[fuScen];
  document.getElementById("fu-goals").hidden=fuScen!=="goal";
  const t=document.getElementById("fu-table");t.replaceChildren();
  const h=t.createTHead().insertRow();["Åldersgrupp","Räckvidd idag","2025","2030","2035","2040","2025–2035","Tillförlitlighet 2035"].forEach(x=>{const c=document.createElement("th");c.textContent=x;h.append(c);});
  const tb=t.createTBody();
  FG.forEach(g=>{const tr=tb.insertRow();const n=tr.insertCell();n.textContent=g;const rc=tr.insertCell();rc.className="num";rc.textContent=Math.round(REACH0[g]*100)+"\u00a0%";
    const rows=FY.map(y=>futureRow(g,y,kom,fuScen,fuGoals));
    rows.forEach((rw,i)=>{const c=tr.insertCell();c.className="num";c.textContent=fmt(rw.expected_borrowers);if(i>0){const s=document.createElement("span");s.className="rng";s.textContent=fmt(rw.low)+"–"+fmt(rw.high);c.append(s);}c.title=rw.reliability.reasons.join(" ");});
    const d=rows[2].expected_borrowers/rows[0].expected_borrowers-1;const dc=tr.insertCell();dc.className="num "+cls(d);dc.textContent=fmtPct(d);
    const rel=rows[2].reliability;const rcell=tr.insertCell();const chip=document.createElement("span");chip.className="relchip r"+rel.rating;chip.textContent=rel.label;rcell.title=rel.reasons.join(" ");rcell.append(chip);});
  const tr=tb.insertRow();tr.style.fontWeight="600";const a=tr.insertCell();a.textContent="Totalt";tr.insertCell();
  const totals=FY.map(y=>d3.sum(FG,g=>futureRow(g,y,kom,fuScen,fuGoals).expected_borrowers));
  totals.forEach(v=>{const c=tr.insertCell();c.className="num";c.textContent=fmt(v);});const dc=tr.insertCell();const d=totals[2]/totals[0]-1;dc.className="num "+cls(d);dc.textContent=fmtPct(d);tr.insertCell();
}

function drawAll(){
  if(!document.getElementById("overview").hidden) drawOverview();
  if(!document.getElementById("reach").hidden) drawReach();
  if(!document.getElementById("compare").hidden) drawCompare();
  if(!document.getElementById("future").hidden) drawFuture();
}
drawAll();
let rz; new ResizeObserver(()=>{clearTimeout(rz);rz=setTimeout(drawAll,80);}).observe(document.querySelector("main"));

/* ---------- Reliability: fixed rules, computed in code ---------- */
const REL_LABEL={en:["Uncertain","Indicative","Reliable"],sv:["Osäkert","Indikation","Tillförlitligt"]};
function monthlyNoise(branch,metric){
  // spread of same-month-last-year changes (2025 vs 2024) for this branch, or all branches
  const val=(y,m)=>d3.sum(BM.filter(r=>r.year===y&&r.m===m&&(!branch||r.branch===branch)),r=>r[metric]);
  const ch=d3.range(1,13).map(m=>{const a=val(2024,m),b=val(2025,m);return a?b/a-1:null;}).filter(v=>v!=null);
  return ch.length>2?d3.deviation(ch):null;
}
function assessChange({before,after,branch,metric,months=1}){
  const a=+before,b=+after,reasons=[];
  if(!(a>0)||!(b>=0)) return {rating:0,reasons:["För lite data för att jämföra."]};
  const pois=Math.sqrt(a+b);
  let noise=pois, how="den slumpmässiga variationen för tal av den här storleken";
  const sd=metric&&METRICS.includes(metric)?monthlyNoise(branch,metric):null;
  if(sd!=null){const emp=a*sd/Math.pow(Math.max(1,months),0.25); /* conservative: months are partly connected, so they count less than independent samples */if(emp>noise){noise=emp;how="hur mycket "+(branch||"biblioteken")+" normalt varierar från år till år";}}
  const z=Math.abs(b-a)/noise, pctTxt=fmtPct(b/a-1);
  let rating;
  if(z>=2){rating=2;reasons.push(`Förändringen (${pctTxt}) är tydligt större än ${how}.`);}
  else if(z>=1){rating=1;reasons.push(`Förändringen (${pctTxt}) är större än vanligt men kan ändå vara slump, med tanke på ${how}.`);}
  else{rating=0;reasons.push(`Förändringen (${pctTxt}) ligger inom ${how}.`);}
  return {rating,reasons,noise_band:"±"+fmt(Math.round(2*noise)),z:+z.toFixed(1)};
}
function assessReliability(i){
  let rating=2;const reasons=[];const cap=(r,why)=>{if(r<rating)rating=r;reasons.push(why);};
  const k=String(i.kind||"");
  if(k==="count"){const n=+i.count;
    if(n<10){cap(0,`Färre än 10 – för få för att redovisa.`);}
    else if(n<50)cap(0,`Bygger på bara ${fmt(n)}, så små förändringar slår igenom kraftigt.`);
    else if(n<500)cap(1,`Bygger på ${fmt(n)}; räcker för en grov bild.`);
    else reasons.push(`Bygger på ${fmt(n)}.`);}
  else if(k==="share"){const num=+i.numerator,den=+i.denominator;
    if(!(den>0)) cap(0,"Ingen gruppstorlek angiven.");
    else if(den<10) cap(0,"Gruppen har färre än 10 personer – för få för att redovisa.");
    else{const p=num/den,moe=196*Math.sqrt(p*(1-p)/den);const txt=`felmarginal omkring ±${moe<1?dec(moe,1):Math.round(moe)} procentenheter (grupp på ${fmt(den)})`;
      if(moe>10)cap(0,`Bred ${txt}.`);else if(moe>3)cap(1,`Måttlig ${txt}.`);else reasons.push(`Smal ${txt}.`);}}
  else if(k==="change"){const c=assessChange(i);cap(c.rating,c.reasons[0]);}
  else if(k==="area_pattern"){const n=+i.n_areas;
    if(!(n>=8))cap(0,`Bara ${n||"några få"} områden – för få för att visa ett mönster.`);
    else cap(1,`Ett mönster över ${n} områden visar ett samband, inte en orsak, och säger ingenting om enskilda personer.`);}
  else if(k==="description"){reasons.push("En direkt räkning ur datan.");}
  else cap(1,"Okänd typ av resultat; behandla som indikation.");
  if(i.partial_period) cap(Math.min(rating,1),"Gäller bara en del av en period.");
  if(i.single_period) cap(Math.min(rating,1),"Bygger på en enda period; en ovanlig månad eller ett ovanligt år kan vilseleda.");
  const out={rating,label:REL_LABEL.sv[rating],reasons};
  if(i.example_data) out.note="Bygger på exempeldata, så resultatet visar bara hur verktyget fungerar.";
  return out;
}

/* ---------- AI: tools over the tables ---------- */
function inRange(mo,from,to){return (!from||mo>=from)&&(!to||mo<=to);}
function arr(v){return Array.isArray(v)?v.map(String):v?[String(v)]:[];}
const TOOLS=[
 {name:"query_library_activity",
  description:"Sums monthly branch activity (example data shaped like a library-system export, Jan 2024–Sep 2026). Returns rows grouped as asked, plus optional derived ratios. Use for loans, visits, events, open hours by branch, stadsområde, month or year.",
  inputSchema:{type:"object",properties:{
    metrics:{type:"array",items:{type:"string",enum:METRICS}},
    group_by:{type:"array",items:{type:"string",enum:["year","month","branch","stadsomrade"]},description:"Empty = one total row."},
    from:{type:"string",description:"First month, YYYY-MM"},to:{type:"string",description:"Last month, YYYY-MM"},
    months_of_year:{type:"array",items:{type:"integer"},description:"Optional, e.g. [1..9] to compare the same months across years"},
    branches:{type:"array",items:{type:"string"}},stadsomraden:{type:"array",items:{type:"string"}},
    derived:{type:"array",items:{type:"string",enum:["loans_per_visit","children_share","visits_per_open_hour","participants_per_event"]}}},required:["metrics"]},
  execute(i){
    const ms=arr(i.metrics).filter(m=>METRICS.includes(m)); if(!ms.length) throw new Error("metrics must include one of "+METRICS.join(", "));
    const gb=arr(i.group_by).map(g=>g==="stadsomrade"?"area":g), br=arr(i.branches), ar=arr(i.stadsomraden), moy=(i.months_of_year||[]).map(Number);
    const unknown=br.filter(b=>!BRANCHES.includes(b)); if(unknown.length) throw new Error("Unknown branch: "+unknown.join(", ")+". Valid: "+BRANCHES.join(", "));
    const rows=BM.filter(r=>inRange(r.month,i.from,i.to)&&(!br.length||br.includes(r.branch))&&(!ar.length||ar.includes(r.area))&&(!moy.length||moy.includes(r.m)));
    const g=d3.rollups(rows,v=>{const o={};const need=new Set(ms);arr(i.derived).forEach(d=>{({loans_per_visit:["loans_physical","visits"],children_share:["loans_children","loans_physical"],visits_per_open_hour:["visits","open_hours"],participants_per_event:["event_participants","events"]})[d]?.forEach(x=>need.add(x));});
        need.forEach(m=>o[m]=d3.sum(v,r=>r[m]));
        arr(i.derived).forEach(d=>{const r={loans_per_visit:o.loans_physical/o.visits,children_share:o.loans_children/o.loans_physical,visits_per_open_hour:o.visits/o.open_hours,participants_per_event:o.event_participants/o.events}[d];if(r!=null&&isFinite(r))o[d]=+r.toFixed(3);});
        o.months_covered=new Set(v.map(r=>r.month)).size;return o;},
      ...gb.map(k=>r=>k==="year"?r.year:r[k]));
    const flat=[];const walk=(node,keys,depth)=>{for(const [k,v] of node){const kk={...keys,[gb[depth]==="area"?"stadsomrade":gb[depth]]:k};if(depth<gb.length-1)walk(v,kk,depth+1);else flat.push({...kk,...v});}};
    if(gb.length) walk(g,{},0); else flat.push(g);
    if(flat.length>400) throw new Error(flat.length+" rows; narrow the request (fewer groups or a shorter period).");
    return {rows:flat,note:"Exempeldata. Lånen inkluderar omlån."};}},
 {name:"query_digital",description:"Monthly system-wide digital use (example data): e-book loans, e-audiobook loans, website sessions, catalogue searches. Returns rows by month or year.",
  inputSchema:{type:"object",properties:{group_by:{type:"string",enum:["month","year"]},from:{type:"string"},to:{type:"string"},months_of_year:{type:"array",items:{type:"integer"}}}},
  execute(i){const moy=(i.months_of_year||[]).map(Number);const rows=DIG.filter(r=>inRange(r.month,i.from,i.to)&&(!moy.length||moy.includes(+r.month.slice(5))));
    if(i.group_by==="year") return d3.rollups(rows,v=>({eloans_ebook:d3.sum(v,r=>r.eloans_ebook),eloans_audiobook:d3.sum(v,r=>r.eloans_audiobook),web_sessions:d3.sum(v,r=>r.web_sessions),catalogue_searches:d3.sum(v,r=>r.catalogue_searches),months:v.length}),r=>r.year).map(([year,o])=>({year,...o}));
    return rows.map(({year,...r})=>r);}},
 {name:"query_reach",description:"Active borrowers (≥1 loan in the year) by home stadsområde and age band, with residents and reach share (example data). 2026 covers Jan–Sep only. Group by any of year, stadsomrade, age_band.",
  inputSchema:{type:"object",properties:{years:{type:"array",items:{type:"integer"}},group_by:{type:"array",items:{type:"string",enum:["year","stadsomrade","age_band"]}},stadsomraden:{type:"array",items:{type:"string"}},age_bands:{type:"array",items:{type:"string",enum:BANDS}}}},
  execute(i){const ys=(i.years||[]).map(Number),ar=arr(i.stadsomraden),bd=arr(i.age_bands),gb=arr(i.group_by);
    const rows=AB.filter(r=>(!ys.length||ys.includes(r.year))&&(!ar.length||ar.includes(r.area))&&(!bd.length||bd.includes(r.age_band))).map(r=>({...r,population:POP.find(p=>p.area===r.area&&p.age_band===r.age_band).population}));
    const key=r=>gb.map(g=>g==="stadsomrade"?r.area:r[g]).join("|");
    return d3.rollups(rows,v=>{const o={};gb.forEach(g=>o[g]=g==="stadsomrade"?v[0].area:v[0][g]);o.active_borrowers=d3.sum(v,r=>r.active);o.residents=d3.sum(v,r=>r.population)/new Set(v.map(r=>r.year)).size;o.reach_pct=+(100*o.active_borrowers/o.residents).toFixed(1);return o;},key).map(d=>d[1]);}},
 {name:"query_kolada",description:"Real public statistics from Kolada (KB/SCB), annual, per kommun. KPIs: "+Object.entries(KN).map(([k,v])=>k+" = "+v).join("; ")+". Kommuner: "+KOMM.join(", ")+". Years 2019–2025 (Malmö and Eslöv also 2019–2025 for all).",
  inputSchema:{type:"object",properties:{kpi_ids:{type:"array",items:{type:"string"}},kommuner:{type:"array",items:{type:"string"}},from_year:{type:"integer"},to_year:{type:"integer"}},required:["kpi_ids"]},
  execute(i){const ks=arr(i.kpi_ids),km=arr(i.kommuner);return KOL.filter(r=>ks.includes(r.kpi)&&(!km.length||km.includes(r.kommun))&&(!i.from_year||r.year>=i.from_year)&&(!i.to_year||r.year<=i.to_year)).map(r=>({kpi:r.kpi,kommun:r.kommun,year:r.year,value:+r.value.toFixed(3)}));}},
 {name:"check_reliability",description:"Rates how much a result can be trusted, using fixed rules. Call it for the main result of every answer before writing the reliability line. kind: 'count' (one total), 'share' (a percentage of a group), 'change' (before vs after), 'area_pattern' (a relationship across areas), 'description' (a plain fact from the data). Returns rating 0-2, label and plain-language reasons.",
  inputSchema:{type:"object",properties:{kind:{type:"string",enum:["count","share","change","area_pattern","description"]},count:{type:"number"},numerator:{type:"number"},denominator:{type:"number",description:"Group size, e.g. residents in the group"},before:{type:"number"},after:{type:"number"},months:{type:"integer",description:"Months each side of a change covers"},branch:{type:"string"},metric:{type:"string",enum:METRICS},n_areas:{type:"integer"},partial_period:{type:"boolean"},single_period:{type:"boolean"},example_data:{type:"boolean"}},required:["kind"]},
  execute(i){return assessReliability(i||{});}},
 {name:"query_future",description:"Population projection (real, SCB regional projection 2024) by age group for Malmö or Eslöv for 2025, 2030, 2035, 2040, combined with the library's reach per age group (example data) under a scenario: 'same' (today's reach), 'trend' (teen reach keeps falling 8%/yr to 2030), or 'goal' (reach moves to given 2030 targets). Returns population, reach, expected active borrowers with a low–high range, and a reliability rating per row. Age groups: "+FG.join(", ")+".",
  inputSchema:{type:"object",properties:{kommun:{type:"string",enum:["Malmö","Eslöv"]},scenario:{type:"string",enum:["same","trend","goal"]},goals_pct:{type:"object",description:"For scenario 'goal': target reach in percent per age group name, e.g. {\"15–19 år\": 30}"},groups:{type:"array",items:{type:"string",enum:FG}},years:{type:"array",items:{type:"integer",enum:FY}}},required:["kommun"]},
  execute(i){const kom=i.kommun==="Eslöv"?"Eslöv":"Malmö",scen=["same","trend","goal"].includes(i.scenario)?i.scenario:"same";const gs=arr(i.groups).filter(g=>FG.includes(g));const ys=(i.years||[]).map(Number).filter(y=>FY.includes(y));
    const goals={...REACH0};if(i.goals_pct&&typeof i.goals_pct==="object")for(const [k,v] of Object.entries(i.goals_pct))if(FG.includes(k)&&isFinite(+v))goals[k]=+v/100;
    const out=[];(gs.length?gs:FG).forEach(g=>(ys.length?ys:FY).forEach(y=>{const rw=futureRow(g,y,kom,scen,goals);out.push({...rw,reliability:rw.reliability.label+": "+rw.reliability.reasons.join(" ")});}));
    return {rows:out,note:"Population is SCB's real projection (2024 edition), which assumes no planned housing. Reach is example data."};}},
 {name:"get_projection_revisions",description:"How SCB's projection for Malmö changed between the 2022 and 2024 editions, per age group, for 2030 and 2040. Large revisions mean the projection is uncertain.",
  execute(){return FG.map(g=>({group:g,y2030_ed2022:PROJ.proj2022_malmo[g]["2030"],y2030_ed2024:PROJ.proj2024["Malmö"][g][1],y2040_ed2022:PROJ.proj2022_malmo[g]["2040"],y2040_ed2024:PROJ.proj2024["Malmö"][g][3]}));}},
 {name:"get_notes",description:"Staff notes about events that affect the numbers (closures, opening-hour changes, new branches). Example notes. Check these before explaining a change.",
  execute(){return NOTES;}}
];

const RULES=`You are the statistics assistant for the public libraries in Malmö, used by a library director to get quick answers and follow-ups about library statistics.

DATA YOU CAN QUERY (through your tools only):
- Branch activity per month, Jan 2024 to Sep 2026 (latest month: ${LAST}). Branches: ${BRANCHES.join(", ")}. Stadsområden: ${AREAS.join(", ")}.
- Digital use per month, active borrowers and residents by stadsområde and age band (0-12, 13-19, 20-64, 65+).
- Real Kolada indicators 2019-2025 for Malmö, Eslöv, Lund, Helsingborg, Göteborg, Stockholm, Uppsala.
- Real SCB population projections (2024 edition, and the 2022 edition for Malmö) by age group to 2040, combined with example reach per age group into scenarios (query_future, get_projection_revisions). For future questions, always state the scenario's assumption, give ranges not single numbers, and say that SCB's projection assumes no planned housing.
- Staff notes.
All branch, digital, reach and note data is EXAMPLE data for this prototype; Kolada data is real. Say which kind a number comes from when it matters.

DEFINITIONS: physical loans include renewals (as in KB statistics). A visit is a door-counter passage. An active borrower made at least one loan in the year. Reach = active borrowers / residents in the group. 2026 is incomplete: compare Jan-Sep 2026 with Jan-Sep 2025 (use months_of_year), never full years against a partial year.

HOW TO ANSWER:
- Get every number from a tool call. Never estimate or recall figures.
- Lead with the direct answer in 1-2 sentences, then the few figures that support it. Keep it short: a director reading between meetings.
- When explaining a change, check get_notes and break the change down (by branch, area, month or age) to find where it comes from. Separate what the data shows from possible explanations, and label explanations as possibilities.
- If the data cannot answer the question, say what data would.
- Format: plain paragraphs and short "- " bullet lists. Use **bold** sparingly for key figures. No tables, no headings.
- Write numbers with spaces as thousands separators and decimal commas in Swedish, commas as thousands separators in English. Answer in the language of the question; the default user writes Swedish.
- End with one short line starting "Nästa:" (or "Next:" when answering in English) suggesting the most useful follow-up question.

RELIABILITY (required on every answer with numbers):
- Call check_reliability for the answer's main result (and for any other result the conclusion rests on). Use the lowest rating among them.
- Then, after that last line, write exactly one final line in this form: [[reliability:R|LANG]] reason
  where R is 0, 1 or 2 from the tool, LANG is sv or en (the language of the question), and reason is one short plain sentence a non-statistician understands, built from the tool's reasons (they are in Swedish; translate them if answering in English) (for example "The drop is within how much this branch normally varies."). Mention example data there when the tool's note says so.
- Let the rating shape your wording: rating 0 → say clearly that the data cannot support a firm conclusion; rating 1 → use "suggests", "may"; rating 2 → you may state it plainly.
- Relationships across areas are never causes and never describe individuals.`;

const FALLBACK_DATA=()=>{
  const byYB=d3.rollups(BM.filter(r=>r.m<=9),v=>[d3.sum(v,r=>r.loans_physical),d3.sum(v,r=>r.visits),d3.sum(v,r=>r.event_participants),d3.sum(v,r=>r.open_hours)],r=>r.year,r=>r.branch);
  let s="BRANCH TOTALS Jan-Sep (year,branch,loans,visits,event_participants,open_hours):\n";byYB.forEach(([y,bs])=>bs.forEach(([b,v])=>s+=`${y},${b},${v.join(",")}\n`));
  s+="\nMONTHLY ALL BRANCHES (month,loans,visits):\n"+d3.rollups(BM,v=>[d3.sum(v,r=>r.loans_physical),d3.sum(v,r=>r.visits)],r=>r.month).map(([m,v])=>m+","+v.join(",")).join("\n");
  s+="\n\nREACH (year,stadsomrade,age_band,active,residents):\n"+AB.map(r=>[r.year,r.area,r.age_band,r.active,POP.find(p=>p.area===r.area&&p.age_band===r.age_band).population].join(",")).join("\n");
  s+="\n\nKOLADA (kpi,kommun,year,value):\n"+KOL.map(r=>[r.kpi,r.kommun,r.year,r.value.toFixed(2)].join(",")).join("\n");
  s+="\n\nSCB PROJECTION 2024 (kommun,group,2025,2030,2035,2040) and example reach today:\n"+["Malmö","Eslöv"].map(k=>FG.map(g=>[k,g,...PROJ.proj2024[k][g],Math.round(REACH0[g]*100)+"%"].join(",")).join("\n")).join("\n");
  s+="\n\nNOTES:\n"+NOTES.map(n=>n.month+" "+n.branch+": "+n.note).join("\n");
  return s;};

const log=document.getElementById("log"), q=document.getElementById("q"), send=document.getElementById("send"), stop=document.getElementById("stop"), sugg=document.getElementById("sugg");
const SUGG=["Varför minskade Lindängen i mars 2026?","Vilken åldersgrupp tappar vi, och var?","Hur många aktiva tonårslåntagare har vi 2030 om räckvidden når 30 %?","Hur står sig Malmö mot Lund och Göteborg i besök per invånare?"];
let turns=[], ctl=null, sample=null, useTools=false, busy=false;

function renderAnswer(el,text){
  const m=text.match(/\[\[reliability:([0-2])(?:\|(sv|en))?\]\]\s*([^\n]*)\s*$/);
  const body=text.replace(/\n?\[\[reliability[^\n]*$/,"").replace(/\n?\[\[[^\n]*$/,"");
  renderMd(el,body);
  if(m){const r=+m[1],lang=m[2]||"sv";const d=document.createElement("div");d.className="rel r"+r;
    const b=document.createElement("b");b.textContent=REL_LABEL[lang][r];const s=document.createElement("span");s.textContent=m[3];d.append(b,s);el.append(d);}
}
function renderMd(el,text){
  el.replaceChildren();
  const blocks=text.replace(/\r/g,"").split(/\n{2,}/);
  blocks.forEach(b=>{const lines=b.split("\n").filter(l=>l.trim());if(!lines.length)return;
    if(lines.every(l=>/^\s*([-*•]|\d+[.)])\s+/.test(l))){const ol=/^\s*\d/.test(lines[0]);const list=document.createElement(ol?"ol":"ul");lines.forEach(l=>{const li=document.createElement("li");inline(li,l.replace(/^\s*([-*•]|\d+[.)])\s+/,""));list.append(li);});el.append(list);}
    else{let p=document.createElement("p");lines.forEach((l,i)=>{if(/^\s*([-*•])\s+/.test(l)){if(p.childNodes.length)el.append(p);const ul=document.createElement("ul");const li=document.createElement("li");inline(li,l.replace(/^\s*[-*•]\s+/,""));ul.append(li);el.append(ul);p=document.createElement("p");}else{if(p.childNodes.length)p.append(document.createElement("br"));inline(p,l.replace(/^#+\s*/,""));}});if(p.childNodes.length)el.append(p);}});
}
function inline(el,s){s.split(/(\*\*[^*]+\*\*)/g).forEach(part=>{if(/^\*\*[^*]+\*\*$/.test(part)){const b=document.createElement("b");b.textContent=part.slice(2,-2);el.append(b);}else if(part)el.append(part);});}

function addMsg(role,text){const d=document.createElement("div");d.className="msg "+role;if(role==="user")d.textContent=text;else if(text)renderMd(d,text);log.append(d);log.scrollTop=log.scrollHeight;return d;}

function intro(){const d=addMsg("bot","");renderMd(d,"Fråga vad du vill om siffrorna på sidan, som du skulle fråga en kollega. Jag kan bryta ner siffror per bibliotek, stadsområde, månad och åldersgrupp, jämföra med andra kommuner i Kolada och visa vilka frågor mot datan som ligger bakom varje svar.\n\nKom ihåg att siffrorna per bibliotek och område här är **exempeldata**. Bara jämförelserna från Kolada är riktiga.");}

function setBusy(b){busy=b;send.disabled=b;stop.hidden=!b;sugg.querySelectorAll("button").forEach(x=>x.disabled=b);}

async function ask(text){
  text=text.trim(); if(!text||busy||!sample) return;
  q.value=""; autosize(); addMsg("user",text); turns.push({role:"user",content:text});
  const bot=addMsg("bot",""); const out=document.createElement("div"); const th=document.createElement("p"); th.className="thinking"; th.textContent="Tänker…"; out.append(th); bot.append(out);
  const calls=[]; const det=document.createElement("details"); det.className="calc"; const sum=document.createElement("summary"); det.append(sum); const code=document.createElement("code"); det.append(code);
  const updCalc=()=>{if(!calls.length)return;sum.textContent="Så räknade jag ("+calls.length+" "+(calls.length===1?"fråga":"frågor")+" mot datan)";code.textContent=calls.map(c=>c.name+"("+JSON.stringify(c.input)+") → "+c.rows).join("\n\n");if(!det.isConnected)bot.append(det);};
  const tools=useTools?TOOLS.map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema,execute:(input)=>{
      if(!out.firstChild||out.firstChild===th) th.textContent="Hämtar data…";
      try{const r=t.execute(input||{});calls.push({name:t.name,input,rows:Array.isArray(r)?r.length+" rows":Array.isArray(r?.rows)?r.rows.length+" rows":"ok"});updCalc();return r;}
      catch(e){calls.push({name:t.name,input,rows:"error: "+e.message});updCalc();throw e;}}})):undefined;
  const history=turns.slice(-12);
  const lead=useTools?RULES:RULES+"\n\nYou have no tools in this view, so judge reliability yourself with these rules: totals under 50 → 0, under 500 → 1; a share's group under 10 → 0; changes smaller than about 5% for a single branch → 0; patterns across fewer than 8 areas → 0, otherwise at most 1; partial periods at most 1. Use only this data:\n\n"+FALLBACK_DATA();
  ctl=new AbortController(); setBusy(true);
  try{
    const opts={signal:ctl.signal,onText:({text})=>{renderAnswer(out,text);log.scrollTop=log.scrollHeight;}};
    if(tools) opts.tools=tools; else opts.cache=false;
    const res=await sample([{role:"user",content:lead},...(history[0]?.role==="assistant"?history.slice(1):history)],opts);
    turns.push({role:"assistant",content:res.text});
    if(res.truncated){const n=document.createElement("p");n.className="err";n.textContent="Svaret blev avkortat. Prova en smalare fråga.";bot.append(n);}
  }catch(e){
    if(e.text) renderAnswer(out,e.text); else out.replaceChildren();
    const msg={not_granted:"AI:n är inte tillåten på den här sidan. Du kan tillåta den under sidans behörigheter.",sampling_disabled:"AI:n är inte tillgänglig för det här kontot.",rate_limited:"För många frågor på kort tid. Vänta en stund och fråga igen.",session_expired:"Din session har gått ut. Logga in igen och ladda om sidan.",refused:"AI:n kunde inte svara på det. Prova att formulera om frågan.",prompt_too_large:"Samtalet blev för långt. Ladda om sidan för att börja om."}[e.code];
    if(e.code!=="cancelled"){const n=document.createElement("p");n.className="err";n.textContent=msg||"Något gick fel. Fråga igen.";bot.append(n);}
    if(["not_granted","sampling_disabled","not_declared","capability_disabled"].includes(e.code)) disableAI(msg);
    turns.pop();
  }finally{setBusy(false);ctl=null;log.scrollTop=log.scrollHeight;}
}
function disableAI(msg){document.querySelector(".composer").hidden=true;sugg.hidden=true;const d=document.createElement("p");d.className="ai-off";d.textContent=msg||"Det går inte att fråga AI:n i den här vyn. Själva dashboarden fungerar som vanligt.";log.after(d);}
function autosize(){q.style.height="auto";q.style.height=Math.min(140,q.scrollHeight)+"px";}
q.addEventListener("input",autosize);
q.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask(q.value);}});
send.addEventListener("click",()=>ask(q.value));
stop.addEventListener("click",()=>ctl?.abort());
SUGG.forEach(s=>{const b=document.createElement("button");b.type="button";b.textContent=s;b.addEventListener("click",()=>ask(s));sugg.append(b);});
intro(); setBusy(true); send.disabled=true;
(async()=>{
  // I Claude: Claudes egen AI. Lokalt (npm run dev): llm-shim.js mot ett OpenAI-kompatibelt API, t.ex. Berget.
  try{
    if(window.claude) sample=await window.claude.use("sample");
    else if(window.__localSample) sample=await window.__localSample();
  }catch{sample=null;}
  if(!sample){disableAI();setBusy(false);return;}
  try{const lim=await sample.limits();useTools=!!lim?.tools;}catch{useTools=false;}
  setBusy(false);
})();
