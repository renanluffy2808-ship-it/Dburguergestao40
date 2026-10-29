import React, { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
  DollarSign,
  History,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FormaPagamento, PedidoVenda } from '../types';

export const PdvView: React.FC = () => {
  const { produtos, pedidos, finalizarPedidoVenda, cancelarPedidoVenda, config, calcularCmvProduto } = useApp();

  // Carrinho de Venda
  const [carrinho, setCarrinho] = useState<Array<{ produtoId: string; quantidade: number }>>([]);
  const [desconto, setDesconto] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [observacoes, setObservacoes] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [abaPdv, setAbaPdv] = useState<'caixa' | 'pedidos'>('caixa');

  // Cancelamento
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<PedidoVenda | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [erroCancelamento, setErroCancelamento] = useState('');

  // Mensagens
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [mensagemErro, setMensagemErro] = useState('');

  // Adicionar produto ao carrinho
  const adicionarAoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => {
      const index = prev.findIndex((item) => item.produtoId === produtoId);
      if (index >= 0) {
        const novos = [...prev];
        novos[index].quantidade += 1;
        return novos;
      }
      return [...prev, { produtoId, quantidade: 1 }];
    });
  };

  const alterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho((prev) => {
      return prev
        .map((item) => {
          if (item.produtoId === produtoId) {
            const novaQtd = item.quantidade + delta;
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ produtoId: string; quantidade: number }>;
    });
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produtoId !== produtoId));
  };

  const limparCarrinho = () => {
    setCarrinho([]);
    setDesconto(0);
    setObservacoes('');
  };

  // Cálculos do Carrinho
  let subtotal = 0;
  let cmvTotal = 0;
  for (const item of carrinho) {
    const prod = produtos.find((p) => p.id === item.produtoId);
    if (prod) {
      subtotal += prod.precoVenda * item.quantidade;
      cmvTotal += calcularCmvProduto(prod) * item.quantidade;
    }
  }

  const valorFinal = Math.max(0, subtotal - desconto);

  // Taxa do pagamento
  let taxaPercent = 0;
  if (formaPagamento === 'pix' || formaPagamento === 'dinheiro') {
    taxaPercent = config.taxaPix;
  } else if (formaPagamento === 'debito') {
    taxaPercent = config.taxaDebito;
  } else if (formaPagamento === 'credito') {
    taxaPercent = config.taxaCredito;
  }

  const valorTaxa = Math.round(((valorFinal * taxaPercent) / 100) * 100) / 100;
  const valorLiquido = Math.round((valorFinal - valorTaxa) * 100) / 100;
  const reservaOperacional = Math.round(((valorFinal * config.reservaOperacionalPercent) / 100) * 100) / 100;
  const lucroEstimado = Math.round((valorFinal - cmvTotal - valorTaxa - reservaOperacional) * 100) / 100;

  const confirmarVenda = () => {
    if (carrinho.length === 0) {
      setMensagemErro('Adicione pelo menos um lanche ao pedido.');
      return;
    }

    const res = finalizarPedidoVenda({
      itens: carrinho,
      desconto,
      formaPagamento,
      observacoes,
    });

    if (res.sucesso) {
      setMensagemSucesso('Pedido concluído com sucesso! Estoque baixado e caixa atualizado.');
      limparCarrinho();
      setTimeout(() => {
        setMensagemSucesso('');
      }, 2500);
    } else {
      setMensagemErro(res.erro || 'Erro ao registrar venda.');
    }
  };

  const executarCancelamento = () => {
    if (!pedidoParaCancelar) return;
    if (!motivoCancelamento.trim()) {
      setErroCancelamento('Informe o motivo do cancelamento para auditoria.');
      return;
    }

    const res = cancelarPedidoVenda(pedidoParaCancelar.id, motivoCancelamento.trim());
    if (res.sucesso) {
      setPedidoParaCancelar(null);
      setMotivoCancelamento('');
      setErroCancelamento('');
      setMensagemSucesso('Pedido cancelado e insumos estornados no estoque!');
      setTimeout(() => setMensagemSucesso(''), 2500);
    } else {
      setErroCancelamento(res.erro || 'Erro ao estornar pedido.');
    }
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const produtosAtivos = produtos.filter((p) => p.ativo);
  const produtosFiltrados = produtosAtivos.filter(
    (p) => categoriaFiltro === 'todas' || p.categoria === categoriaFiltro
  );

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 pt-4">
      {/* Header com Abas PDV / Histórico */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Ponto de Venda (PDV Rápido)</h2>
          <p className="text-xs text-zinc-400">
            Operação rápida pensada para celular com 1 mão. Baixa automática na ficha técnica a cada venda.
          </p>
        </div>

        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setAbaPdv('caixa')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              abaPdv === 'caixa' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Caixa / Vender
          </button>
          <button
            onClick={() => setAbaPdv('pedidos')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              abaPdv === 'pedidos' ? 'bg-amber-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Últimos Pedidos ({pedidos.length})</span>
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {abaPdv === 'caixa' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Vitrine de Lanches (Mobile-First Big Touch) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Categorias */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {['todas', 'Simples', 'Artesanal', 'Smash', 'Adicionais', 'Bebidas'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    categoriaFiltro === cat
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {cat === 'todas' ? 'Todos os Lanches' : cat}
                </button>
              ))}
            </div>

            {/* Grid de Lanches para Toque Rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {produtosFiltrados.map((prod) => {
                const itemNoCarrinho = carrinho.find((i) => i.produtoId === prod.id);

                return (
                  <button
                    key={prod.id}
                    onClick={() => adicionarAoCarrinho(prod.id)}
                    className="p-3 bg-zinc-900/90 hover:bg-zinc-800/90 active:scale-95 border border-zinc-800 rounded-2xl flex flex-col justify-between text-left transition group relative shadow-sm min-h-[105px]"
                  >
                    {itemNoCarrinho && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-zinc-950 rounded-full text-xs font-black shadow-md">
                        {itemNoCarrinho.quantidade}
                      </span>
                    )}

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 block">
                        {prod.categoria}
                      </span>
                      <h4 className="font-extrabold text-xs text-white mt-1 leading-snug group-hover:text-amber-400 transition">
                        {prod.nome}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-black text-sm text-white font-mono">
                        {formatarMoeda(prod.precoVenda)}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-zinc-800 group-hover:bg-amber-500 group-hover:text-black flex items-center justify-center text-zinc-400 transition">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Carrinho e Fechamento de Venda */}
          <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-base text-white">Pedido em Aberto</h3>
                </div>
                {carrinho.length > 0 && (
                  <button
                    onClick={limparCarrinho}
                    className="text-xs text-zinc-500 hover:text-red-400 transition"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Lista de Itens no Carrinho */}
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                {carrinho.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs">
                    Toque nos lanches ao lado para adicionar ao pedido.
                  </div>
                ) : (
                  carrinho.map((item) => {
                    const prod = produtos.find((p) => p.id === item.produtoId);
                    if (!prod) return null;
                    const sub = prod.precoVenda * item.quantidade;

                    return (
                      <div
                        key={item.produtoId}
                        className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="font-bold text-white block truncate">{prod.nome}</span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {formatarMoeda(prod.precoVenda)} unid.
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => alterarQuantidade(item.produtoId, -1)}
                            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-black text-xs text-white min-w-4 text-center font-mono">
                            {item.quantidade}
                          </span>
                          <button
                            onClick={() => alterarQuantidade(item.produtoId, 1)}
                            className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <span className="font-black text-xs text-amber-400 font-mono block">
                            {formatarMoeda(sub)}
                          </span>
                          <button
                            onClick={() => removerDoCarrinho(item.produtoId)}
                            className="text-[10px] text-zinc-500 hover:text-red-400"
                          >
                            remover
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Forma de Pagamento */}
              <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-300 block">Forma de Pagamento</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormaPagamento('pix')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                      formaPagamento === 'pix'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>PIX (0% taxa)</span>
                  </button>

                  <button
                    onClick={() => setFormaPagamento('dinheiro')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                      formaPagamento === 'dinheiro'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Dinheiro (0%)</span>
                  </button>

                  <button
                    onClick={() => setFormaPagamento('debito')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                      formaPagamento === 'debito'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Débito ({config.taxaDebito}%)</span>
                  </button>

                  <button
                    onClick={() => setFormaPagamento('credito')}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                      formaPagamento === 'credito'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Crédito ({config.taxaCredito}%)</span>
                  </button>
                </div>
              </div>

              {/* Desconto */}
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400 font-medium">Desconto Comercial (R$):</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={desconto || ''}
                  placeholder="0,00"
                  onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-right text-xs text-white font-mono font-bold"
                />
              </div>

              {/* Destinação Contábil Transparente */}
              <div className="mt-4 p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-white">{formatarMoeda(subtotal)}</span>
                </div>
                {desconto > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Desconto Aplicado:</span>
                    <span className="font-mono">-{formatarMoeda(desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-300 pt-1 border-t border-zinc-800">
                  <span className="font-bold">Total a Cobrar:</span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    {formatarMoeda(valorFinal)}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 space-y-1 text-[10px]">
                  <div className="flex justify-between text-rose-400">
                    <span>• Reposição de Insumos (CMV Ficha):</span>
                    <span className="font-mono">{formatarMoeda(cmvTotal)}</span>
                  </div>
                  <div className="flex justify-between text-blue-400">
                    <span>• Reserva Operacional ({config.reservaOperacionalPercent}%):</span>
                    <span className="font-mono">{formatarMoeda(reservaOperacional)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>• Taxa Maquininha ({taxaPercent}%):</span>
                    <span className="font-mono">{formatarMoeda(valorTaxa)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold pt-0.5">
                    <span>• Lucro Livre Estimado:</span>
                    <span className="font-mono">{formatarMoeda(lucroEstimado)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão Finalizar Venda */}
            <div className="mt-4">
              <button
                onClick={confirmarVenda}
                disabled={carrinho.length === 0}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-zinc-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>CONFIRMAR VENDA ({formatarMoeda(valorFinal)})</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Aba de Histórico de Pedidos e Estornos */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
            <div>
              <h3 className="font-bold text-sm text-white">Histórico de Pedidos Registrados</h3>
              <p className="text-xs text-zinc-400">
                Cancelamentos de pedidos realizam estorno automático e auditável no estoque e no caixa.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pedidos.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800">
                Nenhum pedido registrado no histórico.
              </div>
            ) : (
              pedidos.map((ped) => (
                <div
                  key={ped.id}
                  className={`p-4 rounded-2xl border transition ${
                    ped.status === 'CANCELADO'
                      ? 'bg-red-950/20 border-red-800/40 opacity-70'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white font-mono">
                          Pedido #{ped.numeroPedido}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ped.status === 'CONCLUIDO'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {ped.status}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase bg-zinc-800 px-2 py-0.5 rounded">
                          {ped.formaPagamento}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(ped.dataHora).toLocaleString('pt-BR')} • {ped.itens.length} lanches
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-zinc-500 block">Total Cobrado</span>
                        <span className="font-black text-sm text-amber-400 font-mono">
                          {formatarMoeda(ped.valorFinal)}
                        </span>
                      </div>

                      {ped.status === 'CONCLUIDO' && (
                        <button
                          onClick={() => {
                            setPedidoParaCancelar(ped);
                            setMotivoCancelamento('');
                            setErroCancelamento('');
                          }}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-red-950 hover:text-red-400 text-zinc-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Estornar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalhe dos lanches vendidos no pedido */}
                  <div className="mt-3 pt-3 border-t border-zinc-800/60 flex flex-wrap gap-2 text-[11px] text-zinc-300">
                    {ped.itens.map((it, idx) => (
                      <span key={idx} className="bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                        {it.quantidade}x {it.nome}
                      </span>
                    ))}
                  </div>

                  {ped.status === 'CANCELADO' && ped.motivoCancelamento && (
                    <div className="mt-2 text-[11px] text-red-400/90 font-medium">
                      Motivo do Cancelamento: {ped.motivoCancelamento}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Cancelamento e Estorno de Pedido */}
      {pedidoParaCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setPedidoParaCancelar(null)}
          />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-base text-white">
                Estornar Pedido #{pedidoParaCancelar.numeroPedido}
              </h3>
              <button
                onClick={() => setPedidoParaCancelar(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-zinc-300">
              <p>
                O cancelamento fará a <strong className="text-white">reversão imediata dos insumos</strong> no estoque
                da hamburgueria e registrará uma saída de estorno financeiro no valor de{' '}
                <strong className="text-amber-400">{formatarMoeda(pedidoParaCancelar.valorFinal)}</strong>.
              </p>

              {erroCancelamento && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
                  {erroCancelamento}
                </div>
              )}

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  Motivo do Estorno (Auditoria Obrigatória) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Cliente desistiu, erro na chapa, troco incorreto..."
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPedidoParaCancelar(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={executarCancelamento}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/20"
                >
                  Confirmar Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
