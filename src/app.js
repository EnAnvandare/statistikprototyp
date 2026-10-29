/* ---------- Gränssnittet ----------
   Allt som ritar sidan. Beräkningar och AI-verktyg finns i core.js. */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

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

const cpSel=document.getElementById("cp-kpi"); KORDER.forEach(k=>cpSel.append(new Option(KN[k],k))); cpSel.addEventListener("change",drawCompare);
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
const GCOL={"0–4 år":"--s2","5–14 år":"--s3","15–19 år":"--s4","20–64 år":"--s6","65–79 år":"--s5","80+ år":"--s1"};
let fuScen="same";const fuGoals={...REACH0};
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
function autosize(){q.style.height="";if(!q.value)return;q.style.height="auto";q.style.height=Math.min(140,Math.max(42,q.scrollHeight+2))+"px";}
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
