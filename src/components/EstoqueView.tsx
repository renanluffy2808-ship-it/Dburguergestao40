import React, { useState } from 'react';
import {
  Boxes,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  FileDown,
  Clock,
  ShieldCheck,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MovimentacaoEstoque, TipoMovimentacaoEstoque } from '../types';

export const EstoqueView: React.FC = () => {
  const { insumos, movimentacoesEstoque, registrarMovimentacaoEstoque } = useApp();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'reposicao' | 'movimentacoes'>('geral');
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);

  // Form Ajuste Manual / Perda
  const [ajusteInsumoId, setAjusteInsumoId] = useState('');
  const [ajusteTipo, setAjusteTipo] = useState<TipoMovimentacaoEstoque>('PERDA_DESCARTE');
  const [ajusteQtd, setAjusteQtd] = useState<number>(0);
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [erroAjuste, setErroAjuste] = useState('');

  const insumosEstoqueBaixo = insumos.filter((i) => i.ativo && i.estoqueAtual > 0 && i.estoqueAtual <= i.estoqueMinimo);
  const insumosEstoqueZerado = insumos.filter((i) => i.ativo && i.estoqueAtual <= 0);

  // Lista de reposição: quanto comprar de cada um para voltar ao nível de segurança (estoque mínimo + 50%)
  const itensParaReposicao = insumos
    .filter((i) => i.ativo && i.estoqueAtual <= i.estoqueMinimo)
    .map((ins) => {
      const objetivo = Math.round(ins.estoqueMinimo * 1.5);
      const faltam = Math.max(0, objetivo - ins.estoqueAtual);
      const custoEstimado = faltam * ins.custoUnitarioConsumo;
      return {
        insumo: ins,
        faltam,
        custoEstimado: Math.round(custoEstimado * 100) / 100,
      };
    });

  const custoTotalReposicao = itensParaReposicao.reduce((acc, it) => acc + it.custoEstimado, 0);

  const salvarAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteInsumoId) {
      setErroAjuste('Selecione o ingrediente a ajustar.');
      return;
    }
    if (ajusteQtd <= 0) {
      setErroAjuste('A quantidade deve ser maior que zero.');
      return;
    }
    if (!ajusteMotivo.trim()) {
      setErroAjuste('Informe a justificativa do descarte ou ajuste de contagem.');
      return;
    }

    const ins = insumos.find((i) => i.id === ajusteInsumoId);
    if (!ins) return;

    // Se for perda/descarte, quantidade é negativa
    const qtdReal = ajusteTipo === 'PERDA_DESCARTE' ? -ajusteQtd : ajusteQtd;

    registrarMovimentacaoEstoque(ins.id, ajusteTipo, qtdReal, ajusteMotivo.trim());
    setModalAjusteAberto(false);
    setAjusteInsumoId('');
    setAjusteQtd(0);
    setAjusteMotivo('');
    setErroAjuste('');
  };

  const exportarReposicaoCsv = () => {
    let csv = 'Insumo;Categoria;Unidade;Estoque Atual;Estoque Minimo;Qtd Necessaria Reposicao;Custo Estimado (R$)\n';
    for (const it of itensParaReposicao) {
      csv += `"${it.insumo.nome}";"${it.insumo.categoria}";"${it.insumo.unidadeConsumo}";${it.insumo.estoqueAtual};${it.insumo.estoqueMinimo};${it.faltam};${it.custoEstimado.toFixed(2)}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reposicao_dburger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const insumosFiltrados = insumos.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()));

  const movFiltradas = movimentacoesEstoque.filter((m) => {
    const matchTipo = filtroTipo === 'todos' || m.tipo === filtroTipo;
    const matchBusca = m.insumoNome.toLowerCase().includes(busca.toLowerCase());
    return matchTipo && matchBusca;
  });

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Controle de Estoque & Perdas</h2>
          <p className="text-xs text-zinc-400">
            Acompanhe o nível dos ingredientes, registro de perdas/descarte e lista de reposição para compras.
          </p>
        </div>

        <button
          onClick={() => {
            setModalAjusteAberto(true);
            setErroAjuste('');
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition active:scale-95"
        >
          <AlertCircle className="w-4 h-4" />
          <span>Lançar Perda / Ajuste</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-zinc-400 block mb-1">Insumos Cadastrados</span>
          <div className="text-2xl font-black text-white">{insumos.length}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Total de matérias-primas</p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-amber-400 block mb-1">Estoque Baixo</span>
          <div className="text-2xl font-black text-amber-400">{insumosEstoqueBaixo.length}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Abaixo do estoque mínimo</p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-red-400 block mb-1">Estoque Zerado</span>
          <div className="text-2xl font-black text-red-400">{insumosEstoqueZerado.length}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Lanches podem faltar</p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-emerald-400 block mb-1">Custo Total Reposição</span>
          <div className="text-2xl font-black text-emerald-400">{formatarMoeda(custoTotalReposicao)}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Estimado para reabastecer</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-zinc-800 gap-4">
        <button
          onClick={() => setAbaAtiva('geral')}
          className={`pb-3 text-xs font-bold transition border-b-2 ${
            abaAtiva === 'geral' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Visão Geral do Estoque
        </button>
        <button
          onClick={() => setAbaAtiva('reposicao')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
            abaAtiva === 'reposicao'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <span>Lista de Reposição</span>
          {itensParaReposicao.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-zinc-950 rounded-full text-[10px] font-black">
              {itensParaReposicao.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAbaAtiva('movimentacoes')}
          className={`pb-3 text-xs font-bold transition border-b-2 ${
            abaAtiva === 'movimentacoes'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Extrato de Movimentações
        </button>
      </div>

      {/* Conteúdo Aba 1: Geral */}
      {abaAtiva === 'geral' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar insumo no estoque..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insumosFiltrados.map((ins) => {
              const zerado = ins.estoqueAtual <= 0;
              const baixo = ins.estoqueAtual > 0 && ins.estoqueAtual <= ins.estoqueMinimo;

              return (
                <div
                  key={ins.id}
                  className={`p-4 rounded-2xl border transition ${
                    zerado
                      ? 'bg-red-950/20 border-red-800/60'
                      : baixo
                      ? 'bg-amber-950/20 border-amber-800/60'
                      : 'bg-zinc-900/80 border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-500">{ins.categoria}</span>
                      <h4 className="font-extrabold text-sm text-white mt-0.5">{ins.nome}</h4>
                    </div>
                    {zerado ? (
                      <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-full text-[10px] font-bold">
                        ZERADO
                      </span>
                    ) : baixo ? (
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-full text-[10px] font-bold">
                        BAIXO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full text-[10px] font-bold">
                        OK
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-end">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Estoque Atual</span>
                      <span className="font-black text-base text-white font-mono">
                        {ins.estoqueAtual.toLocaleString('pt-BR')} {ins.unidadeConsumo}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block">Mínimo Recomendado</span>
                      <span className="font-semibold text-xs text-zinc-400 font-mono">
                        {ins.estoqueMinimo.toLocaleString('pt-BR')} {ins.unidadeConsumo}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Lista de Reposição */}
      {abaAtiva === 'reposicao' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
            <div>
              <h3 className="font-bold text-sm text-white">Sugestão de Pedido para Fornecedores</h3>
              <p className="text-xs text-zinc-400">
                Itens que atingiram ou caíram abaixo da reserva mínima de segurança.
              </p>
            </div>
            {itensParaReposicao.length > 0 && (
              <button
                onClick={exportarReposicaoCsv}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>

          {itensParaReposicao.length === 0 ? (
            <div className="py-12 text-center text-emerald-400 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800 flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
              <span>Nenhum insumo precisando de reposição no momento! Estoque em nível seguro.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {itensParaReposicao.map(({ insumo, faltam, custoEstimado }) => (
                <div
                  key={insumo.id}
                  className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white">{insumo.nome}</h4>
                    <p className="text-xs text-zinc-400">
                      Atual: <span className="font-bold text-red-400">{insumo.estoqueAtual} {insumo.unidadeConsumo}</span> • Mínimo: {insumo.estoqueMinimo} {insumo.unidadeConsumo}
                    </p>
                    {insumo.fornecedorNome && (
                      <p className="text-[11px] text-amber-400/80 mt-0.5">Fornecedor: {insumo.fornecedorNome}</p>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-zinc-500 block">Comprar Pelo Menos:</span>
                    <span className="font-extrabold text-sm text-white font-mono">
                      +{faltam.toLocaleString('pt-BR')} {insumo.unidadeConsumo}
                    </span>
                    <span className="text-[11px] text-amber-400 font-mono block">
                      ~ {formatarMoeda(custoEstimado)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Aba 3: Movimentações */}
      {abaAtiva === 'movimentacoes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar no histórico por ingrediente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'SAIDA_VENDA', label: 'Vendas' },
                { id: 'ENTRADA_COMPRA', label: 'Compras' },
                { id: 'PERDA_DESCARTE', label: 'Perdas / Descarte' },
                { id: 'ESTORNO_VENDA', label: 'Estornos' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFiltroTipo(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    filtroTipo === t.id
                      ? 'bg-amber-500 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {movFiltradas.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800">
                Nenhuma movimentação registrada para os filtros selecionados.
              </div>
            ) : (
              movFiltradas.map((mov) => {
                const isEntrada = mov.quantidade > 0;
                return (
                  <div
                    key={mov.id}
                    className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isEntrada ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {isEntrada ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{mov.insumoNome}</span>
                        <span className="text-[11px] text-zinc-400">{mov.motivo}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-black font-mono block ${
                          isEntrada ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isEntrada ? '+' : ''}
                        {mov.quantidade} {mov.unidade}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(mov.dataHora).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Lançar Perda / Ajuste */}
      {modalAjusteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalAjusteAberto(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-base text-white">Lançar Descarte / Ajuste de Estoque</h3>
              <button
                onClick={() => setModalAjusteAberto(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={salvarAjuste} className="mt-4 space-y-4">
              {erroAjuste && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
                  {erroAjuste}
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Ingrediente *</label>
                <select
                  value={ajusteInsumoId}
                  onChange={(e) => setAjusteInsumoId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="">Selecione o ingrediente...</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} (Atual: {i.estoqueAtual} {i.unidadeConsumo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Tipo de Movimentação</label>
                <select
                  value={ajusteTipo}
                  onChange={(e) => setAjusteTipo(e.target.value as TipoMovimentacaoEstoque)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="PERDA_DESCARTE">Perda / Descarte / Vencimento (Baixa com impacto contábil)</option>
                  <option value="AJUSTE_MANUAL">Ajuste de Inventário / Contagem</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Quantidade a Descartar/Ajustar *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="Ex: 500 (em gramas ou unidades de consumo)"
                  value={ajusteQtd || ''}
                  onChange={(e) => setAjusteQtd(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Justificativa / Motivo *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Queima na chapa, pão amassado, vencimento de molho..."
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAjusteAberto(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
