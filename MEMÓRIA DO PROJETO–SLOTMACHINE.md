# MEMÓRIA DO PROJETO – SLOT MACHINE

## Autor
Ildebrando

Projeto de desenvolvimento de uma slot machine temática estilo **Indiana Jones / templo antigo**.

O projeto é desenvolvido em **HTML, CSS e JavaScript puro**, sem engine de jogos.

---

# Estrutura Atual do Projeto

Pastas principais:

/admin → painel administrativo  
/engine → lógica da máquina  
/assets → imagens, efeitos e sons  
/css → estilos do jogo  
/js → scripts principais  

Estrutura atual:

admin/
engine/
assets/
css/
   base/
   mobile/
   desktop/
js/
index.html

---

# Engine do Jogo

Arquivos principais:

engine/slotEngine.js  
engine/slotConfig.js  
script.js

Responsabilidades:

slotEngine.js  
- lógica da slot
- sorteio de símbolos
- cálculo de vitória

slotConfig.js
- pesos de probabilidade
- tabela de prêmios
- controle financeiro
- controle de risco
- jackpot progressivo

script.js
- interface do jogador
- animações
- efeitos visuais
- interação com a engine

---

# Símbolos do Jogo

map  
compass  
gem  
idol  
relic  
crown  

Novo símbolo especial:

templeEye

Função:
disparar o JACKPOT.

---

# Jackpot

Sistema implementado:

jackpot progressivo

Configurações:

jackpotMin
jackpotMax
jackpotContributionPercent

Local de configuração:
admin.html

Funcionamento:

cada aposta contribui com porcentagem ao jackpot.

Quando aparecer:

templeEye templeEye templeEye

→ evento jackpot

Eventos visuais:

templo treme  
cartas pulsam  
moedas caem  
partículas do templo  
mensagem "VOCÊ GANHOU"

Interface bloqueada durante animação.

Após pagamento:

jackpot reinicia em jackpotMin.

---

# Interface do Jogo

Layout base:

1280 x 720  
proporção 16:9

Foi criado sistema de:

Safe Area Layout

Área segura:

960 x 540

Elementos importantes ficam dentro dessa área.

---

# Sistema Mobile

O jogo será usado principalmente em celular.

Modo obrigatório:

horizontal (landscape)

CSS separado:

css/base  
css/mobile  
css/desktop

Mobile usa media queries.

---

# Testes Mobile

Servidor local usado:

python -m http.server 8000

Acesso no celular:

http://IP:8000

---

# Melhorias Planejadas

Interface
- partículas nas tochas
- momentum visual
- mensagens animadas
- moedas virando partículas
- iluminação do templo
- jackpot pulsando

Mecânicas
- jackpot progressivo
- bonus roleta
- mini game memória
- símbolo coringa
- sistema near miss

Admin
- dashboard financeiro
- log diário
- histórico de lucros
- gráficos da máquina
- simulador

Infraestrutura
- layout mobile dedicado
- estrutura CSS organizada
- safe area layout
- PWA instalável
- repositório GitHub

---

# Roadmap

Existe um arquivo chamado:

melhorias_slot.html

Ele funciona como checklist das melhorias do projeto.

---

# Próximo Passo do Projeto

1. Finalizar estrutura CSS mobile.
2. Ajustar layout para celular horizontal.
3. Implementar PWA.
4. Testar instalação no celular.
5. Melhorar UI do jogo.

---

# Observação Importante

Quando este arquivo for enviado novamente para o ChatGPT, ele deve ser usado para:

- restaurar o contexto do projeto
- continuar o desenvolvimento da slot machine
- manter as decisões arquiteturais tomadas neste chat.