import React, { useState, useEffect } from 'react';
import {
  Settings,
  DollarSign,
  Percent,
  Flame,
  Zap,
  Droplet,
  Wifi,
  Wrench,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Shield,
  Save,
  Palette,
  Copy,
  ExternalLink,
  Smartphone,
  Store,
  Database,
  Server,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PersonalizarCardapioModal } from './PersonalizarCardapioModal';
import {
  obterLojaIdAtual,
  definirLojaId,
  gerarUrlCardapioPublico,
  apiUrl,
  getServidorOnlineUrl,
  definirServidorOnlineUrl,
  isServidorCustomizado,
  testarConexaoServidor,
  ResultadoConexaoServidor,
  isAndroidApp,
  SERVIDOR_ONLINE_PADRAO,
} from '../lib/lojaId';

export const ConfiguracoesView: React.FC = () => {
  const {
    config,
    atualizarConfig,
    exportarBackupJson,
    importarBackupJson,
    reiniciarParaDadosPadrao,
    iniciarBancoVazio,
    zerarCaixaEVendas,
  } = useApp();

  const [nomeHamburgueria, setNomeHamburgueria] = useState(config.nomeHamburgueria);
  const [taxaMaquineta, setTaxaMaquineta] = useState(config.taxaMaquinetaPadrao);
  const [taxaPix, setTaxaPix] = useState(config.taxaPix);
  const [taxaDebito, setTaxaDebito] = useState(config.taxaDebito);
  const [taxaCredito, setTaxaCredito] = useState(config.taxaCredito);
  const [reservaPercent, setReservaPercent] = useState(config.reservaOperacionalPercent);
  const [metaMargem, setMetaMargem] = useState(config.metaMargemContribuicao);
  const [previsaoLanches, setPrevisaoLanches] = useState(config.previsaoVendasMensaisLanches);

  // Modal de Personalização Visual do Cardápio
  const [modalCustomizarAberto, setModalCustomizarAberto] = useState(false);
  const [lojaIdInstalacao, setLojaIdInstalacao] = useState(() => obterLojaIdAtual());
  const [editandoLojaId, setEditandoLojaId] = useState(false);
  const [novoLojaIdInput, setNovoLojaIdInput] = useState(() => obterLojaIdAtual());
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Custos Fixos Mensais
  const [custosFixos, setCustosFixos] = useState([...config.custosFixos]);
  const [novoCustoNome, setNovoCustoNome] = useState('');
  const [novoCustoValor, setNovoCustoValor] = useState<number>(0);

  const [msgSucesso, setMsgSucesso] = useState('');
  const [msgErro, setMsgErro] = useState('');
  const [modalConfirmacaoReset, setModalConfirmacaoReset] = useState<'padrao' | 'vazio' | 'caixa' | null>(null);

  // Status de Banco de Dados e Nuvem
  const [dbStatus, setDbStatus] = useState<{
    engine: string;
    isConnected: boolean;
    persistentAcrossRestarts: boolean;
    databaseHost?: string;
    totalLojas: number;
    totalPedidos: number;
    totalProdutos: number;
    totalFotos: number;
    aviso?: string;
    ultimoBackupEm?: string;
    connectionError?: string | null;
  } | null>(null);
  const [carregandoBackupServidor, setCarregandoBackupServidor] = useState(false);
  const [inputDatabaseUrl, setInputDatabaseUrl] = useState('');
  const [conectandoDb, setConectandoDb] = useState(false);
  const [mostrarCampoConexao, setMostrarCampoConexao] = useState(false);

  // Servidor Online / Backend na Nuvem
  const [servidorUrlAtual, setServidorUrlAtual] = useState(() => getServidorOnlineUrl());
  const [editandoServidorUrl, setEditandoServidorUrl] = useState(false);
  const [inputServidorUrl, setInputServidorUrl] = useState(() => getServidorOnlineUrl());
  const [testandoServidor, setTestandoServidor] = useState(false);
  const [resultadoConexaoServidor, setResultadoConexaoServidor] = useState<ResultadoConexaoServidor | null>(null);

  const handleTestarConexaoServidor = async (urlTeste?: string) => {
    setTestandoServidor(true);
    setResultadoConexaoServidor(null);
    try {
      const res = await testarConexaoServidor(urlTeste || servidorUrlAtual);
      setResultadoConexaoServidor(res);
    } catch {
      setResultadoConexaoServidor({
        sucesso: false,
        mensagem: 'Erro inesperado ao consultar o servidor.',
      });
    } finally {
      setTestandoServidor(false);
    }
  };

  const handleSalvarServidorUrl = () => {
    const limpo = inputServidorUrl.trim().replace(/\/+$/, '');
    definirServidorOnlineUrl(limpo);
    const atualizada = getServidorOnlineUrl();
    setServidorUrlAtual(atualizada);
    setEditandoServidorUrl(false);
    setMsgSucesso('URL do Servidor Online atualizada!');
    setTimeout(() => setMsgSucesso(''), 3000);
    handleTestarConexaoServidor(atualizada);
  };

  const handleRestaurarPadraoServidorUrl = () => {
    definirServidorOnlineUrl('');
    const padrao = getServidorOnlineUrl();
    setInputServidorUrl(padrao);
    setServidorUrlAtual(padrao);
    setEditandoServidorUrl(false);
    setMsgSucesso('URL do servidor restaurada para o padrão!');
    setTimeout(() => setMsgSucesso(''), 3000);
    handleTestarConexaoServidor(padrao);
  };

  const carregarStatusBanco = () => {
    fetch(apiUrl('/api/admin/database-status'))
      .then((r) => r.json())
      .then((data) => {
        if (data.sucesso) setDbStatus(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    carregarStatusBanco();
  }, []);

  const conectarPostgresNeon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDatabaseUrl.trim().startsWith('postgres')) {
      setMsgErro('A URL de conexão deve começar com postgresql://');
      setTimeout(() => setMsgErro(''), 4000);
      return;
    }

    setConectandoDb(true);
    try {
      const token = localStorage.getItem('DBURGER_ADMIN_SESSION_TOKEN') || '';
      const res = await fetch(apiUrl('/api/admin/database-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ databaseUrl: inputDatabaseUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.sucesso) {
        setMsgSucesso(data.mensagem || 'PostgreSQL conectado e dados migrados com sucesso!');
        setInputDatabaseUrl('');
        setMostrarCampoConexao(false);
        carregarStatusBanco();
      } else {
        setMsgErro(data.erro || data.mensagem || 'Falha ao conectar no PostgreSQL.');
      }
    } catch (err: any) {
      setMsgErro('Erro ao enviar requisição de conexão: ' + err.message);
    } finally {
      setConectandoDb(false);
      setTimeout(() => {
        setMsgSucesso('');
        setMsgErro('');
      }, 6000);
    }
  };

  const gerarBackupServidor = async () => {
    setCarregandoBackupServidor(true);
    try {
      const token = localStorage.getItem('DBURGER_ADMIN_SESSION_TOKEN') || '';
      const res = await fetch(apiUrl('/api/admin/backup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.sucesso) {
        setMsgSucesso(`Backup do servidor gerado com sucesso! Arquivo: ${data.arquivo}`);
      } else {
        setMsgErro(data.erro || 'Falha ao gerar backup no servidor.');
      }
    } catch (err: any) {
      setMsgErro('Erro de conexão ao gerar backup: ' + err.message);
    } finally {
      setCarregandoBackupServidor(false);
      setTimeout(() => {
        setMsgSucesso('');
        setMsgErro('');
      }, 4000);
    }
  };

  const salvarParametros = (e: React.FormEvent) => {
    e.preventDefault();
    atualizarConfig({
      nomeHamburgueria: nomeHamburgueria.trim() || "D' Burger",
      taxaMaquinetaPadrao: taxaMaquineta,
      taxaPix,
      taxaDebito,
      taxaCredito,
      reservaOperacionalPercent: reservaPercent,
      metaMargemContribuicao: metaMargem,
      previsaoVendasMensaisLanches: Math.max(1, previsaoLanches),
      custosFixos,
    });
    setMsgSucesso('Configurações financeiras salvas com sucesso!');
    setTimeout(() => setMsgSucesso(''), 2500);
  };

  const adicionarCustoFixo = () => {
    if (!novoCustoNome.trim() || novoCustoValor <= 0) return;
    const novo = {
      id: `cf-${Date.now()}`,
      nome: novoCustoNome.trim(),
      valorMensal: novoCustoValor,
      categoria: 'outros' as const,
    };
    setCustosFixos([...custosFixos, novo]);
    setNovoCustoNome('');
    setNovoCustoValor(0);
  };

  const removerCustoFixo = (id: string) => {
    setCustosFixos(custosFixos.filter((c) => c.id !== id));
  };

  const totalCustosFixos = custosFixos.reduce((acc, c) => acc + c.valorMensal, 0);
  const rateioFixoPorLanche = totalCustosFixos / Math.max(1, previsaoLanches);

  // Backup Exportar
  const handleBaixarBackup = () => {
    const jsonStr = exportarBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_dburger_gestao_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setMsgSucesso('Backup completo exportado com sucesso!');
    setTimeout(() => setMsgSucesso(''), 2500);
  };

  // Backup Importar
  const handleImportarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const res = importarBackupJson(content);
          if (res.sucesso) {
            setMsgSucesso('Backup restaurado com 100% de sucesso!');
            setTimeout(() => setMsgSucesso(''), 2500);
          } else {
            setMsgErro(res.erro || 'Erro ao importar backup.');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">Configurações Financeiras & Backup</h2>
          <p className="text-xs text-zinc-400">
            Ajuste as taxas de máquina, reserva operacional de contas fixas, custos mensais e segurança de dados.
          </p>
        </div>
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
          <span className="font-bold block">🍔 Pagamentos & Pedidos Web:</span>
          <span>Acesse a aba <strong>Pagamentos e Pedidos</strong> para cadastrar seu WhatsApp, Chave Pix e regras de entrega.</span>
        </div>
      </div>

      {msgSucesso && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{msgSucesso}</span>
        </div>
      )}

      {msgErro && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{msgErro}</span>
        </div>
      )}

      {/* SEÇÃO PRINCIPAL: Personalizar Meu Cardápio (Editor Visual Completo) */}
      <div className="bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-900 p-5 rounded-2xl border-2 border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Palette className="w-5 h-5" />
            </span>
            <h3 className="text-base font-black text-white tracking-wide">
              Personalizar meu cardápio
            </h3>
            <span className="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Novo Editor Visual
            </span>
          </div>
          <p className="text-xs text-zinc-300">
            Manipule livremente todos os elementos visuais do cardápio público: altere cores (fundo branco, preto ou qualquer cor), envie fotos de fundo da galeria do celular, configure logotipo, capa, fontes, posições dos títulos e oculte subtítulos sem deixar espaço vazio.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalCustomizarAberto(true)}
          className="px-5 py-3 rounded-xl text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Palette className="w-4 h-4" />
          <span>Personalizar meu cardápio</span>
        </button>
      </div>

      {/* SEÇÃO: Identidade da Instalação & Independência de Lojas */}
      <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-500" />
            <h3 className="font-extrabold text-sm text-white">
              Identificador da sua Instalação (Cardápio Independente)
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
            ID Atual: <strong className="text-amber-400">{lojaIdInstalacao}</strong>
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          O aplicativo é 100% reutilizável e independente. Se você administra sua hamburgueria no seu celular e sua irmã administra a loja de batatas no celular dela, cada instalação possui seu próprio cardápio, produtos, fotos, tema e pedidos isolados.
        </p>

        {/* Link do Cardápio para Clientes */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-mono select-all truncate">
            {gerarUrlCardapioPublico(lojaIdInstalacao)}
          </div>
          <button
            type="button"
            onClick={() => {
              const url = gerarUrlCardapioPublico(lojaIdInstalacao);
              navigator.clipboard.writeText(url);
              setCopiadoLink(true);
              setTimeout(() => setCopiadoLink(false), 2500);
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            {copiadoLink ? 'Link Copiado!' : 'Copiar Link para Clientes'}
          </button>
          <a
            href={gerarUrlCardapioPublico(lojaIdInstalacao)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Testar Cardápio
          </a>
        </div>

        {/* Opção para alterar identificador da instalação */}
        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
          {!editandoLojaId ? (
            <button
              type="button"
              onClick={() => {
                setNovoLojaIdInput(lojaIdInstalacao);
                setEditandoLojaId(true);
              }}
              className="text-zinc-400 hover:text-amber-400 transition-colors text-[11px] underline"
            >
              Deseja alterar o identificador desta instalação neste aparelho?
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full pt-1">
              <input
                type="text"
                value={novoLojaIdInput}
                onChange={(e) => setNovoLojaIdInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="ex: batata-show ou dburger"
                className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-mono flex-1 max-w-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const safe = definirLojaId(novoLojaIdInput);
                  setLojaIdInstalacao(safe);
                  setEditandoLojaId(false);
                  setMsgSucesso(`Instalação configurada para o identificador "${safe}"!`);
                  setTimeout(() => setMsgSucesso(''), 3000);
                }}
                className="px-3 py-1.5 bg-amber-500 text-black font-bold text-xs rounded-lg hover:bg-amber-400"
              >
                Salvar ID
              </button>
              <button
                type="button"
                onClick={() => setEditandoLojaId(false)}
                className="px-2 py-1.5 text-zinc-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO: Servidor Online & Sincronização na Nuvem */}
      <div className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h3 className="font-extrabold text-sm text-white">
              Servidor Online & Conexão do Cardápio na Internet
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                isServidorCustomizado()
                  ? 'bg-purple-950/60 border-purple-800 text-purple-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              {isServidorCustomizado() ? 'URL Personalizada' : 'URL Padrão'}
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          O aplicativo Android instalado no celular e os clientes no navegador acessam este endereço para carregar o cardápio público e receber pedidos.
          A publicação de cardápio <strong>NÃO exige banco de dados Neon</strong> — ela utiliza o backend integrado do D’ Burger.
        </p>

        {/* Linha com a URL atual e botão de teste */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-cyan-300 font-mono select-all truncate">
              {servidorUrlAtual}
            </div>
            <button
              type="button"
              onClick={() => handleTestarConexaoServidor()}
              disabled={testandoServidor}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testandoServidor ? 'animate-spin' : ''}`} />
              <span>{testandoServidor ? 'Testando...' : 'Testar Conexão'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputServidorUrl(servidorUrlAtual);
                setEditandoServidorUrl(!editandoServidorUrl);
              }}
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>{editandoServidorUrl ? 'Fechar Edição' : 'Alterar URL'}</span>
            </button>
          </div>

          {/* Resultado do Teste de Conexão */}
          {resultadoConexaoServidor && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 transition ${
                resultadoConexaoServidor.sucesso
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : resultadoConexaoServidor.statusHttp === 404
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {resultadoConexaoServidor.sucesso ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>{resultadoConexaoServidor.mensagem}</span>
              </div>
              {resultadoConexaoServidor.detalhes && (
                <p className="text-[11px] opacity-90 pl-6 leading-relaxed">
                  {resultadoConexaoServidor.detalhes}
                </p>
              )}
            </div>
          )}

          {/* Formulário de alteração da URL */}
          {editandoServidorUrl && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 mt-2">
              <label className="text-xs font-bold text-zinc-300 block">
                Novo Endereço do Servidor Backend (HTTPS)
              </label>
              <input
                type="url"
                value={inputServidorUrl}
                onChange={(e) => setInputServidorUrl(e.target.value)}
                placeholder="https://meu-servidor-dburger.onrender.com ou https://ais-pre-..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white font-mono"
              />
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Insira a URL do seu backend hospedado na nuvem (Google Cloud Run, Render, Railway, Fly.io, Vercel ou o link gerado pelo botão <strong>Share</strong> no AI Studio).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSalvarServidorUrl}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition"
                >
                  Salvar Nova URL
                </button>
                <button
                  type="button"
                  onClick={handleRestaurarPadraoServidorUrl}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition"
                >
                  Restaurar Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoServidorUrl(false)}
                  className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Guia Rápido: Como validar o cardápio público pela internet */}
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-[11px] text-zinc-300 space-y-2">
          <p className="font-bold text-white flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Como validar o cardápio público pela internet (Passo a Passo):</span>
          </p>
          <ul className="space-y-1.5 pl-4 list-disc text-zinc-400">
            <li>
              <strong className="text-zinc-200">Google AI Studio (Ambiente de Testes):</strong> As URLs <code>ais-dev-...</code> e <code>ais-pre-...</code> possuem barreira de autenticação da conta Google (Google Auth Bridge) por segurança do ambiente de desenvolvimento. Clientes externos anônimos e o APK instalado não possuem cookies da sua conta Google, exigindo uma URL pública real.
            </li>
            <li>
              <strong className="text-zinc-200">Hospedagem Pública Gratuita (Render / Railway / Fly.io):</strong> O projeto já conta com <code>render.yaml</code> e <code>Dockerfile</code> prontos para publicação em 1 clique. Ao conectar a um serviço como o Render.com (grátis), você recebe uma URL HTTPS definitiva (ex: <code>https://dburger.onrender.com</code>). Basta colar em <em>"Alterar URL"</em> e testar!
            </li>
            <li>
              <strong className="text-zinc-200">No próprio Aplicativo Android (Offline-First):</strong> Mesmo sem internet ou servidor ativo, a gestão no APK é 100% autônoma com banco local e cálculo de custos/CMV preservado.
            </li>
          </ul>
        </div>
      </div>

      {/* Modal Visual de Personalização do Cardápio */}
      <PersonalizarCardapioModal
        aberto={modalCustomizarAberto}
        onFechar={() => setModalCustomizarAberto(false)}
        onTemaSalvo={(novoTema) => {
          if (novoTema.nomeLoja) {
            setNomeHamburgueria(novoTema.nomeLoja);
            atualizarConfig({ nomeHamburgueria: novoTema.nomeLoja });
          }
          setMsgSucesso('Tema e personalização do cardápio salvos com sucesso!');
          setTimeout(() => setMsgSucesso(''), 3000);
        }}
      />

      <form onSubmit={salvarParametros} className="space-y-6">
        {/* Parâmetros Gerais */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-amber-500" />
            <span>Dados da Hamburgueria & Parâmetros Base</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Nome Comercial do Estabelecimento</label>
              <input
                type="text"
                value={nomeHamburgueria}
                onChange={(e) => setNomeHamburgueria(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">
                Previsão Mensal de Lanches Vendidos (para rateio de custos fixos)
              </label>
              <input
                type="number"
                min="1"
                value={previsaoLanches}
                onChange={(e) => setPrevisaoLanches(parseInt(e.target.value) || 600)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Rateio atual: {formatarMoeda(rateioFixoPorLanche)} por lanche vendido.
              </p>
            </div>
          </div>
        </div>

        {/* Taxas de Pagamento e Reserva */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-500" />
            <span>Taxas das Modalidades de Pagamento & Reserva de Segurança</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Taxa da Maquininha Padrão (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxaMaquineta}
                onChange={(e) => setTaxaMaquineta(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Padrão solicitado: 0,70%</p>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Taxa PIX (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxaPix}
                onChange={(e) => setTaxaPix(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Padrão solicitado: 0%</p>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">
                Reserva Operacional de Referência (%)
              </label>
              <input
                type="number"
                step="0.10"
                min="0"
                value={reservaPercent}
                onChange={(e) => setReservaPercent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono font-bold text-amber-400"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Padrão solicitado: 12,10%</p>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Taxa Cartão Débito (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxaDebito}
                onChange={(e) => setTaxaDebito(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Taxa Cartão Crédito à Vista (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxaCredito}
                onChange={(e) => setTaxaCredito(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Meta de Margem-Alvo Desejada (%)</label>
              <input
                type="number"
                step="0.5"
                min="5"
                max="90"
                value={metaMargem}
                onChange={(e) => setMetaMargem(parseFloat(e.target.value) || 35)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono font-bold text-emerald-400"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Usada na fórmula de preço sugerido</p>
            </div>
          </div>
        </div>

        {/* Custos Fixos Mensais da Hamburgueria */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Custos Fixos Mensais (Gás, Luz, Água, Internet, Manutenção)</span>
            </h3>
            <span className="text-xs font-black text-amber-400 font-mono">
              Total: {formatarMoeda(totalCustosFixos)}/mês
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {custosFixos.map((custo) => (
              <div
                key={custo.id}
                className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-white block">{custo.nome}</span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {formatarMoeda(custo.valorMensal)} por mês
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removerCustoFixo(custo.id)}
                  className="text-zinc-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Adicionar novo custo fixo */}
          <div className="pt-2 border-t border-zinc-800 flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full">
              <label className="text-[11px] text-zinc-400 block mb-0.5">Nome do Custo Fixo</label>
              <input
                type="text"
                placeholder="Ex: Aluguel do ponto, Contador, Empréstimo..."
                value={novoCustoNome}
                onChange={(e) => setNovoCustoNome(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>
            <div className="w-full sm:w-36">
              <label className="text-[11px] text-zinc-400 block mb-0.5">Valor Mensal (R$)</label>
              <input
                type="number"
                step="10"
                min="0"
                placeholder="0,00"
                value={novoCustoValor || ''}
                onChange={(e) => setNovoCustoValor(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <button
              type="button"
              onClick={adicionarCustoFixo}
              className="w-full sm:w-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs"
            >
              Adicionar Custo
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Parâmetros Financeiros</span>
          </button>
        </div>
      </form>

      {/* Infraestrutura de Banco de Dados & Armazenamento em Nuvem */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-sm text-white">Banco de Dados & Persistência na Nuvem</h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 w-fit ${
              dbStatus?.persistentAcrossRestarts
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dbStatus?.persistentAcrossRestarts ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {dbStatus?.persistentAcrossRestarts
              ? 'PostgreSQL Conectado (Nuvem Definitiva)'
              : 'Armazenamento Autônomo com Auto-Recuperação'}
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          {dbStatus?.persistentAcrossRestarts
            ? 'Seu backend está conectado diretamente ao banco relacional PostgreSQL na nuvem. Todos os pedidos, produtos publicados e fotos estão protegidos de reinicializações e instâncias simultâneas.'
            : 'O servidor está operando com banco autônomo com gravação atômica protegida e cache autorrecuperável para fotos. Se o Cloud Run for reciclado, as fotos e dados são preservados via cache local e snapshots.'}
        </p>

        {/* Estatísticas do Banco */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Motor Ativo</span>
            <span className="text-sm font-black text-amber-400 mt-1 block">
              {dbStatus?.engine === 'postgresql' ? 'PostgreSQL' : 'JSON Atômico'}
            </span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Pedidos Gravados</span>
            <span className="text-sm font-black text-white mt-1 block">
              {dbStatus?.totalPedidos ?? 0} pedidos
            </span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Produtos Online</span>
            <span className="text-sm font-black text-white mt-1 block">
              {dbStatus?.totalProdutos ?? 0} produtos
            </span>
          </div>
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Fotos Salvas</span>
            <span className="text-sm font-black text-emerald-400 mt-1 block">
              {dbStatus?.totalFotos ?? 0} imagens
            </span>
          </div>
        </div>

        {/* Ação de Backup no Servidor */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-zinc-400">
            Último snapshot do servidor:{' '}
            <span className="text-zinc-200 font-medium">
              {dbStatus?.ultimoBackupEm ? new Date(dbStatus.ultimoBackupEm).toLocaleString('pt-BR') : 'Automático'}
            </span>
          </div>
          <button
            onClick={gerarBackupServidor}
            disabled={carregandoBackupServidor}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition w-full sm:w-auto justify-center"
          >
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span>{carregandoBackupServidor ? 'Gravando Backup...' : 'Gerar Snapshot no Servidor'}</span>
          </button>
        </div>

        {/* Erro de Conexão (se houver) */}
        {dbStatus?.connectionError && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span><strong>Aviso de Conexão:</strong> {dbStatus.connectionError}</span>
          </div>
        )}

        {/* Formulário de Conexão Direta ao Neon (In-App) */}
        {!dbStatus?.persistentAcrossRestarts ? (
          <div className="p-4 bg-zinc-950 border border-amber-500/30 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-white">Conectar ao Neon Diretamente (Sem precisar do console GCP)</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarCampoConexao(!mostrarCampoConexao)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline text-left sm:text-right"
              >
                {mostrarCampoConexao ? 'Ocultar Campo' : 'Inserir String do Neon'}
              </button>
            </div>

            {mostrarCampoConexao ? (
              <form onSubmit={conectarPostgresNeon} className="space-y-3 pt-2">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Cole abaixo a <strong>Connection String</strong> copiada do Neon (começa com <code className="text-amber-300">postgresql://...</code>).
                  O sistema testará a conexão, criará as tabelas e migrará os <strong>8 pedidos</strong>, produtos e fotos automaticamente.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="postgresql://neondb_owner:***@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require"
                    value={inputDatabaseUrl}
                    onChange={(e) => setInputDatabaseUrl(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    disabled={conectandoDb}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${conectandoDb ? 'animate-spin' : ''}`} />
                    <span>{conectandoDb ? 'Testando e Migrando...' : 'Conectar e Migrar'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Você já copiou a Connection String do Neon? Toque em <strong>"Inserir String do Neon"</strong> acima para conectar pelo próprio celular sem precisar de permissões avançadas no Google Cloud Console.
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Conectado ao PostgreSQL em: <strong className="font-mono text-white">{dbStatus?.databaseHost}</strong></span>
            </div>
            <button
              onClick={() => setMostrarCampoConexao(!mostrarCampoConexao)}
              className="text-[11px] text-zinc-400 hover:text-white underline shrink-0"
            >
              Alterar Banco
            </button>
          </div>
        )}

        {/* Guia caso queira configurar no Cloud Run */}
        <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1.5">
          <span className="text-[11px] font-bold text-zinc-400 block">
            Ou configure como variável de ambiente no Cloud Run:
          </span>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Nome da variável: <code className="text-amber-300 bg-zinc-900 px-1 py-0.5 rounded">DATABASE_URL</code> com o valor da string do Neon. O backend reconhece e migra automaticamente.
          </p>
        </div>
      </div>

      {/* Backup e Gestão da Base de Dados */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-500" />
          <span>Backup Local & Segurança dos Dados (Offline)</span>
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Todos os seus dados estão salvos 100% offline no seu aparelho. Exporte cópias de segurança em JSON
          periodicamente para guardar no WhatsApp ou Google Drive.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleBaixarBackup}
            className="p-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3 text-left transition"
          >
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-white block">Exportar Backup Completo</span>
              <span className="text-[11px] text-zinc-400">Gera arquivo .json com todos os cadastros e vendas.</span>
            </div>
          </button>

          <label className="p-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-white block">Restaurar de um Backup</span>
              <span className="text-[11px] text-zinc-400">Recupera dados salvos anteriormente no aparelho.</span>
            </div>
            <input type="file" accept=".json" className="hidden" onChange={handleImportarArquivo} />
          </label>
        </div>

        {/* Zona de Perigo / Reinicialização de Banco */}
        <div className="pt-4 border-t border-zinc-800 space-y-2">
          <span className="text-xs font-bold text-red-400 block">Opções de Reinicialização de Dados</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setModalConfirmacaoReset('caixa')}
              className="px-4 py-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 font-bold rounded-xl text-xs transition"
            >
              Zerar Apenas Caixa & Vendas (Manter Meus Insumos e Cardápio)
            </button>
            <button
              onClick={() => setModalConfirmacaoReset('vazio')}
              className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-bold rounded-xl text-xs transition"
            >
              Iniciar Banco Vazio (Apagar Tudo do Zero)
            </button>
            <button
              onClick={() => setModalConfirmacaoReset('padrao')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition"
            >
              Recarregar Demonstração D’ Burger
            </button>
          </div>
        </div>
      </div>

      {/* Modal Confirmação de Reset */}
      {modalConfirmacaoReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalConfirmacaoReset(null)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-zinc-800">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Confirmação de Operação Crítica</h3>
            </div>

            <p className="mt-4 text-xs text-zinc-300 leading-relaxed">
              {modalConfirmacaoReset === 'caixa'
                ? 'Deseja zerar todas as vendas e o caixa? O saldo será resetado para R$ 0,00, mas os seus insumos e o seu cardápio cadastrados continuarão intactos.'
                : modalConfirmacaoReset === 'vazio'
                ? 'Tem certeza de que deseja iniciar o banco vazio? Todos os insumos, produtos, pedidos e caixa serão apagados para você cadastrar seus dados reais do zero.'
                : 'Tem certeza de que deseja restaurar as receitas e insumos de exemplo padrão do D’ Burger? As vendas atuais serão reiniciadas.'}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalConfirmacaoReset(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalConfirmacaoReset === 'caixa') {
                    zerarCaixaEVendas();
                    setMsgSucesso('Caixa e vendas zerados com sucesso! Insumos e cardápio mantidos.');
                  } else if (modalConfirmacaoReset === 'vazio') {
                    iniciarBancoVazio();
                    setMsgSucesso('Banco de dados completamente zerado! Pronto para cadastros reais.');
                  } else {
                    reiniciarParaDadosPadrao();
                    setMsgSucesso('Dados de exemplo padrão recarregados com sucesso!');
                  }
                  setModalConfirmacaoReset(null);
                  setTimeout(() => setMsgSucesso(''), 3000);
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
