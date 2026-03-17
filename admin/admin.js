const pages = Array.from(document.querySelectorAll(".page"));
const menuItems = Array.from(document.querySelectorAll(".menu li"));
const simbolos = ["map", "compass", "gem", "idol", "relic", "crown", "templeEye"];
const DAILY_LOG_KEY = "machineDailyLog";
const DAILY_HISTORY_KEY = "machineDailyHistory";
const DAILY_SNAPSHOT_KEY = "machineDailySnapshot";
let lucroChart = null;
let rtpChart = null;
let premiosChart = null;
const betMessageStorageKey = window.BET_MESSAGE_KEY || "betMessageConfig";
let simulacaoEmExecucao = false;

function abrirPagina(pageId){
    pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
    menuItems.forEach((item) => item.classList.toggle("active", item.dataset.page === pageId));
}

menuItems.forEach((item) => {
    item.addEventListener("click", () => {
        if(document.getElementById(item.dataset.page)){
            abrirPagina(item.dataset.page);
        }
    });
});

function lerNumero(id, fallback){
    const valor = Number(document.getElementById(id).value);
    return Number.isFinite(valor) ? valor : fallback;
}

function lerJSONLocal(chave, fallback){
    try{
        const valor = window.localStorage.getItem(chave);
        return valor ? JSON.parse(valor) : fallback;
    }catch{
        return fallback;
    }
}

function salvarJSONLocal(chave, valor){
    window.localStorage.setItem(chave, JSON.stringify(valor));
}

function formatarNumeroBR(valor, casasDecimais = 0){
    return Number(valor || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais
    });
}

function formatarMoedaBR(valor){
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatarPercentualBR(valor){
    return `${formatarNumeroBR((Number(valor) || 0) * 100, 2)}%`;
}

function atualizarStatusSimulacao(texto, classe = ""){
    const statusEl = document.getElementById("simulacaoStatus");
    if(!statusEl){
        return;
    }

    statusEl.className = "simulacao-status";
    if(classe){
        statusEl.classList.add(classe);
    }
    statusEl.innerText = texto;
}

function atualizarPainelSimulacao(resultado){
    const dados = resultado || {
        totalGiros: 0,
        totalApostado: 0,
        totalPago: 0,
        rtp: 0,
        lucroMaquina: 0,
        taxaVitoria: 0,
        vitoriasPequenas: 0,
        vitoriasMedias: 0,
        vitoriasGrandes: 0,
        jackpots: 0,
        bonus: 0,
        premioMedio: 0
    };

    document.getElementById("simulacaoTotalGiros").innerText = formatarNumeroBR(dados.totalGiros);
    document.getElementById("simulacaoTotalApostado").innerText = formatarMoedaBR(dados.totalApostado);
    document.getElementById("simulacaoTotalPago").innerText = formatarMoedaBR(dados.totalPago);
    document.getElementById("simulacaoRtp").innerText = formatarPercentualBR(dados.rtp);
    document.getElementById("simulacaoLucro").innerText = formatarMoedaBR(dados.lucroMaquina);
    document.getElementById("simulacaoTaxaVitoria").innerText = formatarPercentualBR(dados.taxaVitoria);
    document.getElementById("simulacaoVitoriasPequenas").innerText = formatarNumeroBR(dados.vitoriasPequenas);
    document.getElementById("simulacaoVitoriasMedias").innerText = formatarNumeroBR(dados.vitoriasMedias);
    document.getElementById("simulacaoVitoriasGrandes").innerText = formatarNumeroBR(dados.vitoriasGrandes);
    document.getElementById("simulacaoJackpots").innerText = formatarNumeroBR(dados.jackpots);
    document.getElementById("simulacaoBonus").innerText = formatarNumeroBR(dados.bonus);
    document.getElementById("simulacaoPremioMedio").innerText = formatarMoedaBR(dados.premioMedio);
}

function criarStorageTemporario(){
    const dados = new Map();

    return {
        getItem(chave){
            return dados.has(chave) ? dados.get(chave) : null;
        },
        setItem(chave, valor){
            dados.set(chave, String(valor));
        },
        removeItem(chave){
            dados.delete(chave);
        },
        clear(){
            dados.clear();
        }
    };
}

function copiarStorage(origem, destino){
    const chaveFn = typeof origem.key === "function"
        ? origem.key.bind(origem)
        : (indice) => Object.keys(origem).filter((chave) => typeof origem[chave] !== "function")[indice];
    const total = Number(origem.length) || 0;

    for(let indice = 0; indice < total; indice++){
        const chave = chaveFn(indice);
        if(chave === null || chave === undefined){
            continue;
        }

        const valor = origem.getItem(chave);
        if(valor !== null){
            destino.setItem(chave, valor);
        }
    }
}

function classificarVitoria(premio, slotConfig){
    const premios = Object.values(slotConfig.premios || {})
        .map((valor) => Number(valor))
        .filter((valor) => Number.isFinite(valor) && valor > 0)
        .sort((a, b) => a - b);

    if(!premio || !premios.length){
        return "nenhuma";
    }

    const maiorPremio = premios[premios.length - 1];
    const limitePequeno = premios[Math.min(premios.length - 1, Math.floor((premios.length - 1) / 3))];
    const limiteMedio = premios[Math.min(premios.length - 1, Math.floor(((premios.length - 1) * 2) / 3))];

    if(slotConfig && slotConfig.premios && Number(slotConfig.premios.templeEye) === 0 && premio >= maiorPremio){
        return "jackpot";
    }

    if(premio <= limitePequeno){
        return "pequena";
    }

    if(premio <= limiteMedio){
        return "media";
    }

    return "grande";
}

function criarResultadoBaseSimulacao(totalGiros, aposta){
    return {
        totalGiros,
        aposta,
        totalApostado: 0,
        totalPago: 0,
        lucroMaquina: 0,
        rtp: 0,
        totalVitorias: 0,
        taxaVitoria: 0,
        vitoriasPequenas: 0,
        vitoriasMedias: 0,
        vitoriasGrandes: 0,
        jackpots: 0,
        bonus: 0,
        premioMedio: 0
    };
}

async function executarSimulacao(totalGiros, aposta){
    if(!window.SLOT_ENGINE || typeof window.SLOT_ENGINE.girar !== "function"){
        throw new Error("Engine de giro indisponivel.");
    }

    const storageReal = window.localStorage;
    const getCurrentBetValueReal = window.getCurrentBetValue;
    const runtimeStateOriginal = typeof window.SLOT_ENGINE.getRuntimeState === "function"
        ? window.SLOT_ENGINE.getRuntimeState()
        : null;
    const slotConfigOriginal = { ...(window.SLOT_CONFIG || {}) };
    const storageTemporario = criarStorageTemporario();
    const storageRealMethods = {
        getItem: storageReal.getItem.bind(storageReal),
        setItem: storageReal.setItem.bind(storageReal),
        removeItem: storageReal.removeItem.bind(storageReal),
        clear: storageReal.clear.bind(storageReal)
    };
    copiarStorage(storageReal, storageTemporario);
    const resultado = criarResultadoBaseSimulacao(totalGiros, aposta);

    try{
        storageReal.getItem = storageTemporario.getItem.bind(storageTemporario);
        storageReal.setItem = storageTemporario.setItem.bind(storageTemporario);
        storageReal.removeItem = storageTemporario.removeItem.bind(storageTemporario);
        storageReal.clear = storageTemporario.clear.bind(storageTemporario);
        window.getCurrentBetValue = () => aposta;

        if(typeof window.SLOT_ENGINE.setRuntimeState === "function"){
            window.SLOT_ENGINE.setRuntimeState({
                machineState: "NORMAL",
                spinsSinceWin: 0,
                machineStats: {
                    giros: 0,
                    apostado: 0,
                    premios: 0,
                    lucroCasa: 0,
                    vitorias: 0
                }
            });
        }

        if(typeof window.refreshSlotConfig === "function"){
            window.refreshSlotConfig();
        }
        if(typeof window.refreshMachineFinance === "function"){
            window.refreshMachineFinance();
        }
        if(typeof window.resetPlayerSession === "function"){
            window.resetPlayerSession(30);
        }
        if(typeof window.inserirDinheiro === "function"){
            window.inserirDinheiro(Math.max(1000000, totalGiros * aposta * 4));
        }

        const lote = 2000;
        for(let indice = 0; indice < totalGiros; indice++){
            const giro = window.SLOT_ENGINE.girar();
            const premio = Number(giro.premio) || 0;

            resultado.totalApostado += aposta;
            resultado.totalPago += premio;

            if(giro.triggeredJackpot){
                resultado.jackpots++;
            }

            if(premio > 0){
                resultado.totalVitorias++;
                const categoria = classificarVitoria(premio, window.SLOT_CONFIG);
                if(categoria === "pequena"){
                    resultado.vitoriasPequenas++;
                }else if(categoria === "media"){
                    resultado.vitoriasMedias++;
                }else{
                    resultado.vitoriasGrandes++;
                }

                if(typeof window.registrarGanhoSessao === "function"){
                    window.registrarGanhoSessao(premio);
                }
            }

            if((indice + 1) % lote === 0 || indice + 1 === totalGiros){
                atualizarStatusSimulacao(
                    `Executando simulacao... ${formatarNumeroBR(indice + 1)} / ${formatarNumeroBR(totalGiros)} giros.`,
                    "executando"
                );
                await new Promise((resolve) => window.setTimeout(resolve, 0));
            }
        }

        resultado.lucroMaquina = resultado.totalApostado - resultado.totalPago;
        resultado.rtp = resultado.totalApostado > 0 ? resultado.totalPago / resultado.totalApostado : 0;
        resultado.taxaVitoria = resultado.totalGiros > 0 ? resultado.totalVitorias / resultado.totalGiros : 0;
        resultado.premioMedio = resultado.totalVitorias > 0 ? resultado.totalPago / resultado.totalVitorias : 0;
        return resultado;
    }finally{
        storageReal.getItem = storageRealMethods.getItem;
        storageReal.setItem = storageRealMethods.setItem;
        storageReal.removeItem = storageRealMethods.removeItem;
        storageReal.clear = storageRealMethods.clear;
        if(getCurrentBetValueReal){
            window.getCurrentBetValue = getCurrentBetValueReal;
        }else{
            delete window.getCurrentBetValue;
        }

        if(typeof window.SLOT_ENGINE.setRuntimeState === "function" && runtimeStateOriginal){
            window.SLOT_ENGINE.setRuntimeState(runtimeStateOriginal);
        }

        if(window.SLOT_CONFIG){
            Object.keys(window.SLOT_CONFIG).forEach((chave) => delete window.SLOT_CONFIG[chave]);
            Object.assign(window.SLOT_CONFIG, slotConfigOriginal);
        }

        if(typeof window.refreshMachineFinance === "function"){
            window.refreshMachineFinance();
        }
        if(typeof window.refreshPlayerSession === "function"){
            window.refreshPlayerSession();
        }
        if(typeof window.refreshSlotConfig === "function"){
            window.refreshSlotConfig();
        }
    }
}

async function rodarSimulacao(){
    if(simulacaoEmExecucao){
        return;
    }

    const totalGiros = Number(document.getElementById("simulacaoSpins").value);
    const aposta = Number(document.getElementById("simulacaoAposta").value);
    if(!Number.isFinite(totalGiros) || totalGiros <= 0 || !Number.isFinite(aposta) || aposta <= 0){
        atualizarStatusSimulacao("Informe parametros validos para a simulacao.", "erro");
        return;
    }

    simulacaoEmExecucao = true;
    const botao = document.getElementById("rodarSimulacaoBtn");
    if(botao){
        botao.disabled = true;
    }

    atualizarStatusSimulacao("Preparando simulacao isolada...", "executando");

    try{
        const resultado = await executarSimulacao(totalGiros, aposta);
        atualizarPainelSimulacao(resultado);
        atualizarStatusSimulacao(
            `Simulacao concluida: ${formatarNumeroBR(resultado.totalGiros)} giros com aposta ${formatarMoedaBR(aposta)}.`,
            ""
        );
    }catch(erro){
        atualizarStatusSimulacao(`Falha ao executar a simulacao: ${erro.message}`, "erro");
    }finally{
        simulacaoEmExecucao = false;
        if(botao){
            botao.disabled = false;
        }
    }
}

function obterDataHojeISO(){
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarDataISO(dataIso){
    if(!dataIso){
        return "-";
    }

    const [ano, mes, dia] = dataIso.split("-");
    if(!ano || !mes || !dia){
        return dataIso;
    }

    return `${dia}/${mes}/${ano}`;
}

function criarLogDiarioBase(data){
    return {
        data,
        lucro: 0,
        totalApostas: 0,
        totalPremios: 0,
        totalVitorias: 0,
        totalGiros: 0
    };
}

function lerMachineStatsAtual(){
    try{
        const stats = JSON.parse(window.localStorage.getItem("machineStats"));
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

function criarSnapshotFinanceiro(financeiro){
    return {
        totalApostas: financeiro.totalApostas || 0,
        totalPremios: financeiro.totalPremios || 0,
        totalSpins: financeiro.totalSpins || 0,
        totalVitorias: lerMachineStatsAtual().vitorias || 0
    };
}

function obterHistoricoDiario(){
    return lerJSONLocal(DAILY_HISTORY_KEY, []);
}

function salvarHistoricoDiario(historico){
    salvarJSONLocal(DAILY_HISTORY_KEY, historico);
}

function obterLogDiarioAtual(){
    return lerJSONLocal(DAILY_LOG_KEY, null);
}

function salvarLogDiarioAtual(log){
    salvarJSONLocal(DAILY_LOG_KEY, log);
}

function obterSnapshotDiario(){
    return lerJSONLocal(DAILY_SNAPSHOT_KEY, null);
}

function salvarSnapshotDiario(snapshot){
    salvarJSONLocal(DAILY_SNAPSHOT_KEY, snapshot);
}

function substituirRegistroDiario(historico, registro){
    const semMesmoDia = historico.filter((item) => item.data !== registro.data);
    semMesmoDia.push(registro);
    semMesmoDia.sort((a, b) => a.data.localeCompare(b.data));
    return semMesmoDia;
}

function sincronizarLogDiario(){
    const hoje = obterDataHojeISO();
    const financeiro = lerFinanceiroAtual();
    const stats = lerMachineStatsAtual();
    let logAtual = obterLogDiarioAtual();
    let historico = obterHistoricoDiario();
    let snapshot = obterSnapshotDiario();

    if(!logAtual){
        logAtual = {
            data: hoje,
            lucro: financeiro.lucroMaquina || 0,
            totalApostas: financeiro.totalApostas || 0,
            totalPremios: financeiro.totalPremios || 0,
            totalVitorias: stats.vitorias || 0,
            totalGiros: financeiro.totalSpins || 0
        };
        snapshot = criarSnapshotFinanceiro(financeiro);
        salvarLogDiarioAtual(logAtual);
        salvarSnapshotDiario(snapshot);
        return logAtual;
    }

    if(logAtual.data !== hoje){
        if(!snapshot){
            snapshot = criarSnapshotFinanceiro(financeiro);
        }

        const deltaApostasAnterior = Math.max(0, (financeiro.totalApostas || 0) - (snapshot.totalApostas || 0));
        const deltaPremiosAnterior = Math.max(0, (financeiro.totalPremios || 0) - (snapshot.totalPremios || 0));
        const deltaGirosAnterior = Math.max(0, (financeiro.totalSpins || 0) - (snapshot.totalSpins || 0));
        const deltaVitoriasAnterior = Math.max(0, (stats.vitorias || 0) - (snapshot.totalVitorias || 0));

        logAtual.totalApostas = (logAtual.totalApostas || 0) + deltaApostasAnterior;
        logAtual.totalPremios = (logAtual.totalPremios || 0) + deltaPremiosAnterior;
        logAtual.totalGiros = (logAtual.totalGiros || 0) + deltaGirosAnterior;
        logAtual.totalVitorias = (logAtual.totalVitorias || 0) + deltaVitoriasAnterior;
        logAtual.lucro = logAtual.totalApostas - logAtual.totalPremios;

        historico = substituirRegistroDiario(historico, logAtual);
        salvarHistoricoDiario(historico);
        logAtual = criarLogDiarioBase(hoje);
        snapshot = criarSnapshotFinanceiro(financeiro);
        salvarLogDiarioAtual(logAtual);
        salvarSnapshotDiario(snapshot);
        return logAtual;
    }

    if(!snapshot){
        snapshot = criarSnapshotFinanceiro(financeiro);
    }

    const deltaApostas = (financeiro.totalApostas || 0) - (snapshot.totalApostas || 0);
    const deltaPremios = (financeiro.totalPremios || 0) - (snapshot.totalPremios || 0);
    const deltaGiros = (financeiro.totalSpins || 0) - (snapshot.totalSpins || 0);
    const deltaVitorias = (stats.vitorias || 0) - (snapshot.totalVitorias || 0);

    if(deltaApostas < 0 || deltaPremios < 0 || deltaGiros < 0 || deltaVitorias < 0){
        logAtual = criarLogDiarioBase(hoje);
        snapshot = criarSnapshotFinanceiro(financeiro);
    }else if(deltaApostas > 0 || deltaPremios > 0 || deltaGiros > 0 || deltaVitorias > 0){
        logAtual.totalApostas = (logAtual.totalApostas || 0) + deltaApostas;
        logAtual.totalPremios = (logAtual.totalPremios || 0) + deltaPremios;
        logAtual.totalGiros = (logAtual.totalGiros || 0) + deltaGiros;
        logAtual.totalVitorias = (logAtual.totalVitorias || 0) + deltaVitorias;
        logAtual.lucro = logAtual.totalApostas - logAtual.totalPremios;
        snapshot = criarSnapshotFinanceiro(financeiro);
    }

    salvarLogDiarioAtual(logAtual);
    salvarSnapshotDiario(snapshot);
    return logAtual;
}

function obterSerieDiaria(){
    const historico = obterHistoricoDiario();
    const logAtual = obterLogDiarioAtual();
    const serie = logAtual ? substituirRegistroDiario(historico, logAtual) : historico.slice();
    return serie.sort((a, b) => a.data.localeCompare(b.data));
}

function atualizarLogDoDia(){
    const logAtual = sincronizarLogDiario();
    document.getElementById("logDataHoje").innerText = formatarDataISO(logAtual.data);
    document.getElementById("logLucroHoje").innerText = logAtual.lucro || 0;
    document.getElementById("logApostasHoje").innerText = logAtual.totalApostas || 0;
    document.getElementById("logPremiosHoje").innerText = logAtual.totalPremios || 0;
}

function atualizarPercentuaisPesos(){
    const pesos = simbolos.map((simbolo) => {
        const nome = simbolo.charAt(0).toUpperCase() + simbolo.slice(1);
        return {
            nome,
            peso: Math.max(0, lerNumero(`peso${nome}`, SLOT_CONFIG.pesos[simbolo]))
        };
    });
    const somaPesos = pesos.reduce((total, item) => total + item.peso, 0);

    pesos.forEach(({ nome, peso }) => {
        const percentual = somaPesos > 0 ? (peso / somaPesos) * 100 : 0;
        document.getElementById(`porcentagem${nome}`).innerText = `${percentual.toFixed(2)}%`;
    });
}

function atualizarHistoricoDiario(){
    const corpo = document.getElementById("historicoDiarioBody");
    const serie = obterSerieDiaria();

    if(!serie.length){
        corpo.innerHTML = '<tr><td colspan="4">Sem registros diarios.</td></tr>';
        return;
    }

    corpo.innerHTML = serie
        .map((registro) => (
            `<tr><td>${formatarDataISO(registro.data)}</td><td>${registro.lucro || 0}</td><td>${registro.totalApostas || 0}</td><td>${registro.totalPremios || 0}</td></tr>`
        ))
        .join("");
}

function destruirGraficos(){
    [lucroChart, rtpChart, premiosChart].forEach((grafico) => {
        if(grafico){
            grafico.destroy();
        }
    });

    lucroChart = null;
    rtpChart = null;
    premiosChart = null;
}

function atualizarGraficos(){
    if(typeof window.Chart !== "function"){
        return;
    }

    const serie = obterSerieDiaria();
    const labels = serie.map((registro) => formatarDataISO(registro.data));
    const lucroSerie = serie.map((registro) => registro.lucro || 0);
    const premiosSerie = serie.map((registro) => registro.totalPremios || 0);
    const rtpSerie = serie.map((registro) => {
        const apostas = registro.totalApostas || 0;
        return apostas > 0 ? Number((((registro.totalPremios || 0) / apostas) * 100).toFixed(2)) : 0;
    });

    destruirGraficos();

    const opcoesBase = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#ffffff"
                }
            }
        },
        scales: {
            x: {
                ticks: { color: "#ffffff" },
                grid: { color: "rgba(255,255,255,0.08)" }
            },
            y: {
                ticks: { color: "#ffffff" },
                grid: { color: "rgba(255,255,255,0.08)" }
            }
        }
    };

    lucroChart = new window.Chart(document.getElementById("graficoLucro"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Lucro",
                data: lucroSerie,
                borderColor: "#eab308",
                backgroundColor: "rgba(234,179,8,0.2)",
                tension: 0.25,
                fill: true
            }]
        },
        options: opcoesBase
    });

    rtpChart = new window.Chart(document.getElementById("graficoRtp"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "RTP (%)",
                data: rtpSerie,
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56,189,248,0.18)",
                tension: 0.25,
                fill: true
            }]
        },
        options: opcoesBase
    });

    premiosChart = new window.Chart(document.getElementById("graficoPremios"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Premios por Dia",
                data: premiosSerie,
                backgroundColor: "#22c55e"
            }]
        },
        options: opcoesBase
    });
}

function lerSaldoAtual(){
    const saldo = Number(window.localStorage.getItem("saldo"));
    return Number.isFinite(saldo) ? saldo : 30;
}

function lerFinanceiroAtual(){
    if(typeof window.getMachineFinanceMetrics === "function"){
        return window.getMachineFinanceMetrics();
    }

    return {
        moneyIn: 0,
        moneyOut: 0,
        bancaMaquina: 0,
        totalApostas: 0,
        totalPremios: 0,
        totalSpins: 0,
        lucroMaquina: 0,
        rtpReal: 0
    };
}

function lerSessaoAtual(){
    if(typeof window.getPlayerSessionMetrics === "function"){
        return window.getPlayerSessionMetrics();
    }

    return {
        saldoInicialSessao: 0,
        saldoAtual: lerSaldoAtual(),
        ganhosSessao: 0,
        ganhoRestante: 0,
        maxWinPerSession: 0
    };
}

function salvarSaldoAtual(novoSaldo){
    const saldoAjustado = Math.max(0, novoSaldo);
    window.localStorage.setItem("saldo", String(saldoAjustado));
    if(typeof window.sincronizarSaldoSessao === "function"){
        window.sincronizarSaldoSessao(saldoAjustado);
    }
    atualizarDashboard();
}

function carregarFormulario(){
    window.refreshSlotConfig();
    document.getElementById("rtpInput").value = (SLOT_CONFIG.rtpAlvo * 100).toFixed(1).replace(".0", "");
    document.getElementById("percentualMaxPremio").value = (SLOT_CONFIG.riskControl.percentualMaxPremio * 100)
        .toFixed(1)
        .replace(".0", "");
    document.getElementById("maxWinPerSpin").value = SLOT_CONFIG.riskControl.maxWinPerSpin;
    document.getElementById("maxWinPerSession").value = SLOT_CONFIG.riskControl.maxWinPerSession;
    document.getElementById("mensagemLinha1").value = SLOT_CONFIG.betMessage.mensagemLinha1;
    document.getElementById("mensagemLinha2").value = SLOT_CONFIG.betMessage.mensagemLinha2;
    document.getElementById("tempoMensagem").value = SLOT_CONFIG.betMessage.tempoMensagem;
    document.getElementById("jackpotMin").value = (SLOT_CONFIG.jackpot?.min || 0).toFixed(0);
    document.getElementById("jackpotMax").value = (SLOT_CONFIG.jackpot?.max || 0).toFixed(0);
    document.getElementById("jackpotContributionPercent").value = ((SLOT_CONFIG.jackpot?.contributionPercent || 0) * 100).toFixed(2);

    simbolos.forEach((simbolo) => {
        const nome = simbolo.charAt(0).toUpperCase() + simbolo.slice(1);
        document.getElementById(`peso${nome}`).value = SLOT_CONFIG.pesos[simbolo];
        document.getElementById(`premio${nome}`).value = SLOT_CONFIG.premios[simbolo];
    });

    atualizarPercentuaisPesos();
}

function salvarMensagemAposta(){
    const mensagemLinha1 = (document.getElementById("mensagemLinha1").value || "").trim() || "APOSTA {bet}";
    const mensagemLinha2 = (document.getElementById("mensagemLinha2").value || "").trim() || "GANHO MAX {maxWin}";
    const tempoMensagem = Math.max(200, lerNumero("tempoMensagem", SLOT_CONFIG.betMessage.tempoMensagem || 3000));

    salvarJSONLocal(betMessageStorageKey, {
        mensagemLinha1,
        mensagemLinha2,
        tempoMensagem
    });
    window.refreshSlotConfig();
    alert("Mensagem de aposta atualizada.");
}

function salvarRTP(){
    const rtp = Math.min(100, Math.max(1, lerNumero("rtpInput", SLOT_CONFIG.rtpAlvo * 100)));
    window.localStorage.setItem("rtp", String(rtp));
    window.refreshSlotConfig();
    alert("RTP atualizado.");
}

function salvarSimbolos(){
    const config = {};

    simbolos.forEach((simbolo) => {
        const nome = simbolo.charAt(0).toUpperCase() + simbolo.slice(1);
        config[simbolo] = Math.max(1, lerNumero(`peso${nome}`, SLOT_CONFIG.pesos[simbolo]));
    });

    window.localStorage.setItem("pesos", JSON.stringify(config));
    window.refreshSlotConfig();
    atualizarPercentuaisPesos();
    alert("Pesos atualizados.");
}

function salvarPremios(){
    const premios = {};

    simbolos.forEach((simbolo) => {
        const nome = simbolo.charAt(0).toUpperCase() + simbolo.slice(1);
        premios[simbolo] = Math.max(0, lerNumero(`premio${nome}`, SLOT_CONFIG.premios[simbolo]));
    });

    window.localStorage.setItem("premios", JSON.stringify(premios));
    window.refreshSlotConfig();
    alert("Premios atualizados.");
}

function salvarControleRisco(){
    const percentualMaxPremio = Math.min(100, Math.max(0, lerNumero("percentualMaxPremio", 20))) / 100;
    const maxWinPerSpin = Math.max(0, lerNumero("maxWinPerSpin", SLOT_CONFIG.riskControl.maxWinPerSpin));
    const maxWinPerSession = Math.max(0, lerNumero("maxWinPerSession", SLOT_CONFIG.riskControl.maxWinPerSession));

    window.localStorage.setItem("riskControl", JSON.stringify({
        percentualMaxPremio,
        maxWinPerSpin,
        maxWinPerSession
    }));
    window.refreshSlotConfig();
    atualizarDashboard();
    alert("Controle de risco atualizado.");
}

function salvarConfiguracaoJackpot(){
    const min = Math.max(0, lerNumero("jackpotMin", SLOT_CONFIG.jackpot?.min || 0));
    const max = Math.max(min, lerNumero("jackpotMax", SLOT_CONFIG.jackpot?.max || min));
    const percent = Math.min(100, Math.max(0, lerNumero("jackpotContributionPercent", (SLOT_CONFIG.jackpot?.contributionPercent || 0) * 100)));

    if(typeof window.setJackpotMin === "function"){
        window.setJackpotMin(min);
    }

    if(typeof window.setJackpotMax === "function"){
        window.setJackpotMax(max);
    }

    if(typeof window.setJackpotContributionPercent === "function"){
        window.setJackpotContributionPercent(percent / 100);
    }

    if(typeof window.resetJackpotValue === "function"){
        window.resetJackpotValue();
    }

    if(typeof window.refreshSlotConfig === "function"){
        window.refreshSlotConfig();
    }

    atualizarDashboard();
    alert("Configuracao de jackpot atualizada.");
}

function adicionarCreditos(){
    const ajuste = Math.max(1, lerNumero("ajusteCredito", 0));
    window.inserirDinheiro(ajuste);
    salvarSaldoAtual(lerSaldoAtual() + ajuste);
    alert("Creditos adicionados.");
}

function removerCreditos(){
    const ajusteSolicitado = Math.max(1, lerNumero("ajusteCredito", 0));
    const ajuste = Math.min(ajusteSolicitado, lerSaldoAtual());
    if(ajuste <= 0){
        alert("Sem creditos para remover.");
        return;
    }

    const retirada = typeof window.retirarDinheiro === "function"
        ? window.retirarDinheiro(ajuste)
        : { pago: true };

    if(!retirada.pago){
        alert("Banca insuficiente para remover creditos.");
        return;
    }

    salvarSaldoAtual(lerSaldoAtual() - ajuste);
    alert("Creditos removidos.");
}

function resetarSessaoJogador(){
    if(typeof window.resetPlayerSession === "function"){
        window.resetPlayerSession(lerSaldoAtual());
    }
    atualizarDashboard();
    alert("Sessao resetada.");
}

function resetarEstatisticasMaquina(){
    const confirmado = window.confirm("Deseja resetar as estatisticas da maquina?");
    if(!confirmado){
        return;
    }

    const saldoAtual = lerSaldoAtual();
    const financeiroAtual = lerFinanceiroAtual();

    window.localStorage.setItem("machineStats", JSON.stringify({
        giros: 0,
        apostado: 0,
        premios: 0,
        lucroCasa: 0,
        vitorias: 0
    }));

    window.localStorage.setItem("machineFinance", JSON.stringify({
        moneyIn: 0,
        moneyOut: 0,
        bancaMaquina: financeiroAtual.bancaMaquina || 0,
        totalApostas: 0,
        totalPremios: 0,
        totalSpins: 0
    }));

    window.localStorage.setItem("playerSession", JSON.stringify({
        saldoInicialSessao: saldoAtual,
        saldoAtual,
        premiosSessaoAcumulados: 0,
        ganhosSessao: 0
    }));

    if(typeof window.refreshMachineFinance === "function"){
        window.refreshMachineFinance();
    }

    if(typeof window.refreshPlayerSession === "function"){
        window.refreshPlayerSession();
    }

    atualizarDashboard();
    atualizarLogDoDia();
    atualizarHistoricoDiario();
    atualizarGraficos();
    alert("Estatisticas resetadas.");
}

function atualizarDashboard(){
    let stats = null;

    try{
        stats = JSON.parse(window.localStorage.getItem("machineStats"));
    }catch{
        stats = null;
    }

    if(!stats){
        stats = { giros: 0, premios: 0, lucroCasa: 0, apostado: 0, vitorias: 0 };
    }

    const saldoAtual = lerSaldoAtual();
    const financeiro = lerFinanceiroAtual();
    const sessao = lerSessaoAtual();
    const rtp = financeiro.totalApostas > 0 ? financeiro.rtpReal * 100 : 0;
    const totalGiros = financeiro.totalSpins || stats.giros || 0;
    const totalVitorias = stats.vitorias || 0;
    const taxaVitoria = totalGiros > 0 ? (totalVitorias / totalGiros) * 100 : 0;

    document.getElementById("totalGiros").innerText = totalGiros;
    document.getElementById("premiosPagos").innerText = financeiro.totalPremios || stats.premios || 0;
    document.getElementById("lucroCasa").innerText = financeiro.lucroMaquina || stats.lucroCasa || 0;
    document.getElementById("rtpReal").innerText = `${rtp.toFixed(2)}%`;
    document.getElementById("taxaVitoria").innerText = `${taxaVitoria.toFixed(2)}%`;
    document.getElementById("bancaMaquina").innerText = financeiro.bancaMaquina || 0;
    document.getElementById("dinheiroInserido").innerText = financeiro.moneyIn || 0;
    document.getElementById("dinheiroPago").innerText = financeiro.moneyOut || 0;
    document.getElementById("lucroFinanceiro").innerText = financeiro.lucroMaquina || 0;
    document.getElementById("totalApostasFinanceiro").innerText = financeiro.totalApostas || 0;
    document.getElementById("totalPremiosFinanceiro").innerText = financeiro.totalPremios || 0;
    document.getElementById("rtpFinanceiro").innerText = `${rtp.toFixed(2)}%`;
    document.getElementById("totalSpinsFinanceiro").innerText = financeiro.totalSpins || 0;
    document.getElementById("riscoPercentualAtual").innerText = `${(SLOT_CONFIG.riskControl.percentualMaxPremio * 100).toFixed(1)}%`;
    document.getElementById("riscoSpinAtual").innerText = SLOT_CONFIG.riskControl.maxWinPerSpin || 0;
    document.getElementById("riscoSessaoAtual").innerText = SLOT_CONFIG.riskControl.maxWinPerSession || 0;
    document.getElementById("ganhoSessaoAtual").innerText = sessao.premiosSessaoAcumulados || sessao.ganhosSessao || 0;

    document.getElementById("saldoAtual").innerText = saldoAtual;
    document.getElementById("saldoEditor").innerText = saldoAtual;
    document.getElementById("totalApostado").innerText = financeiro.totalApostas || stats.apostado || 0;
    document.getElementById("lucroHistorico").innerText = financeiro.lucroMaquina || stats.lucroCasa || 0;
    document.getElementById("estadoResumo").innerText = sessao.ganhoRestante <= 0
        ? "Limite de sessao atingido"
        : totalGiros > 0
            ? "Operando"
            : "Sem giros";

    atualizarLogDoDia();
    atualizarHistoricoDiario();
    atualizarGraficos();
}

window.salvarRTP = salvarRTP;
window.salvarSimbolos = salvarSimbolos;
window.salvarPremios = salvarPremios;
window.salvarControleRisco = salvarControleRisco;
window.salvarMensagemAposta = salvarMensagemAposta;
window.adicionarCreditos = adicionarCreditos;
window.removerCreditos = removerCreditos;
window.resetarSessaoJogador = resetarSessaoJogador;
window.resetarEstatisticasMaquina = resetarEstatisticasMaquina;
window.rodarSimulacao = rodarSimulacao;
window.salvarConfiguracaoJackpot = salvarConfiguracaoJackpot;

carregarFormulario();
atualizarPainelSimulacao();
simbolos.forEach((simbolo) => {
    const nome = simbolo.charAt(0).toUpperCase() + simbolo.slice(1);
    const input = document.getElementById(`peso${nome}`);
    if(input){
        input.addEventListener("input", atualizarPercentuaisPesos);
    }
});
atualizarDashboard();
abrirPagina("dashboard");
window.setInterval(atualizarDashboard, 1000);
window.addEventListener("storage", () => {
    carregarFormulario();
    atualizarDashboard();
});
