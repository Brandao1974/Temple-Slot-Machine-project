const CREDITOS_INICIAIS = 30; // Altere este valor para mudar os creditos iniciais do jogo.
const BASE_GAME_WIDTH = 1280;
const BASE_GAME_HEIGHT = 720;
const JACKPOT_ANIMATION_MS = 4800;
const CARD_ASSET_BY_SYMBOL = {
    templeEye: "olhodotemplo"
};
const CARD_CANVAS_ID = "flip-cards-canvas";
const CARD_LAYOUT_DESKTOP = [
    { x: 540, y: 350 },
    { x: 690, y: 350 },
    { x: 840, y: 350 }
];
const CARD_LAYOUT_MOBILE = [
    { x: 335, y: 356 },
    { x: 565, y: 356 },
    { x: 800, y: 356 }
];
const CARD_SPIN_PREVIEW_SYMBOLS = ["compass", "map", "idol", "relic", "crown", "gem"];
const CARD_FINAL_REVEAL_LEAD_MS = 140;
const CARD_SPIN_PREVIEW_INTERVAL_MS = 90;
const PHONE_MAX_DEVICE_WIDTH = 540;
const PHONE_MAX_DEVICE_HEIGHT = 960;
const BET_LEVELS = [
    { label: "BAIXA", value: 0.25, maxWin: 50 },
    { label: "LEVE", value: 0.5, maxWin: 100 },
    { label: "NORMAL", value: 1, maxWin: 200 },
    { label: "ALTA", value: 2, maxWin: 400 },
    { label: "SUPER", value: 5, maxWin: 1000 },
    { label: "TURBO", value: 10, maxWin: 2000 }
];
const BET_DEFAULT_INDEX = 2;

function lerSaldoSalvo(){
    const saldoSalvo = Number(window.localStorage.getItem("saldo"));
    return Number.isFinite(saldoSalvo) ? saldoSalvo : CREDITOS_INICIAIS;
}

let saldo = lerSaldoSalvo();

let girando = false;
let autoGiro = false;
let aguardandoPagamento = false;
let jackpotEmAndamento = false;
let jackpotPendenteReset = false;
let avisoTimeoutId = null;
let creditosAnimados = saldo;
let animacaoCreditosId = null;
let emissorJackpotId = null;
let jackpotCoinRainIntervalId = null;
let jackpotDustIntervalId = null;
let currentBetIndex = BET_DEFAULT_INDEX;
let betToastTimeoutId = null;
let betToastAnimationEndHandlerAttached = false;
let gameInitialized = false;
let loaderTransitionStarted = false;
let serviceWorkerUpdateHandlerAttached = false;
let serviceWorkerUpdateNoticeVisible = false;
const trilhaSonora = new Audio("assets/audio/trilhasonora.mp3");
const payoutCoinsSound = new Audio("assets/audio/payoutcoins.mp3");
const coinClinkSound = new Audio("assets/audio/coin_clink.mp3");

trilhaSonora.loop = true;
trilhaSonora.volume = 0.25;
payoutCoinsSound.volume = 0.5;
coinClinkSound.volume = 0.6;

const flipCardImageCache = new Map();
let flipCards = [];
let flipCanvas = null;
let flipCtx = null;
let flipAnimationFrameId = null;
let flipCardBackImage = null;

const creditosEl = document.getElementById("creditos");
const apostaEl = document.getElementById("aposta");
const ganhoEl = document.getElementById("ganho");
const jackpotEl = document.getElementById("jackpot-valor");
const jackpotMessageEl = document.getElementById("jackpot-message");
const avisoEl = document.getElementById("msg-creditos");
const betToastWrapperEl = document.getElementById("bet-toast-wrapper");
const betToastEl = document.getElementById("bet-toast");
const betToastContentEl = betToastEl ? betToastEl.querySelector(".bet-toast-content") : null;
const betToastParticlesEl = betToastEl ? betToastEl.querySelector(".bet-toast-particles") : null;
const betMinusEl = document.getElementById("bet-minus");
const betPlusEl = document.getElementById("bet-plus");
const apostaPlacaEl = document.querySelector(".placa-aposta");
const botaoGirar = document.querySelector(".btn-girar");
const botaoAuto = document.querySelector(".btn-auto");
const painelEl = document.querySelector(".painel");
const temploEl = document.querySelector(".templo-bg");
const areaJogoEl = document.querySelector(".area-jogo");
const gameContainerEl = document.getElementById("game-container");
const slotAnchorEls = [
    document.getElementById("slot1"),
    document.getElementById("slot2"),
    document.getElementById("slot3")
];

function salvarSaldo(){
    window.localStorage.setItem("saldo", String(saldo));
    if(typeof window.sincronizarSaldoSessao === "function"){
        window.sincronizarSaldoSessao(saldo);
    }
}

function formatarMoedaBRL(valor){
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarValorPainel(valor){
    const numero = Number(valor);
    if(!Number.isFinite(numero)){
        return "0";
    }

    const possuiFracao = Math.abs(numero % 1) > 0.0001;
    return numero.toLocaleString("pt-BR", {
        minimumFractionDigits: possuiFracao ? 2 : 0,
        maximumFractionDigits: 2
    });
}

function getCurrentBetValue(){
    return BET_LEVELS[currentBetIndex].value;
}

function getCurrentBetLevel(){
    return BET_LEVELS[currentBetIndex];
}

function getCardAssetName(simbolo){
    return CARD_ASSET_BY_SYMBOL[simbolo] || simbolo;
}

function getFlipCardImage(assetName){
    if(flipCardImageCache.has(assetName)){
        return flipCardImageCache.get(assetName);
    }

    const image = new Image();
    image.src = `assets/cartas/${assetName}.webp`;
    flipCardImageCache.set(assetName, image);
    return image;
}

function forEachFlipCard(callback){
    flipCards.forEach((card, index) => {
        if(card){
            callback(card, index);
        }
    });
}

function getCardLayout(){
    if(window.innerWidth >= 900 && areaJogoEl && slotAnchorEls.every(Boolean)){
        const areaRect = areaJogoEl.getBoundingClientRect();
        if(areaRect.width > 0 && areaRect.height > 0){
            return slotAnchorEls.map((anchor) => {
                const anchorRect = anchor.getBoundingClientRect();

                return {
                    x: ((anchorRect.left + (anchorRect.width / 2) - areaRect.left) / areaRect.width) * BASE_GAME_WIDTH,
                    y: ((anchorRect.top + (anchorRect.height / 2) - areaRect.top) / areaRect.height) * BASE_GAME_HEIGHT
                };
            });
        }
    }

    return window.innerWidth < 900 ? CARD_LAYOUT_MOBILE : CARD_LAYOUT_DESKTOP;
}

function atualizarLayoutFlipCards(){
    const layout = getCardLayout();

    forEachFlipCard((card, index) => {
        const position = layout[index] || CARD_LAYOUT_DESKTOP[index];
        if(!position){
            return;
        }

        card.x = position.x;
        card.y = position.y;
    });
}

function isPhoneResolution(){
    const screenWidth = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    const screenHeight = window.screen && window.screen.height ? window.screen.height : window.innerHeight;
    const shortestSide = Math.min(screenWidth, screenHeight);
    const longestSide = Math.max(screenWidth, screenHeight);

    return shortestSide <= PHONE_MAX_DEVICE_WIDTH && longestSide <= PHONE_MAX_DEVICE_HEIGHT;
}

function aplicarOrientacaoHorizontalMobile(){
    if(!isPhoneResolution()){
        return;
    }

    if(
        !window.screen ||
        !window.screen.orientation ||
        typeof window.screen.orientation.lock !== "function"
    ){
        return;
    }

    const orientationType = String(window.screen.orientation.type || "");
    if(orientationType.startsWith("landscape")){
        return;
    }

    window.screen.orientation.lock("landscape").catch(() => {});
}

function ensureFlipCanvas(){
    if(flipCanvas || !areaJogoEl){
        return;
    }

    flipCanvas = document.createElement("canvas");
    flipCanvas.id = CARD_CANVAS_ID;
    flipCanvas.width = BASE_GAME_WIDTH;
    flipCanvas.height = BASE_GAME_HEIGHT;
    flipCanvas.setAttribute("aria-hidden", "true");
    areaJogoEl.appendChild(flipCanvas);
    flipCtx = flipCanvas.getContext("2d");
}

function inicializarFlipCards(){
    ensureFlipCanvas();
    if(!flipCtx || flipCards.length){
        return;
    }

    flipCardBackImage = getFlipCardImage("card_back");
    flipCards = getCardLayout().map((position, index) => new FlipCard(
        flipCtx,
        position.x,
        position.y,
        getFlipCardImage(["compass", "map", "idol"][index] || "card_back"),
        flipCardBackImage
    ));

    atualizarLayoutFlipCards();
}

function iniciarLoopFlipCards(){
    if(flipAnimationFrameId || !flipCtx){
        return;
    }

    const render = () => {
        if(!flipCtx || !flipCanvas){
            flipAnimationFrameId = null;
            return;
        }

        const now = Date.now();
        flipCtx.clearRect(0, 0, flipCanvas.width, flipCanvas.height);
        forEachFlipCard((card) => {
            card.update(now);
            card.draw(now);
        });
        flipAnimationFrameId = window.requestAnimationFrame(render);
    };

    render();
}

function getJackpotAmount(){
    if(typeof window.getJackpotValue === "function"){
        return Number(window.getJackpotValue()) || 0;
    }

    return Number(window.SLOT_CONFIG && window.SLOT_CONFIG.premios ? window.SLOT_CONFIG.premios.crown : 0) || 0;
}

function getBetMessageConfig(){
    const config = window.SLOT_CONFIG && window.SLOT_CONFIG.betMessage
        ? window.SLOT_CONFIG.betMessage
        : {};

    return {
        mensagemLinha1: typeof config.mensagemLinha1 === "string" && config.mensagemLinha1.trim()
            ? config.mensagemLinha1
            : "APOSTA {bet}",
        mensagemLinha2: typeof config.mensagemLinha2 === "string" && config.mensagemLinha2.trim()
            ? config.mensagemLinha2
            : "GANHO MAX {maxWin}",
        tempoMensagem: Math.max(200, Number(config.tempoMensagem) || 3000)
    };
}

function substituirMarcadoresMensagem(template, nivelAtual){
    return String(template || "")
        .replaceAll("{bet}", formatarMoedaBRL(nivelAtual.value))
        .replaceAll("{maxWin}", formatarMoedaBRL(nivelAtual.maxWin));
}

function animarMudancaAposta(){
    if(!apostaEl || !apostaPlacaEl){
        return;
    }

    apostaEl.classList.remove("bet-change");
    apostaPlacaEl.classList.remove("bet-change");
    void apostaEl.offsetWidth;
    apostaEl.classList.add("bet-change");
    apostaPlacaEl.classList.add("bet-change");
    window.setTimeout(() => {
        apostaEl.classList.remove("bet-change");
        apostaPlacaEl.classList.remove("bet-change");
    }, 220);
}

function limparParticulasMensagemAposta(){
    if(!betToastParticlesEl){
        return;
    }

    betToastParticlesEl
        .querySelectorAll(".bet-toast-particle")
        .forEach((particula) => particula.remove());
}

function criarParticulasMensagemAposta(){
    if(!betToastParticlesEl){
        return;
    }

    limparParticulasMensagemAposta();

    const quantidade = 10 + Math.floor(Math.random() * 6);
    for(let i = 0; i < quantidade; i++){
        const particula = document.createElement("div");
        particula.className = "bet-toast-particle";
        particula.style.left = `${50 + (Math.random() * 52 - 26)}%`;
        particula.style.bottom = `${6 + Math.random() * 10}px`;
        particula.style.animationDuration = `${1.05 + Math.random() * 0.45}s`;
        particula.style.animationDelay = `${Math.random() * 0.08}s`;
        particula.style.setProperty("--toast-particle-x", `${Math.random() * 30 - 15}px`);
        particula.style.setProperty("--toast-particle-scale", `${0.6 + Math.random() * 0.8}`);
        betToastParticlesEl.appendChild(particula);
        window.setTimeout(() => particula.remove(), 1700);
    }
}

function mostrarMensagemAposta(){
    if(!betToastEl || !betToastContentEl || !betToastWrapperEl){
        return;
    }

    window.refreshSlotConfig();

    if(betToastTimeoutId){
        window.clearTimeout(betToastTimeoutId);
        betToastTimeoutId = null;
    }

    betToastEl.classList.remove("ativo");
    limparParticulasMensagemAposta();

    const nivelAtual = getCurrentBetLevel();
    const config = getBetMessageConfig();
    betToastContentEl.innerHTML = `
        <span class="bet-toast-label">${substituirMarcadoresMensagem(config.mensagemLinha1, nivelAtual)}</span>
        <span class="bet-toast-label">${substituirMarcadoresMensagem(config.mensagemLinha2, nivelAtual)}</span>
    `;
    betToastEl.style.setProperty("--bet-toast-duration", `${config.tempoMensagem}ms`);
    betToastWrapperEl.style.display = "block";
    void betToastEl.offsetWidth;
    betToastEl.classList.add("ativo");
    criarParticulasMensagemAposta();

    betToastTimeoutId = window.setTimeout(() => {
        limparParticulasMensagemAposta();
        betToastTimeoutId = null;
    }, config.tempoMensagem);
}

function atualizarControlesAposta(animar = false){
    if(apostaEl){
        apostaEl.innerText = formatarMoedaBRL(getCurrentBetValue());
    }

    if(betMinusEl){
        betMinusEl.disabled = currentBetIndex <= 0;
    }

    if(betPlusEl){
        betPlusEl.disabled = currentBetIndex >= BET_LEVELS.length - 1;
    }

    if(typeof window.refreshSlotConfig === "function"){
        window.refreshSlotConfig();
    }

    if(animar){
        animarMudancaAposta();
    }
}

function alterarAposta(direcao){
    const proximoIndice = Math.min(
        BET_LEVELS.length - 1,
        Math.max(0, currentBetIndex + direcao)
    );

    if(proximoIndice === currentBetIndex){
        return;
    }

    currentBetIndex = proximoIndice;
    atualizarControlesAposta(true);
    mostrarMensagemAposta();
    atualizarBotaoPronto();
}

function atualizarBotaoPronto(){
    const prontoParaGirar = !girando && !aguardandoPagamento && !autoGiro && !jackpotEmAndamento && saldo >= SLOT_CONFIG.custoJogada;
    if(botaoGirar){
        botaoGirar.classList.toggle("spin-ready", prontoParaGirar);
    }
}

function animarContadorCreditos(valorFinal){
    const alvo = Number(valorFinal);
    if(!Number.isFinite(alvo) || !creditosEl){
        return;
    }

    if(animacaoCreditosId){
        window.cancelAnimationFrame(animacaoCreditosId);
        animacaoCreditosId = null;
    }

    if(alvo <= creditosAnimados){
        creditosAnimados = alvo;
        creditosEl.innerText = formatarValorPainel(alvo);
        return;
    }

    const inicio = creditosAnimados;
    const duracao = 320;
    const tempoInicial = performance.now();

    const atualizar = (tempoAtual) => {
        const progresso = Math.min(1, (tempoAtual - tempoInicial) / duracao);
        const suavizado = 1 - Math.pow(1 - progresso, 3);
        creditosAnimados = inicio + ((alvo - inicio) * suavizado);
        creditosEl.innerText = formatarValorPainel(creditosAnimados);

        if(progresso < 1){
            animacaoCreditosId = window.requestAnimationFrame(atualizar);
            return;
        }

        creditosAnimados = alvo;
        creditosEl.innerText = formatarValorPainel(alvo);
        animacaoCreditosId = null;
    };

    animacaoCreditosId = window.requestAnimationFrame(atualizar);
}

function limparCartasVencedoras(){
    forEachFlipCard((card) => card.setWinning(false));
}

function destacarCartasVencedoras(){
    forEachFlipCard((card) => card.setWinning(true));
    window.setTimeout(limparCartasVencedoras, 1400);
}

let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

function criarParticulaJackpot(){
    if(!jackpotEl || !jackpotEl.parentElement){
        return;
    }

    const particula = document.createElement("div");
    particula.className = "jackpot-particula";
    particula.style.left = `${18 + Math.random() * 64}%`;
    particula.style.bottom = `${8 + Math.random() * 10}px`;
    particula.style.animationDuration = `${2.4 + Math.random() * 0.8}s`;
    particula.style.animationDelay = `${Math.random() * 0.25}s`;
    particula.style.setProperty("--jackpot-dx", `${Math.random() * 18 - 9}px`);
    particula.style.setProperty("--jackpot-scale", `${0.7 + Math.random() * 0.7}`);
    jackpotEl.parentElement.appendChild(particula);
    window.setTimeout(() => particula.remove(), 3400);
}

function iniciarEmissorJackpot(){
    if(emissorJackpotId || !jackpotEl || !jackpotEl.parentElement){
        return;
    }

    for(let i = 0; i < 4; i++){
        window.setTimeout(criarParticulaJackpot, i * 180);
    }

    emissorJackpotId = window.setInterval(criarParticulaJackpot, 320);
}

function atualizarHUD(){
    window.refreshSlotConfig();
    animarContadorCreditos(saldo);
    atualizarControlesAposta();
    if(jackpotEl){
        jackpotEl.innerText = formatarMoedaBRL(getJackpotAmount());
    }
    if(!aguardandoPagamento && ganhoEl){
        ganhoEl.innerText = "0";
    }
    atualizarBotaoPronto();
}

function mostrarAvisoCreditos(){
    mostrarAviso("CR\u00c9DITOS INSUFICIENTES");
}

function mostrarAviso(texto){
    if(avisoEl){
        avisoEl.innerText = texto;
        avisoEl.classList.add("ativo");
    }
    if(botaoGirar){
        botaoGirar.classList.remove("erro");
        void botaoGirar.offsetWidth;
        botaoGirar.classList.add("erro");
    }

    if(avisoTimeoutId){
        window.clearTimeout(avisoTimeoutId);
    }

    avisoTimeoutId = window.setTimeout(() => {
        if(avisoEl){
            avisoEl.classList.remove("ativo");
        }
        if(botaoGirar){
            botaoGirar.classList.remove("erro");
        }
        avisoTimeoutId = null;
    }, 2000);
}

function obterMensagemBloqueio(resultado){
    if(resultado.bloqueadoPorPercentual){
        return "PR\u00caMIO ACIMA DO LIMITE DA BANCA";
    }

    if(resultado.bloqueadoPorBanca){
        return "BANCA INSUFICIENTE PARA PAGAMENTO";
    }

    if(resultado.limitadoPorSpin){
        return "PR\u00caMIO LIMITADO POR GIRO";
    }

    return "";
}

function setEstadoAutoGiro(ativo){
    if(jackpotEmAndamento && ativo){
        return;
    }
    autoGiro = ativo;
    if(botaoAuto){
        botaoAuto.classList.toggle("ativo", ativo);
    }
    if(botaoGirar){
        botaoGirar.style.opacity = ativo ? "0.4" : "1";
        botaoGirar.style.pointerEvents = ativo ? "none" : "auto";
    }
}

function limparEfeitosJackpot(){
    if(jackpotCoinRainIntervalId){
        window.clearInterval(jackpotCoinRainIntervalId);
        jackpotCoinRainIntervalId = null;
    }
    if(jackpotDustIntervalId){
        window.clearInterval(jackpotDustIntervalId);
        jackpotDustIntervalId = null;
    }
    if(painelEl){
        painelEl.classList.remove("jackpot");
    }
    forEachFlipCard((card) => card.resetEffects());
    if(temploEl){
        temploEl.classList.remove("templo-jackpot");
    }
    if(jackpotMessageEl){
        jackpotMessageEl.classList.remove("ativo");
    }
    limparCartasVencedoras();
}

function playJackpotMusic(){
    // Placeholder para futura integracao com assets/audio/jackpot-win.mp3.
}

function criarMoedaChuvaJackpot(){
    const moeda = document.createElement("div");
    moeda.className = "moeda-chuva jackpot-long";
    moeda.style.left = `${Math.random() * 100}vw`;
    moeda.style.width = `${16 + Math.random() * 24}px`;
    moeda.style.height = moeda.style.width;
    moeda.style.animationDuration = `${2.4 + Math.random() * 2.1}s`;
    moeda.style.setProperty("--coin-scale", `${0.7 + Math.random() * 1.1}`);
    moeda.style.setProperty("--coin-rotation", `${540 + Math.floor(Math.random() * 900)}deg`);
    document.body.appendChild(moeda);
    window.setTimeout(() => moeda.remove(), 6200);
}

function coinRain(){
    for(let i = 0; i < 16; i++){
        window.setTimeout(criarMoedaChuvaJackpot, i * 90);
    }

    jackpotCoinRainIntervalId = window.setInterval(() => {
        for(let i = 0; i < 3; i++){
            criarMoedaChuvaJackpot();
        }
    }, 260);
}

function criarTempleDustParticula(){
    const particula = document.createElement("div");
    particula.className = "temple-dust";
    particula.style.left = `${8 + Math.random() * 84}%`;
    particula.style.setProperty("--dust-drift", `${Math.random() * 70 - 35}px`);
    particula.style.setProperty("--dust-scale", `${0.5 + Math.random() * 1.4}`);
    particula.style.setProperty("--dust-duration", `${3.6 + Math.random() * 2.2}s`);
    document.body.appendChild(particula);
    window.setTimeout(() => particula.remove(), 6500);
}

function templeDust(){
    for(let i = 0; i < 20; i++){
        window.setTimeout(criarTempleDustParticula, i * 80);
    }

    jackpotDustIntervalId = window.setInterval(() => {
        for(let i = 0; i < 4; i++){
            criarTempleDustParticula();
        }
    }, 260);
}

function dispararJackpot(resultado){
    if(painelEl){
        painelEl.classList.add("jackpot");
    }
    forEachFlipCard((card, indice) => {
        const templeEye = !resultado || resultado.simbolos[indice] === "templeEye";
        card.setJackpot(templeEye);
        card.setTempleEye(templeEye);
    });
    if(temploEl){
        temploEl.classList.add("templo-jackpot");
    }
    if(jackpotMessageEl){
        jackpotMessageEl.classList.remove("ativo");
        void jackpotMessageEl.offsetWidth;
        jackpotMessageEl.classList.add("ativo");
    }
    playJackpotMusic();
    coinRain();
    templeDust();

    const flash = document.createElement("div");
    flash.className = "flash-jackpot";
    document.body.appendChild(flash);
    window.setTimeout(() => flash.remove(), 700);
}

function jogar(){
    if(girando || aguardandoPagamento || jackpotEmAndamento){
        return;
    }

    if(saldo < SLOT_CONFIG.custoJogada){
        setEstadoAutoGiro(false);
        mostrarAvisoCreditos();
        return;
    }

    limparEfeitosJackpot();
    if(ganhoEl){
        ganhoEl.innerText = "0";
    }
    saldo -= SLOT_CONFIG.custoJogada;
    salvarSaldo();
    atualizarHUD();
    girando = true;
    atualizarBotaoPronto();

    const resultado = SLOT_ENGINE.girar();
    const { simbolos, premio } = resultado;

    girarCarta(0, 800, simbolos[0], () => {
        girarCarta(1, 900, simbolos[1], () => {
            girarCarta(2, 1000, simbolos[2], () => {
                if(resultado.triggeredJackpot){
                    executarSequenciaJackpot(resultado);
                    return;
                }

                if(premio > 0){
                    if(resultado.limitadoPorSpin){
                        mostrarAviso(obterMensagemBloqueio(resultado));
                    }
                    efeitosVitoria(resultado);
                    premiar(premio);
                    return;
                }

                const mensagemBloqueio = obterMensagemBloqueio(resultado);
                if(mensagemBloqueio){
                    mostrarAviso(mensagemBloqueio);
                }
                girando = false;
                atualizarBotaoPronto();
                if(autoGiro){
                    window.setTimeout(executarAutoGiro, 700);
                }
            });
        });
    });
}

function girarCarta(index, tempo, simbolo, callback){
    const card = flipCards[index];

    if(!card){
        if(callback){
            callback();
        }
        return;
    }

    const previewSymbols = CARD_SPIN_PREVIEW_SYMBOLS.filter((item) => item !== simbolo);
    const fallbackPreview = previewSymbols.length ? previewSymbols : CARD_SPIN_PREVIEW_SYMBOLS;
    let previewIndex = index % fallbackPreview.length;
    const aplicarPreview = () => {
        const previewSymbol = fallbackPreview[previewIndex % fallbackPreview.length];
        previewIndex += 1;
        card.setFrontImage(getFlipCardImage(getCardAssetName(previewSymbol)));
    };
    const revealDelay = Math.max(0, tempo - CARD_FINAL_REVEAL_LEAD_MS);

    aplicarPreview();
    const previewIntervalId = window.setInterval(aplicarPreview, CARD_SPIN_PREVIEW_INTERVAL_MS);
    card.setJackpot(false);
    card.setTempleEye(false);
    card.setWinning(false);
    card.start(tempo);

    window.setTimeout(() => {
        window.clearInterval(previewIntervalId);
        card.setFrontImage(getFlipCardImage(getCardAssetName(simbolo)));
        card.setTempleEye(simbolo === "templeEye");
    }, revealDelay);

    window.setTimeout(() => {
        window.clearInterval(previewIntervalId);
        card.setFrontImage(getFlipCardImage(getCardAssetName(simbolo)));
        card.setTempleEye(simbolo === "templeEye");
        if(callback){
            callback();
        }
    }, tempo);
}

function executarSequenciaJackpot(resultado){
    jackpotEmAndamento = true;
    girando = false;
    aguardandoPagamento = false;
    jackpotPendenteReset = false;
    setEstadoAutoGiro(false);
    if(botaoGirar){
        botaoGirar.style.pointerEvents = "none";
        botaoGirar.style.opacity = "0.35";
    }
    atualizarBotaoPronto();
    dispararJackpot(resultado);

    window.setTimeout(() => {
        if(resultado.premio > 0){
            jackpotPendenteReset = true;
            premiar(resultado.premio);
        }else{
            jackpotPendenteReset = false;
        }
        atualizarHUD();
        limparEfeitosJackpot();
        jackpotEmAndamento = false;
        if(botaoGirar){
            botaoGirar.style.pointerEvents = "auto";
            botaoGirar.style.opacity = autoGiro ? "0.4" : "1";
        }
        atualizarBotaoPronto();
    }, JACKPOT_ANIMATION_MS);
}

function premiar(valor){
    const pagamento = window.registrarPremio(valor);
    if(!pagamento.pago){
        aguardandoPagamento = false;
        girando = false;
        jackpotPendenteReset = false;
        if(ganhoEl){
            ganhoEl.innerText = "0";
        }
        mostrarAviso("PAGAMENTO BLOQUEADO");

        if(autoGiro){
            window.setTimeout(executarAutoGiro, 600);
        }
        return;
    }

    if(typeof window.registrarGanhoSessao === "function"){
        window.registrarGanhoSessao(valor);
    }

    aguardandoPagamento = true;
    atualizarBotaoPronto();
    transferirPremio(valor);
}

function transferirPremio(valor){
    if(!ganhoEl){
        aguardandoPagamento = false;
        girando = false;
        atualizarBotaoPronto();
        return;
    }

    ganhoEl.innerText = String(valor);
    tocarSomPayout();

    let restante = valor;
    const incremento = Math.max(1, Math.ceil(valor / 40));
    const intervalo = window.setInterval(() => {
        const parcela = Math.min(incremento, restante);
        restante -= parcela;
        saldo += parcela;
        salvarSaldo();
        animarContadorCreditos(saldo);
        ganhoEl.innerText = String(restante);
        criarMoedaTransferencia();

        if(restante <= 0){
            window.clearInterval(intervalo);
            payoutCoinsSound.pause();
            payoutCoinsSound.currentTime = 0;
            tocarSomFinalPagamento();
            if(jackpotPendenteReset && typeof window.resetJackpotValue === "function"){
                window.resetJackpotValue();
                jackpotPendenteReset = false;
            }
            aguardandoPagamento = false;
            ganhoEl.innerText = "0";
            girando = false;
            atualizarBotaoPronto();
            atualizarHUD();

            if(autoGiro){
                window.setTimeout(executarAutoGiro, 600);
            }
        }
    }, 90);
}

function tocarSomPayout(){
    payoutCoinsSound.currentTime = 0;
    payoutCoinsSound.play().catch(() => {});
}

function tocarSomFinalPagamento(){
    coinClinkSound.currentTime = 0;
    coinClinkSound.play().catch(() => {});
}

function criarMoedaTransferencia(){
    if(!ganhoEl || !creditosEl){
        return;
    }

    const ganho = ganhoEl.getBoundingClientRect();
    const creditos = creditosEl.getBoundingClientRect();
    const moeda = document.createElement("div");

    moeda.className = "moeda-transfer";
    moeda.style.left = `${ganho.left + ganho.width / 2}px`;
    moeda.style.top = `${ganho.top + ganho.height / 2}px`;

    const destinoX = creditos.left + creditos.width / 2;
    const destinoY = creditos.top + creditos.height / 2;
    const dx = destinoX - (ganho.left + ganho.width / 2);
    const dy = destinoY - (ganho.top + ganho.height / 2);

    moeda.style.setProperty("--dx", `${dx}px`);
    moeda.style.setProperty("--dy", `${dy}px`);

    document.body.appendChild(moeda);
    window.setTimeout(() => moeda.remove(), 1600);
}

function efeitosVitoria(resultado){
    gerarParticulas();
    gerarFaiscas();
    gerarFumaca();
    destacarCartasVencedoras();

    if(resultado.triggeredJackpot){
        return;
    }
}

function gerarParticulas(){
    for(let i = 0; i < 25; i++){
        const particula = document.createElement("div");
        particula.className = "particula";
        particula.style.left = `${window.innerWidth / 2 + (Math.random() * 200 - 100)}px`;
        particula.style.top = `${window.innerHeight / 2}px`;
        document.body.appendChild(particula);
        window.setTimeout(() => particula.remove(), 3500);
    }
}

function gerarFaiscas(){
    for(let i = 0; i < 15; i++){
        const faisca = document.createElement("div");
        faisca.className = "faisca";
        faisca.style.left = `${window.innerWidth / 2 + (Math.random() * 200 - 100)}px`;
        faisca.style.top = `${window.innerHeight / 2}px`;
        document.body.appendChild(faisca);
        window.setTimeout(() => faisca.remove(), 600);
    }
}

function gerarFumaca(){
    const fumaca = document.createElement("div");
    fumaca.className = "fumaca";
    fumaca.style.left = `${window.innerWidth / 2 - 60}px`;
    fumaca.style.bottom = "100px";
    document.body.appendChild(fumaca);
    window.setTimeout(() => fumaca.remove(), 6000);
}

function toggleAutoGiro(){
    if(jackpotEmAndamento){
        return;
    }

    if(autoGiro){
        setEstadoAutoGiro(false);
        return;
    }

    setEstadoAutoGiro(true);
    executarAutoGiro();
}

function executarAutoGiro(){
    if(!autoGiro || girando || aguardandoPagamento || jackpotEmAndamento){
        return;
    }

    if(saldo < SLOT_CONFIG.custoJogada){
        setEstadoAutoGiro(false);
        mostrarAvisoCreditos();
        return;
    }

    jogar();
}

function reconciliarEstadoExterno(){
    if(girando || aguardandoPagamento || jackpotEmAndamento){
        return;
    }

    if(autoGiro && saldo < SLOT_CONFIG.custoJogada){
        setEstadoAutoGiro(false);
        mostrarAvisoCreditos();
    }

    atualizarBotaoPronto();
}

function iniciarTrilha(){
    trilhaSonora.play().catch(() => {});
}

window.jogar = jogar;
window.toggleAutoGiro = toggleAutoGiro;
window.getCurrentBetValue = getCurrentBetValue;
window.addEventListener("resize", ajustarEscala);
document.addEventListener("click", iniciarTrilha, { once: true });

if(betMinusEl){
    betMinusEl.addEventListener("click", () => alterarAposta(-1));
}

if(betPlusEl){
    betPlusEl.addEventListener("click", () => alterarAposta(1));
}

window.addEventListener("storage", (event) => {
    if(event.key === "saldo"){
        saldo = lerSaldoSalvo();
        atualizarHUD();
        reconciliarEstadoExterno();
    }

    if(
        event.key === "pesos" ||
        event.key === "premios" ||
        event.key === "rtp" ||
        event.key === "riskControl" ||
        event.key === "betMessageConfig" ||
        event.key === "jackpotValue"
    ){
        window.refreshSlotConfig();
        atualizarHUD();
        reconciliarEstadoExterno();
    }
});

if(betToastEl && !betToastAnimationEndHandlerAttached){
    betToastEl.addEventListener("animationend", (event) => {
        if(event.animationName === "betToastInOut"){
            betToastEl.classList.remove("ativo");
            limparParticulasMensagemAposta();
            if(betToastWrapperEl){
                betToastWrapperEl.style.display = "none";
            }
            betToastTimeoutId = null;
        }
    });
    betToastAnimationEndHandlerAttached = true;
}

document.addEventListener('touchmove', function (event) {
    if (event.scale !== 1) {
        event.preventDefault();
    }
}, { passive: false });

function inicializarJogo(){
    if(gameInitialized){
        return;
    }

    gameInitialized = true;
    aplicarOrientacaoHorizontalMobile();
    saldo = lerSaldoSalvo();
    creditosAnimados = saldo;
    if(window.localStorage.getItem("saldo") === null){
        salvarSaldo();
    }else if(typeof window.sincronizarSaldoSessao === "function"){
        window.sincronizarSaldoSessao(saldo);
    }
    iniciarEmissorJackpot();
    atualizarControlesAposta();
    if(betToastWrapperEl){
        betToastWrapperEl.style.display = "none";
    }
    ajustarEscala();
    inicializarFlipCards();
    atualizarLayoutFlipCards();
    iniciarLoopFlipCards();
    atualizarHUD();
    reconciliarEstadoExterno();
}

window.addEventListener("load", inicializarJogo, { once: true });

/* ===== LOADER TRANSITION ===== */

window.addEventListener("load", () => {
    if(loaderTransitionStarted){
        return;
    }

    loaderTransitionStarted = true;
    const loader = document.getElementById("loader");
    const game = document.getElementById("game-container");

    if(!loader){
        return;
    }

    setTimeout(() => {

        loader.style.opacity = "0";

        if(game){
            game.style.opacity = "1";
            game.style.transform = "scale(1)";
        }

        setTimeout(() => {
            loader.style.display = "none";
        }, 800);

    }, 500);
});

function ajustarEscala(){

const stage = document.getElementById("game-container");

if(!stage) return;

const larguraTela = window.innerWidth;
const alturaTela = window.innerHeight;

const escalaX = larguraTela / 1280;
const escalaY = alturaTela / 720;

const escala = Math.min(escalaX, escalaY);

stage.style.transform = "scale(" + escala + ")";
atualizarLayoutFlipCards();
}

window.addEventListener("resize", ajustarEscala);
window.addEventListener("load", ajustarEscala);
window.addEventListener("load", aplicarOrientacaoHorizontalMobile);
window.addEventListener("resize", aplicarOrientacaoHorizontalMobile);
document.addEventListener("touchstart", aplicarOrientacaoHorizontalMobile, { once: true, passive: true });
document.addEventListener("click", aplicarOrientacaoHorizontalMobile, { once: true });


// atualização do sw
function registrarServiceWorkerUmaVez(){
  if(!("serviceWorker" in navigator)){
    return;
  }

  if(window.__slotServiceWorkerRegistrationPromise){
    return;
  }

  window.__slotServiceWorkerRegistrationPromise = navigator.serviceWorker.register("./sw.js").then(reg => {
    if(!serviceWorkerUpdateHandlerAttached){
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if(!newWorker){
          return;
        }

        newWorker.addEventListener("statechange", () => {
          if(newWorker.state === "installed" && navigator.serviceWorker.controller){
            mostrarAvisoAtualizacao(newWorker);
          }
        });
      });
      serviceWorkerUpdateHandlerAttached = true;
    }

    console.log("Service Worker registrado");
    return reg;
  }).catch(erro => {
    console.log("Erro SW:", erro);
  });
}

registrarServiceWorkerUmaVez();

function mostrarAvisoAtualizacao(worker) {
  if(serviceWorkerUpdateNoticeVisible){
    return;
  }

  const aviso = document.createElement('div');
  serviceWorkerUpdateNoticeVisible = true;
  
  aviso.innerHTML = `
    <div style="
      position:fixed;
      bottom:20px;
      left:50%;
      transform:translateX(-50%);
      background:#111;
      color:#fff;
      padding:15px 20px;
      border-radius:10px;
      z-index:9999;
      box-shadow:0 0 10px rgba(0,0,0,0.5);
    ">
      Nova versão disponível 🎮
      <button id="btn-update" style="
        margin-left:10px;
        padding:5px 10px;
        background:#ffd66b;
        border:none;
        border-radius:5px;
        cursor:pointer;
      ">
        Atualizar
      </button>
    </div>
  `;

  document.body.appendChild(aviso);

  const botaoAtualizar = document.getElementById('btn-update');
  if(botaoAtualizar){
    botaoAtualizar.onclick = () => {
      worker.postMessage('SKIP_WAITING');
    };
  }
}

if("serviceWorker" in navigator){
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
