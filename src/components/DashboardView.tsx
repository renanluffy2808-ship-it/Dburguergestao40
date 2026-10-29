import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ShieldAlert,
  Percent,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
  ArrowRight,
  HelpCircle,
  Coins,
  Receipt,
  Scale,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TabType } from './Navbar';

interface DashboardViewProps {
  setCurrentTab: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setCurrentTab }) => {
  const { indicadores, pedidos, produtos, insumos, compras, config, calcularAnaliseProduto } = useApp();
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [modalExplicacao, setModalExplicacao] = useState<{ titulo: string; descricao: string; formula: string } | null>(null);

  // Filtragem de dados pelo período selecionado
  const agora = new Date();
  const hojeStr = agora.toISOString().split('T')[0];
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const pedidosPeriodo = pedidos.filter((p) => {
    if (p.status !== 'CONCLUIDO') return false;
    const dataPed = new Date(p.dataHora);
    const dataStr = p.dataHora.split('T')[0];
    if (periodo === 'hoje') return dataStr === hojeStr;
    if (periodo === 'semana') return dataPed >= seteDiasAtras;
    return dataPed >= trintaDiasAtras;
  });

  const faturamentoPeriodo = pedidosPeriodo.reduce((acc, p) => acc + p.valorFinal, 0);
  const lanchesPeriodo = pedidosPeriodo.reduce(
    (acc, p) => acc + p.itens.reduce((sum, it) => sum + it.quantidade, 0),
    0
  );
  const cmvPeriodo = pedidosPeriodo.reduce((acc, p) => acc + p.cmvTotalMomento, 0);
  const taxasPeriodo = pedidosPeriodo.reduce((acc, p) => acc + p.valorTaxa, 0);
  const reservaPeriodo = pedidosPeriodo.reduce((acc, p) => acc + p.reservaOperacionalMomento, 0);

  // Reposição de estoque = equivalente ao CMV dos lanches vendidos para recomprar os insumos consumidos
  const reposicaoPeriodo = cmvPeriodo;

  // Lucro / Resultado operacional estimado após deduzir CMV, taxas e reserva
  const lucroEstimadoPeriodo = Math.max(0, faturamentoPeriodo - cmvPeriodo - taxasPeriodo - reservaPeriodo);

  // Mais vendidos
  const contagemVendasPorProduto: Record<string, { nome: string; quantidade: number; faturamento: number }> = {};
  for (const p of pedidosPeriodo) {
    for (const it of p.itens) {
      if (!contagemVendasPorProduto[it.produtoId]) {
        contagemVendasPorProduto[it.produtoId] = { nome: it.nome, quantidade: 0, faturamento: 0 };
      }
      contagemVendasPorProduto[it.produtoId].quantidade += it.quantidade;
      contagemVendasPorProduto[it.produtoId].faturamento += it.subtotal;
    }
  }

  const rankingMaisVendidos = Object.entries(contagemVendasPorProduto)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Produtos com atenção ou margem insuficiente
  const produtosAlerta = produtos
    .map((p) => ({ produto: p, analise: calcularAnaliseProduto(p) }))
    .filter((p) => p.analise.statusCor !== 'verde');

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Top Banner Alert (Se houver insumos críticos) */}
      {(indicadores.insumosEstoqueZerado.length > 0 || indicadores.insumosEstoqueBaixo.length > 0) && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-900/50 text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Atenção ao Estoque da Hamburgueria</h3>
              <p className="text-xs text-red-300">
                {indicadores.insumosEstoqueZerado.length > 0
                  ? `${indicadores.insumosEstoqueZerado.length} insumo(s) ZERADO(S) e `
                  : ''}
                {indicadores.insumosEstoqueBaixo.length} insumo(s) abaixo do estoque mínimo.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('estoque')}
            className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            <span>Ver Estoque</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header com Seletor de Período */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Painel Operacional & Financeiro</h2>
          <p className="text-xs text-zinc-400">
            Acompanhe a saúde do negócio sem ilusão: faturamento não é lucro!
          </p>
        </div>

        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => setPeriodo('hoje')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              periodo === 'hoje' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              periodo === 'semana' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Últimos 7 Dias
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              periodo === 'mes' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Últimos 30 Dias
          </button>
        </div>
      </div>

      {/* 4 Cards Principais de Destinação do Dinheiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faturamento Bruto */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-zinc-700 transition relative">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Faturamento Bruto</span>
            <button
              onClick={() =>
                setModalExplicacao({
                  titulo: 'Faturamento Bruto',
                  descricao:
                    'É a soma total do valor cobrado em todas as vendas do período. ATENÇÃO: Faturamento NÃO é lucro! Deste valor ainda devem sair os insumos, as taxas e as contas.',
                  formula: 'Soma dos pedidos concluídos no período selecionado.',
                })
              }
              className="text-zinc-500 hover:text-amber-400 transition"
              title="Explicar indicador"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="text-2xl font-black text-white">{formatarMoeda(faturamentoPeriodo)}</div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>{lanchesPeriodo} lanches vendidos</span>
            <span className="text-amber-400 font-semibold">{pedidosPeriodo.length} pedidos</span>
          </div>
        </div>

        {/* Card 2: CMV & Reposição de Estoque */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-zinc-700 transition relative">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              CMV / Reposição de Insumos
            </span>
            <button
              onClick={() =>
                setModalExplicacao({
                  titulo: 'CMV (Custo das Mercadorias Vendidas)',
                  descricao:
                    'Representa o custo exato dos ingredientes (carnes, pães, queijos, bacon, molhos e embalagens) consumidos nos lanches vendidos. Esse dinheiro DEVE ser guardado para recomprar o estoque.',
                  formula: 'Σ (Quantidade vendida × Custo da Ficha Técnica de cada lanche)',
                })
              }
              className="text-zinc-500 hover:text-amber-400 transition"
              title="Explicar indicador"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="text-2xl font-black text-rose-400">{formatarMoeda(cmvPeriodo)}</div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>
              {faturamentoPeriodo > 0 ? ((cmvPeriodo / faturamentoPeriodo) * 100).toFixed(1) : 0}% do faturamento
            </span>
            <span className="text-rose-400 font-medium">Comprometido</span>
          </div>
        </div>

        {/* Card 3: Reserva Operacional */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-zinc-700 transition relative">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Reserva Operacional ({config.reservaOperacionalPercent.toFixed(1)}%)
            </span>
            <button
              onClick={() =>
                setModalExplicacao({
                  titulo: 'Reserva Operacional',
                  descricao:
                    'Provisão obrigatória calculada sobre cada venda para pagar contas fixas do fim do mês (gás, água, energia, internet, manutenção) sem passar aperto.',
                  formula: `Faturamento × ${config.reservaOperacionalPercent.toFixed(2)}%`,
                })
              }
              className="text-zinc-500 hover:text-amber-400 transition"
              title="Explicar indicador"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="text-2xl font-black text-blue-400">{formatarMoeda(reservaPeriodo)}</div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>Fundo para contas fixas</span>
            <span className="text-blue-400 font-medium">Blindado</span>
          </div>
        </div>

        {/* Card 4: Lucro Estimado */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-sm hover:border-zinc-700 transition relative">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Resultado Estimado
            </span>
            <button
              onClick={() =>
                setModalExplicacao({
                  titulo: 'Resultado Operacional Estimado',
                  descricao:
                    'O que sobra para o proprietário após descontar o CMV dos ingredientes, as taxas de cartão/maquineta e a reserva de contas fixas.',
                  formula: 'Faturamento - CMV - Taxas Pagamento - Reserva Operacional',
                })
              }
              className="text-zinc-500 hover:text-amber-400 transition"
              title="Explicar indicador"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="text-2xl font-black text-emerald-400">{formatarMoeda(lucroEstimadoPeriodo)}</div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center justify-between">
            <span>Taxas pagas: {formatarMoeda(taxasPeriodo)}</span>
            <span className="text-emerald-400 font-semibold">
              {faturamentoPeriodo > 0 ? ((lucroEstimadoPeriodo / faturamentoPeriodo) * 100).toFixed(1) : 0}% margem
            </span>
          </div>
        </div>
      </div>

      {/* Visão de Caixa Real: Saldo Total vs Comprometido vs Saldo Livre */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Saúde Real do Caixa da Hamburgueria</h3>
              <p className="text-xs text-zinc-400">
                Saldo bancário atual desmembrado entre o que você pode gastar e o que já tem dono.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentTab('caixa')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>Ver Extrato do Caixa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <span className="text-xs text-zinc-400 font-medium">Saldo Total em Caixa</span>
            <div className="text-xl font-extrabold text-white mt-1">
              {formatarMoeda(indicadores.saldoCaixaTotal)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Entradas totais menos saídas e compras pagas registradas.
            </p>
          </div>

          <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <span className="text-xs text-rose-400 font-medium">Comprometido com Insumos & Contas</span>
            <div className="text-xl font-extrabold text-rose-400 mt-1">
              {formatarMoeda(indicadores.dinheiroComprometidoReposicao + indicadores.dinheiroAcumuladoReserva)}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Reposição de carnes/pães ({formatarMoeda(indicadores.dinheiroComprometidoReposicao)}) + Reserva ({formatarMoeda(indicadores.dinheiroAcumuladoReserva)}).
            </p>
          </div>

          <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-800/40">
            <span className="text-xs text-emerald-400 font-bold">Saldo Livre Real para Retirada</span>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {formatarMoeda(indicadores.saldoCaixaLivre)}
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Valor 100% seguro que você pode retirar sem deixar o estoque desfalcado ou atrasar contas.
            </p>
          </div>
        </div>
      </div>

      {/* Grid com Lanches Mais Vendidos & Produtos com Atenção de Preço */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mais Vendidos */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-white">Lanches Mais Vendidos ({periodo.toUpperCase()})</h3>
            </div>
            <button
              onClick={() => setCurrentTab('relatorios')}
              className="text-xs text-zinc-400 hover:text-white transition"
            >
              Relatório Completo
            </button>
          </div>

          {rankingMaisVendidos.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              Nenhuma venda registrada no período selecionado. Realize sua primeira venda no PDV!
            </div>
          ) : (
            <div className="space-y-3">
              {rankingMaisVendidos.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 text-amber-400 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-white">{prod.nome}</h4>
                      <p className="text-[11px] text-zinc-400">{prod.quantidade} unidades vendidas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-xs text-white">{formatarMoeda(prod.faturamento)}</div>
                    <span className="text-[10px] text-emerald-400">Faturamento gerado</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Produtos com Margem ou Preço que Exigem Atenção */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-white">Monitor de Rentabilidade do Cardápio</h3>
            </div>
            <button
              onClick={() => setCurrentTab('cardapio')}
              className="text-xs text-zinc-400 hover:text-white transition"
            >
              Ver Cardápio
            </button>
          </div>

          {produtosAlerta.length === 0 ? (
            <div className="py-8 text-center text-emerald-400/90 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span>Excelente! Todos os lanches ativos possuem ficha técnica completa e margem saudável.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {produtosAlerta.slice(0, 4).map(({ produto, analise }) => (
                <div
                  key={produto.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    analise.statusCor === 'vermelho'
                      ? 'bg-red-950/30 border-red-800/50 text-red-200'
                      : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          analise.statusCor === 'vermelho' ? 'bg-red-500' : 'bg-amber-400'
                        }`}
                      />
                      <h4 className="font-bold text-xs text-white">{produto.nome}</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40">
                        {formatarMoeda(produto.precoVenda)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1">{analise.motivoCor}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-400 block">Sugerido:</span>
                    <span className="font-bold text-xs text-amber-400">
                      {formatarMoeda(analise.precoRecomendadoAlvo)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Explicação de Indicador / Memória de Cálculo */}
      {modalExplicacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalExplicacao(null)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-white">{modalExplicacao.titulo}</h3>
              </div>
              <button
                onClick={() => setModalExplicacao(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded-md bg-zinc-800"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>{modalExplicacao.descricao}</p>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-amber-400 text-[11px]">
                <span className="text-zinc-500 block mb-1 font-sans text-[10px] uppercase font-bold">
                  Fórmula Matemática:
                </span>
                {modalExplicacao.formula}
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={() => setModalExplicacao(null)}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
