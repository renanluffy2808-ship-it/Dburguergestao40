import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Type,
  Layout,
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Save,
  RotateCcw,
  X,
  Upload,
  Camera,
  Check,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  CardapioThemeConfig,
  AlinhamentoTexto,
  FormatoArredondamento,
  NivelSombra,
  FamiliaFonte,
  TamanhoFonte,
  AlturaCapa,
  ModoLayoutProdutos,
} from '../types';
import { TEMA_CARDAPIO_PADRAO } from '../data/initialData';
import { PRESETS_TEMA_CARDAPIO, ThemePreset } from '../data/themePresets';
import { obterLojaIdAtual, gerarUrlCardapioPublico, getLojaHeader } from '../lib/lojaId';
import { getAdminAuthHeader } from '../lib/authService';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onTemaSalvo?: (novoTema: CardapioThemeConfig) => void;
}

type TabSecao = 'textos' | 'posicoes' | 'cores' | 'imagens' | 'estilo' | 'presets';

export const PersonalizarCardapioModal: React.FC<Props> = ({ aberto, onFechar, onTemaSalvo }) => {
  const [tabAtiva, setTabAtiva] = useState<TabSecao>('textos');
  const [tema, setTema] = useState<CardapioThemeConfig>(() => ({ ...TEMA_CARDAPIO_PADRAO }));
  const [temaOriginal, setTemaOriginal] = useState<CardapioThemeConfig>(() => ({ ...TEMA_CARDAPIO_PADRAO }));
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Upload refs
  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputCapaRef = useRef<HTMLInputElement>(null);
  const fileInputFundoRef = useRef<HTMLInputElement>(null);
  const [fazendoUpload, setFazendoUpload] = useState<string | null>(null);

  // Carregar tema atual do servidor
  const carregarTemaDoServidor = async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/theme', {
        headers: getLojaHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.theme) {
          const merged = { ...TEMA_CARDAPIO_PADRAO, ...data.theme };
          setTema(merged);
          setTemaOriginal(merged);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar tema do cardápio:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (aberto) {
      carregarTemaDoServidor();
    }
  }, [aberto]);

  if (!aberto) return null;

  // Atualizador parcial do tema
  const atualizarCampo = <K extends keyof CardapioThemeConfig>(campo: K, valor: CardapioThemeConfig[K]) => {
    setTema((prev) => ({ ...prev, [campo]: valor }));
  };

  // Upload real de imagem para o servidor
  const handleUploadImagem = async (e: React.ChangeEvent<HTMLInputElement>, campo: 'logotipoUrl' | 'imagemCapaUrl' | 'imagemFundoUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotificacao({ tipo: 'erro', texto: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WebP).' });
      return;
    }

    setFazendoUpload(campo);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (!base64) {
          setFazendoUpload(null);
          return;
        }

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getLojaHeader(),
          },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            atualizarCampo(campo, data.url);
            if (campo === 'imagemFundoUrl') {
              atualizarCampo('fundoTipo', 'imagem');
            }
            setNotificacao({ tipo: 'sucesso', texto: 'Foto enviada e armazenada com sucesso!' });
            setTimeout(() => setNotificacao(null), 3000);
          }
        } else {
          setNotificacao({ tipo: 'erro', texto: 'Erro ao enviar foto para o servidor.' });
        }
        setFazendoUpload(null);
      };
      reader.readAsDataURL(file);
    } catch {
      setNotificacao({ tipo: 'erro', texto: 'Falha ao processar arquivo.' });
      setFazendoUpload(null);
    }
  };

  // Aplicar Preset
  const aplicarPreset = (preset: ThemePreset) => {
    setTema((prev) => ({
      ...prev,
      ...preset.theme,
    }));
    setNotificacao({ tipo: 'sucesso', texto: `Visual "${preset.nome}" aplicado na prévia!` });
    setTimeout(() => setNotificacao(null), 3000);
  };

  // Mover seções para cima / baixo
  const moverSecao = (index: number, direcao: 'cima' | 'baixo') => {
    const ordem = [...(tema.ordemSecoes || ['capa', 'cabecalho', 'apresentacao', 'filtros', 'produtos'])];
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= ordem.length) return;

    const temp = ordem[index];
    ordem[index] = ordem[novoIndex];
    ordem[novoIndex] = temp;
    atualizarCampo('ordemSecoes', ordem);
  };

  const nomesSecoes: Record<string, string> = {
    capa: 'Imagem de Capa / Banner',
    cabecalho: 'Cabeçalho da Loja (Nome, Logo e Status)',
    apresentacao: 'Apresentação e Descrição da Empresa',
    filtros: 'Filtro e Barra de Categorias',
    produtos: 'Grade / Lista de Produtos',
  };

  // Salvar no servidor (Publicar Alterações)
  const salvarAlteracoes = async () => {
    setSalvando(true);
    try {
      const res = await fetch('/api/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify({ theme: tema }),
      });

      if (res.ok) {
        const data = await res.json();
        setTemaOriginal(data.theme || tema);
        if (onTemaSalvo) onTemaSalvo(data.theme || tema);
        setNotificacao({ tipo: 'sucesso', texto: 'Cardápio personalizado e publicado com sucesso!' });
        setTimeout(() => setNotificacao(null), 3500);
      } else {
        setNotificacao({ tipo: 'erro', texto: 'Falha ao salvar customizações no servidor.' });
      }
    } catch (e) {
      setNotificacao({ tipo: 'erro', texto: 'Erro de rede ao salvar tema.' });
    } finally {
      setSalvando(false);
    }
  };

  // Restaurar Padrão
  const restaurarPadrao = async () => {
    if (!window.confirm('Tem certeza de que deseja restaurar as configurações visuais para o padrão?')) {
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch('/api/theme/reset', {
        method: 'POST',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
      if (res.ok) {
        const data = await res.json();
        const t = data.theme || TEMA_CARDAPIO_PADRAO;
        setTema(t);
        setTemaOriginal(t);
        if (onTemaSalvo) onTemaSalvo(t);
        setNotificacao({ tipo: 'sucesso', texto: 'Visual padrão restaurado com sucesso!' });
        setTimeout(() => setNotificacao(null), 3000);
      }
    } catch {
      setNotificacao({ tipo: 'erro', texto: 'Erro ao restaurar padrão.' });
    } finally {
      setSalvando(false);
    }
  };

  // Desfazer / Cancelar
  const cancelarAlteracoes = () => {
    setTema({ ...temaOriginal });
    onFechar();
  };

  const lojaIdAtual = obterLojaIdAtual();
  const urlPublicaCardapio = gerarUrlCardapioPublico(lojaIdAtual);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabeçalho do Editor */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Personalizar meu cardápio
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-normal">
                  Loja: {lojaIdAtual === 'default' ? "D' Burger (Principal)" : lojaIdAtual}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Altere textos, cores, imagens, fontes, posições e layout com prévia ao vivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={urlPublicaCardapio}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
              title="Abrir cardápio público em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              Ver online
            </a>
            <button
              onClick={cancelarAlteracoes}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
              title="Fechar editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notificações em Toast */}
        {notificacao && (
          <div
            className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 border-b transition-all ${
              notificacao.tipo === 'sucesso'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/80 text-rose-300 border-rose-800/60'
            }`}
          >
            {notificacao.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{notificacao.texto}</span>
          </div>
        )}

        {/* Barra de Abas do Editor */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-950/40 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setTabAtiva('textos')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'textos'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Textos e Nomes
          </button>

          <button
            onClick={() => setTabAtiva('posicoes')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'posicoes'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            Posicionamento & Ordem
          </button>

          <button
            onClick={() => setTabAtiva('cores')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'cores'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Fundo & Cores
          </button>

          <button
            onClick={() => setTabAtiva('imagens')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'imagens'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Capa & Logotipo
          </button>

          <button
            onClick={() => setTabAtiva('estilo')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'estilo'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Tipografia & Bordas
          </button>

          <button
            onClick={() => setTabAtiva('presets')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              tabAtiva === 'presets'
                ? 'bg-amber-500 text-black font-semibold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Modelos Prontos
          </button>
        </div>

        {/* Corpo Principal: Controles na Esquerda (60%) e Prévia Mobile na Direita (40%) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Painel de Controles (60% no desktop) */}
          <div className="lg:col-span-7 p-4 sm:p-6 overflow-y-auto max-h-[calc(96vh-170px)] space-y-6">
            
            {/* ABA 1: TEXTOS */}
            {tabAtiva === 'textos' && (
              <div className="space-y-4">
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Type className="w-4 h-4 text-amber-400" />
                    Identidade e Nomes Principais
                  </h3>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Nome Comercial da Loja *
                    </label>
                    <input
                      type="text"
                      value={tema.nomeLoja}
                      onChange={(e) => atualizarCampo('nomeLoja', e.target.value)}
                      placeholder="Ex: D’ Burger, Batata Show, Cantinho da Coxinha..."
                      className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Aparece no topo do cardápio, nos comprovantes Pix e nas mensagens de WhatsApp.
                    </p>
                  </div>

                  {/* Subtítulo com switch */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">
                        Subtítulo abaixo do nome
                      </label>
                      <button
                        type="button"
                        onClick={() => atualizarCampo('mostrarSubtitulo', !tema.mostrarSubtitulo)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                          tema.mostrarSubtitulo
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {tema.mostrarSubtitulo ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {tema.mostrarSubtitulo ? 'Exibindo' : 'Oculto'}
                      </button>
                    </div>

                    {tema.mostrarSubtitulo && (
                      <input
                        type="text"
                        value={tema.subtituloLoja}
                        onChange={(e) => atualizarCampo('subtituloLoja', e.target.value)}
                        placeholder="Ex: Hambúrgueres Artesanais & Smash ou Batatas Recheadas"
                        className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                    <p className="text-[11px] text-zinc-500">
                      Se ocultado, desaparece sem deixar nenhum espaço em branco.
                    </p>
                  </div>
                </div>

                {/* Apresentação e Boas-Vindas */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Frases de Apresentação e Boas-Vindas
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">Frase de Apresentação</label>
                      <button
                        type="button"
                        onClick={() => atualizarCampo('mostrarFraseApresentacao', !tema.mostrarFraseApresentacao)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                          tema.mostrarFraseApresentacao
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {tema.mostrarFraseApresentacao ? 'Exibindo' : 'Oculto'}
                      </button>
                    </div>
                    {tema.mostrarFraseApresentacao && (
                      <input
                        type="text"
                        value={tema.fraseApresentacao}
                        onChange={(e) => atualizarCampo('fraseApresentacao', e.target.value)}
                        placeholder="Ex: Faça seu pedido online sem complicações"
                        className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">Descrição da Empresa</label>
                      <button
                        type="button"
                        onClick={() => atualizarCampo('mostrarDescricaoLoja', !tema.mostrarDescricaoLoja)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                          tema.mostrarDescricaoLoja
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {tema.mostrarDescricaoLoja ? 'Exibindo' : 'Oculto'}
                      </button>
                    </div>
                    {tema.mostrarDescricaoLoja && (
                      <textarea
                        rows={2}
                        value={tema.descricaoLoja}
                        onChange={(e) => atualizarCampo('descricaoLoja', e.target.value)}
                        placeholder="Ex: Escolha seus itens favoritos, personalize os adicionais e envie direto para o nosso WhatsApp!"
                        className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-300">Etiqueta de Status (Badge)</label>
                      <button
                        type="button"
                        onClick={() => atualizarCampo('mostrarBadgeStatus', !tema.mostrarBadgeStatus)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                          tema.mostrarBadgeStatus
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {tema.mostrarBadgeStatus ? 'Exibindo' : 'Oculto'}
                      </button>
                    </div>
                    {tema.mostrarBadgeStatus && (
                      <input
                        type="text"
                        value={tema.badgeStatusAberto}
                        onChange={(e) => atualizarCampo('badgeStatusAberto', e.target.value)}
                        placeholder="Ex: Aberto agora"
                        className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                </div>

                {/* Textos de Botões e Seções */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Botões e Títulos de Seção
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Título da Seção de Produtos
                      </label>
                      <input
                        type="text"
                        value={tema.tituloSecaoProdutos}
                        onChange={(e) => atualizarCampo('tituloSecaoProdutos', e.target.value)}
                        placeholder="Ex: Nosso Cardápio"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Texto do Botão Adicionar
                      </label>
                      <input
                        type="text"
                        value={tema.textoBotaoAdicionar}
                        onChange={(e) => atualizarCampo('textoBotaoAdicionar', e.target.value)}
                        placeholder="Ex: Adicionar"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Texto do Botão Carrinho
                      </label>
                      <input
                        type="text"
                        value={tema.textoBotaoCarrinho}
                        onChange={(e) => atualizarCampo('textoBotaoCarrinho', e.target.value)}
                        placeholder="Ex: Ver Meu Carrinho"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Texto da Seção de Adicionais
                      </label>
                      <input
                        type="text"
                        value={tema.textoPersonalizarAdicionais}
                        onChange={(e) => atualizarCampo('textoPersonalizarAdicionais', e.target.value)}
                        placeholder="Ex: Personalize seu pedido"
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: POSICIONAMENTO E ORDEM */}
            {tabAtiva === 'posicoes' && (
              <div className="space-y-4">
                {/* Posicionamento do Cabeçalho */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-amber-400" />
                    Posicionamento dos Elementos no Cabeçalho
                  </h3>

                  {/* Posição do Nome da Loja */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2">
                      Posição do Nome da Loja
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'topo', label: 'No Topo' },
                        { id: 'meio', label: 'No Meio' },
                        { id: 'abaixo_capa', label: 'Abaixo da Capa' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => atualizarCampo('posicaoNomeLoja', pos.id as any)}
                          className={`py-2 px-3 text-xs rounded-xl border text-center transition-all ${
                            tema.posicaoNomeLoja === pos.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Posição do Logotipo */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2">
                      Posição do Logotipo
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'ao_lado_nome', label: 'Ao lado do Nome' },
                        { id: 'acima_nome', label: 'Acima do Nome' },
                        { id: 'abaixo_nome', label: 'Abaixo do Nome' },
                        { id: 'oculto', label: 'Ocultar Logo' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => atualizarCampo('posicaoLogo', pos.id as any)}
                          className={`py-2 px-2.5 text-xs rounded-xl border text-center transition-all ${
                            tema.posicaoLogo === pos.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alinhamento de Texto */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2">
                      Alinhamento Geral do Cabeçalho
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'esquerda', label: 'Esquerda', icon: AlignLeft },
                        { id: 'centro', label: 'Centralizado', icon: AlignCenter },
                        { id: 'direita', label: 'Direita', icon: AlignRight },
                      ].map((al) => {
                        const Icon = al.icon;
                        return (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => {
                              atualizarCampo('alinhamentoCabecalho', al.id as AlinhamentoTexto);
                              atualizarCampo('alinhamentoApresentacao', al.id as AlinhamentoTexto);
                            }}
                            className={`py-2 px-3 text-xs rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                              tema.alinhamentoCabecalho === al.id
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {al.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reordenar Seções do Cardápio */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">
                      Ordem das Seções no Cardápio
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Use os botões para mover seções para cima ou para baixo conforme preferir:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {(tema.ordemSecoes || ['capa', 'cabecalho', 'apresentacao', 'filtros', 'produtos']).map(
                      (secKey, idx, arr) => (
                        <div
                          key={secKey}
                          className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-medium text-white">
                              {nomesSecoes[secKey] || secKey}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moverSecao(idx, 'cima')}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                idx === 0
                                  ? 'opacity-30 cursor-not-allowed border-transparent text-zinc-600'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white'
                              }`}
                              title="Mover para cima"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => moverSecao(idx, 'baixo')}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                idx === arr.length - 1
                                  ? 'opacity-30 cursor-not-allowed border-transparent text-zinc-600'
                                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-white'
                              }`}
                              title="Mover para baixo"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: FUNDO E CORES */}
            {tabAtiva === 'cores' && (
              <div className="space-y-4">
                {/* Tipo de Fundo */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    Plano de Fundo da Loja
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => atualizarCampo('fundoTipo', 'solido')}
                      className={`py-2 px-3 text-xs rounded-xl border text-center transition-all ${
                        tema.fundoTipo === 'solido'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Cor Sólida (Branco, Preto, Custom)
                    </button>

                    <button
                      type="button"
                      onClick={() => atualizarCampo('fundoTipo', 'imagem')}
                      className={`py-2 px-3 text-xs rounded-xl border text-center transition-all ${
                        tema.fundoTipo === 'imagem'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Foto de Fundo (Galeria/Câmera)
                    </button>
                  </div>

                  {/* Seletor de Cores de Fundo Rápidas */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Cor de Fundo da Página
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={tema.corFundo}
                        onChange={(e) => atualizarCampo('corFundo', e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer bg-zinc-900 border border-zinc-700 p-1"
                      />
                      <input
                        type="text"
                        value={tema.corFundo}
                        onChange={(e) => atualizarCampo('corFundo', e.target.value)}
                        className="w-28 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white"
                      />

                      {/* Paleta Rápida */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {[
                          { cor: '#09090b', title: 'Preto Noturno' },
                          { cor: '#ffffff', title: 'Branco Puro' },
                          { cor: '#f4f4f5', title: 'Cinza Suave' },
                          { cor: '#1c1917', title: 'Marrom Rústico' },
                          { cor: '#170c24', title: 'Roxo Noturno' },
                        ].map((c) => (
                          <button
                            key={c.cor}
                            type="button"
                            onClick={() => {
                              atualizarCampo('corFundo', c.cor);
                              if (c.cor === '#ffffff' || c.cor === '#f4f4f5') {
                                atualizarCampo('corTextoPrincipal', '#18181b');
                                atualizarCampo('corTextoSecundario', '#71717a');
                                atualizarCampo('corFundoSecao', '#ffffff');
                                atualizarCampo('corBordaCartao', '#e4e4e7');
                              } else {
                                atualizarCampo('corTextoPrincipal', '#ffffff');
                                atualizarCampo('corTextoSecundario', '#a1a1aa');
                              }
                            }}
                            className="w-7 h-7 rounded-lg border border-zinc-600 hover:scale-110 transition-transform"
                            style={{ backgroundColor: c.cor }}
                            title={c.title}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Foto de Fundo se fundoTipo for imagem */}
                  {tema.fundoTipo === 'imagem' && (
                    <div className="space-y-3 pt-3 border-t border-zinc-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-300">
                          Imagem de Fundo
                        </label>
                        {tema.imagemFundoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              atualizarCampo('imagemFundoUrl', '');
                              atualizarCampo('fundoTipo', 'solido');
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remover imagem
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          ref={fileInputFundoRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadImagem(e, 'imagemFundoUrl')}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputFundoRef.current?.click()}
                          disabled={fazendoUpload === 'imagemFundoUrl'}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                        >
                          <Camera className="w-4 h-4 text-amber-400" />
                          {fazendoUpload === 'imagemFundoUrl' ? 'Enviando foto...' : 'Escolher foto da galeria/câmera'}
                        </button>
                      </div>

                      {tema.imagemFundoUrl && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span>Opacidade da imagem de fundo</span>
                            <span>{tema.imagemFundoOpacidade || 15}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="80"
                            value={tema.imagemFundoOpacidade || 15}
                            onChange={(e) => atualizarCampo('imagemFundoOpacidade', Number(e.target.value))}
                            className="w-full accent-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cores de Elementos Principais */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Cores dos Elementos Visuais
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Cor Destaque / Marca */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Cor Principal de Destaque
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corDestaque}
                          onChange={(e) => atualizarCampo('corDestaque', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corDestaque}
                          onChange={(e) => atualizarCampo('corDestaque', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Cor dos Botões */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Cor dos Botões de Ação
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corBotao}
                          onChange={(e) => atualizarCampo('corBotao', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corBotao}
                          onChange={(e) => atualizarCampo('corBotao', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Cor dos Preços */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Cor dos Preços (R$)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corPreco}
                          onChange={(e) => atualizarCampo('corPreco', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corPreco}
                          onChange={(e) => atualizarCampo('corPreco', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Cor dos Cartões de Produtos */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Fundo dos Cartões de Produto
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corFundoSecao}
                          onChange={(e) => atualizarCampo('corFundoSecao', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corFundoSecao}
                          onChange={(e) => atualizarCampo('corFundoSecao', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Cor do Texto Principal */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Cor dos Títulos e Nomes
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corTextoPrincipal}
                          onChange={(e) => atualizarCampo('corTextoPrincipal', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corTextoPrincipal}
                          onChange={(e) => atualizarCampo('corTextoPrincipal', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>

                    {/* Cor do Texto Secundário */}
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Cor das Descrições (Secundária)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={tema.corTextoSecundario}
                          onChange={(e) => atualizarCampo('corTextoSecundario', e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={tema.corTextoSecundario}
                          onChange={(e) => atualizarCampo('corTextoSecundario', e.target.value)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4: CAPA & LOGOTIPO */}
            {tabAtiva === 'imagens' && (
              <div className="space-y-4">
                {/* Logotipo */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      Logotipo da Marca
                    </h3>
                    {tema.logotipoUrl && (
                      <button
                        type="button"
                        onClick={() => atualizarCampo('logotipoUrl', '')}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-zinc-700 bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
                      {tema.logotipoUrl ? (
                        <img src={tema.logotipoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        ref={fileInputLogoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImagem(e, 'logotipoUrl')}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputLogoRef.current?.click()}
                        disabled={fazendoUpload === 'logotipoUrl'}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        {fazendoUpload === 'logotipoUrl' ? 'Enviando...' : 'Enviar logo pelo celular'}
                      </button>
                      <p className="text-[11px] text-zinc-500">
                        PNG com fundo transparente ou JPG quadrado (ex: 400x400)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Imagem de Capa / Banner */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-200">
                      Imagem de Capa / Banner de Destaque
                    </h3>
                    {tema.imagemCapaUrl && (
                      <button
                        type="button"
                        onClick={() => atualizarCampo('imagemCapaUrl', '')}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remover
                      </button>
                    )}
                  </div>

                  {tema.imagemCapaUrl && (
                    <div className="h-28 w-full rounded-2xl overflow-hidden border border-zinc-700 relative">
                      <img src={tema.imagemCapaUrl} alt="Capa" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputCapaRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImagem(e, 'imagemCapaUrl')}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputCapaRef.current?.click()}
                      disabled={fazendoUpload === 'imagemCapaUrl'}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                      {fazendoUpload === 'imagemCapaUrl' ? 'Enviando foto...' : 'Enviar foto de capa (Galeria/Câmera)'}
                    </button>
                  </div>

                  {/* Altura da Capa */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { id: 'baixo', label: 'Capa Baixa' },
                      { id: 'medio', label: 'Capa Média' },
                      { id: 'alto', label: 'Capa Alta' },
                    ].map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => atualizarCampo('imagemCapaAltura', alt.id as AlturaCapa)}
                        className={`py-2 px-2.5 text-xs rounded-xl border text-center transition-all ${
                          tema.imagemCapaAltura === alt.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                      >
                        {alt.label}
                      </button>
                    ))}
                  </div>

                  {/* Opacidade de Leitura sobre a capa */}
                  {tema.imagemCapaUrl && (
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Escurecimento sobre a capa (Melhora leitura dos textos)</span>
                        <span>{tema.sobreposicaoCapaOpacidade || 40}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="85"
                        value={tema.sobreposicaoCapaOpacidade || 40}
                        onChange={(e) => atualizarCampo('sobreposicaoCapaOpacidade', Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 5: TIPOGRAFIA, BORDAS & CARTÕES */}
            {tabAtiva === 'estilo' && (
              <div className="space-y-4">
                {/* Família da Fonte */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Type className="w-4 h-4 text-amber-400" />
                    Família da Fonte (Tipografia)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'sans', label: 'Moderna (Sans)', fontClass: 'font-sans' },
                      { id: 'serif', label: 'Elegante (Serif)', fontClass: 'font-serif' },
                      { id: 'rounded', label: 'Arredondada', fontClass: 'font-sans tracking-wide' },
                      { id: 'mono', label: 'Rústica (Mono)', fontClass: 'font-mono' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => atualizarCampo('fonteFamilia', f.id as FamiliaFonte)}
                        className={`p-3 text-xs rounded-xl border text-center transition-all ${
                          tema.fonteFamilia === f.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                      >
                        <span className={`block text-sm mb-1 ${f.fontClass}`}>Aa Bb</span>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Arredondamento dos Cantos */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Formato dos Cantos (Bordas)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'nenhum', label: 'Reto (0px)' },
                      { id: 'pequeno', label: 'Suave (8px)' },
                      { id: 'medio', label: 'Arredondado (16px)' },
                      { id: 'grande', label: 'Muito Arredondado' },
                    ].map((arr) => (
                      <button
                        key={arr.id}
                        type="button"
                        onClick={() => {
                          atualizarCampo('arredondamentoCartoes', arr.id as FormatoArredondamento);
                          atualizarCampo('arredondamentoBotoes', arr.id as FormatoArredondamento);
                        }}
                        className={`py-2 px-3 text-xs rounded-xl border text-center transition-all ${
                          tema.arredondamentoCartoes === arr.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                        }`}
                      >
                        {arr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layout e Exibições */}
                <div className="bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Modo de Exibição dos Produtos
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => atualizarCampo('layoutProdutos', 'grade')}
                      className={`py-2.5 px-3 text-xs rounded-xl border text-center transition-all ${
                        tema.layoutProdutos === 'grade'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Grade (Visual em Cards)
                    </button>

                    <button
                      type="button"
                      onClick={() => atualizarCampo('layoutProdutos', 'lista')}
                      className={`py-2.5 px-3 text-xs rounded-xl border text-center transition-all ${
                        tema.layoutProdutos === 'lista'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Lista Compacta (Texto + Foto Lateral)
                    </button>
                  </div>

                  {/* Switches de Detalhes */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                      <span>Exibir fotos dos produtos no cardápio</span>
                      <input
                        type="checkbox"
                        checked={tema.mostrarFotosProdutos}
                        onChange={(e) => atualizarCampo('mostrarFotosProdutos', e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                      <span>Exibir tempo estimado de preparo</span>
                      <input
                        type="checkbox"
                        checked={tema.mostrarTempoPreparo}
                        onChange={(e) => atualizarCampo('mostrarTempoPreparo', e.target.checked)}
                        className="rounded accent-amber-500 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 6: MODELOS PRONTOS (PRESETS) */}
            {tabAtiva === 'presets' && (
              <div className="space-y-3">
                <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">Dica:</span> Escolha um modelo para
                  mudar todas as cores e estilos de uma vez, e depois ajuste o que quiser nas outras abas!
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESETS_TEMA_CARDAPIO.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-white flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border border-white/20"
                              style={{ backgroundColor: preset.corAmostra }}
                            />
                            {preset.nome}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mb-3">{preset.descricao}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => aplicarPreset(preset)}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Aplicar este visual
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Painel da Direita: Prévia ao Vivo em Moldura de Celular (40%) */}
          <div className="lg:col-span-5 p-4 bg-zinc-950/80 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col items-center justify-center">
            <div className="w-full flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                Prévia do Celular ao Vivo
              </span>
              <span className="text-[11px] text-zinc-500">Muda instantaneamente</span>
            </div>

            {/* Mockup do Celular */}
            <div
              className="w-full max-w-[340px] h-[520px] rounded-[36px] p-3 border-4 border-zinc-700 shadow-2xl relative overflow-hidden flex flex-col transition-all"
              style={{
                backgroundColor: tema.corFundo,
                backgroundImage:
                  tema.fundoTipo === 'imagem' && tema.imagemFundoUrl
                    ? `url(${tema.imagemFundoUrl})`
                    : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                fontFamily:
                  tema.fonteFamilia === 'serif'
                    ? 'serif'
                    : tema.fonteFamilia === 'mono'
                    ? 'monospace'
                    : 'sans-serif',
              }}
            >
              {/* Notch do celular */}
              <div className="w-24 h-4 bg-zinc-800 rounded-b-xl mx-auto mb-2 shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-zinc-900 border border-zinc-700" />
              </div>

              {/* Conteúdo rolável do cardápio mobile */}
              <div className="flex-1 overflow-y-auto rounded-2xl p-2 space-y-3 scrollbar-none">
                
                {/* Capa se configurada */}
                {tema.imagemCapaUrl && (
                  <div
                    className={`w-full rounded-xl overflow-hidden relative ${
                      tema.imagemCapaAltura === 'pequeno'
                        ? 'h-16'
                        : tema.imagemCapaAltura === 'grande'
                        ? 'h-32'
                        : 'h-24'
                    }`}
                  >
                    <img src={tema.imagemCapaUrl} alt="Capa" className="w-full h-full object-cover" />
                    <div
                      className="absolute inset-0 bg-black"
                      style={{ opacity: (tema.sobreposicaoCapaOpacidade || 40) / 100 }}
                    />
                  </div>
                )}

                {/* Cabeçalho */}
                <div
                  className={`space-y-1 ${
                    tema.alinhamentoCabecalho === 'centro'
                      ? 'text-center items-center flex flex-col'
                      : tema.alinhamentoCabecalho === 'direita'
                      ? 'text-right items-end flex flex-col'
                      : 'text-left items-start flex flex-col'
                  }`}
                >
                  {/* Logo se acima do nome */}
                  {tema.posicaoLogo === 'acima_nome' && tema.logotipoUrl && (
                    <img src={tema.logotipoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover mb-1" />
                  )}

                  {/* Nome da Loja com logo ao lado se configurado */}
                  <div className="flex items-center gap-2">
                    {tema.posicaoLogo === 'ao_lado_nome' && tema.logotipoUrl && (
                      <img src={tema.logotipoUrl} alt="Logo" className="w-7 h-7 rounded-full object-cover" />
                    )}
                    <h1
                      className="text-base font-black tracking-tight"
                      style={{ color: tema.corTextoPrincipal }}
                    >
                      {tema.nomeLoja || "D’ Burger"}
                    </h1>
                  </div>

                  {/* Subtítulo (se ativo) */}
                  {tema.mostrarSubtitulo && tema.subtituloLoja && (
                    <p
                      className="text-[11px] font-medium"
                      style={{ color: tema.corTextoSecundario }}
                    >
                      {tema.subtituloLoja}
                    </p>
                  )}

                  {/* Badge de status */}
                  {tema.mostrarBadgeStatus && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold mt-1"
                      style={{
                        backgroundColor: `${tema.corDestaque}20`,
                        color: tema.corDestaque,
                        border: `1px solid ${tema.corDestaque}40`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {tema.badgeStatusAberto || 'Aberto agora'}
                    </span>
                  )}
                </div>

                {/* Apresentação se ativa */}
                {tema.mostrarFraseApresentacao && tema.fraseApresentacao && (
                  <div
                    className="p-2 rounded-xl text-[11px]"
                    style={{
                      backgroundColor: `${tema.corFundoSecao}`,
                      color: tema.corTextoSecundario,
                      border: `1px solid ${tema.corBordaCartao}`,
                    }}
                  >
                    {tema.fraseApresentacao}
                  </div>
                )}

                {/* Categorias Mockup */}
                <div className="flex items-center gap-1.5 overflow-x-hidden pt-1">
                  {['Todos', 'Mais Pedidos', 'Combos'].map((c, i) => (
                    <span
                      key={c}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-semibold shrink-0"
                      style={
                        i === 0
                          ? { backgroundColor: tema.corBotao, color: tema.corTextoBotao }
                          : {
                              backgroundColor: tema.corFundoSecao,
                              color: tema.corTextoSecundario,
                              border: `1px solid ${tema.corBordaCartao}`,
                            }
                      }
                    >
                      {c}
                    </span>
                  ))}
                </div>

                {/* Título Seção */}
                <p className="text-xs font-bold pt-1" style={{ color: tema.corTextoPrincipal }}>
                  {tema.tituloSecaoProdutos || 'Nosso Cardápio'}
                </p>

                {/* Card de Produto de Exemplo */}
                <div
                  className="p-2.5 flex items-center justify-between gap-2 shadow-sm"
                  style={{
                    backgroundColor: tema.corFundoSecao,
                    border: `1px solid ${tema.corBordaCartao}`,
                    borderRadius:
                      tema.arredondamentoCartoes === 'nenhum'
                        ? '0px'
                        : tema.arredondamentoCartoes === 'pequeno'
                        ? '8px'
                        : tema.arredondamentoCartoes === 'grande'
                        ? '20px'
                        : '14px',
                  }}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p
                      className="text-[11px] font-bold truncate"
                      style={{ color: tema.corTextoPrincipal }}
                    >
                      Item Especial da Casa
                    </p>
                    <p
                      className="text-[9px] line-clamp-2"
                      style={{ color: tema.corTextoSecundario }}
                    >
                      Ingredientes selecionados e tempero artesanal exclusivo.
                    </p>
                    <p className="text-xs font-extrabold pt-0.5" style={{ color: tema.corPreco }}>
                      R$ 32,90
                    </p>
                  </div>

                  {tema.mostrarFotosProdutos && (
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700/60 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Botão de Carrinho Mockup */}
                <div className="pt-2">
                  <div
                    className="w-full py-2 px-3 text-center text-[11px] font-bold shadow-md"
                    style={{
                      backgroundColor: tema.corBotao,
                      color: tema.corTextoBotao,
                      borderRadius:
                        tema.arredondamentoBotoes === 'nenhum'
                          ? '0px'
                          : tema.arredondamentoBotoes === 'pequeno'
                          ? '8px'
                          : tema.arredondamentoBotoes === 'grande'
                          ? '20px'
                          : '12px',
                    }}
                  >
                    {tema.textoBotaoCarrinho || 'Ver Meu Carrinho'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações: Salvar, Desfazer e Restaurar */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={restaurarPadrao}
            disabled={salvando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Visual Padrão
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelarAlteracoes}
              disabled={salvando}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-black bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {salvando ? 'Salvando...' : 'Publicar Alterações no Cardápio'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
