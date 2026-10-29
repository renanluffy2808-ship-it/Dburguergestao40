import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  TrendingUp,
  Percent,
  DollarSign,
  AlertTriangle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RelatoriosView: React.FC = () => {
  const { pedidos, produtos, insumos, compras, lancamentosCaixa, config, calcularAnaliseProduto, calcularCmvProduto } =
    useApp();
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | 'mes' | 'todos'>('mes');
  const [tipoRelatorio, setTipoRelatorio] = useState<'vendas' | 'produtos' | 'compras' | 'perdas'>('vendas');

  const agora = new Date();
  const hojeStr = agora.toISOString().split('T')[0];
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter((p) => {
    if (p.status !== 'CONCLUIDO') return false;
    const dataPed = new Date(p.dataHora);
    const dataStr = p.dataHora.split('T')[0];
    if (periodo === 'hoje') return dataStr === hojeStr;
    if (periodo === '7dias') return dataPed >= seteDiasAtras;
    if (periodo === 'mes') return dataPed >= inicioMes;
    return true;
  });

  const faturamentoTotal = pedidosFiltrados.reduce((acc, p) => acc + p.valorFinal, 0);
  const cmvTotal = pedidosFiltrados.reduce((acc, p) => acc + p.cmvTotalMomento, 0);
  const taxasTotal = pedidosFiltrados.reduce((acc, p) => acc + p.valorTaxa, 0);
  const reservaTotal = pedidosFiltrados.reduce((acc, p) => acc + p.reservaOperacionalMomento, 0);
  const lucroEstimadoTotal = Math.max(0, faturamentoTotal - cmvTotal - taxasTotal - reservaTotal);

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Exportadores para CSV
  const exportarVendasCsv = () => {
    let csv = 'Numero Pedido;Data Hora;Forma Pagamento;Valor Final;Taxa Paga;CMV Insumos;Reserva 12.1%;Lucro Estimado\n';
    for (const p of pedidosFiltrados) {
      csv += `${p.numeroPedido};"${new Date(p.dataHora).toLocaleString('pt-BR')}";"${p.formaPagamento}";${p.valorFinal.toFixed(
        2
      )};${p.valorTaxa.toFixed(2)};${p.cmvTotalMomento.toFixed(2)};${p.reservaOperacionalMomento.toFixed(
        2
      )};${p.lucroEstimadoMomento.toFixed(2)}\n`;
    }
    baixarArquivoCsv(csv, `relatorio_vendas_dburger_${periodo}.csv`);
  };

  const exportarRentabilidadeCsv = () => {
    let csv = 'Lanche;Categoria;Preco Venda;CMV Ficha;Markup;Margem Bruta (%);Status;Preco Recomendado\n';
    for (const p of produtos) {
      const a = calcularAnaliseProduto(p);
      csv += `"${p.nome}";"${p.categoria}";${p.precoVenda.toFixed(2)};${a.cmv.toFixed(2)};${a.markupAtual.toFixed(
        2
      )};${a.margemBrutaIngredientesPercent.toFixed(1)};"${a.statusCor.toUpperCase()}";${a.precoRecomendadoAlvo.toFixed(2)}\n`;
    }
    baixarArquivoCsv(csv, `relatorio_rentabilidade_cardapio.csv`);
  };

  const baixarArquivoCsv = (conteudo: string, nomeArquivo: string) => {
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Relatórios & Análises Financeiras</h2>
          <p className="text-xs text-zinc-400">
            Exportação de dados para planilhas (Excel/CSV) e impressão para conferência gerencial.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
          <button
            onClick={tipoRelatorio === 'vendas' ? exportarVendasCsv : exportarRentabilidadeCsv}
            className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Controles de Filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-white">Período:</span>
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: '7dias', label: '7 Dias' },
              { id: 'mes', label: 'Este Mês' },
              { id: 'todos', label: 'Todos' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  periodo === p.id ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTipoRelatorio('vendas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              tipoRelatorio === 'vendas'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Vendas do Período
          </button>
          <button
            onClick={() => setTipoRelatorio('produtos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              tipoRelatorio === 'produtos'
                ? 'bg-zinc-800 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Rentabilidade por Lanche
          </button>
        </div>
      </div>

      {/* Resumo do Período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800">
          <span className="text-[11px] text-zinc-400 block">Faturamento Bruto</span>
          <span className="text-xl font-black text-white font-mono mt-1 block">
            {formatarMoeda(faturamentoTotal)}
          </span>
          <span className="text-[10px] text-zinc-500">{pedidosFiltrados.length} pedidos</span>
        </div>

        <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800">
          <span className="text-[11px] text-rose-400 block">CMV Total Insumos</span>
          <span className="text-xl font-black text-rose-400 font-mono mt-1 block">
            {formatarMoeda(cmvTotal)}
          </span>
          <span className="text-[10px] text-zinc-500">Reposição de carnes/pães</span>
        </div>

        <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800">
          <span className="text-[11px] text-blue-400 block">Reserva Operacional</span>
          <span className="text-xl font-black text-blue-400 font-mono mt-1 block">
            {formatarMoeda(reservaTotal)}
          </span>
          <span className="text-[10px] text-zinc-500">Fundo contas fixas (12,1%)</span>
        </div>

        <div className="p-4 bg-emerald-950/20 rounded-2xl border border-emerald-800/40">
          <span className="text-[11px] text-emerald-400 font-bold block">Lucro Estimado</span>
          <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
            {formatarMoeda(lucroEstimadoTotal)}
          </span>
          <span className="text-[10px] text-emerald-400/80">Livre de CMV, taxas e reserva</span>
        </div>
      </div>

      {/* Tabela do Relatório */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {tipoRelatorio === 'vendas' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Pedido</th>
                  <th className="p-3.5">Data & Hora</th>
                  <th className="p-3.5">Pagamento</th>
                  <th className="p-3.5 text-right">Valor Final</th>
                  <th className="p-3.5 text-right">Taxa</th>
                  <th className="p-3.5 text-right">CMV Insumos</th>
                  <th className="p-3.5 text-right">Reserva</th>
                  <th className="p-3.5 text-right text-emerald-400">Lucro Estimado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {pedidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-zinc-500 font-sans">
                      Nenhum pedido encontrado para o período selecionado.
                    </td>
                  </tr>
                ) : (
                  pedidosFiltrados.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-800/40 transition">
                      <td className="p-3.5 font-bold text-white">#{p.numeroPedido}</td>
                      <td className="p-3.5 font-sans">{new Date(p.dataHora).toLocaleString('pt-BR')}</td>
                      <td className="p-3.5 uppercase font-sans text-amber-400">{p.formaPagamento}</td>
                      <td className="p-3.5 text-right font-bold text-white">{formatarMoeda(p.valorFinal)}</td>
                      <td className="p-3.5 text-right text-zinc-400">{formatarMoeda(p.valorTaxa)}</td>
                      <td className="p-3.5 text-right text-rose-400">{formatarMoeda(p.cmvTotalMomento)}</td>
                      <td className="p-3.5 text-right text-blue-400">{formatarMoeda(p.reservaOperacionalMomento)}</td>
                      <td className="p-3.5 text-right font-bold text-emerald-400">
                        {formatarMoeda(p.lucroEstimadoMomento)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Lanche / Produto</th>
                  <th className="p-3.5">Linha</th>
                  <th className="p-3.5 text-right">Preço Atual</th>
                  <th className="p-3.5 text-right">CMV Ficha</th>
                  <th className="p-3.5 text-right">Markup</th>
                  <th className="p-3.5 text-right">Margem Bruta</th>
                  <th className="p-3.5 text-right">Preço Recomendado</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {produtos.map((p) => {
                  const a = calcularAnaliseProduto(p);
                  return (
                    <tr key={p.id} className="hover:bg-zinc-800/40 transition">
                      <td className="p-3.5 font-sans font-bold text-white">{p.nome}</td>
                      <td className="p-3.5 font-sans text-amber-500">{p.categoria}</td>
                      <td className="p-3.5 text-right font-bold text-white">{formatarMoeda(p.precoVenda)}</td>
                      <td className="p-3.5 text-right text-rose-400">{formatarMoeda(a.cmv)}</td>
                      <td className="p-3.5 text-right text-emerald-400">{a.markupAtual.toFixed(2)}x</td>
                      <td className="p-3.5 text-right">{a.margemBrutaIngredientesPercent.toFixed(1)}%</td>
                      <td className="p-3.5 text-right font-bold text-amber-400">
                        {formatarMoeda(a.precoRecomendadoAlvo)}
                      </td>
                      <td className="p-3.5 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.statusCor === 'verde'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : a.statusCor === 'amarelo'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {a.statusCor.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
