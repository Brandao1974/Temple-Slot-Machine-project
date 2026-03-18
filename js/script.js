const CREDITOS_INICIAIS = 30; // Altere este valor para mudar os creditos iniciais do jogo.
const BASE_GAME_WIDTH = 1280;
const BASE_GAME_HEIGHT = 720;
const JACKPOT_ANIMATION_MS = 4800;
const CARD_ASSET_BY_SYMBOL = {
    templeEye: "olhodotemplo"
};
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
const trilhaSonora = new Audio("assets/audio/trilhasonora.mp3");
const payoutCoinsSound = new Audio("assets/audio/payoutcoins.mp3");
const coinClinkSound = new Audio("assets/audio/coin_clink.mp3");

trilhaSonora.loop = true;
trilhaSonora.volume = 0.25;
payoutCoinsSound.volume = 0.5;
coinClinkSound.volume = 0.6;

const cartas = Array.from(document.querySelectorAll(".carta"));
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
const tochas = Array.from(document.querySelectorAll(".torch"));
const gameStageEl = document.getElementById("game-stage");
const gameContainerEl = document.getElementById("game-container");

function ajustarEscala(){
    if(!gameStageEl || !gameContainerEl){
        return;
    }

    const scaleWidth = window.innerWidth / BASE_GAME_WIDTH;
    const scaleHeight = window.innerHeight / BASE_GAME_HEIGHT;
    const scale = Math.min(1, scaleWidth, scaleHeight);

    gameContainerEl.style.transform = `scale(${scale})`;
    gameStageEl.style.width = `${BASE_GAME_WIDTH * scale}px`;
    gameStageEl.style.height = `${BASE_GAME_HEIGHT * scale}px`;
}

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
    botaoGirar.classList.toggle("spin-ready", prontoParaGirar);
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
    cartas.forEach((carta) => carta.classList.remove("win"));
}

function destacarCartasVencedoras(){
    cartas.forEach((carta) => carta.classList.add("win"));
    window.setTimeout(limparCartasVencedoras, 1400);
}

function aplicarEstadoCartas3D(classeAtiva){
    cartas.forEach((carta) => {
        carta.classList.remove("spin3d", "stop3d");
        if(classeAtiva){
            carta.classList.add(classeAtiva);
        }
    });
}

function atualizarClasseTempleEye(carta, simbolo){
    if(!carta){
        return;
    }

    carta.classList.toggle("temple-eye", simbolo === "templeEye");
}

function criarFaiscaTocha(tocha, indice){
    const spark = document.createElement("div");
    spark.className = "torch-spark";
    spark.style.left = `${42 + (Math.random() * 16)}%`;
    spark.style.animationDelay = `${indice * 0.9 + Math.random() * 0.6}s`;
    spark.style.animationDuration = `${2.4 + Math.random() * 1.2}s`;
    spark.style.setProperty("--spark-dx", `${Math.random() * 28 - 14}px`);
    spark.style.setProperty("--spark-scale", `${0.7 + Math.random() * 0.9}`);
    tocha.appendChild(spark);
}

function inicializarTochasVivas(){
    tochas.forEach((tocha) => {
        if(!tocha || tocha.querySelector(".torch-spark")){
            return;
        }

        for(let i = 0; i < 7; i++){
            criarFaiscaTocha(tocha, i);
        }
    });
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
    if(!aguardandoPagamento){
        ganhoEl.innerText = "0";
    }
    atualizarBotaoPronto();
}

function mostrarAvisoCreditos(){
    mostrarAviso("CR\u00c9DITOS INSUFICIENTES");
}

function mostrarAviso(texto){
    avisoEl.innerText = texto;
    avisoEl.classList.add("ativo");
    botaoGirar.classList.remove("erro");
    void botaoGirar.offsetWidth;
    botaoGirar.classList.add("erro");

    if(avisoTimeoutId){
        window.clearTimeout(avisoTimeoutId);
    }

    avisoTimeoutId = window.setTimeout(() => {
        avisoEl.classList.remove("ativo");
        botaoGirar.classList.remove("erro");
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
    botaoAuto.classList.toggle("ativo", ativo);
    botaoGirar.style.opacity = ativo ? "0.4" : "1";
    botaoGirar.style.pointerEvents = ativo ? "none" : "auto";
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
    painelEl.classList.remove("jackpot");
    cartas.forEach((carta) => carta.classList.remove("jackpot"));
    temploEl.classList.remove("templo-jackpot");
    tochas.forEach((tocha) => tocha.classList.remove("jackpot"));
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
    painelEl.classList.add("jackpot");
    cartas.forEach((carta, indice) => {
        carta.classList.toggle("jackpot", !resultado || resultado.simbolos[indice] === "templeEye");
    });
    temploEl.classList.add("templo-jackpot");
    tochas.forEach((tocha) => tocha.classList.add("jackpot"));
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
    ganhoEl.innerText = "0";
    saldo -= SLOT_CONFIG.custoJogada;
    salvarSaldo();
    atualizarHUD();
    girando = true;
    atualizarBotaoPronto();

    const resultado = SLOT_ENGINE.girar();
    const { simbolos, premio } = resultado;

    girarCarta(0, 900, simbolos[0], () => {
        girarCarta(1, 1400, simbolos[1], () => {
            girarCarta(2, 1900, simbolos[2], () => {
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
    const carta = cartas[index];
    if(!carta){
        if(typeof callback === "function"){
            callback();
        }
        return;
    }

    const img = carta.querySelector(".face");
    carta.classList.remove("stop3d");
    carta.classList.add("spin3d");
    carta.classList.add("girando");

    window.setTimeout(() => {
        carta.classList.remove("girando");
        carta.classList.remove("spin3d");
        carta.classList.add("stop3d");
        img.src = `assets/cartas/${getCardAssetName(simbolo)}.webp`;
        atualizarClasseTempleEye(carta, simbolo);
        window.setTimeout(() => {
            carta.classList.remove("stop3d");
        }, 220);
        if(typeof callback === "function"){
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
    botaoGirar.style.pointerEvents = "none";
    botaoGirar.style.opacity = "0.35";
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
        botaoGirar.style.pointerEvents = "auto";
        botaoGirar.style.opacity = autoGiro ? "0.4" : "1";
        atualizarBotaoPronto();
    }, JACKPOT_ANIMATION_MS);
}

function premiar(valor){
    const pagamento = window.registrarPremio(valor);
    if(!pagamento.pago){
        aguardandoPagamento = false;
        girando = false;
        jackpotPendenteReset = false;
        ganhoEl.innerText = "0";
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
            betToastWrapperEl.style.display = "none";
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

window.onload = function(){
    saldo = lerSaldoSalvo();
    creditosAnimados = saldo;
    if(window.localStorage.getItem("saldo") === null){
        salvarSaldo();
    }else if(typeof window.sincronizarSaldoSessao === "function"){
        window.sincronizarSaldoSessao(saldo);
    }
    inicializarTochasVivas();
    iniciarEmissorJackpot();
    atualizarControlesAposta();
    if(betToastWrapperEl){
        betToastWrapperEl.style.display = "none";
    }
    ajustarEscala();
    aplicarEstadoCartas3D("stop3d");
    atualizarHUD();
    reconciliarEstadoExterno();
};

function ajustarEscala(){

const stage = document.getElementById("game-container");

if(!stage) return;

const larguraTela = window.innerWidth;
const alturaTela = window.innerHeight;

const escalaX = larguraTela / 1280;
const escalaY = alturaTela / 720;

const escala = Math.min(escalaX, escalaY);

stage.style.transform = "scale(" + escala + ")";
}

window.addEventListener("resize", ajustarEscala);
window.addEventListener("load", ajustarEscala);

function ajustarEscalaGame(){

const game = document.getElementById("game-container");
if(!game) return;

const larguraTela = window.innerWidth;
const alturaTela = window.innerHeight;

const escalaX = larguraTela / 1280;
const escalaY = alturaTela / 720;

const escala = Math.min(escalaX, escalaY);

game.style.transform = `scale(${escala})`;
}

window.addEventListener("resize", ajustarEscalaGame);
window.addEventListener("load", ajustarEscalaGame);

function verificarOrientacao(){

if(window.innerHeight > window.innerWidth){

document.body.innerHTML = `
<div style="
width:100vw;
height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:#000;
color:#ffd66b;
font-size:26px;
font-family:serif;
text-align:center;
padding:40px;
">
🔄 Gire o celular para jogar
</div>`;

}

}

window.addEventListener("load", verificarOrientacao);
window.addEventListener("resize", verificarOrientacao);