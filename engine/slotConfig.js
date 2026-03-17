const SLOT_CONFIG_VERSION = "5";
const MACHINE_FINANCE_KEY = "machineFinance";
const RISK_CONTROL_KEY = "riskControl";
const PLAYER_SESSION_KEY = "playerSession";
const BET_MESSAGE_KEY = "betMessageConfig";
const JACKPOT_VALUE_KEY = "jackpotValue";
const JACKPOT_MIN_KEY = "jackpotMin";
const JACKPOT_MAX_KEY = "jackpotMax";
const JACKPOT_CONTRIBUTION_KEY = "jackpotContributionPercent";

const DEFAULT_SLOT_CONFIG = {

    custoJogada: 1,

    pesos: {
        map: 8,
        compass: 8,
        gem: 6,
        idol: 24,
        relic: 2,
        crown: 2,
        templeEye: 1
    },

    premios: {
        map: 4,
        compass: 8,
        gem: 12,
        idol: 16,
        relic: 20,
        crown: 24,
        templeEye: 0
    },

    rtpAlvo: 0.92,

    riskControl: {
        percentualMaxPremio: 0.2,
        maxWinPerSpin: 50,
        maxWinPerSession: 100
    },

    volatility: {
        states: {
            COLD: { multiplier: 0.9 },
            NORMAL: { multiplier: 1 },
            HOT: { multiplier: 1.08 },
            JACKPOT: { multiplier: 1.15 }
        }
    },

    betMessage: {
        mensagemLinha1: "APOSTA {bet}",
        mensagemLinha2: "GANHO MAX {maxWin}",
        tempoMensagem: 3000
    }

};

DEFAULT_SLOT_CONFIG.jackpot = {
    min: 0,
    max: 10000,
    contributionPercent: 0.05
};

const DEFAULT_MACHINE_FINANCE = {
    moneyIn: 0,
    moneyOut: 0,
    bancaMaquina: 200,
    totalApostas: 0,
    totalPremios: 0,
    totalSpins: 0
};

const DEFAULT_PLAYER_SESSION = {
    saldoInicialSessao: 30,
    saldoAtual: 30,
    premiosSessaoAcumulados: 0,
    ganhosSessao: 0
};

function lerJSONStorage(chave){
    try{
        const valor = window.localStorage.getItem(chave);
        return valor ? JSON.parse(valor) : null;
    }catch{
        return null;
    }
}

function normalizarNumero(valor, fallback, minimo = 0){
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= minimo ? numero : fallback;
}

function lerMachineStatsLegado(){
    const legado = lerJSONStorage("machineStats") || {};
    return {
        giros: normalizarNumero(legado.giros, 0, 0),
        apostado: normalizarNumero(legado.apostado, 0, 0),
        premios: normalizarNumero(legado.premios, 0, 0),
        lucroCasa: Number.isFinite(Number(legado.lucroCasa)) ? Number(legado.lucroCasa) : 0,
        vitorias: normalizarNumero(legado.vitorias, 0, 0)
    };
}

function construirSlotConfig(){
    const pesosSalvos = lerJSONStorage("pesos") || {};
    const premiosSalvos = lerJSONStorage("premios") || {};
    const riscoSalvo = lerJSONStorage(RISK_CONTROL_KEY) || {};
    const mensagemApostaSalva = lerJSONStorage(BET_MESSAGE_KEY) || {};
    const custoDinamico = typeof window.getCurrentBetValue === "function"
        ? normalizarNumero(window.getCurrentBetValue(), DEFAULT_SLOT_CONFIG.custoJogada, 0)
        : DEFAULT_SLOT_CONFIG.custoJogada;
    const rtpSalvo = normalizarNumero(
        window.localStorage.getItem("rtp"),
        DEFAULT_SLOT_CONFIG.rtpAlvo * 100,
        1
    ) / 100;

    const retorno = {
        ...DEFAULT_SLOT_CONFIG,
        custoJogada: custoDinamico,
        pesos: {
            ...DEFAULT_SLOT_CONFIG.pesos,
            map: normalizarNumero(pesosSalvos.map, DEFAULT_SLOT_CONFIG.pesos.map, 1),
            compass: normalizarNumero(pesosSalvos.compass, DEFAULT_SLOT_CONFIG.pesos.compass, 1),
            gem: normalizarNumero(pesosSalvos.gem, DEFAULT_SLOT_CONFIG.pesos.gem, 1),
            idol: normalizarNumero(pesosSalvos.idol, DEFAULT_SLOT_CONFIG.pesos.idol, 1),
            relic: normalizarNumero(pesosSalvos.relic, DEFAULT_SLOT_CONFIG.pesos.relic, 1),
            crown: normalizarNumero(pesosSalvos.crown, DEFAULT_SLOT_CONFIG.pesos.crown, 1),
            templeEye: normalizarNumero(pesosSalvos.templeEye, DEFAULT_SLOT_CONFIG.pesos.templeEye, 1)
        },
        premios: {
            ...DEFAULT_SLOT_CONFIG.premios,
            map: normalizarNumero(premiosSalvos.map, DEFAULT_SLOT_CONFIG.premios.map, 0),
            compass: normalizarNumero(premiosSalvos.compass, DEFAULT_SLOT_CONFIG.premios.compass, 0),
            gem: normalizarNumero(premiosSalvos.gem, DEFAULT_SLOT_CONFIG.premios.gem, 0),
            idol: normalizarNumero(premiosSalvos.idol, DEFAULT_SLOT_CONFIG.premios.idol, 0),
            relic: normalizarNumero(premiosSalvos.relic, DEFAULT_SLOT_CONFIG.premios.relic, 0),
            crown: normalizarNumero(premiosSalvos.crown, DEFAULT_SLOT_CONFIG.premios.crown, 0),
            templeEye: normalizarNumero(premiosSalvos.templeEye, DEFAULT_SLOT_CONFIG.premios.templeEye, 0)
        },
        rtpAlvo: rtpSalvo,
        riskControl: {
            percentualMaxPremio: normalizarNumero(
                riscoSalvo.percentualMaxPremio,
                DEFAULT_SLOT_CONFIG.riskControl.percentualMaxPremio,
                0
            ),
            maxWinPerSpin: normalizarNumero(
                riscoSalvo.maxWinPerSpin,
                DEFAULT_SLOT_CONFIG.riskControl.maxWinPerSpin,
                0
            ),
            maxWinPerSession: normalizarNumero(
                riscoSalvo.maxWinPerSession,
                DEFAULT_SLOT_CONFIG.riskControl.maxWinPerSession,
                0
            )
        },
        betMessage: {
            mensagemLinha1: typeof mensagemApostaSalva.mensagemLinha1 === "string" && mensagemApostaSalva.mensagemLinha1.trim()
                ? mensagemApostaSalva.mensagemLinha1
                : DEFAULT_SLOT_CONFIG.betMessage.mensagemLinha1,
            mensagemLinha2: typeof mensagemApostaSalva.mensagemLinha2 === "string" && mensagemApostaSalva.mensagemLinha2.trim()
                ? mensagemApostaSalva.mensagemLinha2
                : DEFAULT_SLOT_CONFIG.betMessage.mensagemLinha2,
            tempoMensagem: normalizarNumero(
                mensagemApostaSalva.tempoMensagem,
                DEFAULT_SLOT_CONFIG.betMessage.tempoMensagem,
                0
            )
        }
    };

    retorno.jackpot = {
        min: getJackpotMin(),
        max: getJackpotMax(),
        contributionPercent: getJackpotContributionPercent()
    };

    return retorno;
}

function construirMachineFinance(){
    const salvo = lerJSONStorage(MACHINE_FINANCE_KEY) || {};
    const legado = lerMachineStatsLegado();
    const saldoBase = DEFAULT_MACHINE_FINANCE.bancaMaquina + legado.lucroCasa;
    const bancaLegada = saldoBase > 0 ? saldoBase : DEFAULT_MACHINE_FINANCE.bancaMaquina;

    return {
        moneyIn: normalizarNumero(salvo.moneyIn, DEFAULT_MACHINE_FINANCE.moneyIn, 0),
        moneyOut: normalizarNumero(salvo.moneyOut, DEFAULT_MACHINE_FINANCE.moneyOut, 0),
        bancaMaquina: normalizarNumero(salvo.bancaMaquina, bancaLegada, 0),
        totalApostas: normalizarNumero(salvo.totalApostas, legado.apostado, 0),
        totalPremios: normalizarNumero(salvo.totalPremios, legado.premios, 0),
        totalSpins: normalizarNumero(salvo.totalSpins, legado.giros, 0)
    };
}

function salvarMachineFinance(financeiro){
    window.localStorage.setItem(MACHINE_FINANCE_KEY, JSON.stringify(financeiro));
}

function temValorProprio(objeto, chave){
    return Boolean(objeto) && Object.prototype.hasOwnProperty.call(objeto, chave);
}

function construirPlayerSession(){
    const salvo = lerJSONStorage(PLAYER_SESSION_KEY) || {};
    const saldoAtual = normalizarNumero(
        window.localStorage.getItem("saldo"),
        DEFAULT_PLAYER_SESSION.saldoAtual,
        0
    );
    const saldoInicialSessao = normalizarNumero(salvo.saldoInicialSessao, saldoAtual, 0);
    const premiosSessaoAcumulados = temValorProprio(salvo, "premiosSessaoAcumulados")
        ? normalizarNumero(salvo.premiosSessaoAcumulados, DEFAULT_PLAYER_SESSION.premiosSessaoAcumulados, 0)
        : DEFAULT_PLAYER_SESSION.premiosSessaoAcumulados;

    return {
        saldoInicialSessao,
        saldoAtual,
        premiosSessaoAcumulados,
        ganhosSessao: premiosSessaoAcumulados
    };
}

function salvarPlayerSession(sessao){
    window.localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(sessao));
}

function refreshMachineFinance(){
    const atualizado = construirMachineFinance();
    Object.keys(window.MACHINE_FINANCE || {}).forEach((chave) => {
        delete window.MACHINE_FINANCE[chave];
    });
    Object.assign(window.MACHINE_FINANCE || {}, atualizado);
    return window.MACHINE_FINANCE;
}

function refreshPlayerSession(){
    const atualizado = construirPlayerSession();
    Object.keys(window.PLAYER_SESSION || {}).forEach((chave) => {
        delete window.PLAYER_SESSION[chave];
    });
    Object.assign(window.PLAYER_SESSION || {}, atualizado);
    return window.PLAYER_SESSION;
}

function getJackpotValue(){
    return normalizarNumero(
        window.localStorage.getItem(JACKPOT_VALUE_KEY),
        DEFAULT_SLOT_CONFIG.premios.crown,
        0
    );
}

function setJackpotValue(valor){
    const jackpot = normalizarNumero(valor, 0, 0);
    window.localStorage.setItem(JACKPOT_VALUE_KEY, String(jackpot));
    return jackpot;
}

function resetJackpotValue(){
    return setJackpotValue(0);
}

function persistirMachineFinance(atualizador){
    const base = construirMachineFinance();
    const proximo = typeof atualizador === "function" ? atualizador({ ...base }) : base;
    salvarMachineFinance(proximo);
    refreshMachineFinance();
    return getMachineFinanceMetrics();
}

function persistirPlayerSession(atualizador){
    const base = construirPlayerSession();
    const proximo = typeof atualizador === "function" ? atualizador({ ...base }) : base;
    salvarPlayerSession(proximo);
    refreshPlayerSession();
    return getPlayerSessionMetrics();
}

function incrementarTotalSpins(quantidade = 1){
    const qtd = normalizarNumero(quantidade, 1, 0);
    return persistirMachineFinance((financeiro) => {
        financeiro.totalSpins += qtd;
        return financeiro;
    });
}

function inserirDinheiro(valor){
    const quantia = normalizarNumero(valor, 0, 0);
    if(quantia <= 0){
        return getMachineFinanceMetrics();
    }

    return persistirMachineFinance((financeiro) => {
        financeiro.moneyIn += quantia;
        financeiro.bancaMaquina += quantia;
        return financeiro;
    });
}

function retirarDinheiro(valor){
    const quantia = normalizarNumero(valor, 0, 0);
    if(quantia <= 0){
        return {
            ...getMachineFinanceMetrics(),
            pago: false
        };
    }

    const atual = construirMachineFinance();
    if(quantia > atual.bancaMaquina){
        return {
            ...getMachineFinanceMetrics(),
            pago: false
        };
    }

    const metricas = persistirMachineFinance((financeiro) => {
        financeiro.moneyOut += quantia;
        financeiro.bancaMaquina -= quantia;
        return financeiro;
    });

    return {
        ...metricas,
        pago: true
    };
}

function registrarAposta(valor){
    const quantia = normalizarNumero(valor, 0, 0);
    if(quantia <= 0){
        return getMachineFinanceMetrics();
    }

    const resultado = persistirMachineFinance((financeiro) => {
        financeiro.totalApostas += quantia;
        financeiro.bancaMaquina += quantia;
        return financeiro;
    });

    const contribution = quantia * getJackpotContributionPercent();
    if(contribution > 0){
        setJackpotValue(getJackpotValue() + contribution);
    }

    return resultado;
}

function registrarPremio(valor){
    const quantia = normalizarNumero(valor, 0, 0);
    if(quantia <= 0){
        return {
            ...getMachineFinanceMetrics(),
            pago: false
        };
    }

    const atual = construirMachineFinance();
    if(quantia > atual.bancaMaquina){
        return {
            ...getMachineFinanceMetrics(),
            pago: false
        };
    }

    const metricas = persistirMachineFinance((financeiro) => {
        financeiro.moneyOut += quantia;
        financeiro.totalPremios += quantia;
        financeiro.bancaMaquina -= quantia;
        return financeiro;
    });

    return {
        ...metricas,
        pago: true
    };
}

function getJackpotMin(){
    return normalizarNumero(window.localStorage.getItem(JACKPOT_MIN_KEY), DEFAULT_SLOT_CONFIG.jackpot.min, 0);
}

function getJackpotMax(){
    return normalizarNumero(window.localStorage.getItem(JACKPOT_MAX_KEY), DEFAULT_SLOT_CONFIG.jackpot.max, 0);
}

function getJackpotContributionPercent(){
    const valor = Number(window.localStorage.getItem(JACKPOT_CONTRIBUTION_KEY));
    if(Number.isFinite(valor) && valor >= 0 && valor <= 1){
        return valor;
    }
    return DEFAULT_SLOT_CONFIG.jackpot.contributionPercent;
}

function getJackpotValue(){
    return normalizarNumero(window.localStorage.getItem(JACKPOT_VALUE_KEY), 0, 0);
}

function setJackpotValue(valor){
    const min = getJackpotMin();
    const max = getJackpotMax();
    let novo = Number(valor);
    if(!Number.isFinite(novo)){
        novo = min;
    }
    novo = Math.max(min, Math.min(max, novo));
    window.localStorage.setItem(JACKPOT_VALUE_KEY, String(novo));
    return novo;
}

function resetJackpotValue(){
    return setJackpotValue(getJackpotMin());
}

function setJackpotMin(valor){
    const min = normalizarNumero(valor, DEFAULT_SLOT_CONFIG.jackpot.min, 0);
    window.localStorage.setItem(JACKPOT_MIN_KEY, String(min));
    return min;
}

function setJackpotMax(valor){
    const max = Number(valor);
    if(!Number.isFinite(max) || max <= getJackpotMin()){
        return getJackpotMax();
    }
    window.localStorage.setItem(JACKPOT_MAX_KEY, String(max));
    return max;
}

function setJackpotContributionPercent(valor){
    let percent = Number(valor);
    if(!Number.isFinite(percent)){
        percent = DEFAULT_SLOT_CONFIG.jackpot.contributionPercent;
    }
    percent = Math.min(1, Math.max(0, percent));
    window.localStorage.setItem(JACKPOT_CONTRIBUTION_KEY, String(percent));
    return percent;
}

function initJackpotDefaults(){
    if(window.localStorage.getItem(JACKPOT_MIN_KEY) === null){
        setJackpotMin(DEFAULT_SLOT_CONFIG.jackpot.min);
    }
    if(window.localStorage.getItem(JACKPOT_MAX_KEY) === null){
        setJackpotMax(DEFAULT_SLOT_CONFIG.jackpot.max);
    }
    if(window.localStorage.getItem(JACKPOT_CONTRIBUTION_KEY) === null){
        setJackpotContributionPercent(DEFAULT_SLOT_CONFIG.jackpot.contributionPercent);
    }
    if(window.localStorage.getItem(JACKPOT_VALUE_KEY) === null){
        resetJackpotValue();
    }
}

function getMachineFinanceMetrics(){
    const financeiro = refreshMachineFinance();
    const lucroMaquina = financeiro.totalApostas - financeiro.totalPremios;
    const rtpReal = financeiro.totalApostas > 0
        ? financeiro.totalPremios / financeiro.totalApostas
        : 0;

    return {
        ...financeiro,
        lucroMaquina,
        rtpReal
    };
}

function getPlayerSessionMetrics(){
    const sessao = refreshPlayerSession();
    const limiteSessao = window.SLOT_CONFIG && window.SLOT_CONFIG.riskControl
        ? window.SLOT_CONFIG.riskControl.maxWinPerSession
        : DEFAULT_SLOT_CONFIG.riskControl.maxWinPerSession;
    const ganhoRestante = Math.max(0, limiteSessao - sessao.premiosSessaoAcumulados);

    return {
        ...sessao,
        maxWinPerSession: limiteSessao,
        ganhoRestante
    };
}

function sincronizarSaldoSessao(saldoAtual){
    const saldoNormalizado = normalizarNumero(saldoAtual, construirPlayerSession().saldoAtual, 0);
    return persistirPlayerSession((sessao) => {
        sessao.saldoAtual = saldoNormalizado;
        return sessao;
    });
}

function registrarGanhoSessao(valor){
    const quantia = normalizarNumero(valor, 0, 0);
    if(quantia <= 0){
        return getPlayerSessionMetrics();
    }

    return persistirPlayerSession((sessao) => {
        const acumuladoAtual = normalizarNumero(
            sessao.premiosSessaoAcumulados,
            normalizarNumero(sessao.ganhosSessao, 0, 0),
            0
        );
        sessao.premiosSessaoAcumulados = acumuladoAtual + quantia;
        sessao.ganhosSessao = sessao.premiosSessaoAcumulados;
        return sessao;
    });
}

function resetPlayerSession(saldoInicial){
    const saldo = normalizarNumero(
        saldoInicial,
        normalizarNumero(window.localStorage.getItem("saldo"), DEFAULT_PLAYER_SESSION.saldoAtual, 0),
        0
    );

    salvarPlayerSession({
        saldoInicialSessao: saldo,
        saldoAtual: saldo,
        premiosSessaoAcumulados: 0,
        ganhosSessao: 0
    });

    return refreshPlayerSession();
}

function semearConfigPadraoSeNecessario(){
    const versaoAtual = window.localStorage.getItem("slotConfigVersion");
    if(versaoAtual === SLOT_CONFIG_VERSION){
        if(!lerJSONStorage(MACHINE_FINANCE_KEY)){
            salvarMachineFinance(DEFAULT_MACHINE_FINANCE);
        }
        if(!lerJSONStorage(RISK_CONTROL_KEY)){
            window.localStorage.setItem(RISK_CONTROL_KEY, JSON.stringify(DEFAULT_SLOT_CONFIG.riskControl));
        }
        if(!lerJSONStorage(BET_MESSAGE_KEY)){
            window.localStorage.setItem(BET_MESSAGE_KEY, JSON.stringify(DEFAULT_SLOT_CONFIG.betMessage));
        }
        initJackpotDefaults();
        if(!lerJSONStorage(PLAYER_SESSION_KEY)){
            resetPlayerSession(normalizarNumero(window.localStorage.getItem("saldo"), 30, 0));
        }
        return;
    }

    if(!lerJSONStorage("pesos")){
        window.localStorage.setItem("pesos", JSON.stringify(DEFAULT_SLOT_CONFIG.pesos));
    }

    if(!lerJSONStorage("premios")){
        window.localStorage.setItem("premios", JSON.stringify(DEFAULT_SLOT_CONFIG.premios));
    }

    if(window.localStorage.getItem("rtp") === null){
        window.localStorage.setItem("rtp", String(DEFAULT_SLOT_CONFIG.rtpAlvo * 100));
    }

    if(window.localStorage.getItem("saldo") === null){
        window.localStorage.setItem("saldo", "30");
    }

    window.localStorage.setItem(RISK_CONTROL_KEY, JSON.stringify({
        ...DEFAULT_SLOT_CONFIG.riskControl,
        ...(lerJSONStorage(RISK_CONTROL_KEY) || {})
    }));
    window.localStorage.setItem(BET_MESSAGE_KEY, JSON.stringify({
        ...DEFAULT_SLOT_CONFIG.betMessage,
        ...(lerJSONStorage(BET_MESSAGE_KEY) || {})
    }));
    initJackpotDefaults();
    salvarMachineFinance(construirMachineFinance());
    resetPlayerSession(normalizarNumero(window.localStorage.getItem("saldo"), 30, 0));

    window.localStorage.setItem("slotConfigVersion", SLOT_CONFIG_VERSION);
}

function refreshSlotConfig(){
    const atualizado = construirSlotConfig();
    Object.keys(window.SLOT_CONFIG || {}).forEach((chave) => {
        delete window.SLOT_CONFIG[chave];
    });
    Object.assign(window.SLOT_CONFIG || {}, atualizado);
    return window.SLOT_CONFIG;
}

semearConfigPadraoSeNecessario();
window.SLOT_CONFIG = construirSlotConfig();
window.MACHINE_FINANCE = construirMachineFinance();
window.PLAYER_SESSION = construirPlayerSession();
window.refreshSlotConfig = refreshSlotConfig;
window.refreshMachineFinance = refreshMachineFinance;
window.refreshPlayerSession = refreshPlayerSession;
window.getMachineFinanceMetrics = getMachineFinanceMetrics;
window.getPlayerSessionMetrics = getPlayerSessionMetrics;
window.incrementarTotalSpins = incrementarTotalSpins;
window.inserirDinheiro = inserirDinheiro;
window.retirarDinheiro = retirarDinheiro;
window.registrarAposta = registrarAposta;
window.registrarPremio = registrarPremio;
window.sincronizarSaldoSessao = sincronizarSaldoSessao;
window.registrarGanhoSessao = registrarGanhoSessao;
window.resetPlayerSession = resetPlayerSession;
window.BET_MESSAGE_KEY = BET_MESSAGE_KEY;
window.getJackpotValue = getJackpotValue;
window.setJackpotValue = setJackpotValue;
window.resetJackpotValue = resetJackpotValue;
window.getJackpotMin = getJackpotMin;
window.getJackpotMax = getJackpotMax;
window.getJackpotContributionPercent = getJackpotContributionPercent;
window.setJackpotMin = setJackpotMin;
window.setJackpotMax = setJackpotMax;
window.setJackpotContributionPercent = setJackpotContributionPercent;
