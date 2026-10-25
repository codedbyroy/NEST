// Browser interaction test for the v2 console (Playwright). Usage: node tools/dashboard/v2/ui_test.js
// Expects results/nest/NEST_Dashboard.html (standalone build from tools/dashboard/v2/build.py).
const { chromium } = require('playwright');
const URL=process.env.NEST_URL||'file://'+require('path').resolve(__dirname,'../../../results/nest/NEST_Dashboard.html');
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROMIUM||undefined});
  const ctx = await b.newContext({ viewport:{width:1440,height:950}, reducedMotion:'reduce' }); // exact values; motion_test.js covers animation
  const p = await ctx.newPage(); const errs=[]; const R=[];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_TUNNEL')) errs.push(m.text()); });
  const ok = (name, cond, info='') => R.push(`${cond?'PASS':'FAIL'}  ${name}${info?'  ['+info+']':''}`);
  const S = (f, a) => p.evaluate(f, a);
  await p.goto(URL+'#overview'); await p.waitForTimeout(1200);
  // playback
  let m0 = await S(()=>PNM.st.min); await p.waitForTimeout(1000); let m1 = await S(()=>PNM.st.min);
  ok('play advances clock at 5x', m1-m0 > 3 && m1-m0 < 8, (m1-m0).toFixed(2)+' min/s');
  await p.click('#playBtn'); m0 = await S(()=>PNM.st.min); await p.waitForTimeout(600); m1 = await S(()=>PNM.st.min);
  ok('pause stops clock', m1===m0 && !(await S(()=>PNM.st.playing)));
  ok('play button label', (await p.getAttribute('#playBtn','aria-label'))==='Play simulation');
  await p.click('#speedSeg button[data-v="60"]'); ok('speed 60x', await S(()=>PNM.st.speed)===60 && (await p.getAttribute('#speedSeg button[data-v="60"]','aria-pressed'))==='true');
  await p.click('#speedSeg button[data-v="5"]');
  // scrub
  await p.$eval('#scrubIn', el => { el.value = 840; el.dispatchEvent(new Event('input',{bubbles:true})); });
  ok('scrub sets time', (await p.textContent('#clock')).startsWith('14:00'), await p.textContent('#clock'));
  await p.waitForTimeout(400);
  // consistency: overview demand vs sources hub vs sum of floor chips
  const ovKw = await S(()=>PNM.snapshot().kw);
  const ovTxt = await p.textContent('#kKw .n');
  const chipSum = await S(()=>{ let t=0; PNM.S.ZONES.forEach((z,zi)=>t+=PNM.zoneKW(zi,PNM.slotNow())); return t; });
  ok('overview demand KPI = snapshot', Math.abs(parseFloat(ovTxt)-ovKw) < 0.06, ovTxt+' vs '+ovKw.toFixed(2));
  ok('snapshot = sum of zone kW', Math.abs(chipSum-ovKw) < 1e-6);
  const kpiPpl = await p.textContent('#kPpl .n'); const snapPpl = await S(()=>PNM.snapshot().people);
  ok('people KPI = snapshot', +kpiPpl.replace(/,/g,'') === snapPpl, kpiPpl);
  // timeline click seeks
  await p.$eval('#ovTl', e => e.scrollIntoView({block:'center'})); await p.waitForTimeout(100); const box = await (await p.$('#ovTl svg')).boundingBox(); await p.mouse.click(box.x + box.width*0.5, box.y + box.height*0.5);
  const mt = await S(()=>PNM.st.min); ok('timeline click seeks', mt > 600 && mt < 780, mt.toFixed(0));
  // floor chip -> building
  await p.click('#ovFloors [data-f="2"]'); await p.waitForTimeout(500);
  ok('floor chip opens Building F2', (await S(()=>location.hash))==='#building' && (await p.textContent('#fpTitle'))==='Second floor');
  // sources hub equals overview demand at same time
  await p.$eval('#scrubIn', el => { el.value = 700; el.dispatchEvent(new Event('input',{bubbles:true})); });
  const want = await S(()=>PNM.snapshot().kw);
  await p.goto(URL+'#sources'); await p.waitForTimeout(300);
  await S(()=>{ PNM.st.min=700; PNM.st.playing=false; }); await p.waitForTimeout(1500);
  const hub = await p.evaluate(()=>[...document.querySelectorAll('#flow text')].map(t=>t.textContent).find(t=>/^\d+(\.\d)?$/.test(t.replace(/,/g,''))));
  const want2 = await S(()=>PNM.snapshot().kw);
  ok('sources hub = block demand', Math.abs(parseFloat(hub)-want2) < 0.06, hub+' vs '+want2.toFixed(2));
  const widths = await S(()=>[...document.querySelectorAll('#flow path.flowpath')].map(p=>parseFloat(p.style.strokeWidth)||0));
  ok('flow line widths scale with kW (no particles under reduced motion)', widths.length===7 && Math.max(...widths) > 2 && !(await S(()=>!!document.querySelector('#flow circle[r="3.2"]'))), widths.map(w=>w.toFixed(1)).join(','));
  // assumptions form
  await p.click('details.more summary'); await p.fill('#a_pv','50'); await p.click('#supForm button[type=submit]'); await p.waitForTimeout(600);
  const pvKwh = await p.textContent('#srcCards .sn'); ok('PV 50 kWp increases solar kWh', parseFloat(pvKwh.replace(/,/g,''))>115.7, pvKwh);
  await p.fill('#a_pv','25'); await p.click('#supForm button[type=submit]');
  // building interactions
  await p.goto(URL+'#building'); await S(()=>{PNM.st.playing=false; PNM.st.min=600;}); await p.waitForTimeout(800);
  await p.click('#flBtns [data-f="1"]'); await p.waitForTimeout(400);
  await p.click('#plan g[aria-label^="DKM-106"]'); await p.waitForTimeout(400);
  ok('room click selects room', (await p.textContent('#rc .rid'))==='106' && (await p.textContent('#twTitle')).startsWith('106'));
  await p.click('#plan g[aria-label^="DKM-104"]'); await p.waitForTimeout(300);
  await S(()=>{PNM.st.playing=false;});
  await p.click('#halfBtn'); await S(()=>{PNM.st.playing=false;}); await p.waitForTimeout(500);
  const z = await S(()=>{ const r=PNM.ROOM['DKM-104'], s=PNM.slotNow(); return r.zoneIdx.map(zi=>PNM.SIM.zones[zi].occ[s]); });
  ok('half-filled class: front full, back empty', z[0]===30 && z[1]===0, JSON.stringify(z));
  // advance 9 min and check back lights off, front on
  await S(()=>{ PNM.st.min += 9.5; }); await p.waitForTimeout(700);
  const st104 = await S(()=>{ const r=PNM.ROOM['DKM-104'], s=PNM.slotNow(); return r.zoneIdx.map(zi=>[PNM.circ(zi,0,s).on, PNM.circ(zi,1,s).on]); });
  ok('after ~9 min: back lights off, front lights on', st104[0][0]===true && st104[1][0]===false, JSON.stringify(st104));
  const pillTxt = await p.textContent('#twZones [data-z="1"] .zrow[data-k="0"] .sp'); ok('twin card shows back lights Off', /Off/.test(pillTxt), pillTxt);
  await S(()=>{ PNM.st.min += 8; }); await p.waitForTimeout(600);
  ok('after ~17 min: back fans off', await S(()=>{ const r=PNM.ROOM['DKM-104']; return !PNM.circ(r.zoneIdx[1],1,PNM.slotNow()).on; }));
  const peopleDots = await S(()=>document.querySelectorAll('#twStage g.person').length); ok('twin draws people for front zone', peopleDots>=30, String(peopleDots));
  await p.click('#twZones [data-z="1"] button[data-a="add"]'); await p.waitForTimeout(500);
  ok('+10 people in back zone', await S(()=>PNM.SIM.zones[PNM.ROOM['DKM-104'].zoneIdx[1]].occ[PNM.slotNow()])===10);
  await p.waitForTimeout(300);
  ok('back lights restored on presence', await S(()=>PNM.circ(PNM.ROOM['DKM-104'].zoneIdx[1],0,PNM.slotNow()).on));
  await p.click('#twZones [data-z="1"] button[data-a="reset"]');
  // metric seg
  await p.click('#metricSeg button[data-m="waste"]'); ok('metric seg Idle-on', (await p.getAttribute('#metricSeg button[data-m="waste"]','aria-pressed'))==='true');
  // controls + consistency with energy
  await p.goto(URL+'#energy'); await S(()=>{PNM.st.playing=false;}); await p.waitForTimeout(800);
  await p.click('#spanSeg button[data-v="full"]'); await p.waitForTimeout(1200);
  const withBefore = parseFloat((await p.textContent('#eA')).replace(/,/g,''));
  await p.goto(URL+'#controls'); await S(()=>{PNM.st.playing=false; PNM.st.min=600;}); await p.waitForTimeout(900);
  await p.click('#cfChips [data-f="1"]'); await p.waitForTimeout(300);
  const btn = await p.$('.dc[data-k="0"] .seg button[data-mode="on"]'); const zi = +(await btn.getAttribute('data-zi'));
  // force a currently-off light ON? pick 107 (empty) lights -> on
  await p.click('.dc[data-zi="'+(await S(()=>PNM.ROOM['DKM-107'].zoneIdx[0]))+'"][data-k="0"] .seg button[data-mode="on"]'); await p.waitForTimeout(800);
  const z107 = await S(()=>PNM.ROOM['DKM-107'].zoneIdx[0]);
  ok('override ON sets manual state', await S((zz)=>{const c=PNM.circ(zz,0,PNM.slotNow()); return c.on && c.manual;}, z107));
  ok('card pill shows Manual on', /Manual on/.test(await p.textContent(`.dc[data-zi="${z107}"][data-k="0"] .stp`)));
  ok('override logged', (await S(()=>PNM.st.ovrLog.length))>=1 && /107/.test(await S(()=>PNM.st.ovrLog[0].what)));
  await p.goto(URL+'#energy'); await p.waitForTimeout(1300);
  const withAfter = parseFloat((await p.textContent('#eA')).replace(/,/g,''));
  ok('override raises Energy "with" total', withAfter > withBefore, withBefore+' -> '+withAfter);
  await p.goto(URL+'#controls'); await p.waitForTimeout(500);
  await p.click('[data-bulk="auto"]'); await p.waitForTimeout(400);
  ok('All auto clears overrides on floor', await S((zz)=>!PNM.circ(zz,0,PNM.slotNow()).manual, z107));
  await p.click('#onlyW'); await p.waitForTimeout(400); ok('idle-on filter toggles', (await p.getAttribute('#onlyW','aria-checked'))==='true');
  await p.click('#onlyW');
  // energy controls
  await p.goto(URL+'#energy'); await p.waitForTimeout(800);
  await p.click('#scopeChips [data-s="2"]'); await p.waitForTimeout(500); ok('scope chip Floor 2', (await p.textContent('#byT'))==='By room');
  await p.click('#euSeg button[data-v="before"]'); ok('donut toggle', (await p.getAttribute('#euSeg button[data-v="before"]','aria-pressed'))==='true');
  await p.click('details.more >> nth=0'); await p.click('#rTable th[data-k="p"]'); ok('table sort by %', (await p.textContent('#rTable th[data-k="p"]')).includes('▼'));
  await p.click('#scopeChips [data-s="all"]');
  // scenario popover: baseline + AC policy
  const sBefore = parseFloat((await p.textContent('#eS')).replace(/,/g,''));
  await p.click('#scenBtn'); ok('scenario popover opens', !(await S(()=>document.getElementById('scenPop').hidden)));
  await p.click('#acSeg button[data-ac="switch"]'); await p.waitForTimeout(1500);
  const sAfter = parseFloat((await p.textContent('#eS')).replace(/,/g,''));
  ok('AC switch-off raises savings', sAfter > sBefore, sBefore+' -> '+sAfter);
  await p.selectOption('#baseSel','timeout'); await p.waitForTimeout(1500);
  ok('baseline text updates', /timeout/.test(await p.textContent('#scenTxt')) && /timeout/.test(await p.textContent('#eBn')), await p.textContent('#scenTxt'));
  await p.keyboard.press('Escape'); ok('Escape closes popover', await S(()=>document.getElementById('scenPop').hidden));
  await p.click('#scenBtn'); await p.click('#acSeg button[data-ac="hold"]'); await p.selectOption('#baseSel','manual'); await p.mouse.click(5,900);
  // day change
  const d0 = await S(()=>PNM.D.tot(PNM.D.bld,'after')); await p.selectOption('#daySel','5'); await p.waitForTimeout(800);
  const d1 = await S(()=>PNM.D.tot(PNM.D.bld,'after')); ok('day select changes data (Sat)', d1 < d0*0.7, (d0/1000).toFixed(1)+' -> '+(d1/1000).toFixed(1)+' kWh');
  await p.selectOption('#daySel','0');
  // insights + report
  await p.goto(URL+'#insights'); await p.waitForTimeout(4500);
  ok('insights week rendered', await S(()=>!!document.querySelector('#wk svg') && !!document.querySelector('#occH svg')));
  await p.click('#repCard summary'); await p.selectOption('#rp','day'); await p.click('#rf button[type=submit]'); await p.waitForTimeout(1500);
  ok('report generated', await S(()=>!!document.querySelector('#repOut .paper table')));
  await p.click('#cpCsv'); await p.waitForTimeout(500);
  const cp = await p.textContent('#cpMsg'); const box2 = await S(()=>{const t=document.getElementById('cpBox'); return t.hidden?'' : t.value.slice(0,60);});
  ok('CSV copy works (clipboard or fallback)', /copied/.test(cp) || box2.startsWith('day,room'), cp || box2);
  ok('print button present in local file', !!(await p.$('#prt')));
  // keyboard nav
  await p.goto(URL+'#overview'); await p.waitForTimeout(500); await p.click('#nav button[data-page="energy"]'); await p.waitForTimeout(400);
  ok('sidebar nav', (await S(()=>location.hash))==='#energy' && (await p.textContent('#pageTitle'))==='Energy');
  await p.goto(URL+'#map'); await p.waitForTimeout(400); ok('legacy #map -> Building', (await p.textContent('#pageTitle'))==='Building');
  console.log(R.join('\n')); console.log('FAILS', R.filter(x=>x.startsWith('FAIL')).length, '| errors', JSON.stringify(errs));
  await b.close();
})();
