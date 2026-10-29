import { UnidadeMedida } from '../lib/financialMath';

export type CategoriaInsumo = 'carnes' | 'paes' | 'queijos' | 'molhos' | 'hortifruti' | 'embalagens' | 'bebidas' | 'outros';

export interface HistoricoCustoInsumo {
  data: string;
  custoUnitarioConsumo: number;
  precoPago: number;
  quantidadeComprada: number;
  origem: string; // Ex: "Compra NF 1024" ou "Ajuste Manual"
}

export interface Insumo {
  id: string;
  nome: string;
  categoria: CategoriaInsumo;
  unidadeCompra: UnidadeMedida;
  unidadeConsumo: UnidadeMedida;
  fatorConversao: number; // Qtd em unidade de consumo por unidade de compra (ex: 1kg = 1000g, 1 fardo = 12 unid)
  rendimentoAproveitavelPercent: number; // Ex: 100% se sem perda, 90% se perde 10%
  custoUnitarioConsumo: number; // R$ por unidade de consumo (g, ml, un)
  estoqueAtual: number; // em unidade de consumo
  estoqueMinimo: number; // em unidade de consumo
  fornecedorNome?: string;
  fornecedorId?: string;
  dataValidade?: string;
  ativo: boolean;
  historicoCustos: HistoricoCustoInsumo[];
  observacoes?: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  telefone: string;
  cnpjOuCpf?: string;
  prazoEntregaDias?: number;
  observacoes?: string;
}

export interface ItemCompra {
  insumoId: string;
  insumoNome: string;
  quantidadeCompra: number;
  unidadeCompra: UnidadeMedida;
  precoUnitarioCompra: number;
  desconto: number;
  acrescimo: number;
  subtotal: number;
}

export interface CompraNota {
  id: string;
  numeroNota: string; // ou "S/N"
  data: string;
  fornecedorId?: string;
  fornecedorNome: string;
  valorTotalInformado: number;
  valorSomaItens: number;
  itens: ItemCompra[];
  conferido: boolean;
  observacoes?: string;
  fotoComprovanteUrl?: string;
  criadoEm: string;
}

export interface ItemFichaTecnica {
  insumoId: string;
  quantidadeConsumo: number; // ex: 150 (g de blend), 1 (pão), 30 (g de queijo)
  observacao?: string;
}

export type CategoriaProduto = string;

export interface CategoriaCardapio {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  ativa: boolean;
}

export interface AdicionalCardapio {
  id: string;
  nome: string;
  preco: number;
  descricao?: string;
  fotoUrl?: string;
  ativo: boolean;
  ordem?: number;
  categoriasPermitidas?: string[]; // IDs/nomes de categorias para as quais se aplica. Se vazio ou ['TODAS'], aplica-se a todas
  produtosPermitidos?: string[]; // IDs de produtos específicos
  maximoPorLanche: number; // Ex: até 3 por lanche
  minimoPorLanche: number; // 0 para opcional, >=1 se obrigatório
  obrigatorio?: boolean;
}

export interface HistoricoPrecoProduto {
  data: string;
  precoAnterior: number;
  novoPreco: number;
  motivo?: string;
}

export interface ProdutoCardapio {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  categoriaId?: string;
  descricao?: string;
  precoVenda: number;
  precoSugeridoVenda?: number;
  fotoUrl?: string;
  ingredientes: ItemFichaTecnica[];
  custoEmbalagemManual: number;
  tempoPreparoMinutos?: number;
  ativo: boolean;
  ordem?: number;
  adicionaisIds?: string[];
  historicoPrecos: HistoricoPrecoProduto[];
}

export type TipoMovimentacaoEstoque = 
  | 'ENTRADA_COMPRA' 
  | 'SAIDA_VENDA' 
  | 'PERDA_DESCARTE' 
  | 'AJUSTE_MANUAL' 
  | 'ESTORNO_VENDA';

export interface MovimentacaoEstoque {
  id: string;
  dataHora: string;
  insumoId: string;
  insumoNome: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number; // positivo para entrada, negativo para saída
  unidade: UnidadeMedida;
  custoUnitarioMomento: number;
  motivo: string;
  referenciaId?: string; // ID da compra ou do pedido
}

export type FormaPagamento = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'PIX' | 'DINHEIRO' | 'CARTAO' | 'DEBITO' | 'CREDITO';

export interface AdicionalItem {
  id: string;
  nome: string;
  preco: number;
  precoUnitario?: number;
  quantidade?: number;
  subtotal?: number;
}

export interface ItemPedidoVenda {
  produtoId: string;
  nome: string;
  nomeProduto?: string;
  quantidade: number;
  precoUnitario: number;
  precoBaseLanche?: number;
  cmvUnitarioMomento?: number;
  subtotal: number;
  precoTotal?: number;
  adicionais?: AdicionalItem[];
  observacaoItem?: string;
  observacoes?: string;
  pontoCarne?: string;
}

export type ItemPedido = ItemPedidoVenda;

export type StatusPedido = 
  | 'PENDENTE' 
  | 'PAGO' 
  | 'EM_PREPARO' 
  | 'PREPARANDO'
  | 'SAIU_ENTREGA' 
  | 'DESPACHADO'
  | 'PRONTO'
  | 'PRONTO_RETIRADA' 
  | 'CONCLUIDO' 
  | 'CANCELADO'
  | 'CONFIRMADO';

export type TipoAtendimento = 'ENTREGA' | 'RETIRADA';

export type StatusPagamento = 
  | 'AGUARDANDO_PAGAMENTO' 
  | 'AGUARDANDO'
  | 'PAGO' 
  | 'PAGAMENTO_NA_ENTREGA'
  | 'NAO_APLICAVEL';

export interface EnderecoEntrega {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  complemento?: string;
  referencia?: string;
}

export interface PedidoVenda {
  id: string;
  numeroPedido: number;
  numero?: number;
  dataHora: string;
  status: StatusPedido;
  itens: ItemPedidoVenda[];
  subtotal: number;
  valorBruto?: number;
  desconto: number;
  valorFinal: number;
  formaPagamento: FormaPagamento;
  taxaPagamentoPercent: number;
  valorTaxa: number;
  valorLiquidoRecebido: number;
  cmvTotalMomento: number;
  reservaOperacionalMomento: number;
  valorReposicaoEstoqueMomento: number;
  lucroEstimadoMomento: number;
  observacoes?: string;
  observacoesGerais?: string;
  canceladoEm?: string;
  motivoCancelamento?: string;

  // Informações do Atendimento e Cliente (Cardápio Digital & Checkout)
  tipoAtendimento?: TipoAtendimento;
  clienteNome?: string;
  clienteTelefone?: string;
  enderecoEntrega?: EnderecoEntrega;
  observacoesEntrega?: string;
  taxaEntrega?: number;
  trocoPara?: number;
  precisaTroco?: boolean;

  // Rastreamento de Pagamento Pix / Provedor
  statusPagamento?: StatusPagamento;
  pixChargeId?: string;
  pixQrCode?: string;
  pixCopiaECola?: string;
  pixExpiracao?: string;
  pixPagoEm?: string;
  pixIdTransacao?: string;

  // Tempo de Preparo e WhatsApp
  tempoPreparoEstimadoMinutos?: number;
  whatsappEnviado?: boolean;
  whatsappEnviadoEm?: string;
  origemPedido?: 'PDV_INTERNO' | 'CARDAPIO_DIGITAL';
  tokenPublico?: string;
  historicoStatus?: Array<{
    status: StatusPedido;
    statusPagamento?: StatusPagamento;
    dataHora: string;
    observacao?: string;
  }>;
}

export type CategoriaCaixa = 
  | 'RECEBIMENTO_VENDA' 
  | 'REPOSICAO_ESTOQUE' 
  | 'RESERVA_OPERACIONAL' 
  | 'DESPESA_PAGA' 
  | 'TAXA_PAGAMENTO' 
  | 'PERDA_DESPERDICIO' 
  | 'RETIRADA_PRO_LABORE' 
  | 'OUTROS';

export interface LancamentoCaixa {
  id: string;
  dataHora: string;
  tipo: 'ENTRADA' | 'SAIDA';
  categoria: CategoriaCaixa;
  valor: number;
  descricao: string;
  pedidoId?: string;
  compraId?: string;
}

export interface CustoFixoMensal {
  id: string;
  nome: string;
  valorMensal: number;
  categoria: 'aluguel' | 'energia' | 'gas' | 'agua' | 'internet' | 'manutencao' | 'outros';
}

export type TipoChavePix = 
  | 'cpf' 
  | 'cnpj' 
  | 'telefone' 
  | 'email' 
  | 'aleatoria'
  | 'CPF_CNPJ'
  | 'TELEFONE'
  | 'EMAIL'
  | 'CHAVE_ALEATORIA';

export type ProvedorPix = 
  | 'mercadopago' 
  | 'simulado' 
  | 'nenhum' 
  | 'MERCADO_PAGO' 
  | 'SIMULADOR_TESTE';

export interface ConfiguracaoPedidosPagamentos {
  // WhatsApp do Proprietário
  whatsappLoja: string; // Ex: "+5511999998888" ou "5511999998888"

  // Chave Pix do Proprietário
  chavePix: string;
  tipoChavePix: TipoChavePix;
  titularPix: string;
  instituicaoPix: string;

  // Provedor de Pagamento para Cobrança Dinâmica / Confirmação Real
  provedorPix: ProvedorPix;
  modoTestePix?: boolean; // Modo Sandbox / Teste
  mercadoPagoSandbox?: boolean;
  mercadoPagoAccessToken?: string;
  mercadoPagoPublicKey?: string;

  // Tempo estimado de preparo
  tempoPreparoMinutos: number; // Ex: 40 min
  tempoEstimadoPreparoMinutos?: number;

  // Formas de pagamento aceitas
  aceitaPix: boolean;
  aceitaCartao: boolean;
  aceitaDinheiro: boolean;

  // Opções de atendimento
  permiteEntrega: boolean;
  permiteRetirada: boolean;
  taxaEntrega: number;
  taxaEntregaPadrao?: number;

  // Textos e instruções
  instrucoesEntrega: string;
  instrucoesRetirada: string;
  ativo?: boolean;
}

export type AlinhamentoTexto = 'esquerda' | 'centro' | 'direita';
export type FormatoArredondamento = 'nenhum' | 'pequeno' | 'medio' | 'grande' | 'completo';
export type NivelSombra = 'nenhuma' | 'suave' | 'media' | 'forte';
export type FamiliaFonte = 'sans' | 'serif' | 'mono' | 'condensed';
export type TamanhoFonte = 'pequeno' | 'normal' | 'grande';
export type AlturaCapa = 'pequeno' | 'medio' | 'grande' | 'oculto';
export type ModoLayoutProdutos = 'grade' | 'lista';

export interface CardapioThemeConfig {
  // Identificação e Textos Livres da Loja
  nomeLoja: string;
  subtituloLoja: string;
  mostrarSubtitulo: boolean;
  fraseApresentacao: string;
  mostrarFraseApresentacao: boolean;
  descricaoLoja: string;
  mostrarDescricaoLoja: boolean;
  mensagemBoasVindas: string;
  mostrarMensagemBoasVindas: boolean;
  tituloSecaoProdutos: string;
  textoBotaoCarrinho: string;
  textoBotaoAdicionar: string;
  textoPersonalizarAdicionais: string;
  badgeStatusAberto: string;
  mostrarBadgeStatus: boolean;

  // Posicionamento e Alinhamento
  posicaoNomeLoja: 'topo' | 'meio' | 'abaixo_capa';
  posicaoLogo: 'acima_nome' | 'ao_lado_nome' | 'abaixo_nome' | 'oculto';
  posicaoSubtitulo: 'abaixo_nome' | 'acima_nome' | 'oculto';
  posicaoImagemCapa: 'topo' | 'abaixo_cabecalho' | 'oculto';
  alinhamentoCabecalho: AlinhamentoTexto;
  alinhamentoApresentacao: AlinhamentoTexto;
  ordemSecoes: string[]; // ['capa', 'cabecalho', 'apresentacao', 'filtros', 'produtos']

  // Fundo e Imagens
  fundoTipo: 'solido' | 'imagem';
  corFundo: string;
  imagemFundoUrl?: string;
  imagemFundoOpacidade: number; // 0 a 100
  logotipoUrl?: string;
  imagemCapaUrl?: string;
  imagemCapaAltura: AlturaCapa;
  imagemCapaEnquadramento: 'cover' | 'contain';
  sobreposicaoCapaOpacidade: number; // 0 a 100

  // Cores
  corTextoPrincipal: string;
  corTextoSecundario: string;
  corDestaque: string; // Cor primária / destaque da marca
  corFundoSecao: string; // Cor dos cartões de produtos
  corBordaCartao: string;
  corPreco: string;
  corBotao: string;
  corTextoBotao: string;
  corBadgeCategoria: string;

  // Tipografia e Cartões
  fonteFamilia: FamiliaFonte;
  tamanhoFonteBase: TamanhoFonte;
  arredondamentoCartoes: FormatoArredondamento;
  arredondamentoBotoes: FormatoArredondamento;
  sombraCartoes: NivelSombra;
  layoutProdutos: ModoLayoutProdutos;
  mostrarFotosProdutos: boolean;
  mostrarTempoPreparo: boolean;
  mostrarTaxaEntregaHeader: boolean;
}

export interface ConfiguracaoFinanceira {
  nomeHamburgueria: string;
  taxaMaquinetaPadrao: number; // 0.70%
  taxaPix: number; // 0.0%
  taxaDebito: number; // 1.20%
  taxaCredito: number; // 2.80%
  reservaOperacionalPercent: number; // 12.1%
  metaMargemContribuicao: number; // 35.0%
  previsaoVendasMensaisLanches: number; // ex: 600
  custosFixos: CustoFixoMensal[];
  politicaDestinacao: {
    priorizarReposicaoEstoque: boolean;
    travarRetiradaSemReserva: boolean;
  };
  pedidosPagamentos?: ConfiguracaoPedidosPagamentos;
  cardapioTheme?: CardapioThemeConfig;
  estabelecimentoId?: string;
  slugLoja?: string;
}
