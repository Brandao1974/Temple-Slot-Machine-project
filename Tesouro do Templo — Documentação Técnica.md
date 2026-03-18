# 🧠 Tesouro do Templo — Documentação Técnica

## 🏗️ Arquitetura Geral

O projeto segue uma arquitetura modular separando:

```text
ENGINE (lógica)
UI (interface)
VISUAL (assets e camadas)
```

---

## 📁 Estrutura

```text
/admin
/engine
    slotConfig.js
    slotEngine.js
/css
    /base
    /desktop
    /mobile
/assets
/js
index.html
manifest.json
sw.js
```

---

## ⚙️ Engine

### slotConfig.js

Responsável por:

* valores de aposta
* probabilidades
* regras do jogo

---

### slotEngine.js

Responsável por:

* lógica de giro
* cálculo de resultado
* controle de estado

---

## 🎨 Sistema de Renderização

Separação em camadas:

```text
#game-background → cenário
#game-frame → moldura
#game-ui → interface
```

---

## 📱 Sistema Responsivo

### Base fixa

```js
1280 x 720
```

---

### Desktop

```js
scale = min(width, height)
```

---

### Mobile

```js
scale = (largura / BASE_WIDTH) * 1.2~1.28
transform-origin: top center
translateX(-50%)
```

---

## 🎯 Estratégia Mobile

* prioriza largura
* aceita corte inferior
* protege topo (jackpot)
* elimina faixas laterais

---

## 🎮 UI System

### Componentes

* painel (cartas)
* placas (HUD)
* controles (botões)
* jackpot

---

## ⚠️ Problema resolvido

```text
layout acoplado ao background
```

### Solução:

```text
background ≠ frame ≠ UI
```

---

## 🧱 Frame System

Elemento independente:

```css
#game-frame
```

Responsável por:

* moldura visual
* alinhamento dos slots

---

## 📦 Assets

Separação recomendada:

```text
/assets/background
/assets/frame
/assets/ui
/assets/cards
/assets/effects
```

---

## 🔥 PWA

### Implementação

* manifest.json
* service worker
* modo standalone

---

### Cache Strategy

```js
CACHE_NAME versionado
```

---

## ⚠️ Problema conhecido

```text
cache impede atualização
```

---

## 🧠 Boas práticas adotadas

* commit por etapa
* separação de responsabilidade
* mobile-first adaptativo
* desacoplamento visual

---

## 🚀 Próximos passos técnicos

* cache inteligente
* lazy load de assets
* animações desacopladas
* otimização de performance
* modularização da UI
