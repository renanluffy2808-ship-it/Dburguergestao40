/**
 * D' Burger Gestão - Motor de Precisão Financeira e Matemática Decimal
 * Garante que não haja erros de ponto flutuante binário (IEEE 754) em somas monetárias.
 */

export class DecimalMoney {
  // Representação em centavos (inteiro grande) ou fator de escala 10000 para custos unitários de precisão
  private scaledValue: bigint; // valor escalado por 10000 (4 casas decimais)
  private static readonly SCALE = 10000n;

  constructor(value: number | string | bigint | DecimalMoney = 0) {
    if (value instanceof DecimalMoney) {
      this.scaledValue = value.scaledValue;
    } else if (typeof value === 'bigint') {
      this.scaledValue = value * DecimalMoney.SCALE;
    } else if (typeof value === 'number') {
      // arredonda para 4 casas decimais para evitar ruídos de float
      const rounded = Math.round(value * 10000);
      this.scaledValue = BigInt(rounded);
    } else if (typeof value === 'string') {
      const clean = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean) || 0;
      this.scaledValue = BigInt(Math.round(num * 10000));
    } else {
      this.scaledValue = 0n;
    }
  }

  static fromScaled(scaled: bigint): DecimalMoney {
    const d = new DecimalMoney(0);
    d.scaledValue = scaled;
    return d;
  }

  plus(other: DecimalMoney | number): DecimalMoney {
    const o = other instanceof DecimalMoney ? other : new DecimalMoney(other);
    return DecimalMoney.fromScaled(this.scaledValue + o.scaledValue);
  }

  minus(other: DecimalMoney | number): DecimalMoney {
    const o = other instanceof DecimalMoney ? other : new DecimalMoney(other);
    return DecimalMoney.fromScaled(this.scaledValue - o.scaledValue);
  }

  times(factor: number): DecimalMoney {
    // multiplica com alta precisão
    const factorScaled = BigInt(Math.round(factor * 10000));
    return DecimalMoney.fromScaled((this.scaledValue * factorScaled) / DecimalMoney.SCALE);
  }

  dividedBy(divisor: number): DecimalMoney {
    if (divisor === 0) return new DecimalMoney(0);
    const divisorScaled = BigInt(Math.round(divisor * 10000));
    if (divisorScaled === 0n) return new DecimalMoney(0);
    return DecimalMoney.fromScaled((this.scaledValue * DecimalMoney.SCALE) / divisorScaled);
  }

  toNumber(): number {
    return Number(this.scaledValue) / 10000;
  }

  /**
   * Formata no padrão brasileiro R$ 0,00
   */
  toFormatBRL(): string {
    const num = this.toNumber();
    return num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Formata custo de precisão com até 4 casas (ex: R$ 0,0425 para gramas)
   */
  toPrecisionBRL(): string {
    const num = this.toNumber();
    return num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
}

/**
 * Utilitários de conversão de unidades
 */
export type UnidadeMedida = 'kg' | 'g' | 'L' | 'ml' | 'unidade' | 'pacote' | 'fardo' | 'caixa';

export interface ConversaoResultado {
  sucesso: boolean;
  fator: number; // quantidade em unidade de consumo por unidade de compra
  mensagem?: string;
}

export function validarEConverterUnidades(
  unidadeCompra: UnidadeMedida,
  unidadeConsumo: UnidadeMedida,
  fatorEquivalenciaCustomizado?: number
): ConversaoResultado {
  if (unidadeCompra === unidadeConsumo) {
    return { sucesso: true, fator: 1 };
  }

  // Peso
  if (unidadeCompra === 'kg' && unidadeConsumo === 'g') {
    return { sucesso: true, fator: 1000 };
  }
  if (unidadeCompra === 'g' && unidadeConsumo === 'kg') {
    return { sucesso: true, fator: 0.001 };
  }

  // Volume
  if (unidadeCompra === 'L' && unidadeConsumo === 'ml') {
    return { sucesso: true, fator: 1000 };
  }
  if (unidadeCompra === 'ml' && unidadeConsumo === 'L') {
    return { sucesso: true, fator: 0.001 };
  }

  // Embalagens fechadas (pacote, fardo, caixa, unidade)
  if (fatorEquivalenciaCustomizado && fatorEquivalenciaCustomizado > 0) {
    return { sucesso: true, fator: fatorEquivalenciaCustomizado };
  }

  return {
    sucesso: false,
    fator: 1,
    mensagem: `Não é possível converter automaticamente ${unidadeCompra} para ${unidadeConsumo} sem informar quantas unidades ou gramas contém cada pacote/caixa.`,
  };
}

/**
 * Cálculo de Custo Médio Ponderado (CMP)
 */
export function calcularCustoMedioPonderado(
  estoqueAtual: number,
  custoAtualPorUnidade: number,
  quantidadeComprada: number,
  precoTotalPagoCompra: number
): { novoEstoque: number; novoCustoUnitario: number } {
  const qtdAtual = Math.max(0, estoqueAtual);
  const custoAtual = Math.max(0, custoAtualPorUnidade);
  const qtdNova = Math.max(0, quantidadeComprada);
  const valorTotalNova = Math.max(0, precoTotalPagoCompra);

  const valorEstoqueAtual = qtdAtual * custoAtual;
  const novoEstoque = qtdAtual + qtdNova;

  if (novoEstoque <= 0) {
    return { novoEstoque: 0, novoCustoUnitario: custoAtual };
  }

  const novoCustoUnitario = (valorEstoqueAtual + valorTotalNova) / novoEstoque;
  return {
    novoEstoque,
    novoCustoUnitario: Math.round(novoCustoUnitario * 10000) / 10000,
  };
}

/**
 * Fórmulas Financeiras de Precificação e Rentabilidade
 *
 * Fórmula solicitada pelo usuário:
 * Preço Sugerido = (C + F) / (1 - t - r - m)
 * onde:
 * C = CMV dos ingredientes e materiais diretos (R$)
 * F = Custo fixo rateado por unidade (R$)
 * t = taxa percentual de pagamento (ex: 0.0070 para 0,70%)
 * r = reserva operacional percentual (ex: 0.121 para 12,1%)
 * m = margem de contribuição ou lucro-alvo desejado (ex: 0.25 para 25%)
 */
export interface ParametrosPrecificacao {
  cmv: number; // Custo dos ingredientes e embalagens
  custoFixoUnitario: number; // F (rateio de despesas fixas)
  taxaPagamentoPercent: number; // t (em %, ex: 0.70)
  reservaOperacionalPercent: number; // r (em %, ex: 12.10)
  margemAlvoPercent: number; // m (em %, ex: 25.0)
  precoVendaAtual: number; // Preço praticado no cardápio
}

export interface ResultadoPrecificacao {
  cmv: number;
  precoVendaAtual: number;
  markupAtual: number; // Preço / CMV
  margemBrutaIngredientesPercent: number; // (Preço - CMV) / Preço * 100
  taxaPagamentoValor: number; // Preço * t
  reservaOperacionalValor: number; // Preço * r
  custoFixoValor: number; // F
  saldoEstimadoUnitario: number; // Preço - CMV - Taxa - Reserva - Fixo
  margemContribuicaoRealValor: number; // Preço - CMV - Taxa
  margemContribuicaoRealPercent: number; // (Preço - CMV - Taxa) / Preço * 100
  precoMinimoSugerido: number; // (C + F) / (1 - t - r) [sem margem de lucro]
  precoRecomendadoAlvo: number; // (C + F) / (1 - t - r - m)
  diferencaPreco: number; // Preço Atual - Preço Recomendado
  statusCor: 'verde' | 'amarelo' | 'vermelho';
  motivoCor: string;
}

export function calcularPrecificacao(params: ParametrosPrecificacao): ResultadoPrecificacao {
  const C = Math.max(0, params.cmv);
  const F = Math.max(0, params.custoFixoUnitario);
  const t = Math.max(0, params.taxaPagamentoPercent) / 100;
  const r = Math.max(0, params.reservaOperacionalPercent) / 100;
  const m = Math.max(0, params.margemAlvoPercent) / 100;
  const P = Math.max(0, params.precoVendaAtual);

  const markupAtual = C > 0 ? P / C : 0;
  const margemBrutaIngredientesPercent = P > 0 ? ((P - C) / P) * 100 : 0;

  const taxaPagamentoValor = P * t;
  const reservaOperacionalValor = P * r;
  const custoFixoValor = F;

  const margemContribuicaoRealValor = P - C - taxaPagamentoValor;
  const margemContribuicaoRealPercent = P > 0 ? (margemContribuicaoRealValor / P) * 100 : 0;

  const saldoEstimadoUnitario = P - C - taxaPagamentoValor - reservaOperacionalValor - custoFixoValor;

  // Preço Mínimo (ponto de equilíbrio cobrindo C, F, t e r, lucro zero)
  const denominadorMinimo = 1 - t - r;
  const precoMinimoSugerido = denominadorMinimo > 0.05 ? (C + F) / denominadorMinimo : (C + F) * 1.5;

  // Preço Recomendado com margem-alvo
  const denominadorAlvo = 1 - t - r - m;
  let precoRecomendadoAlvo = 0;
  if (denominadorAlvo > 0.05) {
    precoRecomendadoAlvo = (C + F) / denominadorAlvo;
  } else {
    // Caso soma das taxas + reserva + margem seja >= 100%
    precoRecomendadoAlvo = (C + F) / 0.1; // fallback seguro para não dividir por <= 0
  }

  const diferencaPreco = P - precoRecomendadoAlvo;

  // Classificação por cores conforme regras obrigatórias
  let statusCor: 'verde' | 'amarelo' | 'vermelho' = 'verde';
  let motivoCor = 'Preço atende à meta de rentabilidade configurada.';

  if (C <= 0) {
    statusCor = 'vermelho';
    motivoCor = 'Custo incompleto (CMV é zero ou não possui ingredientes com preço cadastrado).';
  } else if (P < precoMinimoSugerido) {
    statusCor = 'vermelho';
    motivoCor = `Preço de venda (R$ ${P.toFixed(2)}) está abaixo do preço mínimo necessário (R$ ${precoMinimoSugerido.toFixed(2)}) para cobrir custos e taxas.`;
  } else if (P < precoRecomendadoAlvo) {
    statusCor = 'amarelo';
    motivoCor = `Preço atual cobre os custos, mas fica abaixo da meta de lucro recomendada (R$ ${precoRecomendadoAlvo.toFixed(2)}).`;
  } else {
    statusCor = 'verde';
    motivoCor = `Margem saudável! Atende à meta de ${params.margemAlvoPercent.toFixed(1)}% com saldo positivo.`;
  }

  return {
    cmv: Math.round(C * 100) / 100,
    precoVendaAtual: Math.round(P * 100) / 100,
    markupAtual: Math.round(markupAtual * 100) / 100,
    margemBrutaIngredientesPercent: Math.round(margemBrutaIngredientesPercent * 100) / 100,
    taxaPagamentoValor: Math.round(taxaPagamentoValor * 100) / 100,
    reservaOperacionalValor: Math.round(reservaOperacionalValor * 100) / 100,
    custoFixoValor: Math.round(custoFixoValor * 100) / 100,
    saldoEstimadoUnitario: Math.round(saldoEstimadoUnitario * 100) / 100,
    margemContribuicaoRealValor: Math.round(margemContribuicaoRealValor * 100) / 100,
    margemContribuicaoRealPercent: Math.round(margemContribuicaoRealPercent * 100) / 100,
    precoMinimoSugerido: Math.round(precoMinimoSugerido * 100) / 100,
    precoRecomendadoAlvo: Math.round(precoRecomendadoAlvo * 100) / 100,
    diferencaPreco: Math.round(diferencaPreco * 100) / 100,
    statusCor,
    motivoCor,
  };
}
