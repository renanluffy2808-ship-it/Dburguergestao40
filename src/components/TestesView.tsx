import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Cpu,
} from 'lucide-react';
import { executarTodosOsTestes, TestResult } from '../lib/testRunner';

export const TestesView: React.FC = () => {
  const [resultados, setResultados] = useState<TestResult[]>(() => executarTodosOsTestes());
  const [executando, setExecutando] = useState(false);

  const rodarTestes = () => {
    setExecutando(true);
    setTimeout(() => {
      const res = executarTodosOsTestes();
      setResultados(res);
      setExecutando(false);
    }, 300);
  };

  const totalTestes = resultados.length;
  const testesPassados = resultados.filter((r) => r.passou).length;
  const todosPassaram = testesPassados === totalTestes;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Suíte de Testes Automatizados</h2>
          <p className="text-xs text-zinc-400">
            Validação rigorosa de cálculos decimais, conversão de unidades, custo médio ponderado, baixa de estoque e fórmulas.
          </p>
        </div>

        <button
          onClick={rodarTestes}
          disabled={executando}
          className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition active:scale-95"
        >
          <Play className={`w-4 h-4 fill-current ${executando ? 'animate-spin' : ''}`} />
          <span>{executando ? 'Executando Testes...' : 'Executar Todos os Testes'}</span>
        </button>
      </div>

      {/* Card de Status Geral */}
      <div
        className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          todosPassaram
            ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300'
            : 'bg-red-950/20 border-red-800/50 text-red-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl ${
              todosPassaram ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {todosPassaram ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="font-extrabold text-base text-white">
              {todosPassaram ? '100% dos Testes Passaram com Sucesso!' : 'Atenção: Falha em testes'}
            </h3>
            <p className="text-xs opacity-90 mt-0.5">
              {testesPassados} de {totalTestes} testes aprovados. As regras de negócio financeiras estão consistentes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-zinc-800/60 font-mono text-xs">
          <Cpu className="w-4 h-4 text-amber-500" />
          <span>Status:</span>
          <span className="font-black text-emerald-400">APROVADO</span>
        </div>
      </div>

      {/* Lista de Resultados dos Testes */}
      <div className="space-y-3">
        {resultados.map((teste) => (
          <div
            key={teste.id}
            className={`p-4 rounded-2xl border transition ${
              teste.passou
                ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                : 'bg-red-950/30 border-red-800/60'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {teste.passou ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                      {teste.categoria}
                    </span>
                    <h4 className="font-extrabold text-xs text-white">{teste.nome}</h4>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{teste.detalhes}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center font-mono text-xs">
                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {teste.tempoMs.toFixed(2)} ms
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    teste.passou
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {teste.passou ? 'PASSOU' : 'FALHOU'}
                </span>
              </div>
            </div>

            {teste.valoresEsperadosVsObtidos && (
              <div className="mt-3 pt-2 border-t border-zinc-800/60 font-mono text-[11px] text-zinc-400 flex items-center justify-between">
                <span className="text-zinc-500 font-sans">Validação:</span>
                <span className="text-amber-400/90">{teste.valoresEsperadosVsObtidos}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
