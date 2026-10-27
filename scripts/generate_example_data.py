"""Genererar EXEMPELDATA för biblioteken i Malmö (inte riktiga siffror).

Skriver data/branch_month.csv, data/digital_month.csv, data/active_borrowers.csv och
data/area_population_example.csv. Siffrorna är kalibrerade mot Malmös totaler i Kolada 2025
och innehåller några inbyggda mönster som AI:n ska kunna hitta:
  - Lindängenbiblioteket stängt cirka tre veckor i mars 2026
  - Limhamnsbiblioteket söndagsöppet från september 2025
  - Hylliebiblioteket nytt, användningen byggs upp under 2024
  - Räckvidden bland 13–19-åringar sjunker 2025–2026
Ersätt de här filerna med riktiga exporter från Sierra/Quria när de finns.

Kör från projektets rot:  python3 scripts/generate_example_data.py
"""
import csv, random, math
random.seed(42)
branches=[("Stadsbiblioteket","Innerstaden",.38,.34,.30),("Garaget","Innerstaden",.03,.07,.25),
("Rosengårdsbiblioteket","Öster",.06,.12,.55),("Husiebiblioteket","Öster",.05,.04,.45),
("Oxiebiblioteket","Öster",.05,.035,.48),("Kirsebergsbiblioteket","Norr",.06,.055,.42),
("Lindängenbiblioteket","Söder",.05,.07,.52),("Hylliebiblioteket","Söder",.07,.08,.44),
("Tygelsjöbiblioteket","Söder",.02,.015,.50),("Bellevuegårdsbiblioteket","Väster",.06,.05,.43),
("Limhamnsbiblioteket","Väster",.11,.065,.40),("Bunkeflostrands bibliotek","Väster",.06,.04,.50)]
vs=sum(b[3] for b in branches)
LOANS_2025=1_775_000; VISITS_2025=1_820_000
season_l=[1.05,1.0,1.05,0.98,0.95,0.92,1.08,1.0,0.98,1.02,1.0,0.88]
season_v=[1.0,1.05,1.08,1.0,0.95,0.82,0.70,0.85,1.08,1.12,1.10,0.90]
sl=sum(season_l);sv=sum(season_v)
months=[(y,m) for y in (2024,2025,2026) for m in range(1,13) if not (y==2026 and m>9)]
rows=[]
for (y,m) in months:
    yf={2024:0.985,2025:1.0,2026:1.02}[y]
    vf={2024:0.94,2025:1.0,2026:1.03}[y]
    idx=(y-2024)*12+m-1
    for name,area,ls,vsh,kid in branches:
        lf=yf; vff=vf
        if name=="Hylliebiblioteket":
            g=min(1.0,0.62+0.025*idx); lf*=g; vff*=g
        if name=="Limhamnsbiblioteket" and (y,m)>=(2025,9):
            vff*=1.12; lf*=1.05
        if name=="Lindängenbiblioteket" and (y,m)==(2026,3):
            vff*=0.30; lf*=0.42
        teen_drag = 1.0
        loans=LOANS_2025*ls*season_l[m-1]/sl*12/12*lf*random.uniform(.96,1.04)
        visits=VISITS_2025*(vsh/vs)*season_v[m-1]/sv*vff*random.uniform(.95,1.05)
        kshare=kid*random.uniform(.95,1.05)*(1.08 if m in (6,7) else 1)
        ev_base={"Stadsbiblioteket":40,"Garaget":18,"Rosengårdsbiblioteket":22,"Hylliebiblioteket":14}.get(name,7)
        evm=0.35 if m==7 else (0.6 if m in (6,8,12) else 1)
        if name=="Lindängenbiblioteket" and (y,m)==(2026,3): evm*=0.2
        events=max(0,round(ev_base*evm*random.uniform(.8,1.2)))
        part=round(events*random.uniform(14,26))
        hours={"Stadsbiblioteket":68,"Garaget":48,"Rosengårdsbiblioteket":54,"Hylliebiblioteket":52}.get(name,40)
        if name=="Limhamnsbiblioteket" and (y,m)>=(2025,9): hours+=5
        hours_m=round(hours*4.33*(0.75 if m==7 else 1)*(0.3 if name=="Lindängenbiblioteket" and (y,m)==(2026,3) else 1))
        rows.append([f"{y}-{m:02d}",name,area,round(loans),round(loans*kshare),round(visits),events,part,hours_m])
with open('data/branch_month.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(["month","branch","stadsomrade","loans_physical","loans_children","visits","events","event_participants","open_hours"]); w.writerows(rows)
# digital, system-wide
drows=[]
for (y,m) in months:
    idx=(y-2024)*12+m-1
    eb=118000/12*(1-0.012*idx)*random.uniform(.93,1.07)*(1.15 if m in (7,12) else 1)
    ea=34000/12*(1+0.02*idx)*random.uniform(.93,1.07)*(1.1 if m in (7,12) else 1)
    web=310000*random.uniform(.92,1.08)*(0.8 if m==7 else 1)*(1+0.004*idx)
    cat=420000*random.uniform(.92,1.08)*(0.85 if m==7 else 1)
    drows.append([f"{y}-{m:02d}",round(eb),round(ea),round(web),round(cat)])
with open('data/digital_month.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(["month","eloans_ebook","eloans_audiobook","web_sessions","catalogue_searches"]); w.writerows(drows)
# area population (example) and active borrowers by area x age band x year
pop={"Innerstaden":103000,"Norr":62000,"Söder":84000,"Väster":71000,"Öster":47924}
bands=[("0-12",.15),("13-19",.08),("20-64",.62),("65+",.15)]
adj={"Innerstaden":{"0-12":.11,"13-19":.07,"20-64":.65,"65+":.17},"Öster":{"0-12":.19,"13-19":.10,"20-64":.58,"65+":.13}}
reach={"0-12":.46,"13-19":.24,"20-64":.22,"65+":.25}
areaf={"Innerstaden":1.10,"Norr":0.92,"Söder":0.96,"Väster":1.05,"Öster":0.88}
special={("Öster","20-64"):0.80,("Söder","13-19"):0.85,("Öster","0-12"):1.08,("Väster","65+"):1.25}
arows=[]; prow=[]
for a,p in pop.items():
    sh=adj.get(a,{b:s for b,s in bands})
    for b,_ in bands:
        pp=round(p*sh[b])
        prow.append([a,b,pp])
        for y in (2024,2025,2026):
            r=reach[b]*areaf[a]*special.get((a,b),1)
            if b=="13-19": r*={2024:1.0,2025:0.92,2026:0.85}[y]
            else: r*={2024:1.0,2025:0.995,2026:1.0}[y]
            if y==2026: r*=0.86  # Jan-Sep only
            arows.append([y,a,b,round(pp*r*random.uniform(.98,1.02))])
with open('data/area_population_example.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(["stadsomrade","age_band","population"]); w.writerows(prow)
with open('data/active_borrowers.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(["year","stadsomrade","age_band","active_borrowers"]); w.writerows(arows)
print(sum(r[3] for r in rows if r[0].startswith("2025")), sum(r[5] for r in rows if r[0].startswith("2025")))
print(sum(r[3] for r in arows if r[0]==2025), sum(p[2] for p in prow))
