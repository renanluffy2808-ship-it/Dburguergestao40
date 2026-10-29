import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Truck,
  Store,
  ExternalLink,
  RefreshCw,
  QrCode,
  CreditCard,
  Banknote,
  Send,
  Copy,
  ChevronDown,
  ChefHat,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PedidoVenda, StatusPedido, StatusPagamento } from '../types';
import { gerarMensagemPedidoWhatsapp, gerarLinkWhatsapp, formatarTelefoneVisual } from '../lib/whatsappFormatter';

export const PedidosOnlineAdminView: React.FC = () => {
  const { pedidos, config, atualizarStatusPedidoOnline, sincronizarPedidosOnline } = useApp();
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [atualizando, setAtualizando] = useState(false);
  const [pedidoExpandidoId, setPedidoExpandidoId] = useState<string | null>(null);

  // Sincronização automática contínua (a cada 5 segundos) e inicial
  useEffect(() => {
    sincronizarPedidosOnline();
    const interval = setInterval(() => {
      sincronizarPedidosOnline();
    }, 5000);
    return () => clearInterval(interval);
  }, [sincronizarPedidosOnline]);

  const cfg = config.pedidosPagamentos;

  // Filtrar apenas pedidos que possuem dados de cliente/online
  const pedidosOnline = pedidos.filter((p) => p.clienteNome || p.tipoAtendimento);

  const pedidosFiltrados = pedidosOnline.filter((p) => {
    if (filtroStatus === 'TODOS') return true;
    if (filtroStatus === 'AGUARDANDO_PAGAMENTO') return p.statusPagamento === 'AGUARDANDO' || p.statusPagamento === 'AGUARDANDO_PAGAMENTO';
    if (filtroStatus === 'PAGO') return p.statusPagamento === 'PAGO';
    return p.status === filtroStatus;
  });

  const handleAtualizarLista = async () => {
    setAtualizando(true);
    await sincronizarPedidosOnline();
    setAtualizando(false);
  };

  const mudarStatus = async (pedido: PedidoVenda, novoStatus: StatusPedido, novoStatusPagamento?: StatusPagamento) => {
    await atualizarStatusPedidoOnline(pedido.id, novoStatus, novoStatusPagamento);
  };

  const reenviarWhatsapp = (pedido: PedidoVenda) => {
    if (!cfg?.whatsappLoja) {
      alert('Configure o WhatsApp da loja na aba "Pagamentos e Pedidos" antes de enviar.');
      return;
    }
    const mensagem = gerarMensagemPedidoWhatsapp(pedido, cfg);
    const link = gerarLinkWhatsapp(cfg.whatsappLoja, mensagem);
    window.open(link, '_blank');
  };

  const getStatusBadge = (status: StatusPedido, statusPagamento?: StatusPagamento) => {
    if (statusPagamento === 'AGUARDANDO' || statusPagamento === 'AGUARDANDO_PAGAMENTO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-950/80 border border-cyan-600/50 text-cyan-300 flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" /> Aguardando Pix
        </span>
      );
    }
    if (status === 'PREPARANDO' || status === 'EM_PREPARO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 border border-amber-600/50 text-amber-300 flex items-center gap-1">
          <ChefHat className="w-3.5 h-3.5" /> Em Preparo
        </span>
      );
    }
    if (status === 'PRONTO' || status === 'PRONTO_RETIRADA' || status === 'DESPACHADO' || status === 'SAIU_ENTREGA') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950/80 border border-blue-600/50 text-blue-300 flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" /> Despachado / Pronto
        </span>
      );
    }
    if (status === 'CONCLUIDO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
        </span>
      );
    }
    if (status === 'CANCELADO') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/80 border border-rose-600/50 text-rose-300 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Cancelado
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-300">
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Gestão de Pedidos Web
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {pedidosOnline.length} pedidos recebidos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Pedidos Online & Delivery
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Acompanhe pedidos vindos do cardápio digital, verifique a aprovação do Pix e despache para a cozinha.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAtualizarLista}
            disabled={atualizando}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${atualizando ? 'animate-spin' : ''}`} />
            {atualizando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
        {[
          { id: 'TODOS', label: 'Todos os Pedidos' },
          { id: 'AGUARDANDO_PAGAMENTO', label: 'Aguardando Pix' },
          { id: 'CONFIRMADO', label: 'Confirmados' },
          { id: 'PREPARANDO', label: 'Em Preparo' },
          { id: 'DESPACHADO', label: 'Despachados / Prontos' },
          { id: 'CONCLUIDO', label: 'Concluídos' },
          { id: 'CANCELADO', label: 'Cancelados' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroStatus(f.id)}
            className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${filtroStatus === f.id ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de Pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="font-extrabold text-base text-white">Nenhum pedido encontrado nesta categoria</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Assim que clientes montarem e confirmarem pedidos pelo Cardápio Digital público, eles aparecerão automaticamente aqui com todos os detalhes e status do Pix.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => {
            const expandido = pedidoExpandidoId === pedido.id;
            const isEntrega = pedido.tipoAtendimento === 'ENTREGA';

            return (
              <div
                key={pedido.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden transition shadow-sm hover:border-zinc-700"
              >
                {/* Cabeçalho do Card */}
                <div
                  onClick={() => setPedidoExpandidoId(expandido ? null : pedido.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-zinc-900 hover:bg-zinc-850/60 transition"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-amber-400 shrink-0 text-sm">
                      #{pedido.numero ?? pedido.numeroPedido}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-base">
                          {pedido.clienteNome || 'Cliente Anônimo'}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          {pedido.clienteTelefone ? formatarTelefoneVisual(pedido.clienteTelefone) : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-zinc-300">
                          {isEntrega ? (
                            <>
                              <Truck className="w-3.5 h-3.5 text-amber-400" /> Entrega
                            </>
                          ) : (
                            <>
                              <Store className="w-3.5 h-3.5 text-emerald-400" /> Retirada no Local
                            </>
                          )}
                        </span>
                        <span>•</span>
                        <span>{new Date(pedido.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{pedido.itens.reduce((acc, i) => acc + i.quantidade, 0)} itens</span>
                        <span>•</span>
                        <span className="font-bold text-amber-400 font-mono">
                          R$ {pedido.valorFinal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(pedido.status, pedido.statusPagamento)}
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                        {pedido.formaPagamento}
                      </span>
                    </div>

                    <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Conteúdo Expandido com Ações e Detalhes */}
                {expandido && (
                  <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-950/70 space-y-5 text-xs">
                    {/* Bloco de Endereço ou Retirada */}
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-white">
                        {isEntrega ? (
                          <>
                            <MapPin className="w-4 h-4 text-amber-400" />
                            <span>Endereço de Entrega:</span>
                          </>
                        ) : (
                          <>
                            <Store className="w-4 h-4 text-emerald-400" />
                            <span>Modalidade: RETIRADA NO LOCAL</span>
                          </>
                        )}
                      </div>

                      {isEntrega && pedido.enderecoEntrega ? (
                        <p className="text-zinc-300 leading-relaxed pl-6">
                          {pedido.enderecoEntrega.rua}, {pedido.enderecoEntrega.numero}
                          {pedido.enderecoEntrega.complemento ? ` (${pedido.enderecoEntrega.complemento})` : ''} -{' '}
                          {pedido.enderecoEntrega.bairro}, {pedido.enderecoEntrega.cidade}
                          {pedido.enderecoEntrega.referencia && (
                            <span className="block text-zinc-400 text-[11px] mt-0.5">
                              Ref: {pedido.enderecoEntrega.referencia}
                            </span>
                          )}
                        </p>
                      ) : !isEntrega ? (
                        <p className="text-zinc-400 pl-6 text-[11px]">
                          O cliente irá retirar no balcão da loja. Nenhuma taxa de entrega cobrada.
                        </p>
                      ) : null}

                      {(pedido.observacoesGerais || pedido.observacoes) && (
                        <div className="pt-2 border-t border-zinc-800 mt-2 pl-6">
                          <span className="font-semibold text-zinc-400">Observações gerais: </span>
                          <span className="text-amber-300 italic">{pedido.observacoesGerais || pedido.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {/* Itens do Pedido */}
                    <div className="space-y-2">
                      <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                        Itens Solicitados
                      </span>
                      <div className="divide-y divide-zinc-800/80 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                        {pedido.itens.map((it, idx) => (
                          <div key={idx} className="py-2 first:pt-0 last:pb-0 flex justify-between">
                            <div>
                              <span className="font-bold text-zinc-100">
                                {it.quantidade}x {it.nomeProduto || it.nome}
                              </span>
                              {it.pontoCarne && (
                                <p className="text-[11px] text-zinc-400">• Ponto: {it.pontoCarne}</p>
                              )}
                              {it.adicionais && it.adicionais.length > 0 && (
                                <p className="text-[11px] text-amber-400">
                                  + {it.adicionais.map((a) => a.nome).join(', ')}
                                </p>
                              )}
                              {(it.observacoes || it.observacaoItem) && (
                                <p className="text-[11px] text-zinc-300 italic">Obs: {it.observacoes || it.observacaoItem}</p>
                              )}
                            </div>
                            <span className="font-mono font-bold text-zinc-200">
                              R$ {(it.precoTotal ?? it.subtotal ?? 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Informações Financeiras */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Subtotal Itens</span>
                        <span className="font-mono font-bold text-zinc-200">
                          R$ {(pedido.valorBruto ?? pedido.subtotal ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Taxa de Entrega</span>
                        <span className="font-mono font-bold text-zinc-200">
                          R$ {(pedido.taxaEntrega || 0).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Total Final</span>
                        <span className="font-mono font-extrabold text-amber-400 text-sm">
                          R$ {pedido.valorFinal.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Pagamento / Troco</span>
                        <span className="font-semibold text-zinc-300">
                          {pedido.formaPagamento}
                          {pedido.precisaTroco && pedido.trocoPara ? ` (Troco p/ R$ ${pedido.trocoPara.toFixed(2)})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação de Mudança de Status */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {pedido.status !== 'EM_PREPARO' && pedido.status !== 'PREPARANDO' && (
                          <button
                            type="button"
                            onClick={() => mudarStatus(pedido, 'EM_PREPARO')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <ChefHat className="w-3.5 h-3.5" /> Iniciar Preparo
                          </button>
                        )}

                        {pedido.status !== 'DESPACHADO' && pedido.status !== 'SAIU_ENTREGA' && (
                          <button
                            type="button"
                            onClick={() => mudarStatus(pedido, isEntrega ? 'SAIU_ENTREGA' : 'PRONTO_RETIRADA')}
                            className="px-3 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <Truck className="w-3.5 h-3.5" /> {isEntrega ? 'Despachar Entrega' : 'Pronto p/ Retirada'}
                          </button>
                        )}

                        {pedido.status !== 'CONCLUIDO' && (
                          <button
                            type="button"
                            onClick={() => mudarStatus(pedido, 'CONCLUIDO')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Concluir Pedido
                          </button>
                        )}

                        {pedido.status !== 'CANCELADO' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Deseja realmente cancelar este pedido?')) {
                                mudarStatus(pedido, 'CANCELADO');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/40 text-xs font-bold transition"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => reenviarWhatsapp(pedido)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
                      >
                        <Send className="w-3.5 h-3.5" /> Reenviar no WhatsApp
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
