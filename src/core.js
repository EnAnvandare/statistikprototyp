/* ---------- Gemensam kärna ----------
   Data, formatering, tillförlitlighetsregler, framtidsberäkningar och AI-verktyg.
   Ingen kod här får röra sidan (document, window): filen körs både i webbläsaren (före app.js)
   och i Node av scripts/fraga.mjs, så att Claude Code räknar med exakt samma kod som sidan.
   Kräver globala d3 och D (datan). */
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
function agg(rows, metric){ return d3.sum(rows, r=>r[metric]); }
function ytd(year, filt=()=>true){ return BM.filter(r=>r.year===year && r.m<=YTD_M && filt(r)); }

/* ---------- Kommuner och nyckeltal ---------- */
const KORDER=["N09801","N09807","N09809","N09811","N09805","N09026","N09810"];
const KOMM=["Malmö","Eslöv","Lund","Helsingborg","Göteborg","Stockholm","Uppsala"];
const kfmt=k=>k==="N09026"?LOC.format(",.0f"):k==="N09809"?(v=>dec(v,1)+"\u00a0%"):k==="N09805"||k==="N09811"?LOC.format(".1f"):LOC.format(".2f");

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

/* ---------- Future: calculations ---------- */
const PROJ=D.proj, FG=PROJ.groups, FY=PROJ.years;
const REACH0={"0–4 år":.30,"5–14 år":.52,"15–19 år":.24,"20–64 år":.21,"65–79 år":.25,"80+ år":.16};
const TREND={"15–19 år":-0.08};
function reachAt(g,y,scen="same",goals=REACH0){const r0=REACH0[g];if(scen==="trend"){const k=Math.min(y,2030)-2025;return r0*Math.pow(1+(TREND[g]||0),k);}
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

