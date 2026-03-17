let machineState = "NORMAL";
let spinsSinceWin = 0;
const MACHINE_STATS_KEY = "machineStats";

function lerStats(){
    try{
        const stats = JSON.parse(window.localStorage.getItem(MACHINE_STATS_KEY));
        if(stats){
            return {
                giros: Number(stats.giros) || 0,
                apostado: Number(stats.apostado) || 0,
                premios: Number(stats.premios) || 0,
                lucroCasa: Number(stats.lucroCasa) || 0,
                vitorias: Number(stats.vitorias) || 0
            };
        }
    }catch{
        // ignora storage invalido
    }

    return {
        giros: 0,
        apostado: 0,
        premios: 0,
        lucroCasa: 0,
        vitorias: 0
    };
}

function salvarStats(stats){
    window.localStorage.setItem(MACHINE_STATS_KEY, JSON.stringify(stats));
}

function clonarStats(stats){
    return {
        giros: Number(stats.giros) || 0,
        apostado: Number(stats.apostado) || 0,
        premios: Number(stats.premios) || 0,
        lucroCasa: Number(stats.lucroCasa) || 0,
        vitorias: Number(stats.vitorias) || 0
    };
}

function criarResultadoRisco(simbolos, premioOriginal, premioAjustado, motivo, limitadoPorSpin = false){
    return {
        simbolos,
        premio: Math.max(0, premioAjustado),
        premioOriginal,
        bloqueadoPorBanca: motivo === "banca",
        bloqueadoPorPercentual: motivo === "percentual",
        bloqueadoPorSessao: motivo === "sessao",
        limitadoPorSpin
    };
}

function calcularLimitePremioPequeno(){
    const premios = Object.values(SLOT_CONFIG.premios || {})
        .map((valor) => Number(valor))
        .filter((valor) => Number.isFinite(valor) && valor > 0)
        .sort((a, b) => a - b);

    if(premios.length === 0){
        return 0;
    }

    // Mantem liberada a metade inferior dos premios como "micro/pequenos".
    return premios[Math.floor((premios.length - 1) / 2)];
}

function aplicarControlesDeRisco(simbolos, premio){
    const financeiro = window.getMachineFinanceMetrics();
    const sessao = typeof window.getPlayerSessionMetrics === "function"
        ? window.getPlayerSessionMetrics()
        : { ganhoRestante: Infinity };
    const risco = SLOT_CONFIG.riskControl || {};
    let premioAjustado = premio;
    let limitadoPorSpin = false;
    const limitePremioPequeno = calcularLimitePremioPequeno();

    if(premio <= 0){
        return {
            simbolos,
            premio,
            premioOriginal: premio,
            bloqueadoPorBanca: false,
            bloqueadoPorPercentual: false,
            bloqueadoPorSessao: false,
            limitadoPorSpin
        };
    }

    if(risco.maxWinPerSpin > 0 && premioAjustado > risco.maxWinPerSpin){
        premioAjustado = risco.maxWinPerSpin;
        limitadoPorSpin = true;
    }

    if(risco.percentualMaxPremio > 0){
        const premioMaximoPorBanca = financeiro.bancaMaquina * risco.percentualMaxPremio;
        if(premioAjustado > premioMaximoPorBanca){
            return criarResultadoRisco(
                simbolos,
                premio,
                Math.floor(premioMaximoPorBanca),
                "percentual",
                limitadoPorSpin
            );
        }
    }

    if(premioAjustado > financeiro.bancaMaquina){
        return criarResultadoRisco(
            simbolos,
            premio,
            Math.floor(financeiro.bancaMaquina),
            "banca",
            limitadoPorSpin
        );
    }

    if(sessao.ganhoRestante <= 0 && premioAjustado > limitePremioPequeno){
        return criarResultadoRisco(
            simbolos,
            premio,
            limitePremioPequeno,
            "sessao",
            limitadoPorSpin
        );
    }

    if(sessao.ganhoRestante > 0 && premioAjustado > sessao.ganhoRestante){
        return criarResultadoRisco(
            simbolos,
            premio,
            Math.floor(sessao.ganhoRestante),
            "sessao",
            limitadoPorSpin
        );
    }

    return {
        simbolos,
        premio: premioAjustado,
        premioOriginal: premio,
        bloqueadoPorBanca: false,
        bloqueadoPorPercentual: false,
        bloqueadoPorSessao: false,
        limitadoPorSpin
    };
}

const machineStats = lerStats();

function calcularPremioPorCombinacao(simbolos){
    const contagem = {};

    for(const simbolo of simbolos){
        contagem[simbolo] = (contagem[simbolo] || 0) + 1;
    }

    let simboloPremiado = null;
    let maiorRepeticao = 0;

    for(const [simbolo, repeticoes] of Object.entries(contagem)){
        if(repeticoes > maiorRepeticao){
            simboloPremiado = simbolo;
            maiorRepeticao = repeticoes;
        }
    }

    if(maiorRepeticao < 2 || !simboloPremiado){
        return 0;
    }

    const premioBase = SLOT_CONFIG.premios[simboloPremiado] || 0;
    if(premioBase <= 0){
        return 0;
    }
    return maiorRepeticao === 3 ? premioBase : Math.max(1, Math.floor(premioBase / 4));
}

function isTempleEyeJackpot(simbolos){
    return Array.isArray(simbolos) && simbolos.length === 3 && simbolos.every((simbolo) => simbolo === "templeEye");
}

function triggerJackpot(){
    if(typeof window.getJackpotValue === "function"){
        return window.getJackpotValue();
    }

    return Number(SLOT_CONFIG.premios.crown) || 0;
}

const SLOT_ENGINE = {

    atualizarEstado(){

        if(spinsSinceWin > 40){
            machineState = "JACKPOT";
        }
        else if(spinsSinceWin > 25){
            machineState = "HOT";
        }
        else if(spinsSinceWin < 5){
            machineState = "COLD";
        }
        else{
            machineState = "NORMAL";
        }

    },

    ajustarPesos(pesos){
        window.refreshSlotConfig();

        const mult = SLOT_CONFIG.volatility.states[machineState].multiplier;
        const retornoAtual = machineStats.apostado > 0
            ? machineStats.premios / machineStats.apostado
            : SLOT_CONFIG.rtpAlvo;
        const ajusteRTP = retornoAtual > SLOT_CONFIG.rtpAlvo + 0.03
            ? 0.92
            : retornoAtual < SLOT_CONFIG.rtpAlvo - 0.03
                ? 1.08
                : 1;

        const novosPesos = {};

        for(let s in pesos){

            if(s === "idol" || s === "relic" || s === "crown" || s === "templeEye"){
                novosPesos[s] = Math.max(1, Math.round(pesos[s] * mult * ajusteRTP));
            }else if(s === "gem"){
                novosPesos[s] = Math.max(1, Math.round(pesos[s] * Math.max(0.95, ajusteRTP)));
            }else{
                novosPesos[s] = pesos[s];
            }

        }

        return novosPesos;

    },

    sortearSimbolo(pesos){

        let lista = [];

        for(let s in pesos){

            for(let i=0;i<pesos[s];i++){
                lista.push(s);
            }

        }

        return lista[Math.floor(Math.random()*lista.length)];

    },

    girar(opcoes = {}){
        const { persistStats = true } = opcoes;
        window.refreshSlotConfig();
        this.atualizarEstado();

        let pesos = this.ajustarPesos(SLOT_CONFIG.pesos);

        const s1 = this.sortearSimbolo(pesos);
        const s2 = this.sortearSimbolo(pesos);
        const s3 = this.sortearSimbolo(pesos);
        const simbolosBase = [s1, s2, s3];
        const jackpotDisparado = isTempleEyeJackpot(simbolosBase);

        let premio = jackpotDisparado ? triggerJackpot() : calcularPremioPorCombinacao(simbolosBase);

        if(persistStats){
            window.incrementarTotalSpins();
            window.registrarAposta(SLOT_CONFIG.custoJogada);
            machineStats.giros++;
            machineStats.apostado += SLOT_CONFIG.custoJogada;
        }

        const resultadoFinanceiro = aplicarControlesDeRisco(simbolosBase, premio);
        const simbolosFinais = resultadoFinanceiro.simbolos;
        premio = resultadoFinanceiro.premio;

        if(persistStats){
            machineStats.premios += premio;
            if(premio > 0){
                machineStats.vitorias++;
            }
            machineStats.lucroCasa = machineStats.apostado - machineStats.premios;
            salvarStats(machineStats);
        }

        if(premio > 0){
            spinsSinceWin = 0;
        }else{
            spinsSinceWin++;
        }

        this.atualizarEstado();

        return{
            simbolos:simbolosFinais,
            premio:premio,
            estado:machineState,
            triggeredJackpot: jackpotDisparado,
            premioOriginal: resultadoFinanceiro.premioOriginal,
            bloqueadoPorBanca: resultadoFinanceiro.bloqueadoPorBanca,
            bloqueadoPorPercentual: resultadoFinanceiro.bloqueadoPorPercentual,
            bloqueadoPorSessao: resultadoFinanceiro.bloqueadoPorSessao,
            limitadoPorSpin: resultadoFinanceiro.limitadoPorSpin
        }

    },

    getMachineStats(){
        return { ...machineStats };
    },

    getRuntimeState(){
        return {
            machineState,
            spinsSinceWin,
            machineStats: clonarStats(machineStats)
        };
    },

    setRuntimeState(state = {}){
        machineState = typeof state.machineState === "string" ? state.machineState : "NORMAL";
        spinsSinceWin = Number.isFinite(Number(state.spinsSinceWin)) ? Number(state.spinsSinceWin) : 0;

        const proximasStats = clonarStats(state.machineStats || {});
        machineStats.giros = proximasStats.giros;
        machineStats.apostado = proximasStats.apostado;
        machineStats.premios = proximasStats.premios;
        machineStats.lucroCasa = proximasStats.lucroCasa;
        machineStats.vitorias = proximasStats.vitorias;
    }

};

window.SLOT_ENGINE = SLOT_ENGINE;
