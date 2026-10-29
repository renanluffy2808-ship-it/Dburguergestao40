import { PedidoVenda, ConfiguracaoPedidosPagamentos } from '../types';
import { gerarUrlAcompanhamentoPedido } from './lojaId';

/**
 * Utilitário de formatação e validação para WhatsApp no formato internacional (+55 DDD NÚMERO)
 */

export function limparNumeroTelefone(telefone: string): string {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '');
}

export function formatarTelefoneVisual(telefone: string): string {
  const limpo = limparNumeroTelefone(telefone);
  if (!limpo) return '';

  // Se tiver 55 no início (12 ou 13 dígitos)
  if (limpo.startsWith('55') && (limpo.length === 12 || limpo.length === 13)) {
    const ddd = limpo.substring(2, 4);
    const numero = limpo.substring(4);
    if (numero.length === 9) {
      return `+55 (${ddd}) ${numero.substring(0, 5)}-${numero.substring(5)}`;
    } else {
      return `+55 (${ddd}) ${numero.substring(0, 4)}-${numero.substring(4)}`;
    }
  }

  // Se for nacional com DDD (10 ou 11 dígitos)
  if (limpo.length === 11) {
    const ddd = limpo.substring(0, 2);
    const numero = limpo.substring(2);
    return `+55 (${ddd}) ${numero.substring(0, 5)}-${numero.substring(5)}`;
  } else if (limpo.length === 10) {
    const ddd = limpo.substring(0, 2);
    const numero = limpo.substring(2);
    return `+55 (${ddd}) ${numero.substring(0, 4)}-${numero.substring(4)}`;
  }

  return telefone;
}

export function validarTelefoneWhatsapp(telefone: string): {
  valido: boolean;
  e164: string;
  erro?: string;
} {
  const limpo = limparNumeroTelefone(telefone);

  let e164 = limpo;
  // Se não começa com 55, adiciona se tiver 10 ou 11 dígitos
  if (!e164.startsWith('55') && (e164.length === 10 || e164.length === 11)) {
    e164 = `55${e164}`;
  }

  // No Brasil: 55 + 2 dígitos DDD + 8 ou 9 dígitos do número = 12 ou 13 dígitos
  if (e164.length < 12 || e164.length > 13) {
    return {
      valido: false,
      e164: '',
      erro: 'Número inválido. Informe o DDD e o número com 8 ou 9 dígitos (ex: 11 99999-8888 ou +55 11 99999-8888).',
    };
  }

  const ddd = parseInt(e164.substring(2, 4), 10);
  if (ddd < 11 || ddd > 99) {
    return {
      valido: false,
      e164: '',
      erro: 'DDD inválido. Informe um DDD brasileiro válido (ex: 11, 21, 31, 85, etc.).',
    };
  }

  return {
    valido: true,
    e164,
  };
}

export function formatarMoeda(val?: number): string {
  const n = typeof val === 'number' && !isNaN(val) ? val : 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s+/g, ' ');
}

export function formatarNumeroPedido(num?: number): string {
  const n = typeof num === 'number' && !isNaN(num) ? num : 1;
  return `#${n.toString().padStart(6, '0')}`;
}

export function gerarMensagemPedidoWhatsapp(
  pedido: PedidoVenda,
  configLoja?: ConfiguracaoPedidosPagamentos,
  nomeLoja: string = "D’ BURGER"
): string {
  const dataFormatada = new Date(pedido.dataHora).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const linhas: string[] = [];

  // Título e identificação
  linhas.push(`🍔 NOVO PEDIDO — ${nomeLoja.toUpperCase()}`);
  linhas.push(`Pedido: ${formatarNumeroPedido(pedido.numeroPedido ?? pedido.numero)}`);
  linhas.push(`Data/Hora: ${dataFormatada}`);
  linhas.push(`Cliente: ${pedido.clienteNome || 'Cliente'}`);
  linhas.push(`Telefone: ${pedido.clienteTelefone ? formatarTelefoneVisual(pedido.clienteTelefone) : 'Não informado'}`);
  linhas.push('');

  // Atendimento
  if (pedido.tipoAtendimento === 'ENTREGA') {
    linhas.push('ATENDIMENTO: ENTREGA');
    if (pedido.enderecoEntrega) {
      const { rua, numero, bairro, cidade, complemento, referencia } = pedido.enderecoEntrega;
      linhas.push(`Endereço: ${rua}, ${numero} - ${bairro}, ${cidade}`);
      if (complemento?.trim()) {
        linhas.push(`Complemento: ${complemento.trim()}`);
      }
      if (referencia?.trim()) {
        linhas.push(`Ponto de Referência: ${referencia.trim()}`);
      }
    }
    if (pedido.observacoesEntrega?.trim()) {
      linhas.push(`Obs. Entrega: ${pedido.observacoesEntrega.trim()}`);
    }
  } else {
    linhas.push('ATENDIMENTO: RETIRADA NO LOCAL');
  }
  linhas.push('');

  // Itens do Pedido
  linhas.push('ITENS:');
  for (const item of pedido.itens) {
    const nome = item.nome || item.nomeProduto || 'Item';
    const subtotal = item.subtotal ?? item.precoTotal ?? (item.precoUnitario * item.quantidade);
    const temAdicionais = Boolean(item.adicionais && item.adicionais.length > 0);
    const precoBase = item.precoBaseLanche !== undefined
      ? item.precoBaseLanche
      : (temAdicionais
          ? Math.max(0, item.precoUnitario - item.adicionais!.reduce((sum, a) => sum + (a.subtotal || a.preco * (a.quantidade || 1)), 0))
          : item.precoUnitario);

    linhas.push(`${item.quantidade} × ${nome} — ${formatarMoeda(precoBase)}`);

    if (temAdicionais) {
      for (const ad of item.adicionais!) {
        const qtd = ad.quantidade || 1;
        const precoUn = ad.precoUnitario || ad.preco || 0;
        const sub = ad.subtotal !== undefined ? ad.subtotal : (qtd * precoUn);
        linhas.push(`  - ${ad.nome} (${qtd} × ${formatarMoeda(precoUn)}): ${formatarMoeda(sub)}`);
      }
      linhas.push(`  Subtotal personalizado: ${formatarMoeda(subtotal)}`);
    }

    if (item.pontoCarne) {
      linhas.push(`  Ponto da carne: ${item.pontoCarne}`);
    }

    const obs = item.observacoes || item.observacaoItem;
    if (obs?.trim()) {
      linhas.push(`  Obs: ${obs.trim()}`);
    }
  }
  linhas.push('');

  // Observações gerais
  const obsGerais = pedido.observacoesGerais || pedido.observacoes;
  if (obsGerais?.trim()) {
    linhas.push(`Observações gerais: ${obsGerais.trim()}`);
    linhas.push('');
  }

  // Totais financeiros
  const subtotalPedido = pedido.subtotal ?? pedido.valorBruto ?? 0;
  linhas.push(`Subtotal: ${formatarMoeda(subtotalPedido)}`);
  if (pedido.desconto > 0) {
    linhas.push(`Desconto: -${formatarMoeda(pedido.desconto)}`);
  }
  if (pedido.tipoAtendimento === 'ENTREGA') {
    const taxa = pedido.taxaEntrega || 0;
    linhas.push(`Taxa de entrega: ${formatarMoeda(taxa)}`);
  }
  linhas.push(`Total: ${formatarMoeda(pedido.valorFinal)}`);
  linhas.push('');

  // Forma de pagamento e status
  const formaLower = String(pedido.formaPagamento || '').toLowerCase();
  let formaNome = 'PIX';
  let statusTexto = 'AGUARDANDO PAGAMENTO';

  if (formaLower === 'pix') {
    formaNome = 'PIX';
    statusTexto = pedido.statusPagamento === 'PAGO' ? 'PAGO' : 'AGUARDANDO APROVAÇÃO';
  } else if (formaLower === 'dinheiro') {
    formaNome = pedido.tipoAtendimento === 'ENTREGA' ? 'DINHEIRO NA ENTREGA' : 'DINHEIRO NA RETIRADA';
    statusTexto = 'PAGAMENTO NA ENTREGA/RETIRADA';
  } else {
    formaNome = pedido.tipoAtendimento === 'ENTREGA' ? 'CARTÃO NA ENTREGA (MAQUININHA)' : 'CARTÃO NA RETIRADA';
    statusTexto = 'PAGAMENTO NA ENTREGA/RETIRADA';
  }

  linhas.push(`Pagamento: ${formaNome}`);
  linhas.push(`Status: ${statusTexto}`);

  // Troco para dinheiro
  if (formaLower === 'dinheiro') {
    if (pedido.precisaTroco && pedido.trocoPara && pedido.trocoPara > pedido.valorFinal) {
      const troco = pedido.trocoPara - pedido.valorFinal;
      linhas.push(`Troco para: ${formatarMoeda(pedido.trocoPara)} (Levar troco de ${formatarMoeda(troco)})`);
    } else {
      linhas.push('Troco: Não precisa de troco (Valor exato)');
    }
  }

  // Tempo de preparo estimado
  const tempo =
    pedido.tempoPreparoEstimadoMinutos ||
    configLoja?.tempoEstimadoPreparoMinutos ||
    configLoja?.tempoPreparoMinutos ||
    40;
  linhas.push(`Preparo estimado: ~${tempo} minutos (estimativa)`);

  // Link de Acompanhamento em Tempo Real
  if (pedido.tokenPublico) {
    linhas.push('');
    linhas.push(`📱 Acompanhe o status do seu pedido online:`);
    linhas.push(gerarUrlAcompanhamentoPedido(pedido.tokenPublico));
  }

  return linhas.join('\n');
}

export function gerarLinkWhatsapp(numeroE164: string, mensagem: string): string {
  const numeroLimpo = limparNumeroTelefone(numeroE164);
  const textoCodificado = encodeURIComponent(mensagem);
  return `https://wa.me/${numeroLimpo}?text=${textoCodificado}`;
}
