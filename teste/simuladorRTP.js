const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENGINE_FILES = [
    path.join(ROOT_DIR, "engine", "slotConfig.js"),
    path.join(ROOT_DIR, "engine", "slotEngine.js")
];
const EXECUCOES = [100000, 500000, 1000000];

function criarStorageMock(){
    const store = new Map();

    return {
        getItem(chave){
            return store.has(chave) ? store.get(chave) : null;
        },
        setItem(chave, valor){
            store.set(chave, String(valor));
        },
        removeItem(chave){
            store.delete(chave);
        },
        clear(){
            store.clear();
        }
    };
}

function criarContextoSlot(){
    const localStorage = criarStorageMock();
    const window = {
        localStorage,
        console
    };

    const context = vm.createContext({
        console,
        Math,
        Number,
        String,
        Boolean,
        JSON,
        Object,
        Array,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        Infinity,
        NaN,
        window
    });

    window.window = window;

    for(const arquivo of ENGINE_FILES){
        const codigo = fs.readFileSync(arquivo, "utf8");
        vm.runInContext(codigo, context, { filename: arquivo });
        sincronizarGlobais(window, context);
    }

    return window;
}

function sincronizarGlobais(window, context){
    const globais = [
        "SLOT_CONFIG",
        "MACHINE_FINANCE",
        "refreshSlotConfig",
        "refreshMachineFinance",
        "getPlayerSessionMetrics",
        "getMachineFinanceMetrics",
        "incrementarTotalSpins",
        "inserirDinheiro",
        "registrarAposta",
        "registrarPremio",
        "registrarGanhoSessao",
        "resetPlayerSession",
        "SLOT_ENGINE"
    ];

    for(const nome of globais){
        if(Object.prototype.hasOwnProperty.call(window, nome)){
            context[nome] = window[nome];
        }
    }
}

function criarContadorSimbolos(slotConfig){
    const contadores = {};

    for(const simbolo of Object.keys(slotConfig.pesos)){
        contadores[simbolo] = 0;
    }

    return contadores;
}

function simular(totalSpins){
    const window = criarContextoSlot();
    const { SLOT_ENGINE, SLOT_CONFIG } = window;
    if(typeof window.resetPlayerSession === "function"){
        window.resetPlayerSession(30);
    }

    const estatisticas = {
        totalSpins,
        totalBet: 0,
        totalWins: 0,
        profit: 0,
        rtpReal: 0,
        totalVitorias: 0,
        taxaVitoria: 0,
        maiorPremio: 0,
        maiorSequenciaPerdas: 0,
        frequenciaSimbolos: criarContadorSimbolos(SLOT_CONFIG),
        bloqueiosPorBanca: 0
    };

    let sequenciaPerdasAtual = 0;

    for(let i = 0; i < totalSpins; i++){
        const resultado = SLOT_ENGINE.girar();
        let premioPago = 0;

        estatisticas.totalBet += SLOT_CONFIG.custoJogada;

        for(const simbolo of resultado.simbolos){
            estatisticas.frequenciaSimbolos[simbolo] = (estatisticas.frequenciaSimbolos[simbolo] || 0) + 1;
        }

        if(resultado.bloqueadoPorBanca){
            estatisticas.bloqueiosPorBanca++;
        }

        if(resultado.premio > 0){
            const pagamento = window.registrarPremio(resultado.premio);
            if(pagamento.pago){
                premioPago = resultado.premio;
                if(typeof window.registrarGanhoSessao === "function"){
                    window.registrarGanhoSessao(premioPago);
                }
            }
        }

        if(premioPago > 0){
            estatisticas.totalWins += premioPago;
            estatisticas.totalVitorias++;
            estatisticas.maiorPremio = Math.max(estatisticas.maiorPremio, premioPago);
            estatisticas.maiorSequenciaPerdas = Math.max(
                estatisticas.maiorSequenciaPerdas,
                sequenciaPerdasAtual
            );
            sequenciaPerdasAtual = 0;
        }else{
            sequenciaPerdasAtual++;
        }
    }

    estatisticas.maiorSequenciaPerdas = Math.max(
        estatisticas.maiorSequenciaPerdas,
        sequenciaPerdasAtual
    );
    estatisticas.profit = estatisticas.totalBet - estatisticas.totalWins;
    estatisticas.rtpReal = estatisticas.totalBet > 0 ? estatisticas.totalWins / estatisticas.totalBet : 0;
    estatisticas.taxaVitoria = estatisticas.totalSpins > 0
        ? estatisticas.totalVitorias / estatisticas.totalSpins
        : 0;

    return estatisticas;
}

function formatarNumero(valor){
    return new Intl.NumberFormat("pt-BR").format(valor);
}

function formatarMoeda(valor){
    return new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

function formatarPercentual(valor){
    return `${(valor * 100).toFixed(2)}%`;
}

function imprimirDistribuicao(estatisticas){
    const totalSimbolos = estatisticas.totalSpins * 3;

    for(const [simbolo, quantidade] of Object.entries(estatisticas.frequenciaSimbolos)){
        const percentual = totalSimbolos > 0 ? quantidade / totalSimbolos : 0;
        console.log(
            `${simbolo.padEnd(8, " ")} ${formatarNumero(quantidade).padStart(10, " ")} (${formatarPercentual(percentual)})`
        );
    }
}

function imprimirRelatorio(estatisticas){
    console.log("---------------------------------");
    console.log("SIMULACAO SLOT MACHINE");
    console.log("---------------------------------");
    console.log(`Total de giros: ${formatarNumero(estatisticas.totalSpins)}`);
    console.log(`Total apostado: ${formatarMoeda(estatisticas.totalBet)}`);
    console.log(`Total pago: ${formatarMoeda(estatisticas.totalWins)}`);
    console.log(`Lucro da maquina: ${formatarMoeda(estatisticas.profit)}`);
    console.log(`RTP real: ${formatarPercentual(estatisticas.rtpReal)}`);
    console.log(`Maior premio: ${formatarMoeda(estatisticas.maiorPremio)}`);
    console.log(`Taxa de vitoria: ${formatarPercentual(estatisticas.taxaVitoria)}`);
    console.log(`Maior sequencia de perdas: ${formatarNumero(estatisticas.maiorSequenciaPerdas)}`);
    console.log(`Vitorias bloqueadas por banca: ${formatarNumero(estatisticas.bloqueiosPorBanca)}`);
    console.log("Distribuicao de simbolos:");
    imprimirDistribuicao(estatisticas);
    console.log("---------------------------------");

    if(estatisticas.rtpReal > 0.95){
        console.log("Sugestao: RTP acima de 95%. Revise pesos ou premios para reduzir o retorno.");
    }else{
        console.log("Conclusao: a maquina permanece lucrativa no longo prazo nesta simulacao.");
    }

    console.log("");
}

function main(){
    for(const totalSpins of EXECUCOES){
        const estatisticas = simular(totalSpins);
        imprimirRelatorio(estatisticas);
    }
}

main();
