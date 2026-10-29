import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  CompraNota,
  ConfiguracaoFinanceira,
  ConfiguracaoPedidosPagamentos,
  Fornecedor,
  FormaPagamento,
  Insumo,
  LancamentoCaixa,
  MovimentacaoEstoque,
  PedidoVenda,
  ProdutoCardapio,
  ItemFichaTecnica,
  StatusPedido,
  StatusPagamento,
} from '../types';
import {
  CONFIG_INICIAL,
  FORNECEDORES_INICIAIS,
  INSUMOS_PADRAO,
  PRODUTOS_PADRAO,
} from '../data/initialData';
import {
  calcularCustoMedioPonderado,
  calcularPrecificacao,
  ResultadoPrecificacao,
  validarEConverterUnidades,
} from '../lib/financialMath';
import {
  getLojaHeader,
  apiUrl,
  obterLojaIdAtual,
  gerarUrlCardapioPublico,
  getServidorOnlineUrl,
  isAndroidApp,
} from '../lib/lojaId';
import { getAdminAuthHeader, garantirTokenAdminServidor } from '../lib/authService';

interface AppContextType {
  // Dados
  config: ConfiguracaoFinanceira;
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  produtos: ProdutoCardapio[];
  compras: CompraNota[];
  movimentacoesEstoque: MovimentacaoEstoque[];
  pedidos: PedidoVenda[];
  lancamentosCaixa: LancamentoCaixa[];

  // Ações de Insumos
  adicionarInsumo: (insumo: Omit<Insumo, 'id' | 'historicoCustos'>) => string;
  atualizarInsumo: (id: string, dados: Partial<Insumo>) => void;
  inativarInsumo: (id: string) => void;
  excluirInsumo: (id: string) => void;

  // Ações de Fornecedores
  adicionarFornecedor: (fornecedor: Omit<Fornecedor, 'id'>) => string;
  atualizarFornecedor: (id: string, dados: Partial<Fornecedor>) => void;

  // Ações de Compras / Notas Fiscais
  salvarCompraConfirmada: (compra: Omit<CompraNota, 'id' | 'criadoEm'>) => { sucesso: boolean; id?: string; erro?: string };

  // Ações de Produtos / Fichas Técnicas
  adicionarProduto: (produto: Omit<ProdutoCardapio, 'id' | 'historicoPrecos'>) => string;
  atualizarProduto: (id: string, dados: Partial<ProdutoCardapio>, motivoPreco?: string) => void;
  duplicarProduto: (id: string) => void;
  inativarProduto: (id: string) => void;
  excluirProduto: (id: string) => void;
  calcularCmvProduto: (produto: ProdutoCardapio) => number;
  calcularAnaliseProduto: (produto: ProdutoCardapio) => ResultadoPrecificacao;

  // Ações de Estoque
  registrarMovimentacaoEstoque: (
    insumoId: string,
    tipo: MovimentacaoEstoque['tipo'],
    quantidadeConsumo: number,
    motivo: string,
    referenciaId?: string
  ) => void;

  // Ações de Vendas / PDV
  finalizarPedidoVenda: (dados: {
    itens: Array<{ produtoId: string; quantidade: number }>;
    desconto: number;
    formaPagamento: FormaPagamento;
    observacoes?: string;
  }) => { sucesso: boolean; pedidoId?: string; erro?: string };

  cancelarPedidoVenda: (pedidoId: string, motivo: string) => { sucesso: boolean; erro?: string };

  // Ações de Fluxo de Caixa
  adicionarLancamentoManual: (dados: {
    tipo: 'ENTRADA' | 'SAIDA';
    categoria: LancamentoCaixa['categoria'];
    valor: number;
    descricao: string;
  }) => void;
  excluirLancamentoCaixa: (id: string) => void;
  zerarCaixaEVendas: () => void;

  // Configurações
  atualizarConfig: (dados: Partial<ConfiguracaoFinanceira>) => void;
  atualizarConfigPedidosPagamentos: (dados: Partial<ConfiguracaoPedidosPagamentos>) => Promise<void>;
  atualizarStatusPedidoOnline: (id: string, novoStatus: StatusPedido, novoStatusPagamento?: StatusPagamento) => Promise<void>;
  sincronizarPedidosOnline: () => Promise<void>;
  publicarCardapioOnline: () => Promise<{ sucesso: boolean; urlPublica?: string; erro?: string; totalProdutos?: number }>;

  // Backup e Reset
  exportarBackupJson: () => string;
  importarBackupJson: (jsonString: string) => { sucesso: boolean; erro?: string };
  reiniciarParaDadosPadrao: () => void;
  iniciarBancoVazio: () => void;

  // Indicadores calculados
  indicadores: {
    faturamentoHoje: number;
    faturamentoSemana: number;
    faturamentoMes: number;
    lanchesVendidosHoje: number;
    lanchesVendidosMes: number;
    cmvTotalVendidoMes: number;
    taxasPagasMes: number;
    reservaOperacionalMes: number;
    dinheiroReposicaoMes: number;
    saldoCaixaTotal: number;
    saldoCaixaLivre: number;
    dinheiroComprometidoReposicao: number;
    dinheiroAcumuladoReserva: number;
    insumosEstoqueBaixo: Insumo[];
    insumosEstoqueZerado: Insumo[];
  };
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'DBURGER_GESTAO_DATABASE_V1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicialização do estado a partir do LocalStorage ou padrão
  const [config, setConfig] = useState<ConfiguracaoFinanceira>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_CONFIG`);
      if (!saved) return CONFIG_INICIAL;
      const parsed = JSON.parse(saved);
      return {
        ...CONFIG_INICIAL,
        ...parsed,
        pedidosPagamentos: {
          ...CONFIG_INICIAL.pedidosPagamentos,
          ...(parsed.pedidosPagamentos || {}),
        },
      };
    } catch {
      return CONFIG_INICIAL;
    }
  });

  const [insumos, setInsumos] = useState<Insumo[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_INSUMOS`);
      return saved ? JSON.parse(saved) : INSUMOS_PADRAO;
    } catch {
      return INSUMOS_PADRAO;
    }
  });

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_FORNECEDORES`);
      return saved ? JSON.parse(saved) : FORNECEDORES_INICIAIS;
    } catch {
      return FORNECEDORES_INICIAIS;
    }
  });

  const [produtos, setProdutos] = useState<ProdutoCardapio[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_PRODUTOS`);
      return saved ? JSON.parse(saved) : PRODUTOS_PADRAO;
    } catch {
      return PRODUTOS_PADRAO;
    }
  });

  const [compras, setCompras] = useState<CompraNota[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_COMPRAS`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [movimentacoesEstoque, setMovimentacoesEstoque] = useState<MovimentacaoEstoque[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_ESTOQUE_MOV`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pedidos, setPedidos] = useState<PedidoVenda[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_PEDIDOS`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lancamentosCaixa, setLancamentosCaixa] = useState<LancamentoCaixa[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_CAIXA`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Salvar no localStorage sempre que houver alterações
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_CONFIG`, JSON.stringify(config));
      localStorage.setItem(`${STORAGE_KEY}_INSUMOS`, JSON.stringify(insumos));
      localStorage.setItem(`${STORAGE_KEY}_FORNECEDORES`, JSON.stringify(fornecedores));
      localStorage.setItem(`${STORAGE_KEY}_PRODUTOS`, JSON.stringify(produtos));
      localStorage.setItem(`${STORAGE_KEY}_COMPRAS`, JSON.stringify(compras));
      localStorage.setItem(`${STORAGE_KEY}_ESTOQUE_MOV`, JSON.stringify(movimentacoesEstoque));
      localStorage.setItem(`${STORAGE_KEY}_PEDIDOS`, JSON.stringify(pedidos));
      localStorage.setItem(`${STORAGE_KEY}_CAIXA`, JSON.stringify(lancamentosCaixa));
    } catch (e) {
      console.error('Erro ao persistir dados do D Burger:', e);
    }
  }, [config, insumos, fornecedores, produtos, compras, movimentacoesEstoque, pedidos, lancamentosCaixa]);

  // Ações de Insumos
  const adicionarInsumo = (dados: Omit<Insumo, 'id' | 'historicoCustos'>): string => {
    const id = `ins-${Date.now()}`;
    const novoInsumo: Insumo = {
      ...dados,
      id,
      historicoCustos: [
        {
          data: new Date().toISOString().split('T')[0],
          custoUnitarioConsumo: dados.custoUnitarioConsumo,
          precoPago: 0,
          quantidadeComprada: 0,
          origem: 'Cadastro Inicial',
        },
      ],
    };
    setInsumos((prev) => [novoInsumo, ...prev]);
    return id;
  };

  const atualizarInsumo = (id: string, dados: Partial<Insumo>) => {
    setInsumos((prev) =>
      prev.map((ins) => {
        if (ins.id !== id) return ins;
        const atualizado = { ...ins, ...dados };
        // se mudou o custo unitário manualmente, registrar no histórico
        if (dados.custoUnitarioConsumo !== undefined && dados.custoUnitarioConsumo !== ins.custoUnitarioConsumo) {
          atualizado.historicoCustos = [
            {
              data: new Date().toISOString().split('T')[0],
              custoUnitarioConsumo: dados.custoUnitarioConsumo,
              precoPago: 0,
              quantidadeComprada: 0,
              origem: 'Ajuste Manual de Custo',
            },
            ...ins.historicoCustos,
          ];
        }
        return atualizado;
      })
    );
  };

  const inativarInsumo = (id: string) => {
    setInsumos((prev) => prev.map((ins) => (ins.id === id ? { ...ins, ativo: !ins.ativo } : ins)));
  };

  const excluirInsumo = (id: string) => {
    setInsumos((prev) => prev.filter((ins) => ins.id !== id));
  };

  // Fornecedores
  const adicionarFornecedor = (dados: Omit<Fornecedor, 'id'>): string => {
    const id = `forn-${Date.now()}`;
    const novo: Fornecedor = { ...dados, id };
    setFornecedores((prev) => [novo, ...prev]);
    return id;
  };

  const atualizarFornecedor = (id: string, dados: Partial<Fornecedor>) => {
    setFornecedores((prev) => prev.map((f) => (f.id === id ? { ...f, ...dados } : f)));
  };

  // Cálculo de CMV de um produto
  const calcularCmvProduto = (produto: ProdutoCardapio): number => {
    let custoTotalIngredientes = 0;
    for (const item of produto.ingredientes) {
      const insumo = insumos.find((i) => i.id === item.insumoId);
      if (insumo) {
        const rendimento = Math.max(1, insumo.rendimentoAproveitavelPercent) / 100;
        // custo por unidade de consumo real dividindo pelo fator de rendimento
        const custoRealUnitario = insumo.custoUnitarioConsumo / rendimento;
        custoTotalIngredientes += item.quantidadeConsumo * custoRealUnitario;
      }
    }
    const custoEmbalagem = produto.custoEmbalagemManual || 0;
    return Math.round((custoTotalIngredientes + custoEmbalagem) * 100) / 100;
  };

  // Análise completa de precificação e rentabilidade
  const calcularAnaliseProduto = (produto: ProdutoCardapio): ResultadoPrecificacao => {
    const cmv = calcularCmvProduto(produto);
    // Custo fixo por lanche: soma de custos fixos / previsão mensal de lanches
    const totalCustosFixos = config.custosFixos.reduce((acc, c) => acc + c.valorMensal, 0);
    const previsaoLanches = Math.max(1, config.previsaoVendasMensaisLanches);
    const custoFixoPorUnidade = totalCustosFixos / previsaoLanches;

    return calcularPrecificacao({
      cmv,
      custoFixoUnitario: custoFixoPorUnidade,
      taxaPagamentoPercent: config.taxaMaquinetaPadrao,
      reservaOperacionalPercent: config.reservaOperacionalPercent,
      margemAlvoPercent: config.metaMargemContribuicao,
      precoVendaAtual: produto.precoVenda,
    });
  };

  // Compras e Notas Fiscais
  const salvarCompraConfirmada = (compraDados: Omit<CompraNota, 'id' | 'criadoEm'>) => {
    if (compraDados.itens.length === 0) {
      return { sucesso: false, erro: 'A compra precisa conter pelo menos 1 item.' };
    }

    const compraId = `compra-${Date.now()}`;
    const agora = new Date().toISOString();
    const dataOperacao = compraDados.data || agora.split('T')[0];

    const novaCompra: CompraNota = {
      ...compraDados,
      id: compraId,
      criadoEm: agora,
    };

    // 1. Atualizar estoque e custo médio de cada insumo
    setInsumos((prevInsumos) => {
      return prevInsumos.map((ins) => {
        const itemComprado = compraDados.itens.find((it) => it.insumoId === ins.id);
        if (!itemComprado) return ins;

        // Converter quantidade de compra para unidade de consumo
        const conv = validarEConverterUnidades(itemComprado.unidadeCompra, ins.unidadeConsumo, ins.fatorConversao);
        const qtdConsumoAdicionada = itemComprado.quantidadeCompra * (conv.sucesso ? conv.fator : ins.fatorConversao);

        // Preço unitário pago por unidade de consumo nesta compra
        const precoTotalItem = itemComprado.subtotal;
        const precoPorUnidadeConsumo = qtdConsumoAdicionada > 0 ? precoTotalItem / qtdConsumoAdicionada : ins.custoUnitarioConsumo;

        // Custo Médio Ponderado (CMP)
        const cmp = calcularCustoMedioPonderado(
          ins.estoqueAtual,
          ins.custoUnitarioConsumo,
          qtdConsumoAdicionada,
          precoTotalItem
        );

        const novoHistorico = [
          {
            data: dataOperacao,
            custoUnitarioConsumo: cmp.novoCustoUnitario,
            precoPago: precoTotalItem,
            quantidadeComprada: itemComprado.quantidadeCompra,
            origem: compraDados.numeroNota ? `Compra NF ${compraDados.numeroNota}` : 'Compra s/ nota',
          },
          ...ins.historicoCustos,
        ];

        return {
          ...ins,
          estoqueAtual: cmp.novoEstoque,
          custoUnitarioConsumo: cmp.novoCustoUnitario,
          historicoCustos: novoHistorico,
          fornecedorNome: compraDados.fornecedorNome || ins.fornecedorNome,
        };
      });
    });

    // 2. Registrar movimentações de estoque
    const novasMovimentacoes: MovimentacaoEstoque[] = compraDados.itens.map((it) => {
      const ins = insumos.find((i) => i.id === it.insumoId);
      const conv = ins ? validarEConverterUnidades(it.unidadeCompra, ins.unidadeConsumo, ins.fatorConversao) : { sucesso: true, fator: 1 };
      const qtdConsumo = it.quantidadeCompra * (conv.sucesso ? conv.fator : 1);

      return {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        dataHora: agora,
        insumoId: it.insumoId,
        insumoNome: it.insumoNome,
        tipo: 'ENTRADA_COMPRA',
        quantidade: qtdConsumo,
        unidade: ins ? ins.unidadeConsumo : it.unidadeCompra,
        custoUnitarioMomento: it.precoUnitarioCompra,
        motivo: `Entrada por compra ${compraDados.numeroNota ? `NF #${compraDados.numeroNota}` : 'direta'} - Fornecedor: ${compraDados.fornecedorNome}`,
        referenciaId: compraId,
      };
    });

    setMovimentacoesEstoque((prev) => [...novasMovimentacoes, ...prev]);

    // 3. Registrar saída no fluxo de caixa (Destinação: Reposição de Estoque)
    const novoCaixa: LancamentoCaixa = {
      id: `cx-${Date.now()}`,
      dataHora: agora,
      tipo: 'SAIDA',
      categoria: 'REPOSICAO_ESTOQUE',
      valor: compraDados.valorTotalInformado,
      descricao: `Pagamento de compra de insumos ${compraDados.numeroNota ? `(NF ${compraDados.numeroNota})` : ''} - ${compraDados.fornecedorNome}`,
      compraId,
    };
    setLancamentosCaixa((prev) => [novoCaixa, ...prev]);

    // 4. Salvar compra
    setCompras((prev) => [novaCompra, ...prev]);

    return { sucesso: true, id: compraId };
  };

  // Movimentação manual de estoque
  const registrarMovimentacaoEstoque = (
    insumoId: string,
    tipo: MovimentacaoEstoque['tipo'],
    quantidadeConsumo: number,
    motivo: string,
    referenciaId?: string
  ) => {
    const insumo = insumos.find((i) => i.id === insumoId);
    if (!insumo) return;

    const agora = new Date().toISOString();
    const movId = `mov-${Date.now()}`;

    // atualizar saldo do insumo
    setInsumos((prev) =>
      prev.map((ins) => {
        if (ins.id !== insumoId) return ins;
        const novoEstoque = Math.max(0, ins.estoqueAtual + quantidadeConsumo);
        return { ...ins, estoqueAtual: novoEstoque };
      })
    );

    const novaMov: MovimentacaoEstoque = {
      id: movId,
      dataHora: agora,
      insumoId,
      insumoNome: insumo.nome,
      tipo,
      quantidade: quantidadeConsumo,
      unidade: insumo.unidadeConsumo,
      custoUnitarioMomento: insumo.custoUnitarioConsumo,
      motivo,
      referenciaId,
    };

    setMovimentacoesEstoque((prev) => [novaMov, ...prev]);

    // Se for perda/descarte, registrar saída financeira na categoria PERDA_DESPERDICIO
    if (tipo === 'PERDA_DESCARTE') {
      const valorPerda = Math.abs(quantidadeConsumo) * insumo.custoUnitarioConsumo;
      if (valorPerda > 0) {
        setLancamentosCaixa((prev) => [
          {
            id: `cx-${Date.now()}`,
            dataHora: agora,
            tipo: 'SAIDA',
            categoria: 'PERDA_DESPERDICIO',
            valor: Math.round(valorPerda * 100) / 100,
            descricao: `Descarte/Perda: ${Math.abs(quantidadeConsumo)} ${insumo.unidadeConsumo} de ${insumo.nome} - Motivo: ${motivo}`,
          },
          ...prev,
        ]);
      }
    }
  };

  // Vendas / PDV
  const finalizarPedidoVenda = (dados: {
    itens: Array<{ produtoId: string; quantidade: number }>;
    desconto: number;
    formaPagamento: FormaPagamento;
    observacoes?: string;
  }) => {
    if (dados.itens.length === 0) {
      return { sucesso: false, erro: 'O pedido não possui nenhum item.' };
    }

    const agora = new Date().toISOString();
    const pedidoId = `ped-${Date.now()}`;
    const numeroPedido = pedidos.length + 1;

    let subtotal = 0;
    let cmvTotalMomento = 0;
    const itensPedido = [];

    // Calcular itens e validar
    for (const item of dados.itens) {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;
      const precoUnit = produto.precoVenda;
      const cmvUnit = calcularCmvProduto(produto);
      const sub = precoUnit * item.quantidade;

      subtotal += sub;
      cmvTotalMomento += cmvUnit * item.quantidade;

      itensPedido.push({
        produtoId: produto.id,
        nome: produto.nome,
        quantidade: item.quantidade,
        precoUnitario: precoUnit,
        cmvUnitarioMomento: cmvUnit,
        subtotal: sub,
      });
    }

    const valorFinal = Math.max(0, subtotal - dados.desconto);

    // Taxa da modalidade
    let taxaPercent = 0;
    if (dados.formaPagamento === 'pix' || dados.formaPagamento === 'dinheiro') {
      taxaPercent = config.taxaPix;
    } else if (dados.formaPagamento === 'debito') {
      taxaPercent = config.taxaDebito;
    } else if (dados.formaPagamento === 'credito') {
      taxaPercent = config.taxaCredito;
    }

    const valorTaxa = Math.round(((valorFinal * taxaPercent) / 100) * 100) / 100;
    const valorLiquidoRecebido = Math.round((valorFinal - valorTaxa) * 100) / 100;

    // Reserva Operacional calculada (padrão 12.1% sobre faturamento ou valor recebido)
    const reservaOperacionalMomento = Math.round(((valorFinal * config.reservaOperacionalPercent) / 100) * 100) / 100;

    // Reposição de estoque destinada (equivale ao CMV para recompor insumos consumidos)
    const valorReposicaoEstoqueMomento = Math.round(cmvTotalMomento * 100) / 100;

    // Lucro estimado após cobrir reposição, taxa e reserva
    const lucroEstimadoMomento = Math.round((valorFinal - cmvTotalMomento - valorTaxa - reservaOperacionalMomento) * 100) / 100;

    const novoPedido: PedidoVenda = {
      id: pedidoId,
      numeroPedido,
      dataHora: agora,
      status: 'CONCLUIDO',
      itens: itensPedido,
      subtotal: Math.round(subtotal * 100) / 100,
      desconto: Math.round(dados.desconto * 100) / 100,
      valorFinal: Math.round(valorFinal * 100) / 100,
      formaPagamento: dados.formaPagamento,
      taxaPagamentoPercent: taxaPercent,
      valorTaxa,
      valorLiquidoRecebido,
      cmvTotalMomento,
      reservaOperacionalMomento,
      valorReposicaoEstoqueMomento,
      lucroEstimadoMomento,
      observacoes: dados.observacoes,
    };

    // 1. Baixar estoque conforme ficha técnica de cada lanche vendido
    const novasMovimentacoes: MovimentacaoEstoque[] = [];
    const consumoPorInsumo: Record<string, number> = {};

    for (const item of dados.itens) {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;

      for (const ing of produto.ingredientes) {
        const totalQtdConsumo = ing.quantidadeConsumo * item.quantidade;
        consumoPorInsumo[ing.insumoId] = (consumoPorInsumo[ing.insumoId] || 0) + totalQtdConsumo;
      }
    }

    setInsumos((prev) =>
      prev.map((ins) => {
        const qtdConsumida = consumoPorInsumo[ins.id] || 0;
        if (qtdConsumida === 0) return ins;

        novasMovimentacoes.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dataHora: agora,
          insumoId: ins.id,
          insumoNome: ins.nome,
          tipo: 'SAIDA_VENDA',
          quantidade: -qtdConsumida,
          unidade: ins.unidadeConsumo,
          custoUnitarioMomento: ins.custoUnitarioConsumo,
          motivo: `Baixa de ingredientes Pedido #${numeroPedido}`,
          referenciaId: pedidoId,
        });

        return {
          ...ins,
          estoqueAtual: Math.max(0, ins.estoqueAtual - qtdConsumida),
        };
      })
    );

    setMovimentacoesEstoque((prev) => [...novasMovimentacoes, ...prev]);

    // 2. Lançamento no caixa: Entrada do recebimento total da venda
    const novoLancamentoVenda: LancamentoCaixa = {
      id: `cx-${Date.now()}-in`,
      dataHora: agora,
      tipo: 'ENTRADA',
      categoria: 'RECEBIMENTO_VENDA',
      valor: valorFinal,
      descricao: `Venda Pedido #${numeroPedido} (${dados.formaPagamento.toUpperCase()})`,
      pedidoId,
    };

    // 3. Lançamento da taxa deduzida caso haja taxa > 0
    const lancamentosToAdd = [novoLancamentoVenda];
    if (valorTaxa > 0) {
      lancamentosToAdd.push({
        id: `cx-${Date.now()}-taxa`,
        dataHora: agora,
        tipo: 'SAIDA',
        categoria: 'TAXA_PAGAMENTO',
        valor: valorTaxa,
        descricao: `Taxa de maquininha/meio de pagamento Pedido #${numeroPedido} (${taxaPercent}%)`,
        pedidoId,
      });
    }

    setLancamentosCaixa((prev) => [...lancamentosToAdd, ...prev]);
    setPedidos((prev) => [novoPedido, ...prev]);

    return { sucesso: true, pedidoId };
  };

  // Cancelamento de pedido com estorno auditável
  const cancelarPedidoVenda = (pedidoId: string, motivo: string) => {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido) return { sucesso: false, erro: 'Pedido não encontrado.' };
    if (pedido.status === 'CANCELADO') return { sucesso: false, erro: 'Este pedido já está cancelado.' };

    const agora = new Date().toISOString();

    // 1. Estornar movimentações de estoque
    const estornosParaInsumos: Record<string, number> = {};
    const novasMovimentacoes: MovimentacaoEstoque[] = [];

    for (const item of pedido.itens) {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;
      for (const ing of produto.ingredientes) {
        const qtdVoltar = ing.quantidadeConsumo * item.quantidade;
        estornosParaInsumos[ing.insumoId] = (estornosParaInsumos[ing.insumoId] || 0) + qtdVoltar;
      }
    }

    setInsumos((prev) =>
      prev.map((ins) => {
        const qtdVoltar = estornosParaInsumos[ins.id] || 0;
        if (qtdVoltar === 0) return ins;

        novasMovimentacoes.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          dataHora: agora,
          insumoId: ins.id,
          insumoNome: ins.nome,
          tipo: 'ESTORNO_VENDA',
          quantidade: qtdVoltar,
          unidade: ins.unidadeConsumo,
          custoUnitarioMomento: ins.custoUnitarioConsumo,
          motivo: `Estorno de estoque por cancelamento do Pedido #${pedido.numeroPedido} - Motivo: ${motivo}`,
          referenciaId: pedidoId,
        });

        return { ...ins, estoqueAtual: ins.estoqueAtual + qtdVoltar };
      })
    );

    setMovimentacoesEstoque((prev) => [...novasMovimentacoes, ...prev]);

    // 2. Estornar lançamento financeiro
    const lancamentoEstorno: LancamentoCaixa = {
      id: `cx-${Date.now()}-estorno`,
      dataHora: agora,
      tipo: 'SAIDA',
      categoria: 'RECEBIMENTO_VENDA',
      valor: pedido.valorFinal,
      descricao: `Estorno financeiro Pedido #${pedido.numeroPedido} cancelado - Motivo: ${motivo}`,
      pedidoId,
    };
    setLancamentosCaixa((prev) => [lancamentoEstorno, ...prev]);

    // 3. Atualizar status do pedido
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId
          ? {
              ...p,
              status: 'CANCELADO',
              canceladoEm: agora,
              motivoCancelamento: motivo,
            }
          : p
      )
    );

    return { sucesso: true };
  };

  // Produtos CRUD
  const adicionarProduto = (dados: Omit<ProdutoCardapio, 'id' | 'historicoPrecos'>): string => {
    const id = `prod-${Date.now()}`;
    const novoProduto: ProdutoCardapio = {
      ...dados,
      id,
      historicoPrecos: [
        {
          data: new Date().toISOString().split('T')[0],
          precoAnterior: dados.precoVenda,
          novoPreco: dados.precoVenda,
          motivo: 'Criação do produto',
        },
      ],
    };
    setProdutos((prev) => [novoProduto, ...prev]);
    return id;
  };

  const atualizarProduto = (id: string, dados: Partial<ProdutoCardapio>, motivoPreco?: string) => {
    setProdutos((prev) =>
      prev.map((prod) => {
        if (prod.id !== id) return prod;
        const atualizado = { ...prod, ...dados };
        if (dados.precoVenda !== undefined && dados.precoVenda !== prod.precoVenda) {
          atualizado.historicoPrecos = [
            {
              data: new Date().toISOString().split('T')[0],
              precoAnterior: prod.precoVenda,
              novoPreco: dados.precoVenda,
              motivo: motivoPreco || 'Alteração manual de preço',
            },
            ...prod.historicoPrecos,
          ];
        }
        return atualizado;
      })
    );
  };

  const duplicarProduto = (id: string) => {
    const original = produtos.find((p) => p.id === id);
    if (!original) return;
    const novoId = `prod-${Date.now()}`;
    const duplicado: ProdutoCardapio = {
      ...original,
      id: novoId,
      nome: `${original.nome} (Cópia)`,
      historicoPrecos: [
        {
          data: new Date().toISOString().split('T')[0],
          precoAnterior: original.precoVenda,
          novoPreco: original.precoVenda,
          motivo: 'Duplicação de produto',
        },
      ],
    };
    setProdutos((prev) => [duplicado, ...prev]);
  };

  const inativarProduto = (id: string) => {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p)));
  };

  const excluirProduto = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  };

  // Fluxo de caixa manual
  const adicionarLancamentoManual = (dados: {
    tipo: 'ENTRADA' | 'SAIDA';
    categoria: LancamentoCaixa['categoria'];
    valor: number;
    descricao: string;
  }) => {
    const novo: LancamentoCaixa = {
      id: `cx-${Date.now()}`,
      dataHora: new Date().toISOString(),
      tipo: dados.tipo,
      categoria: dados.categoria,
      valor: Math.abs(dados.valor),
      descricao: dados.descricao,
    };
    setLancamentosCaixa((prev) => [novo, ...prev]);
  };

  const excluirLancamentoCaixa = (id: string) => {
    setLancamentosCaixa((prev) => prev.filter((l) => l.id !== id));
  };

  const zerarCaixaEVendas = () => {
    setPedidos([]);
    setLancamentosCaixa([]);
    setMovimentacoesEstoque((prev) => prev.filter((m) => m.tipo !== 'SAIDA_VENDA' && m.tipo !== 'ESTORNO_VENDA'));
  };

  const atualizarConfig = (dados: Partial<ConfiguracaoFinanceira>) => {
    setConfig((prev) => ({ ...prev, ...dados }));
  };

  const atualizarConfigPedidosPagamentos = async (dados: Partial<ConfiguracaoPedidosPagamentos>) => {
    const base = (CONFIG_INICIAL.pedidosPagamentos || {}) as ConfiguracaoPedidosPagamentos;
    const atual = (config.pedidosPagamentos || {}) as Partial<ConfiguracaoPedidosPagamentos>;
    const novosPedidosPagamentos: ConfiguracaoPedidosPagamentos = {
      ...base,
      ...atual,
      ...dados,
      whatsappLoja: dados.whatsappLoja ?? atual.whatsappLoja ?? base.whatsappLoja ?? '',
    };
    const novaConfig: ConfiguracaoFinanceira = {
      ...config,
      pedidosPagamentos: novosPedidosPagamentos,
    };
    setConfig(novaConfig);

    try {
      await fetch(apiUrl('/api/config/admin'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify({ pedidosPagamentos: novosPedidosPagamentos }),
      });
    } catch (e) {
      console.warn('Erro ao salvar config no servidor:', e);
    }
  };

  const sincronizarPedidosOnline = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/pedidos/admin'), {
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const listaRecebida: PedidoVenda[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.pedidos)
          ? data.pedidos
          : [];

        if (listaRecebida.length > 0) {
          setPedidos((prev) => {
            const map = new Map<string, PedidoVenda>();
            prev.forEach((p) => map.set(p.id, p));
            listaRecebida.forEach((p: PedidoVenda) => map.set(p.id, p));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()
            );
          });
        }
      }
    } catch {
      // Modo offline seguro — ignora falha de rede sem interromper a tela
    }
  }, []);

  const atualizarStatusPedidoOnline = async (
    id: string,
    novoStatus: StatusPedido,
    novoStatusPagamento?: StatusPagamento
  ) => {
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          status: novoStatus,
          statusPagamento: novoStatusPagamento || p.statusPagamento,
        };
      })
    );

    try {
      await fetch(apiUrl(`/api/pedidos/admin/${id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify({ status: novoStatus, statusPagamento: novoStatusPagamento }),
      });
    } catch (e) {
      console.warn('Erro ao atualizar status do pedido no servidor:', e);
    }
  };

  /**
   * Publica o cardápio local para a camada online na nuvem.
   * Envia os produtos cadastrados, configurações e tema visual.
   */
  const publicarCardapioOnline = async (): Promise<{
    sucesso: boolean;
    urlPublica?: string;
    erro?: string;
    totalProdutos?: number;
  }> => {
    try {
      let temaSalvo = null;
      try {
        const t = localStorage.getItem('DBURGER_THEME_CONFIG');
        if (t) temaSalvo = JSON.parse(t);
      } catch {}

      let categoriasSalvas = null;
      try {
        const c = localStorage.getItem('DBURGER_GESTAO_CATEGORIAS');
        if (c) categoriasSalvas = JSON.parse(c);
      } catch {}

      let adicionaisSalvos = null;
      try {
        const a = localStorage.getItem('DBURGER_GESTAO_ADICIONAIS');
        if (a) adicionaisSalvos = JSON.parse(a);
      } catch {}

      const payload = {
        produtos,
        categorias: categoriasSalvas || undefined,
        adicionais: adicionaisSalvos || undefined,
        config,
        theme: temaSalvo || config.cardapioTheme,
      };

      await garantirTokenAdminServidor().catch(() => {});

      const res = await fetch(apiUrl('/api/sync/publicar-cardapio'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          sucesso: true,
          urlPublica: data.urlPublica || gerarUrlCardapioPublico(),
          totalProdutos: data.totalProdutos || produtos.length,
        };
      } else {
        const err = await res.json().catch(() => ({}));
        const serverUrl = isAndroidApp() ? getServidorOnlineUrl() : (typeof window !== 'undefined' ? window.location.origin : '');
        return {
          sucesso: false,
          erro: err.erro || `O servidor (${serverUrl}) retornou status HTTP ${res.status}. Verifique se a URL online está ativa e com a rota pública liberada.`,
        };
      }
    } catch (e: any) {
      const serverUrl = isAndroidApp() ? getServidorOnlineUrl() : (typeof window !== 'undefined' ? window.location.origin : '');
      return {
        sucesso: false,
        erro: isAndroidApp()
          ? `Não foi possível conectar ao servidor online (${serverUrl}). Verifique se a URL do backend está ativa na internet ou configure seu endereço em Configurações > Servidor Online. Seus dados estão 100% preservados no dispositivo local.`
          : 'Não foi possível conectar ao servidor para publicar o cardápio. Verifique se o servidor backend está ativo.',
      };
    }
  };

  // Sincronizar produtos com o backend para o cardápio público
  useEffect(() => {
    if (produtos && produtos.length > 0) {
      fetch(apiUrl('/api/sync/admin-produtos'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify({ produtos }),
      }).catch(() => {});
    }
  }, [produtos]);

  // Polling de novos pedidos online a cada 10 segundos
  useEffect(() => {
    sincronizarPedidosOnline();
    const interval = setInterval(sincronizarPedidosOnline, 10000);
    return () => clearInterval(interval);
  }, [sincronizarPedidosOnline]);

  // Backup e Restauração
  const exportarBackupJson = (): string => {
    const backupData = {
      versao: '1.0.0',
      dataExportacao: new Date().toISOString(),
      origem: "D' Burger Gestão",
      config,
      insumos,
      fornecedores,
      produtos,
      compras,
      movimentacoesEstoque,
      pedidos,
      lancamentosCaixa,
    };
    return JSON.stringify(backupData, null, 2);
  };

  const importarBackupJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.config || !parsed.insumos || !parsed.produtos) {
        return { sucesso: false, erro: 'Formato de arquivo de backup inválido.' };
      }
      setConfig(parsed.config);
      setInsumos(parsed.insumos);
      setFornecedores(parsed.fornecedores || []);
      setProdutos(parsed.produtos);
      setCompras(parsed.compras || []);
      setMovimentacoesEstoque(parsed.movimentacoesEstoque || []);
      setPedidos(parsed.pedidos || []);
      setLancamentosCaixa(parsed.lancamentosCaixa || []);
      return { sucesso: true };
    } catch (e) {
      return { sucesso: false, erro: 'Arquivo corrompido ou JSON inválido.' };
    }
  };

  const reiniciarParaDadosPadrao = () => {
    setConfig(CONFIG_INICIAL);
    setInsumos(INSUMOS_PADRAO);
    setFornecedores(FORNECEDORES_INICIAIS);
    setProdutos(PRODUTOS_PADRAO);
    setCompras([]);
    setMovimentacoesEstoque([]);
    setPedidos([]);
    setLancamentosCaixa([]);
  };

  const iniciarBancoVazio = () => {
    setConfig(CONFIG_INICIAL);
    setInsumos([]);
    setFornecedores([]);
    setProdutos([]);
    setCompras([]);
    setMovimentacoesEstoque([]);
    setPedidos([]);
    setLancamentosCaixa([]);
  };

  // Indicadores do Dashboard
  const indicadores = useMemo(() => {
    const hojeStr = new Date().toISOString().split('T')[0];
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    let faturamentoHoje = 0;
    let lanchesVendidosHoje = 0;
    let faturamentoSemana = 0;
    let faturamentoMes = 0;
    let lanchesVendidosMes = 0;
    let cmvTotalVendidoMes = 0;
    let taxasPagasMes = 0;
    let reservaOperacionalMes = 0;
    let dinheiroReposicaoMes = 0;

    for (const ped of pedidos) {
      if (ped.status !== 'CONCLUIDO') continue;
      const dataPed = new Date(ped.dataHora);
      const pedDataStr = ped.dataHora.split('T')[0];
      const totalQtdLanches = ped.itens.reduce((acc, it) => acc + it.quantidade, 0);

      if (pedDataStr === hojeStr) {
        faturamentoHoje += ped.valorFinal;
        lanchesVendidosHoje += totalQtdLanches;
      }
      if (dataPed >= seteDiasAtras) {
        faturamentoSemana += ped.valorFinal;
      }
      if (dataPed >= trintaDiasAtras) {
        faturamentoMes += ped.valorFinal;
        lanchesVendidosMes += totalQtdLanches;
        cmvTotalVendidoMes += ped.cmvTotalMomento;
        taxasPagasMes += ped.valorTaxa;
        reservaOperacionalMes += ped.reservaOperacionalMomento;
        dinheiroReposicaoMes += ped.valorReposicaoEstoqueMomento;
      }
    }

    // Saldo real de caixa (Entradas - Saídas)
    let saldoCaixaTotal = 0;
    let dinheiroComprometidoReposicao = 0;
    let dinheiroAcumuladoReserva = 0;

    for (const lanc of lancamentosCaixa) {
      if (lanc.tipo === 'ENTRADA') {
        saldoCaixaTotal += lanc.valor;
      } else {
        saldoCaixaTotal -= lanc.valor;
      }
    }

    // Dinheiro destinado à reposição vs já gasto
    // O que foi vendido acumulou reposição = dinheiroReposicaoMes
    // O que foi pago em compras de insumos reduziu a reposição
    const comprasPagasTotal = lancamentosCaixa
      .filter((l) => l.categoria === 'REPOSICAO_ESTOQUE' && l.tipo === 'SAIDA')
      .reduce((acc, l) => acc + l.valor, 0);

    dinheiroComprometidoReposicao = Math.max(0, dinheiroReposicaoMes - comprasPagasTotal);
    dinheiroAcumuladoReserva = reservaOperacionalMes;

    // Saldo livre = saldo total - compromisso de reposição de estoque - reserva operacional de segurança
    const saldoCaixaLivre = Math.max(0, saldoCaixaTotal - dinheiroComprometidoReposicao - dinheiroAcumuladoReserva);

    // Insumos com estoque baixo e zerado
    const insumosEstoqueBaixo = insumos.filter((i) => i.ativo && i.estoqueAtual > 0 && i.estoqueAtual <= i.estoqueMinimo);
    const insumosEstoqueZerado = insumos.filter((i) => i.ativo && i.estoqueAtual <= 0);

    return {
      faturamentoHoje: Math.round(faturamentoHoje * 100) / 100,
      faturamentoSemana: Math.round(faturamentoSemana * 100) / 100,
      faturamentoMes: Math.round(faturamentoMes * 100) / 100,
      lanchesVendidosHoje,
      lanchesVendidosMes,
      cmvTotalVendidoMes: Math.round(cmvTotalVendidoMes * 100) / 100,
      taxasPagasMes: Math.round(taxasPagasMes * 100) / 100,
      reservaOperacionalMes: Math.round(reservaOperacionalMes * 100) / 100,
      dinheiroReposicaoMes: Math.round(dinheiroReposicaoMes * 100) / 100,
      saldoCaixaTotal: Math.round(saldoCaixaTotal * 100) / 100,
      saldoCaixaLivre: Math.round(saldoCaixaLivre * 100) / 100,
      dinheiroComprometidoReposicao: Math.round(dinheiroComprometidoReposicao * 100) / 100,
      dinheiroAcumuladoReserva: Math.round(dinheiroAcumuladoReserva * 100) / 100,
      insumosEstoqueBaixo,
      insumosEstoqueZerado,
    };
  }, [pedidos, lancamentosCaixa, insumos]);

  return (
    <AppContext.Provider
      value={{
        config,
        insumos,
        fornecedores,
        produtos,
        compras,
        movimentacoesEstoque,
        pedidos,
        lancamentosCaixa,
        adicionarInsumo,
        atualizarInsumo,
        inativarInsumo,
        excluirInsumo,
        adicionarFornecedor,
        atualizarFornecedor,
        salvarCompraConfirmada,
        adicionarProduto,
        atualizarProduto,
        duplicarProduto,
        inativarProduto,
        excluirProduto,
        calcularCmvProduto,
        calcularAnaliseProduto,
        registrarMovimentacaoEstoque,
        finalizarPedidoVenda,
        cancelarPedidoVenda,
        adicionarLancamentoManual,
        excluirLancamentoCaixa,
        zerarCaixaEVendas,
        atualizarConfig,
        atualizarConfigPedidosPagamentos,
        atualizarStatusPedidoOnline,
        sincronizarPedidosOnline,
        publicarCardapioOnline,
        exportarBackupJson,
        importarBackupJson,
        reiniciarParaDadosPadrao,
        iniciarBancoVazio,
        indicadores,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider');
  }
  return context;
};
