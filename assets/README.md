# Assets da VitLog Torre de Controle

## Instruções para inserir a Logo da VitLog

Esta pasta contém as imagens e assets utilizados no dashboard de Torre de Controle.

### Logo da VitLog

Coloque o arquivo da logo da VitLog nesta pasta com o nome `logo.png`.

**Requisitos da imagem:**
- Nome: `logo.png` (ou altere a referência no index.html)
- Formato: PNG, SVG ou JPG
- Dimensões recomendadas: 256x256 pixels ou superior (quadrado)
- Fundo: Transparente (recomendado)

### Locais onde a logo é usada:

1. **Header (topo da página)** - Classe `.brand-mark` no arquivo `index.html`
   - Dimensões no layout: 46x46 pixels
   - Aparece ao lado do título "Saída de Veículos — VitLog Belém"

2. **Footer (rodapé)** - Classe `.footer-mark` no arquivo `index.html`
   - Mesmas dimensões do header

### Como carregar uma imagem diferente:

Se quiser usar um nome ou caminho diferente, altere as linhas no `index.html`:

**No header:**
```html
<img id="brandLogo" src="assets/logo.png" alt="VitLog Logo" ...>
```

**No footer:**
```html
<img id="footerLogo" src="assets/logo.png" alt="VitLog Logo" ...>
```

Substitua `assets/logo.png` pelo caminho correto da sua imagem.

### CSS customizado:

Se desejar ajustar o estilo da logo, você pode modificar o CSS em `css/styles.css` na seção `.brand-mark` ou `.footer-mark`.

---

**Criado em:** 15/08/2026
