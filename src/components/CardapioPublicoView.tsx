import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  MapPin,
  Clock,
  Phone,
  User,
  Truck,
  Store,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Utensils,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import {
  ProdutoCardapio,
  ItemPedido,
  AdicionalItem,
  ConfiguracaoPedidosPagamentos,
  CategoriaCardapio,
  AdicionalCardapio,
  CardapioThemeConfig,
} from '../types';
import { TEMA_CARDAPIO_PADRAO } from '../data/initialData';
import {
  obterLojaIdAtual,
  getLojaHeader,
  apiUrl,
  gerarUrlAcompanhamentoPedido,
  isAndroidApp,
} from '../lib/lojaId';
import { gerarMensagemPedidoWhatsapp, gerarLinkWhatsapp, formatarTelefoneVisual } from '../lib/whatsappFormatter';

interface Props {
  onVoltarPainel?: () => void;
  isAdmin?: boolean;
}

const PONTOS_CARNE = [
  'Ao ponto da casa (suculento e rosado)',
  'Bem passado (sem ponto rosado)',
  'Ao ponto para mal',
  'Mal passado',
];

export const CardapioPublicoView: React.FC<Props> = ({ onVoltarPainel, isAdmin = false }) => {
  // Carregamento de dados públicos
  const [configLoja, setConfigLoja] = useState<{
    nomeHamburgueria: string;
    pedidosPagamentos: ConfiguracaoPedidosPagamentos;
    cardapioTheme?: CardapioThemeConfig;
    estabelecimentoId?: string;
    slugLoja?: string;
  } | null>(null);

  const [produtos, setProdutos] = useState<ProdutoCardapio[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<CategoriaCardapio[]>([]);
  const [adicionaisLista, setAdicionaisLista] = useState<AdicionalCardapio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('TODOS');

  // Modal de Personalização do Item
  const [produtoModal, setProdutoModal] = useState<ProdutoCardapio | null>(null);
  const [modalQtd, setModalQtd] = useState<number>(1);
  const [modalPontoCarne, setModalPontoCarne] = useState<string>('Ao ponto da casa (suculento e rosado)');
  // Mapa de quantidades de cada adicional para o item atual: { [adicionalId]: quantidade }
  const [modalAdicionaisQtd, setModalAdicionaisQtd] = useState<Record<string, number>>({});
  const [modalObservacoes, setModalObservacoes] = useState<string>('');

  // Carrinho
  const [carrinho, setCarrinho] = useState<ItemPedido[]>([]);
  const [drawerCarrinhoAberto, setDrawerCarrinhoAberto] = useState(false);

  // Modal de Checkout
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [tipoAtendimento, setTipoAtendimento] = useState<'ENTREGA' | 'RETIRADA'>('ENTREGA');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [endereco, setEndereco] = useState({
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    complemento: '',
    referencia: '',
  });
  const [observacoesPedido, setObservacoesPedido] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CARTAO' | 'DINHEIRO'>('PIX');
  const [precisaTroco, setPrecisaTroco] = useState(false);
  const [trocoPara, setTrocoPara] = useState<string>('');
  const [errosCheckout, setErrosCheckout] = useState<string[]>([]);
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  // Tela de Pedido Confirmado / Acompanhamento Pix
  const [pedidoConfirmado, setPedidoConfirmado] = useState<{
    pedido: any;
    token: string;
    pixData?: {
      chargeId: string;
      qrCodeBase64?: string;
      qrCode?: string;
      copiaECola?: string;
      status: string;
      expiraEm?: string;
    };
  } | null>(null);

  const [copiadoPix, setCopiadoPix] = useState(false);
  const [consultandoPix, setConsultandoPix] = useState(false);
  const [pixStatus, setPixStatus] = useState<string>('AGUARDANDO_PAGAMENTO');
  const [simulandoAprovacao, setSimulandoAprovacao] = useState(false);

  // Buscar dados públicos e persistentes do servidor (com fallback local seguro)
  const carregarDadosCardapio = async () => {
    try {
      const lojaId = obterLojaIdAtual();
      const [resConfig, resCardapio] = await Promise.all([
        fetch(apiUrl(`/api/config/public?loja=${lojaId}`), { headers: getLojaHeader() }),
        fetch(apiUrl(`/api/cardapio?loja=${lojaId}`), { headers: getLojaHeader() }),
      ]);

      if (resConfig.ok) {
        const dataCfg = await resConfig.json();
        setConfigLoja(dataCfg);
        if (!dataCfg.pedidosPagamentos?.permiteEntrega && dataCfg.pedidosPagamentos?.permiteRetirada) {
          setTipoAtendimento('RETIRADA');
        }
      }

      if (resCardapio.ok) {
        const dataCardapio = await resCardapio.json();
        if (Array.isArray(dataCardapio)) {
          setProdutos(dataCardapio);
        } else if (dataCardapio && typeof dataCardapio === 'object') {
          setProdutos(dataCardapio.produtos || []);
          if (Array.isArray(dataCardapio.categorias)) {
            setCategoriasLista(dataCardapio.categorias);
          }
          if (Array.isArray(dataCardapio.adicionais)) {
            setAdicionaisLista(dataCardapio.adicionais);
          }
        }
      } else {
        // Fallback para itens locais salvos se o servidor não retornou
        try {
          const prodsSalvos = localStorage.getItem('DBURGER_GESTAO_CARDAPIO_OFFLINE');
          if (prodsSalvos) {
            const parsed = JSON.parse(prodsSalvos);
            if (Array.isArray(parsed) && parsed.length > 0) setProdutos(parsed);
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Erro ao carregar cardápio online, carregando cópia local:', e);
      try {
        const prodsSalvos = localStorage.getItem('DBURGER_GESTAO_CARDAPIO_OFFLINE');
        if (prodsSalvos) {
          const parsed = JSON.parse(prodsSalvos);
          if (Array.isArray(parsed) && parsed.length > 0) setProdutos(parsed);
        }
      } catch {}
    } finally {
      setCarregando(false);
    }
  };

  // Carrega status de pedido para acompanhamento pelo link do cliente
  const carregarAcompanhamentoPedido = async (tokenOuNumero: string) => {
    try {
      const res = await fetch(apiUrl(`/api/pedidos/status/${encodeURIComponent(tokenOuNumero)}`), {
        headers: getLojaHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        const ped = data.pedido || (data.id ? data : null);
        if (ped) {
          setPedidoConfirmado({
            pedido: ped,
            token: ped.tokenPublico || tokenOuNumero,
            pixData: data.cobrancaPix || ped.pix,
          });
          setPixStatus(ped.statusPagamento || 'AGUARDANDO_PAGAMENTO');
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar acompanhamento do pedido:', e);
    }
  };

  useEffect(() => {
    carregarDadosCardapio();

    // Rastreamento automático se o link recebido no WhatsApp contiver ?token= ou ?pedido=
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || params.get('pedido') || params.get('t');
      if (token) {
        carregarAcompanhamentoPedido(token);
      }
    }
  }, []);

  // Polling em tempo real do status do pedido (atualiza automaticamente quando a loja avança o pedido)
  useEffect(() => {
    if (!pedidoConfirmado?.token) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/pedidos/status/${encodeURIComponent(pedidoConfirmado.token)}`), {
          headers: getLojaHeader(),
        });
        if (res.ok) {
          const data = await res.json();
          const ped = data.pedido || (data.id ? data : null);
          if (ped) {
            setPedidoConfirmado((prev) =>
              prev ? { ...prev, pedido: ped, pixData: data.cobrancaPix || ped.pix || prev.pixData } : null
            );
            if (ped.statusPagamento) {
              setPixStatus(ped.statusPagamento);
            }
          }
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [pedidoConfirmado?.token]);

  const cfg = configLoja?.pedidosPagamentos;

  // Categorias disponíveis para filtro
  const categorias = useMemo(() => {
    if (categoriasLista.length > 0) {
      return ['TODOS', ...categoriasLista.filter((c) => c.ativa !== false).map((c) => c.nome)];
    }
    const set = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return ['TODOS', ...Array.from(set)];
  }, [categoriasLista, produtos]);

  const produtosFiltrados = useMemo(() => {
    if (categoriaSelecionada === 'TODOS') return produtos;
    return produtos.filter((p) => p.categoria.toLowerCase() === categoriaSelecionada.toLowerCase());
  }, [produtos, categoriaSelecionada]);

  // Cálculos do Carrinho
  const subtotalCarrinho = useMemo(() => {
    return Math.round(
      carrinho.reduce((acc, item) => acc + (item.precoTotal ?? item.subtotal ?? 0), 0) * 100
    ) / 100;
  }, [carrinho]);

  const taxaEntregaCalculada = useMemo(() => {
    if (tipoAtendimento === 'RETIRADA') return 0;
    return cfg?.taxaEntregaPadrao ?? cfg?.taxaEntrega ?? 6.0;
  }, [tipoAtendimento, cfg]);

  const totalFinalCalculado = useMemo(() => {
    return Math.round((subtotalCarrinho + taxaEntregaCalculada) * 100) / 100;
  }, [subtotalCarrinho, taxaEntregaCalculada]);

  const quantidadeTotalItens = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + item.quantidade, 0);
  }, [carrinho]);

  // Filtra adicionais ativos e permitidos para o produto em customização
  const adicionaisPermitidosParaLanche = useMemo(() => {
    if (!produtoModal) return [];
    return adicionaisLista.filter((ad) => {
      if (ad.ativo === false) return false;
      // Se tiver lista de categorias específicas
      if (ad.categoriasPermitidas && ad.categoriasPermitidas.length > 0) {
        const catPermitida = ad.categoriasPermitidas.some(
          (c) =>
            c === 'TODAS' ||
            c.toLowerCase() === produtoModal.categoria.toLowerCase() ||
            (produtoModal.categoriaId && c === produtoModal.categoriaId)
        );
        if (!catPermitida) return false;
      }
      // Se tiver lista de produtos específicos
      if (ad.produtosPermitidos && ad.produtosPermitidos.length > 0) {
        if (!ad.produtosPermitidos.includes(produtoModal.id)) return false;
      }
      // Se produto tiver adicionaisIds especificados
      if (produtoModal.adicionaisIds && produtoModal.adicionaisIds.length > 0) {
        if (!produtoModal.adicionaisIds.includes(ad.id)) return false;
      }
      return true;
    });
  }, [produtoModal, adicionaisLista]);

  // Abertura do Modal de Personalização
  const abrirPersonalizacao = (produto: ProdutoCardapio) => {
    setProdutoModal(produto);
    setModalQtd(1);
    setModalPontoCarne('Ao ponto da casa (suculento e rosado)');
    setModalAdicionaisQtd({});
    setModalObservacoes('');
  };

  // Ajustar quantidade de um adicional (+ ou -)
  const ajustarQtdAdicional = (adicionalId: string, delta: number, maxPermitido: number = 4) => {
    setModalAdicionaisQtd((prev) => {
      const atual = prev[adicionalId] || 0;
      const novo = Math.max(0, Math.min(maxPermitido, atual + delta));
      return { ...prev, [adicionalId]: novo };
    });
  };

  // Soma de extras do lanche unitário
  const valorTotalAdicionaisUnitario = useMemo(() => {
    let soma = 0;
    for (const [adId, qtd] of Object.entries(modalAdicionaisQtd)) {
      if (qtd > 0) {
        const ad = adicionaisLista.find((a) => a.id === adId);
        if (ad) {
          soma += ad.preco * qtd;
        }
      }
    }
    return Math.round(soma * 100) / 100;
  }, [modalAdicionaisQtd, adicionaisLista]);

  // Preço do lanche personalizado (Base + Extras)
  const precoLanchePersonalizadoUnitario = useMemo(() => {
    if (!produtoModal) return 0;
    const precoBase = produtoModal.precoVenda ?? produtoModal.precoSugeridoVenda ?? 0;
    return Math.round((precoBase + valorTotalAdicionaisUnitario) * 100) / 100;
  }, [produtoModal, valorTotalAdicionaisUnitario]);

  // Total do modal (Preço personalizado × Quantidade de lanches)
  const precoModalCalculado = useMemo(() => {
    return Math.round(precoLanchePersonalizadoUnitario * modalQtd * 100) / 100;
  }, [precoLanchePersonalizadoUnitario, modalQtd]);

  const confirmarItemCarrinho = () => {
    if (!produtoModal) return;

    const precoBase = produtoModal.precoVenda ?? produtoModal.precoSugeridoVenda ?? 0;

    // Compila a lista de adicionais selecionados com quantidades
    const adicionaisFinal: AdicionalItem[] = [];
    for (const [adId, qtd] of Object.entries(modalAdicionaisQtd)) {
      if (qtd > 0) {
        const ad = adicionaisLista.find((a) => a.id === adId);
        if (ad) {
          adicionaisFinal.push({
            id: ad.id,
            nome: ad.nome,
            preco: ad.preco,
            precoUnitario: ad.preco,
            quantidade: qtd,
            subtotal: Math.round(ad.preco * qtd * 100) / 100,
          });
        }
      }
    }

    const precoUnitarioFinal = Math.round((precoBase + valorTotalAdicionaisUnitario) * 100) / 100;
    const subtotalFinal = Math.round(precoUnitarioFinal * modalQtd * 100) / 100;

    const novoItem: ItemPedido = {
      produtoId: produtoModal.id,
      nome: produtoModal.nome,
      nomeProduto: produtoModal.nome,
      quantidade: modalQtd,
      precoBaseLanche: precoBase,
      precoUnitario: precoUnitarioFinal,
      subtotal: subtotalFinal,
      precoTotal: subtotalFinal,
      pontoCarne: produtoModal.categoria.toLowerCase().includes('bebida') ? undefined : modalPontoCarne,
      adicionais: adicionaisFinal,
      observacoes: modalObservacoes.trim() || undefined,
    };

    setCarrinho((prev) => [...prev, novoItem]);
    setProdutoModal(null);
    setModalAdicionaisQtd({});
  };

  const removerItemCarrinho = (index: number) => {
    setCarrinho((prev) => prev.filter((_, i) => i !== index));
  };

  // Validação do Checkout do Cliente
  const validarCheckout = () => {
    const erros: string[] = [];

    if (!nomeCliente.trim()) {
      erros.push('Informe seu nome completo para identificação do pedido.');
    }

    const telLimpo = telefoneCliente.replace(/\D/g, '');
    if (!telLimpo || telLimpo.length < 10) {
      erros.push('Informe um telefone/celular válido com DDD para contato.');
    }

    if (tipoAtendimento === 'ENTREGA') {
      if (!endereco.rua.trim()) erros.push('Endereço: Nome da rua/avenida é obrigatório.');
      if (!endereco.numero.trim()) erros.push('Endereço: Número do imóvel é obrigatório (ou S/N).');
      if (!endereco.bairro.trim()) erros.push('Endereço: Bairro é obrigatório.');
      if (!endereco.cidade.trim()) erros.push('Endereço: Cidade é obrigatória.');
    }

    if (formaPagamento === 'DINHEIRO' && precisaTroco) {
      const valorTroco = parseFloat(trocoPara.replace(',', '.'));
      if (isNaN(valorTroco) || valorTroco <= totalFinalCalculado) {
        erros.push(`O valor do troco deve ser maior que o total do pedido (R$ ${totalFinalCalculado.toFixed(2)}).`);
      }
    }

    return erros;
  };

  // Finalização do Pedido
  const handleFinalizarPedido = async () => {
    const erros = validarCheckout();
    setErrosCheckout(erros);
    if (erros.length > 0) return;

    setEnviandoPedido(true);
    try {
      const payload = {
        clienteNome: nomeCliente.trim(),
        clienteTelefone: telefoneCliente.replace(/\D/g, ''),
        tipoAtendimento,
        enderecoEntrega: tipoAtendimento === 'ENTREGA' ? endereco : undefined,
        formaPagamento,
        precisaTroco: formaPagamento === 'DINHEIRO' ? precisaTroco : false,
        trocoPara: formaPagamento === 'DINHEIRO' && precisaTroco ? parseFloat(trocoPara.replace(',', '.')) : undefined,
        observacoesGerais: observacoesPedido.trim() || undefined,
        itens: carrinho,
      };

      const res = await fetch(apiUrl('/api/pedidos'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getLojaHeader(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        setErrosCheckout([data.erro || 'Falha ao processar pedido. Tente novamente.']);
        setEnviandoPedido(false);
        return;
      }

      const pedidoCriado = data.pedido;
      const token = pedidoCriado?.tokenPublico || data.tokenAcesso || data.token || '';

      // Se for Pix, iniciar cobrança imediatamente
      if (formaPagamento === 'PIX') {
        const resPix = await fetch(apiUrl('/api/pix/create'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getLojaHeader(),
          },
          body: JSON.stringify({ pedidoId: pedidoCriado.id, token }),
        });

        const dataPix = await resPix.json();
        setPedidoConfirmado({
          pedido: pedidoCriado,
          token,
          pixData: dataPix.cobranca,
        });
        setPixStatus(dataPix.cobranca?.status || 'AGUARDANDO_PAGAMENTO');
      } else {
        // Cartão Presencial ou Dinheiro: já apto para WhatsApp!
        setPedidoConfirmado({
          pedido: pedidoCriado,
          token,
        });
      }

      setCarrinho([]);
      setCheckoutAberto(false);
      setDrawerCarrinhoAberto(false);
    } catch (e) {
      setErrosCheckout(['Erro de conexão com o servidor. Verifique sua internet.']);
    } finally {
      setEnviandoPedido(false);
    }
  };

  // Polling de verificação de status do Pix
  useEffect(() => {
    if (!pedidoConfirmado?.pixData?.chargeId || pixStatus === 'PAGO') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/pix/status/${pedidoConfirmado.pixData!.chargeId}`));
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'PAGO' || data.status === 'approved') {
            setPixStatus('PAGO');
            setPedidoConfirmado((prev) =>
              prev ? { ...prev, pedido: { ...prev.pedido, statusPagamento: 'PAGO' } } : null
            );
            clearInterval(interval);
          }
        }
      } catch {
        // silencioso no polling
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [pedidoConfirmado, pixStatus]);

  // Consulta manual do status do Pix
  const handleConsultarPixManual = async () => {
    if (!pedidoConfirmado?.pixData?.chargeId) return;
    setConsultandoPix(true);
    try {
      const res = await fetch(apiUrl(`/api/pix/status/${pedidoConfirmado.pixData.chargeId}`));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'PAGO' || data.status === 'approved') {
          setPixStatus('PAGO');
          setPedidoConfirmado((prev) =>
            prev ? { ...prev, pedido: { ...prev.pedido, statusPagamento: 'PAGO' } } : null
          );
        } else {
          alert('Pagamento ainda não identificado pelo provedor bancário. Aguarde alguns segundos e tente novamente.');
        }
      }
    } catch {
      alert('Erro temporário ao consultar provedor Pix.');
    } finally {
      setConsultandoPix(false);
    }
  };

  // Simular Aprovação no Modo Testes/Sandbox
  const handleSimularAprovacaoPix = async () => {
    if (!pedidoConfirmado?.pixData?.chargeId) return;
    setSimulandoAprovacao(true);
    try {
      const res = await fetch(apiUrl('/api/pix/simulate-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId: pedidoConfirmado.pixData.chargeId }),
      });
      if (res.ok) {
        setPixStatus('PAGO');
        setPedidoConfirmado((prev) =>
          prev ? { ...prev, pedido: { ...prev.pedido, statusPagamento: 'PAGO' } } : null
        );
      }
    } catch {
      alert('Falha ao simular pagamento.');
    } finally {
      setSimulandoAprovacao(false);
    }
  };

  const handleCopiarPixCopiaECola = async () => {
    if (!pedidoConfirmado?.pixData?.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pedidoConfirmado.pixData.copiaECola);
      setCopiadoPix(true);
      setTimeout(() => setCopiadoPix(false), 3000);
    } catch {
      // fallback
    }
  };

  // Disparo para WhatsApp com mensagem oficial e notificação de envio único
  const handleEnviarWhatsapp = async () => {
    if (!pedidoConfirmado || !cfg?.whatsappLoja) return;

    const pedido = pedidoConfirmado.pedido;
    const mensagem = gerarMensagemPedidoWhatsapp(pedido, cfg);
    const link = gerarLinkWhatsapp(cfg.whatsappLoja, mensagem);

    // Idempotência no backend
    try {
      await fetch(apiUrl('/api/pedidos/whatsapp-sent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: pedido.id, token: pedidoConfirmado.token }),
      });
    } catch {
      // continua
    }

    window.open(link, '_blank');
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-300 p-4">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-semibold">Carregando cardápio digital...</p>
      </div>
    );
  }

  // TELA DE PÓS-CHECKOUT (PEDIDO CONFIRMADO / PIX EM ANDAMENTO)
  if (pedidoConfirmado) {
    const pedido = pedidoConfirmado.pedido;
    const isPix = pedido.formaPagamento === 'PIX';
    const pixPago = pixStatus === 'PAGO';
    const podeEnviarWhatsapp = !isPix || pixPago;

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        {/* Topo do Pedido */}
        <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-black text-black">
                D’
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white">{configLoja?.nomeHamburgueria || "D' Burger"}</h1>
                <p className="text-[11px] text-zinc-400">Pedido #{pedido.numero}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPedidoConfirmado(null)}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 border border-zinc-700"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                <span>Cardápio</span>
              </button>
              {isAndroidApp() && isAdmin && onVoltarPainel && (
                <button
                  onClick={onVoltarPainel}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1.5 font-semibold border border-zinc-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Retornar ao App
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 flex-1 w-full">
          {/* Card Status do Pedido */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
            {isPix ? (
              pixPago ? (
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h2 className="text-2xl font-black text-white">Pagamento Pix Confirmado!</h2>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Seu pagamento foi aprovado pelo provedor e seu pedido está pronto para envio à hamburgueria.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto animate-pulse">
                    <QrCode className="w-9 h-9" />
                  </div>
                  <h2 className="text-2xl font-black text-white">Aguardando Pagamento Pix</h2>
                  <p className="text-xs text-zinc-400">
                    Pague pelo QR Code ou Copia e Cola abaixo. <strong>O pedido só é liberado para o WhatsApp após a confirmação bancária real.</strong>
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h2 className="text-2xl font-black text-white">Pedido Realizado com Sucesso!</h2>
                <p className="text-xs text-amber-400 font-semibold">
                  Modalidade: {pedido.formaPagamento === 'CARTAO' ? 'Cartão na Entrega/Retirada' : 'Dinheiro em Espécie'}
                </p>
              </div>
            )}

            {/* Tempo Estimado */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Preparo estimado: <strong>~{cfg?.tempoEstimadoPreparoMinutos ?? cfg?.tempoPreparoMinutos ?? 30} minutos</strong> (estimativa operacional)
              </span>
            </div>

            {/* Linha do Tempo do Pedido em Tempo Real */}
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">
                  Status do Pedido em Tempo Real
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ao Vivo
                </span>
              </div>

              {/* Etapas Visuais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-bold border transition ${
                    ['RECEBIDO', 'CONFIRMADO', 'EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'CONCLUIDO'].includes(
                      pedido.status || 'RECEBIDO'
                    )
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-black'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  1. Recebido
                </div>
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-bold border transition ${
                    ['CONFIRMADO', 'EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'CONCLUIDO'].includes(
                      pedido.status || ''
                    ) || pixPago
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-black'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  2. Confirmado
                </div>
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-bold border transition ${
                    ['EM_PREPARO', 'SAIU_ENTREGA', 'PRONTO_RETIRADA', 'CONCLUIDO'].includes(pedido.status || '')
                      ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  3. Em Preparo
                </div>
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-bold border transition ${
                    ['SAIU_ENTREGA', 'PRONTO_RETIRADA', 'CONCLUIDO'].includes(pedido.status || '')
                      ? 'bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  {pedido.tipoAtendimento === 'RETIRADA' ? '4. Pronto' : '4. A Caminho'}
                </div>
              </div>
            </div>
          </div>

          {/* Bloco de Pagamento Pix (QR Code e Copia e Cola) */}
          {isPix && !pixPago && pedidoConfirmado.pixData && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-mono text-zinc-400">Valor exato da cobrança</span>
                <div className="text-3xl font-extrabold text-cyan-400">
                  R$ {pedido.valorFinal.toFixed(2)}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Beneficiário: {cfg?.titularPix || "D' Burger"} • {cfg?.instituicaoPix || 'Banco Oficial'}
                </p>
              </div>

              {/* Imagem do QR Code */}
              {(pedidoConfirmado.pixData.qrCodeBase64 || pedidoConfirmado.pixData.qrCode) && (
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl max-w-[240px] mx-auto shadow-lg">
                  <img
                    src={
                      pedidoConfirmado.pixData.qrCodeBase64
                        ? `data:image/png;base64,${pedidoConfirmado.pixData.qrCodeBase64}`
                        : pedidoConfirmado.pixData.qrCode
                    }
                    alt="QR Code Pix"
                    className="w-full h-auto aspect-square"
                  />
                  <span className="text-[10px] text-zinc-800 font-bold mt-1">Aponte a câmera no app do seu banco</span>
                </div>
              )}

              {/* Copia e Cola */}
              {pedidoConfirmado.pixData.copiaECola && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Código Pix Copia e Cola
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pedidoConfirmado.pixData.copiaECola}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopiarPixCopiaECola}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiadoPix ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Ações de verificação */}
              <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleConsultarPixManual}
                  disabled={consultandoPix}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${consultandoPix ? 'animate-spin' : ''}`} />
                  {consultandoPix ? 'Consultando provedor bancário...' : 'Já fiz o Pix, verificar pagamento'}
                </button>

                {/* Botão de Sandbox / Teste caso o provedor seja simulador ou modo sandbox ativo */}
                <button
                  type="button"
                  onClick={handleSimularAprovacaoPix}
                  disabled={simulandoAprovacao}
                  className="w-full py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {simulandoAprovacao ? 'Aprovando...' : 'Aprovar Pagamento Pix (Teste / Sandbox)'}
                </button>

                <p className="text-[11px] text-zinc-500 text-center">
                  O sistema consulta o banco automaticamente a cada 4 segundos. Não encerre esta aba antes da confirmação.
                </p>
              </div>
            </div>
          )}

          {/* BLOCO DE DISPARO PARA O WHATSAPP */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Enviar Pedido para a Hamburgueria</h3>
              {podeEnviarWhatsapp ? (
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full font-semibold">
                  Pronto para Enviar
                </span>
              ) : (
                <span className="text-[11px] text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full font-semibold">
                  Aguardando Pagamento Pix
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400">
              {podeEnviarWhatsapp
                ? 'Clique no botão abaixo para abrir o WhatsApp com a mensagem oficial formatada do seu pedido.'
                : 'A liberação para o WhatsApp ocorrerá automaticamente assim que o pagamento Pix for confirmado pelo provedor bancário.'}
            </p>

            <button
              type="button"
              onClick={handleEnviarWhatsapp}
              disabled={!podeEnviarWhatsapp}
              className={`w-full py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl transition ${podeEnviarWhatsapp ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/20' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
            >
              <Phone className="w-5 h-5" />
              {podeEnviarWhatsapp ? 'Abrir WhatsApp e Enviar Pedido' : 'Aguardando Aprovação do Pix...'}
            </button>
          </div>

          {/* Resumo dos Itens do Pedido */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-white text-sm">Resumo dos Itens</h3>
            <div className="divide-y divide-zinc-800 text-xs">
              {pedido.itens.map((it: ItemPedido, idx: number) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <div>
                    <span className="font-bold text-zinc-200">
                      {it.quantidade}x {it.nomeProduto}
                    </span>
                    {it.pontoCarne && <p className="text-zinc-500 text-[11px]">• {it.pontoCarne}</p>}
                    {it.adicionais && it.adicionais.length > 0 && (
                      <p className="text-amber-400/90 text-[11px]">
                        + {it.adicionais.map((a: AdicionalItem) => a.nome).join(', ')}
                      </p>
                    )}
                    {it.observacoes && (
                      <p className="text-zinc-400 italic text-[11px]">Obs: {it.observacoes}</p>
                    )}
                  </div>
                  <span className="font-bold text-zinc-300">R$ {(it.precoTotal ?? it.subtotal ?? 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>R$ {pedido.valorBruto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Taxa de Entrega ({pedido.tipoAtendimento})</span>
                <span>{pedido.taxaEntrega > 0 ? `R$ ${pedido.taxaEntrega.toFixed(2)}` : 'Grátis'}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-white pt-2 border-t border-zinc-800">
                <span>Total Final</span>
                <span className="text-amber-400">R$ {pedido.valorFinal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // TELA DO CARDÁPIO DIGITAL DO CLIENTE
  const theme: CardapioThemeConfig = configLoja?.cardapioTheme || TEMA_CARDAPIO_PADRAO;
  const nomeExibicaoLoja = theme.nomeLoja || configLoja?.nomeHamburgueria || "D' Burger";

  // Mapeamento dos formatos de cantos
  const borderRadiusCartao =
    theme.arredondamentoCartoes === 'nenhum'
      ? '0px'
      : theme.arredondamentoCartoes === 'pequeno'
      ? '8px'
      : theme.arredondamentoCartoes === 'grande'
      ? '24px'
      : theme.arredondamentoCartoes === 'completo'
      ? '32px'
      : '16px';

  const borderRadiusBotao =
    theme.arredondamentoBotoes === 'nenhum'
      ? '0px'
      : theme.arredondamentoBotoes === 'pequeno'
      ? '8px'
      : theme.arredondamentoBotoes === 'grande'
      ? '20px'
      : theme.arredondamentoBotoes === 'completo'
      ? '9999px'
      : '12px';

  const fontFamilyEstilo =
    theme.fonteFamilia === 'serif'
      ? 'Georgia, Cambria, serif'
      : theme.fonteFamilia === 'mono'
      ? 'monospace'
      : theme.fonteFamilia === 'condensed'
      ? 'Impact, "Arial Narrow", sans-serif'
      : 'sans-serif';

  // Renderizadores de cada seção para ordenação livre
  const renderSecaoCapa = () => {
    if (!theme.imagemCapaUrl) return null;
    const alturaClasses =
      theme.imagemCapaAltura === 'pequeno'
        ? 'h-32 sm:h-44'
        : theme.imagemCapaAltura === 'grande'
        ? 'h-64 sm:h-80'
        : 'h-48 sm:h-60';

    return (
      <div key="capa" className={`w-full overflow-hidden relative ${alturaClasses}`}>
        <img
          src={theme.imagemCapaUrl}
          alt="Capa"
          className={`w-full h-full ${theme.imagemCapaEnquadramento === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: (theme.sobreposicaoCapaOpacidade ?? 40) / 100 }}
        />
      </div>
    );
  };

  const renderSecaoCabecalho = () => {
    return (
      <header
        key="cabecalho"
        className="sticky top-0 z-30 backdrop-blur-md px-4 py-3 shadow-md border-b"
        style={{
          backgroundColor: `${theme.corFundo}ee`,
          borderColor: theme.corBordaCartao,
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div
            className={`flex items-center gap-3 ${
              theme.alinhamentoCabecalho === 'centro' ? 'justify-center text-center' : ''
            }`}
          >
            {/* Logo ao lado do nome */}
            {theme.posicaoLogo === 'ao_lado_nome' && (
              <div
                className="w-10 h-10 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border"
                style={{ borderColor: theme.corBordaCartao, backgroundColor: theme.corFundoSecao }}
              >
                {theme.logotipoUrl ? (
                  <img src={theme.logotipoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-black text-lg"
                    style={{ backgroundColor: theme.corDestaque, color: theme.corTextoBotao }}
                  >
                    {nomeExibicaoLoja.charAt(0)}
                  </div>
                )}
              </div>
            )}

            <div>
              {/* Logo acima do nome */}
              {theme.posicaoLogo === 'acima_nome' && theme.logotipoUrl && (
                <div className="w-10 h-10 rounded-2xl overflow-hidden mb-1 border" style={{ borderColor: theme.corBordaCartao }}>
                  <img src={theme.logotipoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              )}

              <h1
                className="font-black text-base sm:text-lg leading-tight tracking-tight"
                style={{ color: theme.corTextoPrincipal }}
              >
                {nomeExibicaoLoja}
              </h1>

              {/* Subtítulo: desaparece sem deixar espaço vazio se inativo */}
              {theme.mostrarSubtitulo && theme.subtituloLoja ? (
                <p className="text-[11px] font-medium leading-none mt-0.5" style={{ color: theme.corTextoSecundario }}>
                  {theme.subtituloLoja}
                </p>
              ) : null}

              {/* Status Aberto */}
              {theme.mostrarBadgeStatus && (
                <p className="text-[11px] flex items-center gap-1.5 mt-1" style={{ color: theme.corTextoSecundario }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>{theme.badgeStatusAberto || 'Aberto agora'}</span>
                  {theme.mostrarTempoPreparo && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span style={{ color: theme.corDestaque }}>
                        ~{cfg?.tempoEstimadoPreparoMinutos || cfg?.tempoPreparoMinutos || 30} min
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAndroidApp() && isAdmin && onVoltarPainel && (
              <button
                onClick={onVoltarPainel}
                className="text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition font-semibold"
                style={{
                  backgroundColor: theme.corFundoSecao,
                  color: theme.corTextoPrincipal,
                  borderColor: theme.corBordaCartao,
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Retornar ao App
              </button>
            )}

            {/* Botão de Carrinho no Topo */}
            <button
              onClick={() => setDrawerCarrinhoAberto(true)}
              className="relative p-2.5 rounded-2xl font-extrabold flex items-center gap-2 shadow-lg transition active:scale-95"
              style={{
                backgroundColor: theme.corBotao,
                color: theme.corTextoBotao,
                borderRadius: borderRadiusBotao,
              }}
              aria-label="Abrir carrinho"
            >
              <ShoppingBag className="w-5 h-5" />
              {quantidadeTotalItens > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2"
                  style={{
                    backgroundColor: theme.corFundo,
                    color: theme.corTextoPrincipal,
                    borderColor: theme.corBotao,
                  }}
                >
                  {quantidadeTotalItens}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
    );
  };

  const renderSecaoApresentacao = () => {
    const temConteudo =
      (theme.mostrarFraseApresentacao && theme.fraseApresentacao) ||
      (theme.mostrarDescricaoLoja && theme.descricaoLoja) ||
      theme.mostrarTaxaEntregaHeader;

    if (!temConteudo) return null;

    return (
      <section
        key="apresentacao"
        className="border-b px-4 py-5"
        style={{
          backgroundColor: `${theme.corFundoSecao}80`,
          borderColor: theme.corBordaCartao,
        }}
      >
        <div
          className={`max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            theme.alinhamentoApresentacao === 'centro' ? 'text-center' : ''
          }`}
        >
          <div>
            {theme.mostrarSubtitulo && theme.subtituloLoja && (
              <span
                className="text-xs font-bold uppercase tracking-wider block mb-0.5"
                style={{ color: theme.corDestaque }}
              >
                {theme.subtituloLoja}
              </span>
            )}

            {theme.mostrarFraseApresentacao && theme.fraseApresentacao && (
              <h2
                className="text-xl sm:text-2xl font-extrabold leading-snug"
                style={{ color: theme.corTextoPrincipal }}
              >
                {theme.fraseApresentacao}
              </h2>
            )}

            {theme.mostrarDescricaoLoja && theme.descricaoLoja && (
              <p
                className="text-xs mt-1 max-w-2xl leading-relaxed"
                style={{ color: theme.corTextoSecundario }}
              >
                {theme.descricaoLoja}
              </p>
            )}
          </div>

          {theme.mostrarTaxaEntregaHeader && (
            <div
              className="flex items-center gap-3 p-2.5 rounded-2xl text-xs shrink-0 border"
              style={{
                backgroundColor: theme.corFundo,
                borderColor: theme.corBordaCartao,
                color: theme.corTextoSecundario,
              }}
            >
              {theme.mostrarTempoPreparo && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" style={{ color: theme.corDestaque }} />
                    <span>~{cfg?.tempoEstimadoPreparoMinutos ?? cfg?.tempoPreparoMinutos ?? 30}m</span>
                  </div>
                  <div className="h-4 w-px bg-zinc-800" />
                </>
              )}
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Taxa: R$ {(cfg?.taxaEntregaPadrao ?? cfg?.taxaEntrega ?? 7.0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderSecaoFiltros = () => {
    return (
      <section
        key="filtros"
        className="sticky top-[58px] z-20 backdrop-blur-md border-b px-4 py-2.5"
        style={{
          backgroundColor: `${theme.corFundo}ee`,
          borderColor: theme.corBordaCartao,
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {categorias.map((cat) => {
            const ativa = categoriaSelecionada === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaSelecionada(cat)}
                className="px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition active:scale-95"
                style={
                  ativa
                    ? {
                        backgroundColor: theme.corBotao,
                        color: theme.corTextoBotao,
                        borderRadius: borderRadiusBotao,
                        boxShadow: `0 4px 12px ${theme.corBotao}40`,
                      }
                    : {
                        backgroundColor: theme.corFundoSecao,
                        color: theme.corTextoSecundario,
                        border: `1px solid ${theme.corBordaCartao}`,
                        borderRadius: borderRadiusBotao,
                      }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const renderSecaoProdutos = () => {
    const isLista = theme.layoutProdutos === 'lista';

    return (
      <main key="produtos" className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full space-y-4">
        {theme.tituloSecaoProdutos && (
          <h3
            className="text-base sm:text-lg font-black tracking-tight"
            style={{ color: theme.corTextoPrincipal }}
          >
            {theme.tituloSecaoProdutos}
          </h3>
        )}

        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Utensils className="w-12 h-12 mx-auto" style={{ color: theme.corTextoSecundario }} />
            <p className="text-sm font-medium" style={{ color: theme.corTextoSecundario }}>
              Nenhum produto cadastrado nesta categoria.
            </p>
          </div>
        ) : (
          <div className={`grid gap-4 ${isLista ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {produtosFiltrados.map((prod) => (
              <div
                key={prod.id}
                onClick={() => abrirPersonalizacao(prod)}
                className="p-4 flex gap-4 cursor-pointer transition group shadow-sm hover:shadow-md active:scale-[0.99]"
                style={{
                  backgroundColor: theme.corFundoSecao,
                  border: `1px solid ${theme.corBordaCartao}`,
                  borderRadius: borderRadiusCartao,
                }}
              >
                {/* Imagem do Produto */}
                {theme.mostrarFotosProdutos && (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative border"
                    style={{
                      backgroundColor: theme.corFundo,
                      borderColor: theme.corBordaCartao,
                    }}
                  >
                    {prod.fotoUrl ? (
                      <img
                        src={prod.fotoUrl}
                        alt={prod.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="text-center p-2">
                        <Utensils className="w-8 h-8 opacity-40" style={{ color: theme.corDestaque }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="font-extrabold text-sm sm:text-base leading-snug truncate"
                        style={{ color: theme.corTextoPrincipal }}
                      >
                        {prod.nome}
                      </h3>
                      {prod.categoria && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-semibold"
                          style={{
                            backgroundColor: `${theme.corBadgeCategoria}15`,
                            color: theme.corBadgeCategoria,
                            borderColor: `${theme.corBadgeCategoria}30`,
                          }}
                        >
                          {prod.categoria}
                        </span>
                      )}
                    </div>

                    <p
                      className="text-xs line-clamp-2 mt-1 leading-relaxed"
                      style={{ color: theme.corTextoSecundario }}
                    >
                      {prod.descricao || 'Item preparado com ingredientes selecionados e alta qualidade.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span
                      className="font-extrabold text-base font-mono"
                      style={{ color: theme.corPreco }}
                    >
                      R$ {(prod.precoVenda ?? prod.precoSugeridoVenda ?? 0).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-black flex items-center gap-1 shadow-sm transition active:scale-95"
                      style={{
                        backgroundColor: theme.corBotao,
                        color: theme.corTextoBotao,
                        borderRadius: borderRadiusBotao,
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{theme.textoBotaoAdicionar || 'Adicionar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  };

  const secoesDisponiveis: Record<string, () => React.ReactNode> = {
    capa: renderSecaoCapa,
    cabecalho: renderSecaoCabecalho,
    apresentacao: renderSecaoApresentacao,
    filtros: renderSecaoFiltros,
    produtos: renderSecaoProdutos,
  };

  const ordemSecoesFinal = theme.ordemSecoes || ['capa', 'cabecalho', 'apresentacao', 'filtros', 'produtos'];

  return (
    <div
      className="min-h-screen flex flex-col transition-colors"
      style={{
        backgroundColor: theme.corFundo,
        backgroundImage:
          theme.fundoTipo === 'imagem' && theme.imagemFundoUrl ? `url(${theme.imagemFundoUrl})` : undefined,
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        color: theme.corTextoPrincipal,
        fontFamily: fontFamilyEstilo,
      }}
    >
      {/* Renderização Dinâmica na Ordem Definida pelo Usuário */}
      {ordemSecoesFinal.map((secKey) => {
        const renderizador = secoesDisponiveis[secKey];
        return renderizador ? renderizador() : null;
      })}

      {/* Barra Flutuante de Carrinho no Mobile */}
      {carrinho.length > 0 && !drawerCarrinhoAberto && !checkoutAberto && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-30">
          <button
            onClick={() => setDrawerCarrinhoAberto(true)}
            className="w-full p-4 flex items-center justify-between shadow-2xl transition transform active:scale-98"
            style={{
              backgroundColor: theme.corBotao,
              color: theme.corTextoBotao,
              borderRadius: borderRadiusBotao,
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
                style={{
                  backgroundColor: theme.corFundo,
                  color: theme.corTextoPrincipal,
                }}
              >
                {quantidadeTotalItens}
              </div>
              <span className="text-sm font-black">
                {theme.textoBotaoCarrinho || 'Ver Meu Carrinho'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-mono font-black">
              <span>R$ {subtotalCarrinho.toFixed(2)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* MODAL 1: Personalização do Lanche (Ponto da carne, adicionais, observações) */}
      {produtoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white">{produtoModal.nome}</h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  R$ {(produtoModal.precoVenda ?? produtoModal.precoSugeridoVenda ?? 0).toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => setProdutoModal(null)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-4 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Ponto da carne (se não for bebida) */}
              {!produtoModal.categoria.toLowerCase().includes('bebida') && (
                <div className="space-y-2">
                  <label className="block font-bold text-white text-xs uppercase tracking-wider">
                    Ponto da Carne
                  </label>
                  <div className="space-y-1.5">
                    {PONTOS_CARNE.map((ponto) => (
                      <label
                        key={ponto}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${modalPontoCarne === ponto ? 'bg-amber-500/10 border-amber-500/60 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                      >
                        <span>{ponto}</span>
                        <input
                          type="radio"
                          name="pontoCarne"
                          checked={modalPontoCarne === ponto}
                          onChange={() => setModalPontoCarne(ponto)}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Adicionais Personalizáveis com Controles de Quantidade (+ / -) */}
              {adicionaisPermitidosParaLanche.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Personalize seu lanche (Adicionais)
                      </label>
                      <p className="text-[11px] text-zinc-400">Escolha os complementos e as quantidades desejadas</p>
                    </div>
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                      Opcional
                    </span>
                  </div>

                  <div className="space-y-2">
                    {adicionaisPermitidosParaLanche.map((adic) => {
                      const qtd = modalAdicionaisQtd[adic.id] || 0;
                      const maximo = adic.maximoPorLanche || 4;
                      const selecionado = qtd > 0;
                      const subtotalAdic = Math.round(adic.preco * qtd * 100) / 100;

                      return (
                        <div
                          key={adic.id}
                          className={`p-3 rounded-2xl border transition ${
                            selecionado
                              ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                              : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-xs ${selecionado ? 'text-amber-300' : 'text-zinc-200'}`}>
                                  {adic.nome}
                                </span>
                                <span className="font-mono text-xs text-amber-400 font-bold shrink-0">
                                  + R$ {adic.preco.toFixed(2)}
                                </span>
                              </div>
                              {adic.descricao && (
                                <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                                  {adic.descricao}
                                </p>
                              )}
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                Limite máximo: {maximo} un por lanche
                              </p>
                            </div>

                            {/* Controles de Quantidade (+ / -) */}
                            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => ajustarQtdAdicional(adic.id, -1, maximo)}
                                disabled={qtd === 0}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                                  qtd === 0
                                    ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:scale-95'
                                }`}
                                aria-label="Diminuir adicional"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <span
                                className={`w-6 text-center font-bold text-xs font-mono ${
                                  selecionado ? 'text-amber-400' : 'text-zinc-400'
                                }`}
                              >
                                {qtd}
                              </span>

                              <button
                                type="button"
                                onClick={() => ajustarQtdAdicional(adic.id, 1, maximo)}
                                disabled={qtd >= maximo}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                                  qtd >= maximo
                                    ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold active:scale-95'
                                }`}
                                aria-label="Aumentar adicional"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {selecionado && (
                            <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                              <span className="text-zinc-400">
                                {qtd} × R$ {adic.preco.toFixed(2)}
                              </span>
                              <span className="font-mono font-bold text-amber-400">
                                Subtotal extra: R$ {subtotalAdic.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações individuais */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-bold text-white text-xs uppercase tracking-wider">
                  Alguma observação para este item?
                </label>
                <textarea
                  rows={2}
                  value={modalObservacoes}
                  onChange={(e) => setModalObservacoes(e.target.value)}
                  placeholder="Ex: sem cebola, maionese à parte, cortar ao meio..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Footer com Quantidade de Lanches e Confirmar */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex flex-col gap-3">
              {valorTotalAdicionaisUnitario > 0 && (
                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
                  <span>
                    Base R$ {(produtoModal.precoVenda ?? 0).toFixed(2)} + Extras R$ {valorTotalAdicionaisUnitario.toFixed(2)}
                  </span>
                  <span className="text-amber-400 font-bold">
                    = R$ {precoLanchePersonalizadoUnitario.toFixed(2)} / lanche
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setModalQtd(Math.max(1, modalQtd - 1))}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm text-white px-2">{modalQtd}</span>
                  <button
                    type="button"
                    onClick={() => setModalQtd(modalQtd + 1)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmarItemCarrinho}
                  className="flex-1 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs sm:text-sm flex items-center justify-between px-4 transition shadow-lg shadow-amber-500/20 active:scale-98"
                >
                  <span>Adicionar ao Pedido</span>
                  <span className="font-mono">R$ {precoModalCalculado.toFixed(2)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER DO CARRINHO */}
      {drawerCarrinhoAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full flex flex-col shadow-2xl">
            {/* Header Carrinho */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-base text-white">Meu Carrinho</h3>
                <span className="text-xs text-zinc-400">({quantidadeTotalItens} itens)</span>
              </div>
              <button
                onClick={() => setDrawerCarrinhoAberto(false)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista Itens */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {carrinho.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <ShoppingBag className="w-12 h-12 text-zinc-700 mx-auto" />
                  <p className="text-zinc-400 text-xs">Seu carrinho ainda está vazio.</p>
                </div>
              ) : (
                carrinho.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2.5 text-xs shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">
                            {item.quantidade}× {item.nomeProduto}
                          </span>
                          {item.precoBaseLanche !== undefined && (
                            <span className="text-[11px] text-zinc-500 font-mono">
                              (Base: R$ {item.precoBaseLanche.toFixed(2)})
                            </span>
                          )}
                        </div>

                        {item.pontoCarne && (
                          <p className="text-[11px] text-zinc-400 mt-0.5">• Ponto: {item.pontoCarne}</p>
                        )}

                        {/* Adicionais com detalhes e preços */}
                        {item.adicionais && item.adicionais.length > 0 && (
                          <div className="mt-1.5 space-y-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-2">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                              Adicionais inclusos:
                            </span>
                            {item.adicionais.map((ad, adIdx) => {
                              const q = ad.quantidade || 1;
                              const p = ad.precoUnitario || ad.preco || 0;
                              const sub = ad.subtotal !== undefined ? ad.subtotal : q * p;
                              return (
                                <div key={adIdx} className="flex items-center justify-between text-[11px] text-zinc-300">
                                  <span>
                                    • {ad.nome} ({q} × R$ {p.toFixed(2)})
                                  </span>
                                  <span className="font-mono font-bold text-amber-400">
                                    + R$ {sub.toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {item.observacoes && (
                          <p className="text-[11px] text-zinc-400 italic mt-1 bg-zinc-900/50 p-1.5 rounded-lg">
                            Obs: {item.observacoes}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-white block">
                          R$ {(item.precoTotal ?? item.subtotal ?? 0).toFixed(2)}
                        </span>
                        {item.quantidade > 1 && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            R$ {item.precoUnitario.toFixed(2)} cada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-zinc-800/60">
                      <button
                        onClick={() => removerItemCarrinho(idx)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                      >
                        Remover item
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Carrinho */}
            {carrinho.length > 0 && (
              <div className="p-4 border-t border-zinc-800 bg-zinc-950 space-y-3">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white font-bold">R$ {subtotalCarrinho.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerCarrinhoAberto(false);
                    setCheckoutAberto(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition"
                >
                  Continuar para Checkout
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CHECKOUT (ENTREGA/RETIRADA, ENDEREÇO, PAGAMENTO) */}
      {checkoutAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Checkout */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white">Finalizar Pedido</h3>
                <p className="text-[11px] text-zinc-400">Preencha seus dados para entrega ou retirada</p>
              </div>
              <button
                onClick={() => setCheckoutAberto(false)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-4 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Alertas de erro */}
              {errosCheckout.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-600/40 text-rose-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    Por favor, corrija os seguintes itens:
                  </div>
                  <ul className="list-disc list-inside text-[11px] pl-1">
                    {errosCheckout.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 1. SELEÇÃO ENTREGA OU RETIRADA */}
              <div className="space-y-2">
                <label className="block font-bold text-white text-xs uppercase tracking-wider">
                  Método de Atendimento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {cfg?.permiteEntrega && (
                    <button
                      type="button"
                      onClick={() => setTipoAtendimento('ENTREGA')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${tipoAtendimento === 'ENTREGA' ? 'bg-amber-500/15 border-amber-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                    >
                      <Truck className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-xs">Entrega em Domicílio</span>
                      <span className="text-[10px] text-zinc-500">
                        Taxa: R$ {(cfg?.taxaEntregaPadrao ?? cfg?.taxaEntrega ?? 7.0).toFixed(2)}
                      </span>
                    </button>
                  )}

                  {cfg?.permiteRetirada && (
                    <button
                      type="button"
                      onClick={() => setTipoAtendimento('RETIRADA')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${tipoAtendimento === 'RETIRADA' ? 'bg-amber-500/15 border-amber-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                    >
                      <Store className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-xs">Retirada no Local</span>
                      <span className="text-[10px] text-emerald-400">Sem taxa de entrega</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. DADOS DO CLIENTE */}
              <div className="space-y-3">
                <label className="block font-bold text-white text-xs uppercase tracking-wider">
                  Seus Dados de Contato
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 text-[11px] mb-1">Seu Nome *</label>
                    <input
                      type="text"
                      value={nomeCliente}
                      onChange={(e) => setNomeCliente(e.target.value)}
                      placeholder="Ex: Maria Oliveira"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[11px] mb-1">Telefone / WhatsApp *</label>
                    <input
                      type="text"
                      value={telefoneCliente}
                      onChange={(e) => setTelefoneCliente(e.target.value)}
                      placeholder="Ex: (11) 98888-7777"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. ENDEREÇO OBRIGATÓRIO SE FOR ENTREGA */}
              {tipoAtendimento === 'ENTREGA' ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-xs">Endereço de Entrega Obrigatório</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-zinc-400 text-[10px] mb-1">Rua / Avenida *</label>
                      <input
                        type="text"
                        value={endereco.rua}
                        onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })}
                        placeholder="Ex: Rua das Flores"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[10px] mb-1">Número *</label>
                      <input
                        type="text"
                        value={endereco.numero}
                        onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                        placeholder="123 ou S/N"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 text-[10px] mb-1">Bairro *</label>
                      <input
                        type="text"
                        value={endereco.bairro}
                        onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
                        placeholder="Ex: Centro"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[10px] mb-1">Cidade *</label>
                      <input
                        type="text"
                        value={endereco.cidade}
                        onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
                        placeholder="Ex: São Paulo"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-zinc-400 text-[10px] mb-1">Complemento (Apto, Bloco)</label>
                      <input
                        type="text"
                        value={endereco.complemento}
                        onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                        placeholder="Ex: Apto 42"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 text-[10px] mb-1">Ponto de Referência</label>
                      <input
                        type="text"
                        value={endereco.referencia}
                        onChange={(e) => setEndereco({ ...endereco, referencia: e.target.value })}
                        placeholder="Ex: Próximo à padaria"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {cfg?.instrucoesEntrega && (
                    <p className="text-[10px] text-zinc-400 italic">
                      ℹ️ {cfg.instrucoesEntrega}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-300">
                  <Store className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block">RETIRADA NO LOCAL</span>
                    <span className="text-[11px] text-zinc-400">
                      {cfg?.instrucoesRetirada || 'Retire no balcão da loja assim que estiver pronto.'}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. FORMA DE PAGAMENTO */}
              <div className="space-y-2">
                <label className="block font-bold text-white text-xs uppercase tracking-wider">
                  Forma de Pagamento
                </label>
                <div className="space-y-2">
                  {cfg?.aceitaPix && (
                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${formaPagamento === 'PIX' ? 'bg-cyan-950/30 border-cyan-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <QrCode className="w-4 h-4 text-cyan-400" />
                        <div>
                          <span className="font-bold text-xs block text-white">Pix Online (Aprovação Rápida)</span>
                          <span className="text-[10px] text-zinc-400">QR Code gerado na próxima tela</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="formaPagamento"
                        checked={formaPagamento === 'PIX'}
                        onChange={() => setFormaPagamento('PIX')}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                    </label>
                  )}

                  {cfg?.aceitaCartao && (
                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${formaPagamento === 'CARTAO' ? 'bg-purple-950/30 border-purple-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="w-4 h-4 text-purple-400" />
                        <div>
                          <span className="font-bold text-xs block text-white">
                            Cartão (Máquina na {tipoAtendimento === 'ENTREGA' ? 'Entrega' : 'Retirada'})
                          </span>
                          <span className="text-[10px] text-zinc-400">Débito ou Crédito presencial</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="formaPagamento"
                        checked={formaPagamento === 'CARTAO'}
                        onChange={() => setFormaPagamento('CARTAO')}
                        className="text-purple-500 focus:ring-purple-500"
                      />
                    </label>
                  )}

                  {cfg?.aceitaDinheiro && (
                    <div
                      className={`p-3 rounded-xl border space-y-2 transition ${formaPagamento === 'DINHEIRO' ? 'bg-emerald-950/30 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                    >
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <Banknote className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="font-bold text-xs block text-white">
                              Dinheiro em Espécie (na {tipoAtendimento === 'ENTREGA' ? 'Entrega' : 'Retirada'})
                            </span>
                            <span className="text-[10px] text-zinc-400">Pagamento no recebimento</span>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="formaPagamento"
                          checked={formaPagamento === 'DINHEIRO'}
                          onChange={() => setFormaPagamento('DINHEIRO')}
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                      </label>

                      {/* Opção de Troco */}
                      {formaPagamento === 'DINHEIRO' && (
                        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={precisaTroco}
                              onChange={(e) => setPrecisaTroco(e.target.checked)}
                              className="rounded border-zinc-700 text-emerald-500"
                            />
                            <span>Precisa de troco?</span>
                          </label>

                          {precisaTroco && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-zinc-400">Troco para quanto?</span>
                              <div className="relative w-36">
                                <span className="absolute left-2.5 top-1.5 text-zinc-500 text-xs">R$</span>
                                <input
                                  type="text"
                                  value={trocoPara}
                                  onChange={(e) => setTrocoPara(e.target.value)}
                                  placeholder="50,00"
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Observações gerais */}
              <div className="space-y-1">
                <label className="block text-zinc-400 text-[11px]">Observações Gerais do Pedido</label>
                <textarea
                  rows={2}
                  value={observacoesPedido}
                  onChange={(e) => setObservacoesPedido(e.target.value)}
                  placeholder="Ex: Tocar o interfone 2 vezes, deixar na portaria..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Resumo Final de Valores */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div className="flex justify-between text-zinc-400 text-xs">
                  <span>Subtotal dos itens</span>
                  <span>R$ {subtotalCarrinho.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400 text-xs">
                  <span>Taxa de Entrega</span>
                  <span>{taxaEntregaCalculada > 0 ? `R$ ${taxaEntregaCalculada.toFixed(2)}` : 'Grátis (Retirada)'}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-white pt-1.5 border-t border-zinc-800">
                  <span>Total do Pedido</span>
                  <span className="text-amber-400 font-mono">R$ {totalFinalCalculado.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer Checkout com Botão Final */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950">
              <button
                type="button"
                onClick={handleFinalizarPedido}
                disabled={enviandoPedido}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm flex items-center justify-center gap-2 shadow-2xl shadow-amber-500/30 transition disabled:opacity-50"
              >
                {enviandoPedido ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando Pedido...
                  </>
                ) : formaPagamento === 'PIX' ? (
                  <>
                    <QrCode className="w-4 h-4" />
                    Gerar Cobrança Pix • R$ {totalFinalCalculado.toFixed(2)}
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    Concluir e Enviar para WhatsApp • R$ {totalFinalCalculado.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
