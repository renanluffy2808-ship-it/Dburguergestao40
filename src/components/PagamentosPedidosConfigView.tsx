import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  CreditCard,
  Banknote,
  Clock,
  Truck,
  Store,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Save,
  Send,
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TipoChavePix, ProvedorPix } from '../types';
import { validarTelefoneWhatsapp, formatarTelefoneVisual, gerarLinkWhatsapp } from '../lib/whatsappFormatter';

export const PagamentosPedidosConfigView: React.FC = () => {
  const { config, atualizarConfigPedidosPagamentos } = useApp();
  const cfg = config.pedidosPagamentos;

  const [form, setForm] = useState({
    whatsappLoja: cfg?.whatsappLoja || '',
    chavePix: cfg?.chavePix || '',
    tipoChavePix: (cfg?.tipoChavePix || 'TELEFONE') as TipoChavePix,
    titularPix: cfg?.titularPix || '',
    instituicaoPix: cfg?.instituicaoPix || '',
    provedorPix: (cfg?.provedorPix || 'MERCADO_PAGO') as ProvedorPix,
    mercadoPagoAccessToken: cfg?.mercadoPagoAccessToken || '',
    mercadoPagoPublicKey: cfg?.mercadoPagoPublicKey || '',
    mercadoPagoSandbox: cfg?.mercadoPagoSandbox ?? true,
    tempoEstimadoPreparoMinutos: cfg?.tempoEstimadoPreparoMinutos || 30,
    aceitaPix: cfg?.aceitaPix ?? true,
    aceitaCartao: cfg?.aceitaCartao ?? true,
    aceitaDinheiro: cfg?.aceitaDinheiro ?? true,
    permiteEntrega: cfg?.permiteEntrega ?? true,
    permiteRetirada: cfg?.permiteRetirada ?? true,
    taxaEntregaPadrao: cfg?.taxaEntregaPadrao ?? 7.0,
    instrucoesEntrega: cfg?.instrucoesEntrega || 'Entregamos em até 45 minutos no endereço informado.',
    instrucoesRetirada: cfg?.instrucoesRetirada || 'Retire no balcão apresentando o número do pedido.',
    ativo: cfg?.ativo ?? true,
  });

  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [errosValidacao, setErrosValidacao] = useState<string[]>([]);
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Link público do cardápio digital
  const urlCardapio = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?view=cardapio`
    : '';

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(urlCardapio);
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 3000);
    } catch {
      // fallback
    }
  };

  const validarFormulario = () => {
    const erros: string[] = [];

    // WhatsApp
    const validacaoTel = validarTelefoneWhatsapp(form.whatsappLoja);
    if (!validacaoTel.valido) {
      erros.push(`WhatsApp do proprietário: ${validacaoTel.erro || 'Número inválido'}`);
    }

    // Chave Pix se Pix estiver ativado
    if (form.aceitaPix) {
      if (!form.chavePix.trim()) {
        erros.push('Chave Pix é obrigatória quando o método Pix está ativo.');
      }
      if (!form.titularPix.trim()) {
        erros.push('Nome do titular da conta Pix é obrigatório.');
      }
    }

    // Métodos de pagamento
    if (!form.aceitaPix && !form.aceitaCartao && !form.aceitaDinheiro) {
      erros.push('Selecione pelo menos uma forma de pagamento aceita.');
    }

    // Modalidade de atendimento
    if (!form.permiteEntrega && !form.permiteRetirada) {
      erros.push('Ative pelo menos uma modalidade: Entrega ou Retirada no local.');
    }

    // Tempo de preparo
    if (form.tempoEstimadoPreparoMinutos <= 0) {
      erros.push('Informe um tempo estimado de preparo maior que zero (em minutos).');
    }

    if (form.permiteEntrega && form.taxaEntregaPadrao < 0) {
      erros.push('A taxa de entrega não pode ser negativa.');
    }

    return erros;
  };

  const handleSalvar = async () => {
    const erros = validarFormulario();
    setErrosValidacao(erros);

    if (erros.length > 0) {
      return;
    }

    setSalvando(true);
    try {
      await atualizarConfigPedidosPagamentos({
        ...form,
        whatsappLoja: form.whatsappLoja.replace(/\D/g, ''),
        tempoPreparoMinutos: Number(form.tempoEstimadoPreparoMinutos),
        tempoEstimadoPreparoMinutos: Number(form.tempoEstimadoPreparoMinutos),
        taxaEntrega: Number(form.taxaEntregaPadrao),
        taxaEntregaPadrao: Number(form.taxaEntregaPadrao),
      });

      setMensagemSucesso('Configurações salvas e aplicadas com sucesso!');
      setTimeout(() => setMensagemSucesso(''), 4000);
    } catch (e) {
      setErrosValidacao(['Erro ao salvar configurações no servidor.']);
    } finally {
      setSalvando(false);
    }
  };

  const handleTestarWhatsapp = () => {
    const telLimpo = form.whatsappLoja.replace(/\D/g, '');
    if (!telLimpo || telLimpo.length < 12) {
      alert('Informe um número de WhatsApp válido (+55 DDD 9XXXX-XXXX) antes de testar.');
      return;
    }

    const mensagemTeste = `🍔 *TESTE DE INTEGRAÇÃO — D' BURGER*\n\nParabéns! Suas configurações de WhatsApp para o destino dos pedidos estão funcionando corretamente no número +${telLimpo}.`;
    const link = gerarLinkWhatsapp(telLimpo, mensagemTeste);
    window.open(link, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Área Administrativa Privada
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Protegido
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Pagamentos e Pedidos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Configure seu WhatsApp de atendimento, chave Pix, integrações de pagamento e regras de entrega/retirada para o cardápio digital dos clientes.
          </p>
        </div>

        {/* Cardápio Digital Link Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 flex flex-col gap-2 min-w-[280px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Cardápio Digital (Cliente)
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
              Sem login do cliente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={urlCardapio}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-mono truncate"
            />
            <button
              onClick={handleCopiarLink}
              title="Copiar Link"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition shrink-0"
            >
              <Copy className="w-4 h-4 text-amber-400" />
            </button>
            <a
              href={urlCardapio}
              target="_blank"
              rel="noreferrer"
              title="Abrir em nova aba"
              className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          {copiadoLink && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Link copiado para a área de transferência!
            </p>
          )}
        </div>
      </div>

      {/* Alertas de validação e sucesso */}
      {mensagemSucesso && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{mensagemSucesso}</p>
        </div>
      )}

      {errosValidacao.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-200 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            Atenção: verifique as configurações pendentes
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 text-rose-200/90 pl-1">
            {errosValidacao.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO 1: Destino WhatsApp do Proprietário */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">WhatsApp do Proprietário</h2>
                <p className="text-xs text-zinc-400">Destino obrigatório das notificações de novos pedidos</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Número de WhatsApp da Loja (com DDI e DDD)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={form.whatsappLoja}
                    onChange={(e) => setForm({ ...form, whatsappLoja: e.target.value })}
                    placeholder="Ex: 5511999998888 ou (11) 99999-8888"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                  {form.whatsappLoja && (
                    <span className="absolute right-3 top-3 text-[11px] font-mono text-zinc-400">
                      {formatarTelefoneVisual(form.whatsappLoja)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleTestarWhatsapp}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" /> Testar
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Formato internacional: +55 (Brasil) + 2 dígitos DDD + 8 ou 9 dígitos do celular. Não inventamos nem fixamos números no código.
              </p>
            </div>

            {/* Tempo Estimado de Preparo */}
            <div className="pt-2 border-t border-zinc-800/80">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Tempo Estimado de Preparo (minutos)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="180"
                  step="5"
                  value={form.tempoEstimadoPreparoMinutos}
                  onChange={(e) => setForm({ ...form, tempoEstimadoPreparoMinutos: Number(e.target.value) })}
                  className="w-32 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                />
                <span className="text-sm text-zinc-400">minutos (estimativa exibida no checkout e no WhatsApp)</span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Informado ao cliente com aviso de estimativa operacional para não prometer hora cravada.
              </p>
            </div>
          </div>
        </div>

        {/* BLOCO 2: Modalidades de Atendimento (Entrega e Retirada) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Entrega e Retirada</h2>
              <p className="text-xs text-zinc-400">Regras e taxas de atendimento do cardápio</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Opções de Atendimento */}
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${form.permiteEntrega ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={form.permiteEntrega}
                  onChange={(e) => setForm({ ...form, permiteEntrega: e.target.checked })}
                  className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-bold text-xs text-white block">Permitir Entrega</span>
                  <span className="text-[11px] text-zinc-400">Exige endereço completo e aplica taxa</span>
                </div>
              </label>

              <label className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${form.permiteRetirada ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={form.permiteRetirada}
                  onChange={(e) => setForm({ ...form, permiteRetirada: e.target.checked })}
                  className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-bold text-xs text-white block">Permitir Retirada</span>
                  <span className="text-[11px] text-zinc-400">Sem taxa e sem pedir endereço</span>
                </div>
              </label>
            </div>

            {/* Taxa de Entrega */}
            {form.permiteEntrega && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Taxa de Entrega Fixa (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-zinc-500 text-sm">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.taxaEntregaPadrao}
                    onChange={(e) => setForm({ ...form, taxaEntregaPadrao: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Valor real aplicado no resumo do pedido e discriminado na mensagem do WhatsApp.
                </p>
              </div>
            )}

            {/* Instruções */}
            <div className="space-y-3 pt-2 border-t border-zinc-800/80">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Instruções para Entrega (visíveis ao cliente)
                </label>
                <textarea
                  rows={2}
                  value={form.instrucoesEntrega}
                  onChange={(e) => setForm({ ...form, instrucoesEntrega: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Instruções para Retirada no Local
                </label>
                <textarea
                  rows={2}
                  value={form.instrucoesRetirada}
                  onChange={(e) => setForm({ ...form, instrucoesRetirada: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 3: Chave Pix e Integração com Confirmação Real */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base">Chave Pix & Provedor com Confirmação Real</h2>
                <p className="text-xs text-zinc-400">
                  O pedido Pix <strong>só é enviado ao WhatsApp após o servidor validar a confirmação real do pagamento</strong>
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.aceitaPix}
                onChange={(e) => setForm({ ...form, aceitaPix: e.target.checked })}
                className="rounded border-zinc-700 text-cyan-500 focus:ring-cyan-500"
              />
              Habilitar Pagamento via Pix
            </label>
          </div>

          {form.aceitaPix && (
            <div className="space-y-5">
              {/* Aviso de Segurança Pix */}
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-600/30 text-cyan-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-cyan-300">
                  <ShieldCheck className="w-4 h-4" /> Regra Estrita de Segurança Pix Ativa
                </p>
                <p className="text-cyan-200/80">
                  O sistema <strong>não</strong> considera pedidos pagos por clique em &quot;Já paguei&quot; nem por captura de tela. O servidor consulta diretamente o provedor e só gera o despacho para o WhatsApp quando a transação constar como efetivamente paga.
                </p>
              </div>

              {/* Dados da Chave Pix do Proprietário */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Tipo de Chave Pix
                  </label>
                  <select
                    value={form.tipoChavePix}
                    onChange={(e) => setForm({ ...form, tipoChavePix: e.target.value as TipoChavePix })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CPF_CNPJ">CPF ou CNPJ</option>
                    <option value="TELEFONE">Telefone celular</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="CHAVE_ALEATORIA">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Chave Pix do Proprietário
                  </label>
                  <input
                    type="text"
                    value={form.chavePix}
                    onChange={(e) => setForm({ ...form, chavePix: e.target.value })}
                    placeholder="Ex: 11999998888, contato@dburger.com ou chave UUID"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Nome do Titular da Conta
                  </label>
                  <input
                    type="text"
                    value={form.titularPix}
                    onChange={(e) => setForm({ ...form, titularPix: e.target.value })}
                    placeholder="Ex: D' Burger Hamburgueria LTDA"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Instituição Financeira / Banco
                  </label>
                  <input
                    type="text"
                    value={form.instituicaoPix}
                    onChange={(e) => setForm({ ...form, instituicaoPix: e.target.value })}
                    placeholder="Ex: Nubank, Banco Inter, Mercado Pago, Itaú..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Escolha do Provedor de Cobrança com Confirmação */}
              <div className="pt-4 border-t border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-white text-sm">
                    Provedor de Pagamento para Confirmação Automática
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, provedorPix: 'MERCADO_PAGO' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.provedorPix === 'MERCADO_PAGO' ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      Mercado Pago (Oficial)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, provedorPix: 'SIMULADOR_TESTE' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.provedorPix === 'SIMULADOR_TESTE' ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      Simulador Integrado / Sandbox
                    </button>
                  </div>
                </div>

                {form.provedorPix === 'MERCADO_PAGO' ? (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">Credenciais da API do Mercado Pago</span>
                      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.mercadoPagoSandbox}
                          onChange={(e) => setForm({ ...form, mercadoPagoSandbox: e.target.checked })}
                          className="rounded border-zinc-700 text-cyan-500"
                        />
                        Modo Sandbox (Testes)
                      </label>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1">
                          Access Token Privado (Server-Side)
                        </label>
                        <input
                          type="password"
                          value={form.mercadoPagoAccessToken}
                          onChange={(e) => setForm({ ...form, mercadoPagoAccessToken: e.target.value })}
                          placeholder="APP_USR-xxxxxxxxx ou TEST-xxxxxxxxx"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-1">
                          Public Key (Opcional para checkout transparente)
                        </label>
                        <input
                          type="text"
                          value={form.mercadoPagoPublicKey}
                          onChange={(e) => setForm({ ...form, mercadoPagoPublicKey: e.target.value })}
                          placeholder="APP_USR-xxxxxxxxx"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80 space-y-1">
                      <p className="font-semibold text-zinc-300">ℹ️ Informações sobre tarifas e cadastro Mercado Pago:</p>
                      <p>• <strong>Sem mensalidade fixa:</strong> O Mercado Pago cobra apenas taxa por transação aprovada (aproximadamente 0,99% a 1,99% no Pix).</p>
                      <p>• Para obter suas credenciais, acesse o painel do Mercado Pago Developers &gt; Suas integrações &gt; Credenciais de produção ou teste.</p>
                      <p>• Se deixar o Access Token vazio, o sistema operará automaticamente em modo Sandbox para testes seguros sem custos.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-amber-800/40 rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-xs text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> Modo Simulador Integrado Ativo
                    </p>
                    <p className="text-xs text-zinc-300">
                      Ideal para testar e demonstrar todo o fluxo do cliente: gera QR Code válido, código Copia e Cola e disponibiliza o botão de confirmação simulada no checkout para validar o disparo real ao WhatsApp sem cobrança financeira.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BLOCO 4: Formas de Pagamento Presenciais (Cartão e Dinheiro) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Cartão e Dinheiro Presencial</h2>
              <p className="text-xs text-zinc-400">
                Pagamentos realizados na entrega ou na retirada (enviados imediatamente ao WhatsApp após conclusão do checkout)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cartão */}
            <label className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${form.aceitaCartao ? 'bg-purple-950/20 border-purple-500/40' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
              <input
                type="checkbox"
                checked={form.aceitaCartao}
                onChange={(e) => setForm({ ...form, aceitaCartao: e.target.checked })}
                className="mt-1 rounded border-zinc-700 text-purple-500 focus:ring-purple-500"
              />
              <div className="space-y-1">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-400" /> Cartão (Máquina na Entrega ou Balcão)
                </span>
                <p className="text-xs text-zinc-400">
                  Permite Débito/Crédito. O pedido é marcado como &quot;PAGAMENTO NA ENTREGA/RETIRADA&quot; e encaminhado diretamente ao WhatsApp.
                </p>
              </div>
            </label>

            {/* Dinheiro */}
            <label className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${form.aceitaDinheiro ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-zinc-950 border-zinc-800 opacity-60'}`}>
              <input
                type="checkbox"
                checked={form.aceitaDinheiro}
                onChange={(e) => setForm({ ...form, aceitaDinheiro: e.target.checked })}
                className="mt-1 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="space-y-1">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-400" /> Dinheiro em Espécie com Troco
                </span>
                <p className="text-xs text-zinc-400">
                  Inclui automaticamente a pergunta de troco no checkout (&quot;Precisa de troco? Para quanto?&quot;) e envia o troco discriminado ao WhatsApp.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Botão de Salvar Configurações */}
      <div className="sticky bottom-4 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Ao salvar, as regras passam a valer imediatamente para todos os novos pedidos online.</span>
        </div>

        <button
          type="button"
          onClick={handleSalvar}
          disabled={salvando}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {salvando ? 'Salvando...' : 'Salvar e Aplicar Configurações'}
        </button>
      </div>
    </div>
  );
};
