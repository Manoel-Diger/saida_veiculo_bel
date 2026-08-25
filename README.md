# Torre de Controle · Saída de Veículos — VitLog Belém

Dashboard interativo construído a partir da base **Saída de Veículos (aba "jan_26 (2)")**,
com KPIs, gráficos, filtros e tabela detalhada.

## Estrutura do projeto

```
├── index.html               Estrutura da página (HTML)
├── Saida_BEL.xlsx            Planilha de origem — substitua por versões novas aqui
├── requirements.txt           Dependência Python (openpyxl) para o script de atualização
├── .vscode/
│   ├── tasks.json             Task do VS Code (Ctrl+Shift+B) para atualizar os dados
│   └── extensions.json        Sugere a extensão Python do VS Code
├── scripts/
│   └── atualizar_dados.py     Lê o Excel e regrava data/dataset.js
├── css/
│   └── styles.css            Todo o estilo visual do dashboard
├── js/
│   ├── app.js                 Lógica da aplicação: filtros, KPIs, gráficos, tabela
│   └── vendor/
│       └── chart.umd.js       Biblioteca Chart.js (embutida localmente, sem depender de internet)
├── data/
│   └── dataset.js             Dados prontos para o dashboard (gerado pelo script — não editar à mão)
└── README.md                  Este arquivo
```

## Como abrir

Basta abrir o `index.html` duas vezes (clique duplo) em qualquer navegador — **não precisa de
internet nem de servidor**. Os dados e a biblioteca de gráficos já estão embutidos localmente
em `data/dataset.js` e `js/vendor/chart.umd.js`, exatamente para evitar falhas de carregamento
por CDN indisponível ou rede bloqueada. As fontes web (Google Fonts) são carregadas quando há
internet e caem automaticamente para as fontes do sistema operacional quando não há — o layout
não quebra em nenhum dos dois casos.

Se preferir rodar com um servidor local (opcional, útil se for hospedar em algum lugar depois):

```bash
# dentro da pasta do projeto
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

## Funcionalidades

- **KPIs e ticker** com faturamento, peso, entregas, cumprimento de meta e km rodados.
- **Gráficos** (Chart.js) de frete por dia, cumprimento de meta, faturamento por motorista,
  entregas por cidade, peso por motorista e principais ofensores por ocorrência.
- **Segmentação por ocorrência**: filtro dedicado por código de ocorrência (com "Sem ocorrência"
  como opção), ranking "Principais Ofensores por Motorista" e ranking "Principais Ofensores por
  Tipo de Ocorrência" (código + descrição + % do total), para identificar de imediato os
  maiores geradores de problema — seja por motorista, seja por motivo. A legenda dos códigos
  (05, 08, 09, 10, 13, 27, 29, 38, 42, 63, 66, 79) está em `js/app.js` (constante `OCC_LEGEND`);
  qualquer código fora dessa lista aparece como "Outro código" nos filtros e rankings.
- **Filtros** por mês, ano, motorista, cidade e ocorrência, com busca livre (placa, motorista
  ou cidade) e tabela paginada e ordenável por qualquer coluna (clique ou `Enter`/`Espaço`
  no cabeçalho).
- **Exportar CSV**: baixa exatamente os registros que estão sob os filtros/busca atuais,
  já formatados para abrir direto no Excel (separador `;`, acentuação em UTF-8 com BOM),
  incluindo a descrição legível de cada código de ocorrência.
- **Acessibilidade**: cabeçalhos de tabela navegáveis por teclado, rótulos `aria-label` nos
  campos de busca e botões, estado vazio explícito quando um filtro não retorna nada.

### Sobre os códigos de ocorrência com múltiplos valores

A coluna "Ocorrência" da planilha aceita mais de um código por viagem, separados por vírgula
(ex.: `38, 13`). Como a planilha usa configuração regional pt-BR, o Excel às vezes interpreta
essa vírgula como separador decimal e grava um único número (ex.: `38,13` vira `38.13`). O
script `scripts/atualizar_dados.py` já desfaz essa conversão automaticamente ao gerar
`data/dataset.js`, recompondo os códigos originais — não é preciso corrigir isso manualmente
na planilha.


## Atualizando os dados

### Fluxo recomendado (via VS Code)

1. Abra a pasta do projeto no VS Code (`Arquivo > Abrir Pasta...`).
2. Na primeira vez, instale as dependências uma vez só, pelo terminal integrado
   (`` Ctrl+` `` abre o terminal):
   ```bash
   pip install -r requirements.txt
   ```
3. Sempre que atualizar a planilha, **substitua o arquivo `Saida_BEL.xlsx`** na raiz do
   projeto pela versão nova (mesmo nome, mesma aba `"jan_26 (2)"`).
4. Rode a task de atualização com **`Ctrl+Shift+B`** (ou vá em
   `Terminal > Run Task... > Atualizar dados do dashboard`).
5. Dê F5 na página do dashboard no navegador — os dados novos já aparecem.

O passo 4 executa `scripts/atualizar_dados.py`, que lê o Excel e regrava
`data/dataset.js` automaticamente. Você também pode rodar esse script direto pelo
terminal, sem usar a task:

```bash
python3 scripts/atualizar_dados.py
```

### Como os dados chegam ao dashboard

Os dados vêm de `data/dataset.js`, que contém uma única variável `VITLOG_DATA` com um array de
objetos (um por lançamento/viagem) — é esse arquivo que o script acima regrava. Todo o resto do
dashboard (KPIs, gráficos, filtros, tabela) se recalcula automaticamente a partir dele; você não
precisa editar mais nada.

O botão **"Atualizar Dados"**, no topo do painel, apenas recalcula e re-renderiza a partir do que
já estiver carregado no navegador — ele não relê o Excel sozinho. Para puxar dados novos da
planilha é sempre necessário rodar o script (passo 4 acima) e depois dar F5 na página.

## Personalização rápida

- **Cores:** todas as cores estão centralizadas como variáveis CSS no topo de `css/styles.css`
  (bloco `:root`) e replicadas no objeto `PALETTE` no início de `js/app.js` (usado pelos gráficos
  Chart.js). Alterar ali reflete em todo o painel.
- **Rodapé:** textos de fonte/autor ficam no `<footer>` de `index.html`.
