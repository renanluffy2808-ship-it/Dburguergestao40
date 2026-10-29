import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  PieChart,
  Coins,
  History,
  TrendingDown,
  Building,
  Trash2,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CategoriaCaixa, LancamentoCaixa } from '../types';

export const CaixaView: React.FC = () => {
  const { lancamentosCaixa, adicionarLancamentoManual, excluirLancamentoCaixa, zerarCaixaEVendas, indicadores, config } = useApp();
  const [modalLancamento, setModalLancamento] = useState(false);
  const [modalZerarCaixa, setModalZerarCaixa] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<LancamentoCaixa | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [msgSucesso, setMsgSucesso] = useState('');

  // Form Manual
  const [formTipo, setFormTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA');
  const [formCategoria, setFormCategoria] = useState<CategoriaCaixa>('DESPESA_PAGA');
  const [formValor, setFormValor] = useState<number>(0);
  const [formDescricao, setFormDescricao] = useState('');
  const [erroForm, setErroForm] = useState('');

  const salvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (formValor <= 0) {
      setErroForm('O valor deve ser maior que zero.');
      return;
    }
    if (!formDescricao.trim()) {
      setErroForm('Informe a descrição do lançamento.');
      return;
    }

    // Alerta se o usuário tentar retirar mais dinheiro do que o caixa livre
    if (formCategoria === 'RETIRADA_PRO_LABORE' && formValor > indicadores.saldoCaixaLivre) {
      if (
        !confirm(
          `Atenção: A retirada de R$ ${formValor.toFixed(
            2
          )} é maior que o Saldo Livre disponível (R$ ${indicadores.saldoCaixaLivre.toFixed(
            2
          )}). Isso usará dinheiro comprometido com reposição de estoque ou reserva de contas fixas. Deseja continuar mesmo assim?`
        )
      ) {
        return;
      }
    }

    adicionarLancamentoManual({
      tipo: formTipo,
      categoria: formCategoria,
      valor: formValor,
      descricao: formDescricao.trim(),
    });

    setModalLancamento(false);
    setFormValor(0);
    setFormDescricao('');
    setErroForm('');
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Somatórias por Categoria
  const totalRecebimentos = lancamentosCaixa
    .filter((l) => l.categoria === 'RECEBIMENTO_VENDA' && l.tipo === 'ENTRADA')
    .reduce((acc, l) => acc + l.valor, 0);

  const totalComprasInsumos = lancamentosCaixa
    .filter((l) => l.categoria === 'REPOSICAO_ESTOQUE' && l.tipo === 'SAIDA')
    .reduce((acc, l) => acc + l.valor, 0);

  const totalDespesasFixas = lancamentosCaixa
    .filter((l) => l.categoria === 'DESPESA_PAGA' && l.tipo === 'SAIDA')
    .reduce((acc, l) => acc + l.valor, 0);

  const totalTaxas = lancamentosCaixa
    .filter((l) => l.categoria === 'TAXA_PAGAMENTO' && l.tipo === 'SAIDA')
    .reduce((acc, l) => acc + l.valor, 0);

  const totalRetiradas = lancamentosCaixa
    .filter((l) => l.categoria === 'RETIRADA_PRO_LABORE' && l.tipo === 'SAIDA')
    .reduce((acc, l) => acc + l.valor, 0);

  const lancamentosFiltrados = lancamentosCaixa.filter(
    (l) => filtroCategoria === 'todas' || l.categoria === filtroCategoria
  );

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Fluxo de Caixa & Destinação do Dinheiro</h2>
          <p className="text-xs text-zinc-400">
            Regra de ouro: não confunda faturamento com lucro disponível para gastar!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setModalZerarCaixa(true)}
            className="px-3.5 py-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Zerar todas as vendas e movimentações de caixa para iniciar com R$ 0,00"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            <span>Zerar Caixa (R$ 0,00)</span>
          </button>

          <button
            onClick={() => {
              setModalLancamento(true);
              setErroForm('');
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento / Despesa</span>
          </button>
        </div>
      </div>

      {msgSucesso && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {/* Cards de Destinação Real */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Saldo Bruto */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-xs font-semibold uppercase">Saldo Total em Caixa</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-white">{formatarMoeda(indicadores.saldoCaixaTotal)}</div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Dinheiro físico + conta bancária atual.
          </p>
        </div>

        {/* Card 2: Comprometido */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="text-xs font-semibold uppercase">Compromissos Blindados</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {formatarMoeda(indicadores.dinheiroComprometidoReposicao + indicadores.dinheiroAcumuladoReserva)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Reposição ({formatarMoeda(indicadores.dinheiroComprometidoReposicao)}) + Reserva ({formatarMoeda(indicadores.dinheiroAcumuladoReserva)})
          </p>
        </div>

        {/* Card 3: Caixa Livre Real */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="text-xs font-bold uppercase">Saldo Livre Seguro</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {formatarMoeda(indicadores.saldoCaixaLivre)}
          </div>
          <p className="text-[11px] text-emerald-300/80 mt-1">
            Lucro disponível para retirada sem quebrar a operação.
          </p>
        </div>
      </div>

      {/* Categorias de Destinação */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
        <h3 className="font-extrabold text-sm text-white mb-3">Totais Acumulados por Categoria</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">Vendas Recebidas</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">{formatarMoeda(totalRecebimentos)}</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">Insumos Comprados</span>
            <span className="font-bold text-rose-400 font-mono text-sm">{formatarMoeda(totalComprasInsumos)}</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">Despesas Fixas Pagas</span>
            <span className="font-bold text-amber-400 font-mono text-sm">{formatarMoeda(totalDespesasFixas)}</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">Taxas Maquininha</span>
            <span className="font-bold text-zinc-400 font-mono text-sm">{formatarMoeda(totalTaxas)}</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">Pró-labore Retirado</span>
            <span className="font-bold text-purple-400 font-mono text-sm">{formatarMoeda(totalRetiradas)}</span>
          </div>
        </div>
      </div>

      {/* Extrato com Filtro */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="font-extrabold text-sm text-white">Extrato Detalhado do Caixa</h3>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
            {[
              { id: 'todas', label: 'Todos' },
              { id: 'RECEBIMENTO_VENDA', label: 'Vendas' },
              { id: 'REPOSICAO_ESTOQUE', label: 'Compras Insumos' },
              { id: 'DESPESA_PAGA', label: 'Contas/Despesas' },
              { id: 'RETIRADA_PRO_LABORE', label: 'Pró-Labore' },
              { id: 'TAXA_PAGAMENTO', label: 'Taxas' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  filtroCategoria === cat.id
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {lancamentosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800">
              Nenhum lançamento registrado nesta categoria.
            </div>
          ) : (
            lancamentosFiltrados.map((lanc) => {
              const isEntrada = lanc.tipo === 'ENTRADA';

              return (
                <div
                  key={lanc.id}
                  className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between text-xs transition"
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
                      <span className="font-bold text-white block">{lanc.descricao}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(lanc.dataHora).toLocaleString('pt-BR')} • {lanc.categoria}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black font-mono text-sm ${
                        isEntrada ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isEntrada ? '+' : '-'} {formatarMoeda(lanc.valor)}
                    </span>
                    <button
                      onClick={() => setLancamentoParaExcluir(lanc)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                      title="Excluir Lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Novo Lançamento Manual / Despesa */}
      {modalLancamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalLancamento(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-base text-white">Novo Lançamento de Caixa</h3>
              <button
                onClick={() => setModalLancamento(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={salvarLancamento} className="mt-4 space-y-4">
              {erroForm && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
                  {erroForm}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormTipo('SAIDA')}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    formTipo === 'SAIDA'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  Saída / Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setFormTipo('ENTRADA')}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    formTipo === 'ENTRADA'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  Entrada / Aporte
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Categoria Contábil</label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value as CategoriaCaixa)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                >
                  <option value="DESPESA_PAGA">Despesa Fixa/Variável (Gás, Luz, Água, Internet)</option>
                  <option value="RETIRADA_PRO_LABORE">Retirada do Proprietário (Pró-Labore)</option>
                  <option value="REPOSICAO_ESTOQUE">Compra Direta de Insumos</option>
                  <option value="RECEBIMENTO_VENDA">Recebimento de Venda Avulsa</option>
                  <option value="OUTROS">Outras Movimentações / Aporte de Capital</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={formValor || ''}
                  onChange={(e) => setFormValor(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Descrição / Finalidade *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conta de gás industrial de outubro, retirada pessoal..."
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalLancamento(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold rounded-xl text-xs shadow-md shadow-amber-500/20"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação Zerar Caixa */}
      {modalZerarCaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalZerarCaixa(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-zinc-800">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Zerar Saldo e Movimentações do Caixa</h3>
            </div>

            <p className="mt-4 text-xs text-zinc-300 leading-relaxed">
              Deseja realmente zerar todo o histórico de vendas e lançamentos de caixa?
              <br /><br />
              • O saldo total passará a ser exatamente <strong className="text-white">R$ 0,00</strong>.
              <br />
              • Os seus insumos e o seu cardápio cadastrados <strong className="text-emerald-400">serão mantidos intactos</strong>.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalZerarCaixa(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  zerarCaixaEVendas();
                  setModalZerarCaixa(false);
                  setMsgSucesso('Caixa zerado com sucesso! Saldo agora é R$ 0,00.');
                  setTimeout(() => setMsgSucesso(''), 3000);
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Sim, Zerar Caixa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Lançamento */}
      {lancamentoParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setLancamentoParaExcluir(null)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-zinc-800">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Excluir Lançamento</h3>
            </div>

            <p className="mt-4 text-xs text-zinc-300 leading-relaxed">
              Deseja excluir o lançamento <strong className="text-white">"{lancamentoParaExcluir.descricao}"</strong> no valor de <strong className="text-amber-400 font-mono">{formatarMoeda(lancamentoParaExcluir.valor)}</strong>?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLancamentoParaExcluir(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  excluirLancamentoCaixa(lancamentoParaExcluir.id);
                  setLancamentoParaExcluir(null);
                  setMsgSucesso('Lançamento removido do extrato!');
                  setTimeout(() => setMsgSucesso(''), 2500);
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
