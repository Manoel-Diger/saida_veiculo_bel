(function(){
  if(typeof VITLOG_DATA === 'undefined'){
    console.error('data/dataset.js não foi carregado. Verifique se o arquivo existe e se o <script> em index.html aponta para o caminho correto.');
    return;
  }
  const RAW = VITLOG_DATA;

  const PALETTE = {
    accent:'#4D8DFF', accent2:'#34D399', accent3:'#F5B94D',
    danger:'#EF6B6B', blue:'#4D8DFF', dim:'#93A1BC', faint:'#5C6A85',
    grid:'rgba(255,255,255,0.06)', panel:'#111A2B'
  };

  // Legenda oficial dos códigos de ocorrência (fornecida pela operação).
  const OCC_LEGEND = {
    '05': 'Dest Alega Merc não Pedida',
    '08': 'Dest Alega Merc Desac C/Pedido',
    '09': 'Dest Ausente Fechado',
    '10': 'Endereço Dest não Localizado',
    '13': 'Entrega Prejudicada Horário',
    '27': 'Excesso de Veiculos',
    '29': 'Responsavel pelo recb Ausente',
    '38': 'CTRC Retido',
    '42': 'Endereço de Entrega Modificado',
    '63': 'Greve',
    '66': 'Rodovia com Acesso Interrompido',
    '79': 'Feriado',
  };
  const occLabel = (code) => OCC_LEGEND[code] ? `${code} · ${OCC_LEGEND[code]}` : `${code} · Outro código`;

  // Código "13" = entrega prejudicada por horário → única ocorrência de responsabilidade
  // operacional direta (falta de tempo). Todas as demais são de natureza comercial
  // (cliente ausente, endereço, greve, etc.). Usado para colorir vermelho vs. amarelo.
  const OPERATIONAL_CODE = '13';
  function isOperationalCode(code){ return String(code).trim() === OPERATIONAL_CODE; }

  function parseOcorrenciaCodes(raw){
    if(raw === 0 || raw === '0' || raw === null || raw === undefined || raw === '') return [];
    return String(raw).split(',').map(s=>s.trim().padStart(2,'0')).filter(s=> s!=='' && s!=='00');
  }

  // Códigos de uma linha "relevantes" para as agregações (KPIs, gráficos, rankings, insights),
  // respeitando o filtro de ocorrência ativo. Sem isso, uma viagem com múltiplos códigos
  // (ex.: "10,13,05") faria códigos que NÃO foram filtrados vazarem para as estatísticas
  // só porque a viagem também continha o código filtrado.
  function getRelevantCodes(r){
    const codes = parseOcorrenciaCodes(r.ocorrencia);
    if(state.ocorrencia==='all' || state.ocorrencia==='none') return codes;
    return codes.filter(c=>c===state.ocorrencia);
  }

  function occCounts(rows){
    let total=0, operational=0, viagensComOcorrencia=0;
    rows.forEach(r=>{
      const codes = getRelevantCodes(r);
      if(codes.length>0) viagensComOcorrencia++;
      total += codes.length;
      operational += codes.filter(isOperationalCode).length;
    });
    return { total, operational, commercial: total-operational, viagensComOcorrencia };
  }

  const CHARTS_AVAILABLE = typeof Chart !== 'undefined';
  if(CHARTS_AVAILABLE){
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = PALETTE.dim;
    Chart.defaults.font.size = 11.5;
  } else {
    console.warn('Chart.js indisponível — os gráficos serão ocultados, mas KPIs, filtros, insights e tabela continuam funcionando.');
  }

  // ---------- Rótulos de dados nos gráficos (somente desktop) ----------
  // Breakpoint alinhado ao "mobile" já usado em css/styles.css (@media max-width:640px).
  // Abaixo dele os rótulos ficam ocultos automaticamente, evitando sobreposição/poluição
  // visual em telas estreitas — os tooltips continuam funcionando em qualquer tamanho de
  // tela, pois não dependem deste plugin.
  const isDesktopViewport = () => window.matchMedia('(min-width: 641px)').matches;

  if(CHARTS_AVAILABLE){
    Chart.register({
      id: 'vitlogDataLabels',
      afterDatasetsDraw(chart){
        const opts = chart.config.options && chart.config.options.plugins && chart.config.options.plugins.vitlogDataLabels;
        if(!opts || opts.display === false) return;
        if(!isDesktopViewport()) return;

        const type = chart.config.type;
        const horizontal = chart.options.indexAxis === 'y';
        const maxItems = opts.maxItems || 24;
        const { ctx } = chart;

        chart.data.datasets.forEach((dataset, dsIndex) => {
          const meta = chart.getDatasetMeta(dsIndex);
          if(meta.hidden || meta.data.length > maxItems) return;

          meta.data.forEach((el, index) => {
            const raw = dataset.data[index];
            if(raw === null || raw === undefined) return;
            if(typeof raw === 'number' && raw === 0) return; // não polui com zeros (ex.: ocorrências)

            const text = opts.formatter ? opts.formatter(raw, dataset, index, dsIndex) : String(raw);
            if(!text) return;

            let x, y, align = 'center', baseline = 'middle';
            if(type === 'doughnut'){
              const pos = el.tooltipPosition();
              x = pos.x; y = pos.y;
            } else if(horizontal){
              x = el.x + 6; y = el.y; align = 'left'; baseline = 'middle';
            } else {
              x = el.x; y = el.y - 8; align = 'center'; baseline = 'bottom';
            }

            ctx.save();
            ctx.font = opts.font || '600 10.5px Inter, sans-serif';
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = opts.strokeColor || 'rgba(8,13,22,0.85)';
            ctx.strokeText(text, x, y);
            ctx.fillStyle = opts.color || '#F2F5FB';
            ctx.fillText(text, x, y);
            ctx.restore();
          });
        });
      }
    });
  }

  // ---------- Helpers ----------
  const ESC_MAP = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
  const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(v||0);
  const fmtBRLfull = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  const fmtNum = (v,d=0) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v||0);
  const fmtPct = (v) => (v*100).toFixed(1).replace('.',',') + '%';
  const fmtDate = (s) => { const [y,m,d] = s.split('-'); return `${d}/${m}`; };
  const fmtHM = (segundos) => {
    const total = Math.round(segundos||0);
    const h = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };
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

  // Rotas presentes na base (números a partir de 1 — o valor 0/vazio é tratado como "sem rota")
  const rotas = [...new Set(RAW.map(r=>r.rota).filter(r=>r!=null))].sort((a,b)=>a-b);
  const selRota = document.getElementById('fRota');
  rotas.forEach(r=>{ const o=document.createElement('option'); o.value=String(r); o.textContent=`Rota ${r}`; selRota.appendChild(o); });

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

  // Ocorrências presentes na base, ordenadas por frequência (mais comuns primeiro)
  const occFrequency = {};
  RAW.forEach(r=>{ parseOcorrenciaCodes(r.ocorrencia).forEach(c=>{ occFrequency[c] = (occFrequency[c]||0)+1; }); });
  const occCodesPresentes = Object.keys(occFrequency).sort((a,b)=> occFrequency[b]-occFrequency[a]);

  const selOcorrencia = document.getElementById('fOcorrencia');
  (() => {
    const oAll = document.createElement('option'); oAll.value='all'; oAll.textContent='Ocorrência (todas)';
    selOcorrencia.appendChild(oAll);
    const oNone = document.createElement('option'); oNone.value='none'; oNone.textContent='Sem ocorrência';
    selOcorrencia.appendChild(oNone);
    occCodesPresentes.forEach(c=>{
      const o=document.createElement('option'); o.value=c; o.textContent=`${occLabel(c)} (${occFrequency[c]})`;
      selOcorrencia.appendChild(o);
    });
    selOcorrencia.value='all';
  })();

  document.getElementById('periodSub').textContent =
    `Base "jan_26 (2)" · ${RAW.length} lançamentos · ${fmtDateFull(minDate)} a ${fmtDateFull(maxDate)}`;

  // ---------- State ----------
  let state = { motorista:'all', cidade:'all', rota:'all', meta:'all', mes:'all', ano:'all', ocorrencia:'all', busca:'' };
  let sortKey = 'data', sortDir = -1, page = 1, pageSize = 10;
  let charts = {};

  function getFiltered(opts){
    opts = opts || {};
    return RAW.filter(r=>{
      if(state.motorista!=='all' && r.motorista!==state.motorista) return false;
      if(state.cidade!=='all' && r.cidade!==state.cidade) return false;
      if(state.rota!=='all' && String(r.rota)!==state.rota) return false;
      if(state.meta!=='all' && r.meta!==state.meta) return false;
      if(!opts.skipMes && state.mes!=='all' && r.data.slice(5,7)!==state.mes) return false;
      if(state.ano!=='all' && r.data.slice(0,4)!==state.ano) return false;
      if(state.ocorrencia==='none' && parseOcorrenciaCodes(r.ocorrencia).length>0) return false;
      if(state.ocorrencia!=='all' && state.ocorrencia!=='none' && !parseOcorrenciaCodes(r.ocorrencia).includes(state.ocorrencia)) return false;
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
      kpiCard('Cumprimento de Meta', fmtPct(pctMeta), `<b>${fmtNum(metaOk)}</b> de <b>${fmtNum(metaValidos.length)}</b> viagens válidas atenderam a meta`, PALETTE.accent3, kpiIcons.target),
      kpiCard('Km Rodados', fmtNum(totalKm), `Média de <b>${fmtNum(kmValidos.length? totalKm/kmValidos.length:0,1)} km</b>/viagem no período`, PALETTE.dim, kpiIcons.road),
      kpiCard('Ocorrências Registradas', fmtNum(occ.total), `Em <b>${fmtPct(f.length? occ.viagensComOcorrencia/f.length:0)}</b> das viagens do período`, PALETTE.danger, kpiIcons.alert),
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
      topMotorista ? `DESTAQUE <b>${esc(topMotorista[0].toUpperCase())}</b>` : ''
    ].filter(Boolean);

    const html = items.map(t=>`<span class="ticker-item">${t}</span><span class="ticker-item dot">◆</span>`).join('');
    document.getElementById('tickerTrack').innerHTML = html + html; // duplicate for seamless loop
  }

  // ---------- Charts ----------
  // Prefixa o nome com a posição no ranking (ordem já calculada em cada render),
  // ex.: índice 0 -> "01º - Edilson". Número com 2 dígitos (padStart) para que a coluna
  // do nome fique alinhada visualmente entre 1º-9º e 10º em diante. Usado só para
  // exibição (labels), sem alterar cálculos/ordem.
  function rankLabel(index, name){ return `${String(index+1).padStart(2,'0')}º - ${name}`; }

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
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:22 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=> fmtBRLfull(c.parsed.y) }, backgroundColor:'#16213A', borderColor:PALETTE.accent, borderWidth:1, titleColor:'#fff', bodyColor:'#fff', padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtBRL(v), maxItems:18 } },
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
          tooltip:{ backgroundColor:'#16213A', borderColor:PALETTE.accent2, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } }
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
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.blue, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:56 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtBRLfull(c.parsed.x) }, backgroundColor:'#16213A', borderColor:PALETTE.blue, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtBRL(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtBRL(v) } }, y:{ grid:{display:false}, ticks:{ crossAlign:'far' } } }
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
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])),
        datasets:[
          { label:'Realizadas', data: sorted.map(x=>x[1].real), backgroundColor:PALETTE.accent2, borderRadius:5, maxBarThickness:26 },
          { label:'Retornadas', data: sorted.map(x=>x[1].ret), backgroundColor:PALETTE.danger, borderRadius:5, maxBarThickness:26 }
        ]},
      options:{
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:22 } },
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } }, tooltip:{ backgroundColor:'#16213A', borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } },
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
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.blue, borderRadius:5, maxBarThickness:24 }]},
      options:{
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:22 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=> fmtNum(c.parsed.y)+' kg' }, backgroundColor:'#16213A', borderColor:PALETTE.blue, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } },
        scales:{ x:{ grid:{display:false}, ticks:{ autoSkip:false, maxRotation:45, minRotation:0 } }, y:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtNum(v) } } }
      }
    });
  }

  function renderChartVolumesMotorista(f){
    destroyChart('volumesMotorista');
    const byMot = {};
    f.forEach(r=>{ byMot[r.motorista]=(byMot[r.motorista]||0)+(r.vols||0); });
    const sorted = Object.entries(byMot).sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartVolumesMotorista').getContext('2d');
    charts.volumesMotorista = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.accent2, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:56 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtNum(c.parsed.x)+' volumes' }, backgroundColor:'#16213A', borderColor:PALETTE.accent2, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtNum(v) } }, y:{ grid:{display:false}, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  function renderChartTempoMedioMotorista(f){
    destroyChart('tempoMedioMotorista');
    const byMot = {};
    f.forEach(r=>{
      if(!r.tempoSeg) return;
      if(!byMot[r.motorista]) byMot[r.motorista] = { total:0, n:0 };
      byMot[r.motorista].total += r.tempoSeg;
      byMot[r.motorista].n += 1;
    });
    const sorted = Object.entries(byMot)
      .map(([mot,v])=>[mot, v.n>0 ? v.total/v.n : 0])
      .sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartTempoMedioMotorista').getContext('2d');
    charts.tempoMedioMotorista = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: PALETTE.accent3, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:60 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtHM(c.parsed.x) }, backgroundColor:'#16213A', borderColor:PALETTE.accent3, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtHM(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtHM(v) } }, y:{ grid:{display:false}, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  function renderChartOcorrencia(f){
    destroyChart('ocorrencia');
    const byMot = {};
    f.forEach(r=>{
      const codes = getRelevantCodes(r);
      if(codes.length===0) return;
      if(!byMot[r.motorista]) byMot[r.motorista] = { op:0, com:0 };
      codes.forEach(c=>{
        if(isOperationalCode(c)) byMot[r.motorista].op++;
        else byMot[r.motorista].com++;
      });
    });
    const sorted = Object.entries(byMot).sort((a,b)=> (b[1].op+b[1].com) - (a[1].op+a[1].com)).slice(0,8);
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
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])),
        datasets:[
          { label:'Operacional (13 · falta de tempo)', data: sorted.map(x=>x[1].op), backgroundColor: PALETTE.danger, borderRadius:5, maxBarThickness:22 },
          { label:'Comercial (demais códigos)', data: sorted.map(x=>x[1].com), backgroundColor: PALETTE.accent3, borderRadius:5, maxBarThickness:22 }
        ]},
      options:{
        indexAxis:'y',
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:36 } },
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } }, tooltip:{ backgroundColor:'#16213A', borderWidth:1, padding:10, callbacks:{ label:(c)=> `${c.dataset.label}: ${fmtNum(c.parsed.x)}` } },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, stacked:true, ticks:{ stepSize:1, precision:0 } }, y:{ grid:{display:false}, stacked:true, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  // Ranking · Performance de Entrega por Motorista (barras verticais)
  // Mesma regra da KPI/ticker "Performance de Entrega": realizadas / entregas programadas.
  function renderChartPerformanceEntrega(f){
    destroyChart('performanceEntrega');
    const byMot = {};
    f.forEach(r=>{
      if(!byMot[r.motorista]) byMot[r.motorista] = { entregas:0, realizadas:0 };
      byMot[r.motorista].entregas += (r.entregas||0);
      byMot[r.motorista].realizadas += (r.realizadas||0);
    });
    const sorted = Object.entries(byMot)
      .filter(([,v])=> v.entregas>0)
      .map(([mot,v])=>[mot, v.realizadas/v.entregas])
      .sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartPerformanceEntrega').getContext('2d');
    charts.performanceEntrega = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: sorted.map(x=> x[1]<0.96 ? PALETTE.danger : PALETTE.accent2), borderRadius:5, maxBarThickness:24 }]},
      options:{
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:24 } },
        plugins:{
          legend:{display:false},
          tooltip:{ callbacks:{ label:(c)=> `Performance: ${fmtPct(c.parsed.y)}` }, backgroundColor:'#16213A', borderColor:PALETTE.accent2, borderWidth:1, titleColor:'#fff', bodyColor:'#fff', padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtPct(v) }
        },
        scales:{
          x:{ grid:{display:false}, ticks:{ autoSkip:false, maxRotation:45, minRotation:0 } },
          y:{ grid:{color:PALETTE.grid}, min:0, max:1, ticks:{ callback:(v)=>fmtPct(v) } }
        }
      }
    });
  }

  // Ranking · Cumprimento de Meta por Motorista (barras verticais)
  // Mesma regra da KPI "Cumprimento de Meta": viagens que "Atendeu a Meta" sobre
  // o total de viagens com meta válida ("Atendeu a Meta" ou "Não Atendeu a Meta").
  function renderChartCumprimentoMeta(f){
    destroyChart('cumprimentoMeta');
    const byMot = {};
    f.forEach(r=>{
      if(r.meta!=='Atendeu a Meta' && r.meta!=='Não Atendeu a Meta') return;
      if(!byMot[r.motorista]) byMot[r.motorista] = { validos:0, ok:0 };
      byMot[r.motorista].validos += 1;
      if(r.meta==='Atendeu a Meta') byMot[r.motorista].ok += 1;
    });
    const sorted = Object.entries(byMot)
      .filter(([,v])=> v.validos>0)
      .map(([mot,v])=>[mot, v.ok/v.validos])
      .sort((a,b)=>b[1]-a[1]);
    const ctx = document.getElementById('chartCumprimentoMeta').getContext('2d');
    charts.cumprimentoMeta = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((x,i)=>rankLabel(i,x[0])), datasets:[{ data: sorted.map(x=>x[1]), backgroundColor: sorted.map(x=> x[1]<0.96 ? PALETTE.danger : PALETTE.accent3), borderRadius:5, maxBarThickness:24 }]},
      options:{
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:24 } },
        plugins:{
          legend:{display:false},
          tooltip:{ callbacks:{ label:(c)=> `Cumprimento de meta: ${fmtPct(c.parsed.y)}` }, backgroundColor:'#16213A', borderColor:PALETTE.accent3, borderWidth:1, titleColor:'#fff', bodyColor:'#fff', padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtPct(v) }
        },
        scales:{
          x:{ grid:{display:false}, ticks:{ autoSkip:false, maxRotation:45, minRotation:0 } },
          y:{ grid:{color:PALETTE.grid}, min:0, max:1, ticks:{ callback:(v)=>fmtPct(v) } }
        }
      }
    });
  }

  // ---------- Produtividade por Rota ----------
  // Todas as análises por rota ignoram lançamentos sem rota atribuída (rota nula,
  // originada do valor 0/vazio na planilha) — só entram rotas numeradas a partir de 1.
  const rotaLabel = (rota) => `Rota ${rota}`;

  // Consolida, por rota, os totais/base necessários para os gráficos e a tabela-resumo.
  function computeRotaStats(f){
    const rows = f.filter(r=>r.rota!=null);
    const byRota = {};
    rows.forEach(r=>{
      if(!byRota[r.rota]) byRota[r.rota] = { viagens:0, entregas:0, realizadas:0, volumes:0, valorFrete:0, tempoTotal:0, tempoCount:0, metaValidos:0, metaOk:0 };
      const s = byRota[r.rota];
      s.viagens += 1;
      s.entregas += (r.entregas||0);
      s.realizadas += (r.realizadas||0);
      s.volumes += (r.vols||0);
      s.valorFrete += (r.valorFrete||0);
      if(r.tempoSeg){ s.tempoTotal += r.tempoSeg; s.tempoCount += 1; }
      if(r.meta==='Atendeu a Meta' || r.meta==='Não Atendeu a Meta'){
        s.metaValidos += 1;
        if(r.meta==='Atendeu a Meta') s.metaOk += 1;
      }
    });
    return Object.entries(byRota).map(([rota,s])=>{
      const horas = s.tempoTotal>0 ? s.tempoTotal/3600 : 0;
      return {
        rota: Number(rota), ...s, horas,
        entregasPorHora: horas>0 ? s.realizadas/horas : 0,
        volPorHora: horas>0 ? s.volumes/horas : 0,
        perfEntrega: s.entregas>0 ? s.realizadas/s.entregas : 0,
        pctMeta: s.metaValidos>0 ? s.metaOk/s.metaValidos : 0,
        tempoMedio: s.tempoCount>0 ? s.tempoTotal/s.tempoCount : 0
      };
    });
  }

  // Ranking de Produtividade por Rota — entregas realizadas por hora de viagem em cada rota.
  function renderChartProdutividadeRota(f){
    destroyChart('produtividadeRota');
    const sorted = computeRotaStats(f).filter(s=>s.horas>0).sort((a,b)=>b.entregasPorHora-a.entregasPorHora);
    const ctx = document.getElementById('chartProdutividadeRota').getContext('2d');
    charts.produtividadeRota = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((s,i)=>rankLabel(i,rotaLabel(s.rota))), datasets:[{ data: sorted.map(s=>s.entregasPorHora), backgroundColor: PALETTE.accent2, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:56 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtNum(c.parsed.x,2)+' entregas/h' }, backgroundColor:'#16213A', borderColor:PALETTE.accent2, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v,2) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtNum(v,1) } }, y:{ grid:{display:false}, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  // Frete Faturado por Rota — total faturado (R$) no período filtrado, por rota.
  function renderChartFreteRota(f){
    destroyChart('freteRota');
    const sorted = computeRotaStats(f).sort((a,b)=>b.valorFrete-a.valorFrete);
    const ctx = document.getElementById('chartFreteRota').getContext('2d');
    charts.freteRota = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((s,i)=>rankLabel(i,rotaLabel(s.rota))), datasets:[{ data: sorted.map(s=>s.valorFrete), backgroundColor: PALETTE.blue, borderRadius:5, maxBarThickness:22 }]},
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:56 } },
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>fmtBRLfull(c.parsed.x) }, backgroundColor:'#16213A', borderColor:PALETTE.blue, borderWidth:1, padding:10 },
          vitlogDataLabels:{ formatter:(v)=>fmtBRL(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, ticks:{ callback:(v)=>fmtBRL(v) } }, y:{ grid:{display:false}, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  // Tabela-resumo por Rota — mesma ordenação do ranking de produtividade (entregas/h).
  function renderRotaSummaryTable(f){
    const body = document.getElementById('rotaSummaryBody');
    if(!body) return;
    const stats = computeRotaStats(f).sort((a,b)=>b.entregasPorHora-a.entregasPorHora);

    let html = '<tr><th>Rota</th><th>Viagens</th><th>Entr. Realiz.</th><th>Volumes</th><th>Tempo Médio</th><th>Entregas/h</th><th>Vol/h</th><th>Perf. Entrega</th><th>Meta</th><th>Frete</th></tr>';

    if(stats.length===0){
      html += `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--text-faint);">Nenhuma rota corresponde aos filtros atuais.</td></tr>`;
      body.innerHTML = html;
      return;
    }

    stats.forEach((s,i)=>{
      html += `<tr>
        <td><span class="badge rota">${esc(rankLabel(i,rotaLabel(s.rota)))}</span></td>
        <td class="mono-cell">${fmtNum(s.viagens)}</td>
        <td class="mono-cell">${fmtNum(s.realizadas)} / ${fmtNum(s.entregas)}</td>
        <td class="mono-cell">${fmtNum(s.volumes)}</td>
        <td class="mono-cell">${s.tempoMedio>0 ? fmtHM(s.tempoMedio) : '—'}</td>
        <td class="mono-cell">${s.horas>0 ? fmtNum(s.entregasPorHora,2) : '—'}</td>
        <td class="mono-cell">${s.horas>0 ? fmtNum(s.volPorHora,1) : '—'}</td>
        <td class="mono-cell">${fmtPct(s.perfEntrega)}</td>
        <td class="mono-cell">${s.metaValidos>0 ? fmtPct(s.pctMeta) : '—'}</td>
        <td class="mono-cell">${fmtBRLfull(s.valorFrete)}</td>
      </tr>`;
    });

    body.innerHTML = html;
  }

  // Ocorrências por Rota — mesmo padrão do ranking "Principais Ofensores por Motorista",
  // agrupado por rota em vez de motorista.
  function renderChartOcorrenciaRota(f){
    destroyChart('ocorrenciaRota');
    const rows = f.filter(r=>r.rota!=null);
    const byRota = {};
    rows.forEach(r=>{
      const codes = getRelevantCodes(r);
      if(codes.length===0) return;
      if(!byRota[r.rota]) byRota[r.rota] = { op:0, com:0 };
      codes.forEach(c=>{
        if(isOperationalCode(c)) byRota[r.rota].op++;
        else byRota[r.rota].com++;
      });
    });
    const sorted = Object.entries(byRota).sort((a,b)=> (b[1].op+b[1].com) - (a[1].op+a[1].com)).slice(0,8);
    const ctx = document.getElementById('chartOcorrenciaRota').getContext('2d');
    if(sorted.length===0){
      charts.ocorrenciaRota = new Chart(ctx,{
        type:'bar', data:{ labels:['Sem ocorrências'], datasets:[{data:[0], backgroundColor:PALETTE.accent2}]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ grid:{color:PALETTE.grid} }, x:{grid:{display:false}} } }
      });
      return;
    }
    charts.ocorrenciaRota = new Chart(ctx,{
      type:'bar',
      data:{ labels: sorted.map((x,i)=>rankLabel(i,rotaLabel(x[0]))),
        datasets:[
          { label:'Operacional (13 · falta de tempo)', data: sorted.map(x=>x[1].op), backgroundColor: PALETTE.danger, borderRadius:5, maxBarThickness:22 },
          { label:'Comercial (demais códigos)', data: sorted.map(x=>x[1].com), backgroundColor: PALETTE.accent3, borderRadius:5, maxBarThickness:22 }
        ]},
      options:{
        indexAxis:'y',
        responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:36 } },
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, boxHeight:10, padding:16, font:{size:11.5} } }, tooltip:{ backgroundColor:'#16213A', borderWidth:1, padding:10, callbacks:{ label:(c)=> `${c.dataset.label}: ${fmtNum(c.parsed.x)}` } },
          vitlogDataLabels:{ formatter:(v)=>fmtNum(v) } },
        scales:{ x:{ grid:{color:PALETTE.grid}, stacked:true, ticks:{ stepSize:1, precision:0 } }, y:{ grid:{display:false}, stacked:true, ticks:{ crossAlign:'far' } } }
      }
    });
  }

  // ---------- Comparativo mensal ----------
  const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const periodLabel = (p) => { const [y,m] = p.split('-'); return `${MESES_ABREV[parseInt(m,10)-1]}/${y.slice(2)}`; };

  const COMPARE_INDICATORS = [
    { label:'Viagens', calc: rows=>rows.length, fmt: fmtNum },
    { label:'Frete Total', calc: rows=>sum(rows,r=>r.valorFrete), fmt: fmtBRL },
    { label:'Peso Transportado (kg)', calc: rows=>sum(rows,r=>r.peso), fmt: v=>fmtNum(v) },
    { label:'Volumes', calc: rows=>sum(rows,r=>r.vols), fmt: v=>fmtNum(v) },
    { label:'Cumprimento de Meta', isPct:true, calc: rows=>{
        const mv = rows.filter(r=>r.meta==='Atendeu a Meta' || r.meta==='Não Atendeu a Meta');
        return mv.length ? mv.filter(r=>r.meta==='Atendeu a Meta').length/mv.length : 0;
      }, fmt: fmtPct },
    { label:'Performance de Entrega', isPct:true, calc: rows=>{
        const ent = sum(rows,r=>r.entregas), real = sum(rows,r=>r.realizadas);
        return ent>0 ? real/ent : 0;
      }, fmt: fmtPct },
    { label:'Ocorrências Registradas', calc: rows=>occCounts(rows).total, fmt: v=>fmtNum(v) },
    { label:'Tempo Médio de Viagem', isTime:true, calc: rows=>{
        const comTempo = rows.filter(r=>r.tempoSeg);
        return comTempo.length ? sum(comTempo,r=>r.tempoSeg)/comTempo.length : 0;
      }, fmt: fmtHM },
  ];

  function variationLabel(ind, firstVal, lastVal){
    if(ind.isTime){
      const diff = lastVal-firstVal;
      const sign = diff>=0?'+':'−';
      return `${sign}${fmtHM(Math.abs(diff))}`;
    }
    if(ind.isPct){
      const diffPp = (lastVal-firstVal)*100;
      const sign = diffPp>=0?'+':'−';
      return `${sign}${Math.abs(diffPp).toFixed(1).replace('.',',')} p.p.`;
    }
    if(firstVal===0) return lastVal===0 ? '—' : 'n/d';
    const pct = ((lastVal-firstVal)/firstVal)*100;
    const sign = pct>=0?'+':'−';
    return `${sign}${Math.abs(pct).toFixed(1).replace('.',',')}%`;
  }

  function renderCompareTable(){
    const body = document.getElementById('compareBody');
    if(!body) return;
    const rows = getFiltered({ skipMes:true });
    const groups = {};
    rows.forEach(r=>{ const k = r.data.slice(0,7); (groups[k] = groups[k]||[]).push(r); });
    const periods = Object.keys(groups).sort();

    const sub = document.getElementById('compareSub');
    if(sub){
      sub.textContent = periods.length>0
        ? `${periods.length} período(s) comparado(s): ${periods.map(periodLabel).join(', ')} — ignora o filtro de Mês; respeita Ano, Motorista, Cidade, Meta e Ocorrência`
        : `Nenhum período disponível para os filtros atuais`;
    }

    if(periods.length===0){
      body.innerHTML = `<tr><td style="text-align:center; padding:24px; color:var(--text-faint);">Nenhum dado corresponde aos filtros atuais.</td></tr>`;
      return;
    }

    const showVar = periods.length>=2;
    let html = '<tr><th>Indicador</th>' + periods.map(p=>`<th>${esc(periodLabel(p))}</th>`).join('') + (showVar?'<th>Variação</th>':'') + '</tr>';

    COMPARE_INDICATORS.forEach(ind=>{
      const vals = periods.map(p=>ind.calc(groups[p]));
      html += '<tr>';
      html += `<td class="compare-label">${esc(ind.label)}</td>`;
      html += vals.map(v=>`<td class="mono-cell">${ind.fmt(v)}</td>`).join('');
      if(showVar){
        const varStr = variationLabel(ind, vals[0], vals[vals.length-1]);
        const cls = varStr.startsWith('+') ? 'var-up' : varStr.startsWith('−') ? 'var-down' : 'var-neutral';
        html += `<td class="mono-cell ${cls}">${varStr}</td>`;
      }
      html += '</tr>';
    });

    body.innerHTML = html;
  }

  // Ranking dos tipos de ocorrência (códigos) — permite identificar de imediato
  // quais motivos mais impactam a operação no período filtrado.
  function renderOccTypeRanking(f){
    const container = document.getElementById('occTypeRanking');
    if(!container) return;
    const counts = {};
    f.forEach(r=>{ getRelevantCodes(r).forEach(c=>{ counts[c] = (counts[c]||0)+1; }); });
    const entries = Object.entries(counts).sort((a,b)=> b[1]-a[1]);
    const total = entries.reduce((a,[,n])=>a+n,0);
    if(entries.length===0){
      container.innerHTML = `<div class="rank-empty">Nenhuma ocorrência registrada com os filtros atuais.</div>`;
      return;
    }
    container.innerHTML = entries.map(([code,n])=>{
      const pct = total>0 ? n/total : 0;
      const desc = OCC_LEGEND[code] || 'Código não catalogado';
      const cls = isOperationalCode(code) ? 'rank-code operational' : 'rank-code commercial';
      const barCls = isOperationalCode(code) ? 'rank-bar-fill operational' : 'rank-bar-fill commercial';
      return `<div class="rank-item">
        <div class="rank-item-top">
          <span class="${cls}">${esc(code)}</span>
          <span class="rank-desc">${esc(desc)}</span>
          <span class="rank-count">${fmtNum(n)} · ${fmtPct(pct)}</span>
        </div>
        <div class="rank-bar-track"><div class="${barCls}" style="width:${(pct*100).toFixed(1)}%"></div></div>
      </div>`;
    }).join('');
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
      const codes = getRelevantCodes(r);
      if(codes.length) byMotOcc[r.motorista] = (byMotOcc[r.motorista]||0) + codes.length;
    });
    const topOcc = Object.entries(byMotOcc).sort((a,b)=>b[1]-a[1])[0];

    const byCodeOcc = {};
    f.forEach(r=>{ getRelevantCodes(r).forEach(c=>{ byCodeOcc[c]=(byCodeOcc[c]||0)+1; }); });
    const topCode = Object.entries(byCodeOcc).sort((a,b)=>b[1]-a[1])[0];

    const totalRetorno = sum(f,r=>r.retornadas);
    const totalEnt = sum(f,r=>r.entregas);

    const cards = [];
    cards.push(`<div class="insight-card good"><div class="i-label">Destaque de faturamento</div><div class="i-text"><b>${esc(topMot[0])}</b> lidera o período com <b>${fmtBRLfull(topMot[1])}</b> em fretes acumulados.</div></div>`);
    cards.push(`<div class="insight-card"><div class="i-label">Rota mais ativa</div><div class="i-text"><b>${esc(topCidade[0])}</b> concentra o maior volume de entregas, com <b>${fmtNum(topCidade[1])}</b> realizadas no período.</div></div>`);
    cards.push(`<div class="insight-card ${pctMeta>=0.85?'good':'warn'}"><div class="i-label">Cumprimento de meta</div><div class="i-text"><b>${fmtPct(pctMeta)}</b> das viagens válidas atenderam a meta estabelecida${pctMeta<0.85?', abaixo do ideal — vale revisar rotas críticas.':'.'} </div></div>`);
    if(topOcc && topCode){
      const codeDesc = OCC_LEGEND[topCode[0]] || 'código não catalogado';
      cards.push(`<div class="insight-card danger"><div class="i-label">Principais ofensores · Ocorrências</div><div class="i-text"><b>${occAll.total}</b> ocorrência(s) em <b>${occAll.viagensComOcorrencia}</b> viagem(ns) no período — <b>${occAll.operational}</b> operacional(is) (código 13, falta de tempo) e <b>${occAll.commercial}</b> comercial(is). Motorista com mais casos: <b>${esc(topOcc[0])}</b> (<b>${topOcc[1]}</b>). Motivo mais frequente: <b>${esc(topCode[0])} · ${esc(codeDesc)}</b> (<b>${topCode[1]}</b> caso(s)).</div></div>`);
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
      return r.placa.toLowerCase().includes(q) || r.motorista.toLowerCase().includes(q) || r.cidade.toLowerCase().includes(q) || (r.rota!=null && String(r.rota).includes(q));
    });

    rows = rows.slice().sort((a,b)=>{
      let va = a[sortKey], vb = b[sortKey];
      if(typeof va === 'string') { va = va.toLowerCase(); vb = (vb||'').toLowerCase(); }
      if(va < vb) return -1*sortDir;
      if(va > vb) return 1*sortDir;
      return 0;
    });

    document.getElementById('tableCount').textContent = `${rows.length} registros`;

    if(rows.length===0){
      document.getElementById('tableBody').innerHTML =
        `<tr><td colspan="15" style="text-align:center; padding:28px; color:var(--text-faint);">Nenhum registro corresponde aos filtros ou à busca atual.</td></tr>`;
      document.getElementById('pgInfo').textContent = 'Página 0 de 0';
      document.getElementById('pgPrev').disabled = true;
      document.getElementById('pgNext').disabled = true;
      return;
    }

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
      const tooltip = codes.map(c=>occLabel(c)).join(' | ');
      return `<span class="${cls}" title="${esc(tooltip)}">⚠ ${esc(codes.join(', '))}</span>`;
    };

    document.getElementById('tableBody').innerHTML = pageRows.map(r=>`
      <tr>
        <td class="mono-cell">${fmtDateFull(r.data)}</td>
        <td class="mono-cell">${esc(r.placa)}</td>
        <td>${esc(r.motorista)}</td>
        <td>${esc(r.cidade)}</td>
        <td class="mono-cell">${r.rota!=null ? fmtNum(r.rota) : '—'}</td>
        <td class="mono-cell">${fmtBRLfull(r.valorFrete)}</td>
        <td class="mono-cell">${fmtHM(r.tempoSeg)}</td>
        <td class="mono-cell">${fmtNum(r.vols)}</td>
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
      if(th.dataset.key===sortKey){
        arrow.textContent = sortDir===1?'▲':'▼';
        th.setAttribute('aria-sort', sortDir===1?'ascending':'descending');
      } else {
        arrow.textContent='';
        th.setAttribute('aria-sort','none');
      }
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
    safeRenderChart(renderChartVolumesMotorista, f, '#chartVolumesMotorista');
    safeRenderChart(renderChartTempoMedioMotorista, f, '#chartTempoMedioMotorista');
    safeRenderChart(renderChartPerformanceEntrega, f, '#chartPerformanceEntrega');
    safeRenderChart(renderChartCumprimentoMeta, f, '#chartCumprimentoMeta');
    safeRenderChart(renderChartProdutividadeRota, f, '#chartProdutividadeRota');
    safeRenderChart(renderChartFreteRota, f, '#chartFreteRota');
    try{ renderRotaSummaryTable(f); } catch(err){ console.error('Falha na tabela-resumo por rota:', err); }
    safeRenderChart(renderChartOcorrenciaRota, f, '#chartOcorrenciaRota');
    safeRenderChart(renderChartPeso, f, '#chartPeso');
    safeRenderChart(renderChartOcorrencia, f, '#chartOcorrencia');
    renderOccTypeRanking(f);
    try{ renderCompareTable(); } catch(err){ console.error('Falha no comparativo mensal:', err); }
    try{ renderInsights(f); } catch(err){ console.error('Falha nos insights:', err); }
    try{ renderTable(f); } catch(err){ console.error('Falha na tabela:', err); }
  }

  // ---------- Events ----------
  selMotorista.addEventListener('change', e=>{ state.motorista=e.target.value; page=1; render(); });
  selCidade.addEventListener('change', e=>{ state.cidade=e.target.value; page=1; render(); });
  selRota.addEventListener('change', e=>{ state.rota=e.target.value; page=1; render(); });
  document.getElementById('fMeta').addEventListener('change', e=>{ state.meta=e.target.value; page=1; render(); });
  selMes.addEventListener('change', e=>{ state.mes=e.target.value; page=1; render(); });
  selAno.addEventListener('change', e=>{ state.ano=e.target.value; page=1; render(); });
  selOcorrencia.addEventListener('change', e=>{ state.ocorrencia=e.target.value; page=1; render(); });
  document.getElementById('clearFilters').addEventListener('click', ()=>{
    state = { motorista:'all', cidade:'all', rota:'all', meta:'all', mes:'all', ano:'all', ocorrencia:'all', busca:'' };
    selMotorista.value='all'; selCidade.value='all'; selRota.value='all'; document.getElementById('fMeta').value='all';
    selMes.value='all'; selAno.value='all'; selOcorrencia.value='all'; document.getElementById('tableSearch').value='';
    page=1; render();
  });
  document.getElementById('tableSearch').addEventListener('input', e=>{ state.busca=e.target.value; page=1; renderTable(getFiltered()); });
  document.querySelectorAll('thead th').forEach(th=>{
    const doSort = () => {
      const key = th.dataset.key;
      if(sortKey===key){ sortDir*=-1; } else { sortKey=key; sortDir = (key==='data')?-1:1; }
      renderTable(getFiltered());
    };
    th.addEventListener('click', doSort);
    th.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); doSort(); }
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

  // ---------- Export CSV ----------
  function toCsvValue(v){
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }
  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const rows = getFiltered();
    if(rows.length===0){ showToast('Nenhum registro para exportar com os filtros atuais'); return; }
    const cols = [
      ['data','Data'], ['placa','Placa'], ['motorista','Motorista'], ['cidade','Cidade'], ['rota','Rota'],
      ['valorFrete','Valor Frete'], ['valorMercadoria','Valor Mercadoria'], ['peso','Peso (kg)'],
      ['entregas','Entregas'], ['realizadas','Realizadas'], ['retornadas','Retornadas'],
      ['pctEntrega','% Entrega'], ['meta','Meta'], ['ocorrencia','Código(s) Ocorrência'], ['ocorrenciaDesc','Descrição da(s) Ocorrência(s)']
    ];
    const header = cols.map(c=>toCsvValue(c[1])).join(';');
    const lines = rows.map(r=>{
      const codes = parseOcorrenciaCodes(r.ocorrencia);
      const row = {
        ...r,
        ocorrencia: codes.join(', '),
        ocorrenciaDesc: codes.map(c=>OCC_LEGEND[c]||'Código não catalogado').join(' | ')
      };
      return cols.map(c=>toCsvValue(row[c[0]])).join(';');
    });
    const csv = '\uFEFF' + [header, ...lines].join('\r\n'); // BOM p/ acentuação correta no Excel
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `vitlog-saida-veiculos-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${rows.length} registro(s) exportado(s) em CSV`);
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
