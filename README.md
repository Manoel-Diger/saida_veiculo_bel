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
por CDN indisponível ou rede bloqueada.

Se preferir rodar com um servidor local (opcional, útil se for hospedar em algum lugar depois):

```bash
# dentro da pasta do projeto
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

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
