(function(){
  if(typeof VITLOG_DATA === 'undefined'){
    console.error('data/dataset.js não foi carregado. Verifique se o arquivo existe e se o <script> em index.html aponta para o caminho correto.');
    return;
  }
  const RAW = VITLOG_DATA;

  const PALETTE = {
    accent:'#5B6EF5', accent2:'#34D399', accent3:'#F5B94D',
    danger:'#EF6B6B', blue:'#38BDF8', dim:'#93A1BC', faint:'#5C6A85',
    grid:'rgba(255,255,255,0.06)', panel:'#111A2B'
  };

  // Código "13" = falta de tempo → único que representa problema operacional real.
  // Os demais códigos são ocorrências encaminhadas ao comercial.
  const OPERATIONAL_CODE = '13';
  function parseOcorrenciaCodes(raw){
    if(raw === 0 || raw === '0' || raw === null || raw === undefined || raw === '') return [];
    return String(raw).split(',').map(s=>s.trim()).filter(s=> s!=='' && s!=='0');
  }
  function isOperationalCode(code){ return String(code).trim() === OPERATIONAL_CODE; }
  function occCounts(rows){
    let total=0, operational=0;
    rows.forEach(r=>{
      const codes = parseOcorrenciaCodes(r.ocorrencia);
      total += codes.length;
      operational += codes.filter(isOperationalCode).length;
    });
    return { total, operational, commercial: total-operational };
  }

  const CHARTS_AVAILABLE = typeof Chart !== 'undefined';
  if(CHARTS_AVAILABLE){
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = PALETTE.dim;
    Chart.defaults.font.size = 11.5;
  } else {
    console.warn('Chart.js indisponível — os gráficos serão ocultados, mas KPIs, filtros, insights e tabela continuam funcionando.');
  }

  // ---------- Helpers ----------
  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v||0);
  const fmtBRLfull = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const fmtNum = (v,d=0) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v||0);
  const fmtPct = (v) => (v*100).toFixed(1).replace('.',',') + '%';
  const fmtDate = (s) => { const [y,m,d] = s.split('-'); return `${d}/${m}`; };
  const fmtDateFull = (s) => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
  const sum = (arr,fn) => arr.reduce((a,r)=>a+(fn(r)||0),0);

  // ---------- Populate filters ----------
  const motoristas = [...new Set(RAW.map(r=>r.motorista))].sort();
  const cidades = [...new Set(RAW.map(r=>r.cidade))].sort();
  const dates = RAW.map(r=>r.data).sort();
  const minDate = dates[0], maxDate = dates[dates.length-1];

  const selMotorista = document.getElementById('fMotorista');
  motoristas.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.textContent=m; selMotorista.appendChild(o); });
  const selCidade = document.getElementById('fCidade');
  cidades.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; selCidade.appendChild(o); });

  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const mesesPresentes = [...new Set(RAW.map(r=>parseInt(r.data.slice(5,7),10)))].sort((a,b)=>a-b);
  const anosPresentes = [...new Set(RAW.map(r=>r.data.slice(0,4)))].sort();

  const selMes = document.getElementById('fMes');
  (() => {
    const oAll = document.createElement('option'); oAll.value='all'; oAll.textContent='Mês';
    selMes.appendChild(oAll);
    mesesPresentes.forEach(m=>{ const o=document.createElement('option'); o.value=String(m).padStart(2,'0'); o.textContent=MESES_PT[m-1]; selMes.appendChild(o); });
    selMes.value='all';
  })();

  const selAno = document.getElementById('fAno');
  (() => {
    const oAll = document.createElement('option'); oAll.value='all'; oAll.textContent='Ano';
    selAno.appendChild(oAll);
    anosPresentes.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; selAno.appendChild(o); });
    selAno.value='all';
  })();

  document.getElementById('periodSub').textContent =
    `Base "jan_26 (2)" · ${RAW.length} lançamentos · ${fmtDateFull(minDate)} a ${fmtDateFull(maxDate)}`;

  // ---------- State ----------
  let state = { motorista:'all', cidade:'all', meta:'all', mes:'all', ano:'all', busca:'' };
  let sortKey = 'data', sortDir = -1, page = 1, pageSize = 10;
  let charts = {};

  function getFiltered(){
    return RAW.filter(r=>{
      if(state.motorista!=='all' && r.motorista!==state.motorista) return false;
      if(state.cidade!=='all' && r.cidade!==state.cidade) return false;
      if(state.meta!=='all' && r.meta!==state.meta) return false;
      if(state.mes!=='all' && r.data.slice(5,7)!==state.mes) return false;
      if(state.ano!=='all' && r.data.slice(0,4)!==state.ano) return false;
      return true;
    });
  }

  // ---------- KPI rendering ----------
  const kpiIcons = {
    viagens: '<path d="M3 16.5V9a1 1 0 0 1 1-1h9l4 4v4.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>',
    money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.6-2.2 1.6 0 2.6.9 2.6 2 0 3-5.2 1.6-5.2 4.6 0 1.2 1.1 2.1 2.7 2.1 1.5 0 2.7-.8 2.7-2.2"/>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7l-3 6a3 3 0 0 0 6 0Zm14 0-3 6a3 3 0 0 0 6 0Z"/><path d="M5 7h14"/>',
    check: '<path d="M9 12.5 11.3 15 16 9.5"/><circle cx="12" cy="12" r="9"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    alert: '<path d="M12 9v4.2M12 17h.01"/><path d="M10.3 3.9 1.9 18.3a1.6 1.6 0 0 0 1.4 2.4h17.4a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z"/>',
    road: '<path d="M4 20 9 4h6l5 16M12 4v3M11 11h2M10 16h4"/>',
    percent: '<circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 15h.01"/><path d="M15 9 9 15"/>',
    package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'
  };

  function kpiCard(label, value, sub, color, icon){
    return `<div class="kpi-card" style="--kpi-color:${color}">
      <div class="kpi-label"><svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  }

  function renderKPIs(f){
    const totalFrete = sum(f,r=>r.valorFrete);
    const totalMercadoria = sum(f,r=>r.valorMercadoria);
    const totalPeso = sum(f,r=>r.peso);
    const totalEntregas = sum(f,r=>r.entregas);
    const totalRealizadas = sum(f,r=>r.realizadas);
    const totalRetornadas = sum(f,r=>r.retornadas);
    const totalVolumes = sum(f,r=>r.vols);
    const taxaSucesso = totalEntregas>0 ? totalRealizadas/totalEntregas : 0;
    const metaValidos = f.filter(r=>r.meta==='Atendeu a Meta' || r.meta==='Não Atendeu a Meta');
    const metaOk = metaValidos.filter(r=>r.meta==='Atendeu a Meta').length;
    const pctMeta = metaValidos.length>0 ? metaOk/metaValidos.length : 0;
    const avgPctFrete = totalMercadoria > 0 ? totalFrete / totalMercadoria : 0;
    const occ = occCounts(f);
    const kmValidos = f.filter(r=>r.kmDia>0);
    const totalKm = sum(kmValidos,r=>r.kmDia);

    const cards = [
      kpiCard('Viagens no período', fmtNum(f.length), `<b>${motoristas.length}</b> motoristas · <b>${cidades.length}</b> destinos`, PALETTE.accent, kpiIcons.viagens),
      kpiCard('Faturamento em Frete', fmtBRL(totalFrete), `Ticket médio <b>${fmtBRL(f.length? totalFrete/f.length:0)}</b>/viagem`, PALETTE.accent, kpiIcons.money),
      kpiCard('Valor em Mercadoria', fmtBRL(totalMercadoria), `Transportado no período filtrado`, PALETTE.blue, kpiIcons.box),
      kpiCard('Peso Transportado', fmtNum(totalPeso) + ' kg', `≈ <b>${fmtNum(totalPeso/1000,1)} t</b> no período`, PALETTE.blue, kpiIcons.scale),
      kpiCard('Entregas Concluídas', `${fmtNum(totalRealizadas)} / ${fmtNum(totalEntregas)}`, `<b>${fmtNum(totalRetornadas)}</b> notas retornadas`, PALETTE.accent2, kpiIcons.check),
      kpiCard('Performance de Entrega', fmtPct(taxaSucesso), `Realizadas sobre total programado`, PALETTE.accent2, kpiIcons.check),
      kpiCard('Frete sobre Mercadoria', fmtPct(avgPctFrete), `Percentual médio sobre valor de mercadoria`, PALETTE.accent3, kpiIcons.percent),
      kpiCard('Quantidade de Volumes', fmtNum(totalVolumes), `Total transportado no período`, PALETTE.accent2, kpiIcons.package),
    ];
    document.getElementById('kpiGrid').innerHTML = cards.join('');
    const kpiSubMes = state.mes==='all' ? 'Mês' : MESES_PT[parseInt(state.mes,10)-1];
    const kpiSubAno = state.ano==='all' ? 'Ano' : state.ano;
    document.getElementById('kpiSub').textContent = `${kpiSubMes} · ${kpiSubAno}`;
    document.getElementById('filterCount').textContent = `${f.length} de ${RAW.length} registros`;
  }

  // ---------- Ticker ----------
  function renderTicker(f){
    const totalFrete = sum(f,r=>r.valorFrete);
    const totalMercadoria = sum(f,r=>r.valorMercadoria);
    const totalPeso = sum(f,r=>r.peso);
    const totalVolumes = sum(f,r=>r.vols);
    const totalEntregas = sum(f,r=>r.entregas);
    const totalRealizadas = sum(f,r=>r.realizadas);
    const taxaSucesso = totalEntregas>0 ? totalRealizadas/totalEntregas : 0;
    const avgPctFrete = totalMercadoria > 0 ? totalFrete / totalMercadoria : 0;
    const topMotorista = Object.entries(f.reduce((a,r)=>{a[r.motorista]=(a[r.motorista]||0)+r.valorFrete; return a;},{})).sort((a,b)=>b[1]-a[1])[0];

    const items = [
      `VIAGENS <b>${fmtNum(f.length)}</b>`,
      `FRETE TOTAL <b>${fmtBRL(totalFrete)}</b>`,
      `MERCADORIA <b>${fmtBRL(totalMercadoria)}</b>`,
      `PESO <b>${fmtNum(totalPeso)} KG</b>`,
      `Performance de Entrega <b>${fmtPct(taxaSucesso)}</b>`,
      `% de Frete <b>${fmtPct(avgPctFrete)}</b>`,
      `Quantidade de Volumes <b>${fmtNum(totalVolumes)}</b>`,
      topMotorista ? `DESTAQUE <b>${topMotorista[0].toUpperCase()}</b>` : ''
    ].filter(Boolean);

    const html = items.map(t=>`<span class="ticker-item">${t}</span><span class="ticker-item dot">◆</span>`).join('');
    document.getElementById('tickerTrack').innerHTML = html + html; // duplicate for seamless loop
  }

  // ---------- Charts ----------
  function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

  function safeRenderChart(fn, f, canvasSelector){
    if(!CHARTS_AVAILABLE){
      const canvas = document.querySelector(canvasSelector);
      const box = canvas ? canvas.closest('.chart-box') : null;
      if(box && !box.dataset.fallbackShown){
        box.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-faint);font-size:12.5px;text-align:center;padding:0 20px;">Biblioteca de gráficos indisponível no momento.<br>Os indicadores e a tabela abaixo continuam completos.</div>';
        box.dataset.fallbackShown = '1';
      }
      return;
    }
    try{ fn(f); }
    catch(err){ console.error('Falha ao renderizar gráfico:', err); }
  }

  function renderChartFrete(f){
    destroyChart('frete');
    const byDate = {};
    f.forEach(r=>{ byDate[r.data]=(byDate[r.data]||0)+r.valorFrete; });
    const labels = Object.keys(byDate).sort();
    const data = labels.map(d=>byDate[d]);
    const ctx = document.getElementById('chartFrete').getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,280);
    grad.addColorStop(0,'rgba(91,110,245,0.32)');
    grad.addColorStop(1,'rgba(91,110,245,0.0)');
    charts.frete = new Chart(ctx,{
      type:'line',
      data:{ labels: labels.map(fmtDate), datasets:[{ data, borderColor:PALETTE.accent, backgroundColor:grad, borderWidth:2.5, pointRadius:2.5, pointBackgroundColor:PALETTE.accent, pointBorderColor:'#0A0A0A', tension:0.35, fill:true }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=> fmtBRLfull(c.parsed.y) }, backgroundColor:'#16213A', borderColor:PALETTE.accent, borderWidth:1, titleColor:'#fff', bodyColor:'#fff', padding:10 } },
        scales:{
          x:{ grid:{display:false}, ticks:{maxRotation:0, autoSkip:true, maxTicksLimit:9} },
          y:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtBRL(v) } }
        }
      }
    });
  }

  function renderChartMeta(f){
    destroyChart('meta');
    const ok = f.filter(r=>r.meta==='Atendeu a Meta').length;
    const no = f.filter(r=>r.meta==='Não Atendeu a Meta').length;
    const na = f.length - ok - no;
    const ctx = document.getElementById('chartMeta').getContext('2d');
    charts.meta = new Chart(ctx,{
      type:'doughnut',
      data:{ labels:['Atendeu a meta','Não atendeu','Indefinido'], datasets:[{ data:[ok,no,na], backgroundColor:[PALETTE.accent2, PALETTE.danger, PALETTE.faint], borderColor:PALETTE.panel, borderWidth:3, hoverOffset:6 }]},
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'68%',
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } },
          tooltip:{ backgroundColor:'#16213A', borderColor:PALETTE.accent2, borderWidth:1, padding:10 } }
      }
    });
  }

  function renderChartMotorista(f){
    destroyChart('motorista');
    const byMot = {};
    f.forEach(r=>{ byMot[r.motorista]=(byMot[r.motorista]||0)+r.valorFrete; });
    const sorted = Object.entries(byMot).sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartMotorista').getContext('2d');
    charts.motorista = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map(x=>x[0]), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.blue, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtBRLfull(c.parsed.x) }, backgroundColor:'#16213A', borderColor:PALETTE.blue, borderWidth:1, padding:10 } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtBRL(v) } }, y:{ grid:{display:false} } }
      }
    });
  }

  function renderChartCidade(f){
    destroyChart('cidade');
    const byCidade = {};
    f.forEach(r=>{ if(!byCidade[r.cidade]) byCidade[r.cidade]={real:0,ret:0}; byCidade[r.cidade].real+=r.realizadas; byCidade[r.cidade].ret+=r.retornadas; });
    const sorted = Object.entries(byCidade).sort((a,b)=>b[1].real-a[1].real);
    const ctx = document.getElementById('chartCidade').getContext('2d');
    charts.cidade = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map(x=>x[0]),
        datasets:[
          { label:'Realizadas', data: sorted.map(x=>x[1].real), backgroundColor:PALETTE.accent2, borderRadius:5, maxBarThickness:26 },
          { label:'Retornadas', data: sorted.map(x=>x[1].ret), backgroundColor:PALETTE.danger, borderRadius:5, maxBarThickness:26 }
        ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } }, tooltip:{ backgroundColor:'#16213A', borderWidth:1, padding:10 } },
        scales:{ x:{ grid:{display:false} }, y:{ grid:{color:PALETTE.grid}, stacked:false } }
      }
    });
  }

  function renderChartPeso(f){
    destroyChart('peso');
    const byMot = {};
    f.forEach(r=>{ byMot[r.motorista]=(byMot[r.motorista]||0)+r.peso; });
    const sorted = Object.entries(byMot).sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartPeso').getContext('2d');
    charts.peso = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map(x=>x[0]), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.blue, borderRadius:5, maxBarThickness:24 }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=> fmtNum(c.parsed.y)+' kg' }, backgroundColor:'#16213A', borderColor:PALETTE.blue, borderWidth:1, padding:10 } },
        scales:{ x:{ grid:{display:false}, ticks:{ autoSkip:true, maxRotation:0 } }, y:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtNum(v) } } }
      }
    });
  }

  function renderChartOcorrencia(f){
    destroyChart('ocorrencia');
    const byMot = {};
    f.forEach(r=>{
      const codes = parseOcorrenciaCodes(r.ocorrencia);
      if(codes.length===0) return;
      if(!byMot[r.motorista]) byMot[r.motorista] = { op:0, com:0 };
      codes.forEach(c=>{
        if(isOperationalCode(c)) byMot[r.motorista].op++;
        else byMot[r.motorista].com++;
      });
    });
    const sorted = Object.entries(byMot).sort((a,b)=> (b[1].op+b[1].com) - (a[1].op+a[1].com));
    const ctx = document.getElementById('chartOcorrencia').getContext('2d');
    if(sorted.length===0){
      charts.ocorrencia = new Chart(ctx,{
        type:'bar', data:{ labels:['Sem ocorrências'], datasets:[{data:[0], backgroundColor:PALETTE.accent2}]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ grid:{color:PALETTE.grid} }, x:{grid:{display:false}} } }
      });
      return;
    }
    charts.ocorrencia = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map(x=>x[0]),
        datasets:[
          { label:'Operacional (falta de tempo)', data: sorted.map(x=>x[1].op), backgroundColor: PALETTE.danger, borderRadius:5, maxBarThickness:26 },
          { label:'Comercial', data: sorted.map(x=>x[1].com), backgroundColor: PALETTE.accent3, borderRadius:5, maxBarThickness:26 }
        ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } }, tooltip:{ backgroundColor:'#16213A', borderWidth:1, padding:10 } },
        scales:{ x:{ grid:{display:false}, stacked:true }, y:{ grid:{color:PALETTE.grid}, ticks:{ stepSize:1, precision:0 }, stacked:true } }
      }
    });
  }

  // ---------- Insights ----------
  function renderInsights(f){
    const grid = document.getElementById('insightGrid');
    if(f.length===0){ grid.innerHTML = `<div class="insight-card warn"><div class="i-label">Sem dados</div><div class="i-text">Nenhum registro corresponde aos filtros selecionados.</div></div>`; return; }

    const byMotFrete = {};
    f.forEach(r=>{ byMotFrete[r.motorista]=(byMotFrete[r.motorista]||0)+r.valorFrete; });
    const topMot = Object.entries(byMotFrete).sort((a,b)=>b[1]-a[1])[0];

    const byCidadeEnt = {};
    f.forEach(r=>{ byCidadeEnt[r.cidade]=(byCidadeEnt[r.cidade]||0)+r.realizadas; });
    const topCidade = Object.entries(byCidadeEnt).sort((a,b)=>b[1]-a[1])[0];

    const metaValidos = f.filter(r=>r.meta==='Atendeu a Meta' || r.meta==='Não Atendeu a Meta');
    const pctMeta = metaValidos.length>0 ? metaValidos.filter(r=>r.meta==='Atendeu a Meta').length/metaValidos.length : 0;

    const occAll = occCounts(f);
    const byMotOcc = {};
    f.forEach(r=>{
      const codes = parseOcorrenciaCodes(r.ocorrencia);
      if(codes.length) byMotOcc[r.motorista] = (byMotOcc[r.motorista]||0) + codes.length;
    });
    const topOcc = Object.entries(byMotOcc).sort((a,b)=>b[1]-a[1])[0];

    const totalRetorno = sum(f,r=>r.retornadas);
    const totalEnt = sum(f,r=>r.entregas);

    const cards = [];
    cards.push(`<div class="insight-card good"><div class="i-label">Destaque de faturamento</div><div class="i-text"><b>${topMot[0]}</b> lidera o período com <b>${fmtBRLfull(topMot[1])}</b> em fretes acumulados.</div></div>`);
    cards.push(`<div class="insight-card"><div class="i-label">Rota mais ativa</div><div class="i-text"><b>${topCidade[0]}</b> concentra o maior volume de entregas, com <b>${fmtNum(topCidade[1])}</b> realizadas no período.</div></div>`);
    cards.push(`<div class="insight-card ${pctMeta>=0.85?'good':'warn'}"><div class="i-label">Cumprimento de meta</div><div class="i-text"><b>${fmtPct(pctMeta)}</b> das viagens válidas atenderam a meta estabelecida${pctMeta<0.85?', abaixo do ideal — vale revisar rotas críticas.':'.'} </div></div>`);
    if(topOcc){
      cards.push(`<div class="insight-card ${occAll.operational>0?'danger':'warn'}"><div class="i-label">Ponto de atenção</div><div class="i-text"><b>${occAll.total}</b> ocorrência(s) registradas no período , <b>${occAll.operational}</b> de origem operacional (falta de tempo) e <b>${occAll.commercial}</b> encaminhadas ao comercial. <b>${topOcc[0]}</b> concentra o maior número de casos (<b>${topOcc[1]}</b>).</div></div>`);
    } else {
      cards.push(`<div class="insight-card good"><div class="i-label">Ponto de atenção</div><div class="i-text">Nenhuma ocorrência registrada no período filtrado. Operação dentro da normalidade.</div></div>`);
    }
    cards.push(`<div class="insight-card ${totalRetorno>0?'warn':'good'}"><div class="i-label">Notas retornadas</div><div class="i-text"><b>${fmtNum(totalRetorno)}</b> de <b>${fmtNum(totalEnt)}</b> entregas programadas retornaram sem conclusão neste recorte.</div></div>`);
    const avgTempo = f.filter(r=>r.tempoSeg).length ? sum(f.filter(r=>r.tempoSeg), r=>r.tempoSeg)/f.filter(r=>r.tempoSeg).length : 0;
    cards.push(`<div class="insight-card"><div class="i-label">Tempo médio de viagem</div><div class="i-text">As viagens do período levam em média <b>${(avgTempo/3600).toFixed(1).replace('.',',')}h</b> entre saída e chegada.</div></div>`);

    grid.innerHTML = cards.join('');
  }

  // ---------- Table ----------
  function renderTable(f){
    let rows = f.filter(r=>{
      if(!state.busca) return true;
      const q = state.busca.toLowerCase();
      return r.placa.toLowerCase().includes(q) || r.motorista.toLowerCase().includes(q);
    });

    rows = rows.slice().sort((a,b)=>{
      let va = a[sortKey], vb = b[sortKey];
      if(typeof va === 'string') { va = va.toLowerCase(); vb = (vb||'').toLowerCase(); }
      if(va < vb) return -1*sortDir;
      if(va > vb) return 1*sortDir;
      return 0;
    });

    document.getElementById('tableCount').textContent = `${rows.length} registros`;
    const totalPages = Math.max(1, Math.ceil(rows.length/pageSize));
    if(page>totalPages) page = totalPages;
    const start = (page-1)*pageSize;
    const pageRows = rows.slice(start, start+pageSize);

    const metaBadge = (m) => {
      if(m==='Atendeu a Meta') return `<span class="badge ok">Atendeu</span>`;
      if(m==='Não Atendeu a Meta') return `<span class="badge no">Não atendeu</span>`;
      return `<span class="badge na">—</span>`;
    };

    const occBadge = (raw) => {
      const codes = parseOcorrenciaCodes(raw);
      if(codes.length===0) return `<span class="occ-none">—</span>`;
      const hasOperational = codes.some(isOperationalCode);
      const cls = hasOperational ? 'occ-flag-critical' : 'occ-flag';
      const label = hasOperational ? 'operacional' : 'comercial';
      return `<span class="${cls}" title="${label}">⚠ ${codes.join(', ')}</span>`;
    };

    document.getElementById('tableBody').innerHTML = pageRows.map(r=>`
      <tr>
        <td class="mono-cell">${fmtDateFull(r.data)}</td>
        <td class="mono-cell">${r.placa}</td>
        <td>${r.motorista}</td>
        <td>${r.cidade}</td>
        <td class="mono-cell">${fmtBRLfull(r.valorFrete)}</td>
        <td class="mono-cell">${fmtNum(r.peso)}</td>
        <td class="mono-cell">${fmtNum(r.entregas)}</td>
        <td class="mono-cell">${fmtNum(r.realizadas)}</td>
        <td class="mono-cell">${fmtNum(r.retornadas)}</td>
        <td class="mono-cell">${fmtPct(r.pctEntrega)}</td>
        <td>${metaBadge(r.meta)}</td>
        <td>${occBadge(r.ocorrencia)}</td>
      </tr>`).join('');

    document.getElementById('pgInfo').textContent = `Página ${page} de ${totalPages}`;
    document.getElementById('pgPrev').disabled = page<=1;
    document.getElementById('pgNext').disabled = page>=totalPages;

    document.querySelectorAll('thead th').forEach(th=>{
      const arrow = th.querySelector('.sort-arrow');
      if(th.dataset.key===sortKey){ arrow.textContent = sortDir===1?'▲':'▼'; } else { arrow.textContent=''; }
    });
  }

  // ---------- Master render ----------
  function render(){
    const f = getFiltered();
    try{ renderKPIs(f); } catch(err){ console.error('Falha nos KPIs:', err); }
    try{ renderTicker(f); } catch(err){ console.error('Falha no ticker:', err); }
    safeRenderChart(renderChartFrete, f, '#chartFrete');
    safeRenderChart(renderChartMeta, f, '#chartMeta');
    safeRenderChart(renderChartMotorista, f, '#chartMotorista');
    safeRenderChart(renderChartCidade, f, '#chartCidade');
    safeRenderChart(renderChartPeso, f, '#chartPeso');
    safeRenderChart(renderChartOcorrencia, f, '#chartOcorrencia');
    try{ renderInsights(f); } catch(err){ console.error('Falha nos insights:', err); }
    try{ renderTable(f); } catch(err){ console.error('Falha na tabela:', err); }
  }

  // ---------- Events ----------
  selMotorista.addEventListener('change', e=>{ state.motorista=e.target.value; page=1; render(); });
  selCidade.addEventListener('change', e=>{ state.cidade=e.target.value; page=1; render(); });
  document.getElementById('fMeta').addEventListener('change', e=>{ state.meta=e.target.value; page=1; render(); });
  selMes.addEventListener('change', e=>{ state.mes=e.target.value; page=1; render(); });
  selAno.addEventListener('change', e=>{ state.ano=e.target.value; page=1; render(); });
  document.getElementById('clearFilters').addEventListener('click', ()=>{
    state = { motorista:'all', cidade:'all', meta:'all', mes:'all', ano:'all', busca:'' };
    selMotorista.value='all'; selCidade.value='all'; document.getElementById('fMeta').value='all';
    selMes.value='all'; selAno.value='all'; document.getElementById('tableSearch').value='';
    page=1; render();
  });
  document.getElementById('tableSearch').addEventListener('input', e=>{ state.busca=e.target.value; page=1; renderTable(getFiltered()); });
  document.querySelectorAll('thead th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(sortKey===key){ sortDir*=-1; } else { sortKey=key; sortDir = (key==='data')?-1:1; }
      renderTable(getFiltered());
    });
  });
  document.getElementById('pgPrev').addEventListener('click', ()=>{ if(page>1){ page--; renderTable(getFiltered()); } });
  document.getElementById('pgNext').addEventListener('click', ()=>{ page++; renderTable(getFiltered()); });

  // ---------- Refresh button ----------
  function showToast(msg){
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(()=> t.classList.remove('show'), 2600);
  }
  function stampUpdate(){
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 'atualizado às ' + now.toLocaleTimeString('pt-BR');
  }
  document.getElementById('refreshBtn').addEventListener('click', function(){
    const btn = this;
    const label = document.getElementById('refreshLabel');
    btn.disabled = true; btn.classList.add('spinning'); label.textContent='Atualizando…';
    setTimeout(()=>{
      render();
      stampUpdate();
      btn.disabled = false; btn.classList.remove('spinning'); label.textContent='Atualizar Dados';
      showToast('Dados atualizados com sucesso');
    }, 750);
  });

  // ---------- Clock ----------
  function tickClock(){ document.getElementById('clockTime').textContent = new Date().toLocaleTimeString('pt-BR'); }
  tickClock(); setInterval(tickClock, 1000);
  stampUpdate();

  const footDate = document.getElementById('footGeneratedDate');
  if(footDate){
    const now = new Date();
    footDate.textContent = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }

  // ---------- Init ----------
  render();
})();
