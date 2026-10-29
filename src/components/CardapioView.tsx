import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Calculator,
  Percent,
  Layers,
  ChevronRight,
  Info,
  Camera,
  Upload,
  Image as ImageIcon,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Tag,
  Check,
  X,
  ExternalLink,
  LogOut,
  Clock,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  CategoriaProduto,
  ItemFichaTecnica,
  ProdutoCardapio,
  CategoriaCardapio,
  AdicionalCardapio,
} from '../types';
import { ResultadoPrecificacao } from '../lib/financialMath';
import { getLojaHeader, gerarUrlCardapioPublico, apiUrl, isAndroidApp, getServidorOnlineUrl } from '../lib/lojaId';
import { loginAdmin, logoutAdmin, alterarSenhaAdmin, isAutenticadoAdmin, getAdminAuthHeader } from '../lib/authService';
import { CATEGORIAS_PADRAO } from '../data/initialData';

type SubTab = 'produtos' | 'categorias' | 'adicionais' | 'fichas';

export const CardapioView: React.FC = () => {
  const {
    produtos: produtosContext,
    insumos,
    config,
    adicionarProduto: adicionarProdutoCtx,
    atualizarProduto: atualizarProdutoCtx,
    duplicarProduto: duplicarProdutoCtx,
    inativarProduto: inativarProdutoCtx,
    excluirProduto: excluirProdutoCtx,
    calcularCmvProduto,
    calcularAnaliseProduto,
    publicarCardapioOnline,
  } = useApp();

  // -------------------------------------------------------------
  // Autenticação Administrativa Local-First (100% Funcional Offline)
  // -------------------------------------------------------------
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('DBURGER_ADMIN_TOKEN') || null;
  });
  const [autenticado, setAutenticado] = useState<boolean>(() => isAutenticadoAdmin());
  const [verificandoAuth, setVerificandoAuth] = useState<boolean>(false);
  const [senhaLogin, setSenhaLogin] = useState<string>('');
  const [mostrarSenhaLogin, setMostrarSenhaLogin] = useState<boolean>(false);
  const [erroLogin, setErroLogin] = useState<string>('');
  const [loginCarregando, setLoginCarregando] = useState<boolean>(false);

  // Modal Alterar Senha
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Modal e Ações do Cardápio Público do Cliente
  const [modalCardapioClienteAberto, setModalCardapioClienteAberto] = useState(false);
  const [copiadoLinkPublico, setCopiadoLinkPublico] = useState(false);
  const [publicandoNuvem, setPublicandoNuvem] = useState(false);
  const [modalPublicacao, setModalPublicacao] = useState<{
    sucesso: boolean;
    url?: string;
    msg: string;
    total?: number;
  } | null>(null);

  // -------------------------------------------------------------
  // Estados de Dados (Local e Servidor)
  // -------------------------------------------------------------
  const [subTab, setSubTab] = useState<SubTab>('produtos');
  const [produtos, setProdutos] = useState<ProdutoCardapio[]>(produtosContext);
  const [categorias, setCategorias] = useState<CategoriaCardapio[]>(() => {
    try {
      const s = localStorage.getItem('DBURGER_GESTAO_CATEGORIAS');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const nomesExistentes = new Set(parsed.map((c: any) => c.nome.toLowerCase()));
          const faltantes = CATEGORIAS_PADRAO.filter(
            (def) => !nomesExistentes.has(def.nome.toLowerCase())
          );
          return [...parsed, ...faltantes];
        }
      }
    } catch {}
    return CATEGORIAS_PADRAO;
  });
  const [adicionais, setAdicionais] = useState<AdicionalCardapio[]>(() => {
    try {
      const s = localStorage.getItem('DBURGER_GESTAO_ADICIONAIS');
      if (s) return JSON.parse(s);
    } catch {}
    return [];
  });
  const [carregandoDados, setCarregandoDados] = useState<boolean>(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);
  const [publicacaoPendente, setPublicacaoPendente] = useState<boolean>(false);

  // Sincroniza estado com o contexto local
  useEffect(() => {
    setProdutos(produtosContext);
  }, [produtosContext]);

  // Busca e Filtros
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todas');

  // -------------------------------------------------------------
  // Modais de Produtos
  // -------------------------------------------------------------
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<ProdutoCardapio | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoCardapio | null>(null);

  // Campos do Formulário de Produto
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState<string>('Artesanal');
  const [formDescricao, setFormDescricao] = useState('');
  const [formPrecoVenda, setFormPrecoVenda] = useState<number>(30.0);
  const [formTempoPreparo, setFormTempoPreparo] = useState<number>(12);
  const [formAtivo, setFormAtivo] = useState<boolean>(true);
  const [formFotoUrl, setFormFotoUrl] = useState<string>('');
  const [formAdicionaisIds, setFormAdicionaisIds] = useState<string[]>([]);
  const [formIngredientes, setFormIngredientes] = useState<ItemFichaTecnica[]>([]);
  const [formCustoEmbalagem, setFormCustoEmbalagem] = useState<number>(1.15);
  const [formInsumoId, setFormInsumoId] = useState('');
  const [formQtdConsumo, setFormQtdConsumo] = useState<number>(1);
  const [novaCategoriaRapida, setNovaCategoriaRapida] = useState('');
  const [mostrandoCriarCatRapida, setMostrandoCriarCatRapida] = useState(false);
  const [motivoPreco, setMotivoPreco] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [uploadandoFoto, setUploadandoFoto] = useState(false);

  // -------------------------------------------------------------
  // Modais de Categorias
  // -------------------------------------------------------------
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<CategoriaCardapio | null>(null);
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<CategoriaCardapio | null>(null);
  const [formCatNome, setFormCatNome] = useState('');
  const [formCatDescricao, setFormCatDescricao] = useState('');
  const [formCatAtiva, setFormCatAtiva] = useState(true);
  const [erroCat, setErroCat] = useState('');

  // -------------------------------------------------------------
  // Modais de Adicionais
  // -------------------------------------------------------------
  const [modalAdicionalAberto, setModalAdicionalAberto] = useState(false);
  const [adicionalEmEdicao, setAdicionalEmEdicao] = useState<AdicionalCardapio | null>(null);
  const [adicionalParaExcluir, setAdicionalParaExcluir] = useState<AdicionalCardapio | null>(null);
  const [formAdicNome, setFormAdicNome] = useState('');
  const [formAdicPreco, setFormAdicPreco] = useState<number>(3.0);
  const [formAdicDescricao, setFormAdicDescricao] = useState('');
  const [formAdicFotoUrl, setFormAdicFotoUrl] = useState('');
  const [formAdicMaximo, setFormAdicMaximo] = useState<number>(4);
  const [formAdicMinimo, setFormAdicMinimo] = useState<number>(0);
  const [formAdicObrigatorio, setFormAdicObrigatorio] = useState<boolean>(false);
  const [formAdicCategorias, setFormAdicCategorias] = useState<string[]>(['TODAS']);
  const [formAdicAtivo, setFormAdicAtivo] = useState(true);
  const [erroAdic, setErroAdic] = useState('');

  // -------------------------------------------------------------
  // Modais de Ficha Técnica
  // -------------------------------------------------------------
  const [modalFichaProduto, setModalFichaProduto] = useState<ProdutoCardapio | null>(null);
  const [modalMemoriaProduto, setModalMemoriaProduto] = useState<{
    produto: ProdutoCardapio;
    analise: ResultadoPrecificacao;
  } | null>(null);
  const [selInsumoId, setSelInsumoId] = useState('');
  const [selQtdConsumo, setSelQtdConsumo] = useState<number>(1);

  // Refs de arquivo para foto (Galeria e Câmera)
  const fileInputGaleriaRef = useRef<HTMLInputElement>(null);
  const fileInputCameraRef = useRef<HTMLInputElement>(null);

  // Disparo de aviso de sucesso
  const mostrarToast = (texto: string) => {
    setToastSucesso(texto);
    setTimeout(() => setToastSucesso(null), 3500);
  };

  const adicionarIngredienteFicha = () => {
    if (!formInsumoId) {
      setErroForm('Selecione um insumo para adicionar à ficha técnica.');
      return;
    }
    const ins = insumos.find((i) => i.id === formInsumoId);
    if (!ins) return;
    if (formQtdConsumo <= 0) {
      setErroForm('Informe uma quantidade válida para a porção do insumo.');
      return;
    }

    const jaExisteIdx = formIngredientes.findIndex((it) => it.insumoId === formInsumoId);
    if (jaExisteIdx >= 0) {
      const novos = [...formIngredientes];
      novos[jaExisteIdx] = {
        ...novos[jaExisteIdx],
        quantidadeConsumo: novos[jaExisteIdx].quantidadeConsumo + formQtdConsumo,
      };
      setFormIngredientes(novos);
    } else {
      setFormIngredientes([
        ...formIngredientes,
        { insumoId: formInsumoId, quantidadeConsumo: formQtdConsumo },
      ]);
    }
    setFormInsumoId('');
    setFormQtdConsumo(1);
    setErroForm('');
  };

  const removerIngredienteFicha = (insId: string) => {
    setFormIngredientes(formIngredientes.filter((it) => it.insumoId !== insId));
  };

  const adicionarCategoriaRapida = () => {
    if (!novaCategoriaRapida.trim()) return;
    const nomeCat = novaCategoriaRapida.trim();
    if (categorias.some((c) => c.nome.toLowerCase() === nomeCat.toLowerCase())) {
      setFormCategoria(nomeCat);
      setNovaCategoriaRapida('');
      setMostrandoCriarCatRapida(false);
      return;
    }
    const novaCatObj: CategoriaCardapio = {
      id: `cat-${Date.now()}`,
      nome: nomeCat,
      descricao: '',
      ordem: categorias.length + 1,
      ativa: true,
    };
    const atualizadas = [...categorias, novaCatObj];
    setCategorias(atualizadas);
    localStorage.setItem('DBURGER_GESTAO_CATEGORIAS', JSON.stringify(atualizadas));
    setFormCategoria(nomeCat);
    setNovaCategoriaRapida('');
    setMostrandoCriarCatRapida(false);
    mostrarToast(`Categoria "${nomeCat}" criada com sucesso!`);
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 1. Verificação de Sessão do Administrador (Offline-First)
  // -------------------------------------------------------------
  useEffect(() => {
    const verificarAuth = async () => {
      // Se já está autenticado localmente, permite acesso imediato
      if (isAutenticadoAdmin() || adminToken) {
        setAutenticado(true);
        setVerificandoAuth(false);
        carregarDadosServidor();
        return;
      }
      setAutenticado(false);
      setVerificandoAuth(false);
    };

    verificarAuth();
  }, [adminToken]);

  // Carregar produtos, categorias e adicionais do backend (com fallback local seguro)
  const carregarDadosServidor = async () => {
    setCarregandoDados(true);
    try {
      const [resProd, resCat, resAdic] = await Promise.all([
        fetch(apiUrl('/api/admin/produtos'), { headers: { ...getAdminAuthHeader(), ...getLojaHeader() } }),
        fetch(apiUrl('/api/admin/categorias'), { headers: { ...getAdminAuthHeader(), ...getLojaHeader() } }),
        fetch(apiUrl('/api/admin/adicionais'), { headers: { ...getAdminAuthHeader(), ...getLojaHeader() } }),
      ]);

      if (resProd.ok) {
        const prodsData = await resProd.json();
        if (Array.isArray(prodsData) && prodsData.length > 0) {
          setProdutos(prodsData);
        }
      }
      if (resCat.ok) {
        const catsData = await resCat.json();
        if (Array.isArray(catsData) && catsData.length > 0) {
          setCategorias(catsData);
          localStorage.setItem('DBURGER_GESTAO_CATEGORIAS', JSON.stringify(catsData));
        }
      }
      if (resAdic.ok) {
        const adicsData = await resAdic.json();
        if (Array.isArray(adicsData) && adicsData.length > 0) {
          setAdicionais(adicsData);
          localStorage.setItem('DBURGER_GESTAO_ADICIONAIS', JSON.stringify(adicsData));
        }
      }
    } catch (e) {
      // Modo offline no celular/APK: mantém dados locais em SQLite/localStorage
      console.log('Painel Cardápio em modo local offline. Dados preservados no dispositivo.');
    } finally {
      setCarregandoDados(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Ações de Login e Logout (100% Funcional Offline no Android APK)
  // -------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senhaLogin.trim()) {
      setErroLogin('Por favor, informe a senha de administrador.');
      return;
    }

    setLoginCarregando(true);
    setErroLogin('');

    try {
      const res = await loginAdmin(senhaLogin.trim());
      if (!res.sucesso) {
        setErroLogin(res.erro || 'Senha incorreta. Tente novamente.');
        return;
      }

      const token = res.token || 'adm_local_session';
      setAdminToken(token);
      setAutenticado(true);
      setSenhaLogin('');
      carregarDadosServidor();
      mostrarToast(
        res.modoOffline
          ? 'Acesso administrativo offline concedido (SQLite Local).'
          : 'Login administrativo online realizado com sucesso!'
      );
    } catch (e) {
      setErroLogin('Erro ao processar autenticação.');
    } finally {
      setLoginCarregando(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setAdminToken(null);
    setAutenticado(false);
    mostrarToast('Sessão administrativa encerrada.');
  };

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSenha(null);

    if (!senhaAtual || !novaSenha || !confirmaNovaSenha) {
      setMsgSenha({ tipo: 'erro', texto: 'Preencha todos os campos da senha.' });
      return;
    }
    if (novaSenha.length < 4) {
      setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 4 caracteres.' });
      return;
    }
    if (novaSenha !== confirmaNovaSenha) {
      setMsgSenha({ tipo: 'erro', texto: 'A confirmação de senha não confere.' });
      return;
    }

    try {
      const res = await alterarSenhaAdmin(senhaAtual, novaSenha);
      if (!res.sucesso) {
        setMsgSenha({ tipo: 'erro', texto: res.erro || 'Falha ao alterar senha.' });
        return;
      }

      setMsgSenha({
        tipo: 'sucesso',
        texto: res.sincronizadoServidor
          ? 'Senha alterada com sucesso localmente e na nuvem!'
          : 'Senha alterada com sucesso localmente (offline)!',
      });
      setTimeout(() => {
        setModalSenhaAberto(false);
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmaNovaSenha('');
        setMsgSenha(null);
      }, 1500);
    } catch {
      setMsgSenha({ tipo: 'erro', texto: 'Erro ao salvar a nova senha.' });
    }
  };

  const handlePublicarCardapio = async () => {
    setPublicandoNuvem(true);
    try {
      const res = await publicarCardapioOnline();
      setModalPublicacao({
        sucesso: res.sucesso,
        url: res.urlPublica,
        msg: res.sucesso
          ? `Cardápio publicado com sucesso na nuvem! ${res.totalProdutos ?? produtos.length} produtos disponíveis para os clientes.`
          : (res.erro || 'Não foi possível conectar ao servidor para publicar. Verifique sua conexão.'),
        total: res.totalProdutos ?? produtos.length,
      });
      if (res.sucesso) {
        setPublicacaoPendente(false);
        mostrarToast('Cardápio sincronizado e publicado na nuvem com sucesso!');
      }
    } catch (e) {
      setModalPublicacao({
        sucesso: false,
        msg: 'Falha de conexão com a nuvem ao publicar o cardápio.',
      });
    } finally {
      setPublicandoNuvem(false);
    }
  };

  // -------------------------------------------------------------
  // 3. Upload Real de Fotos no Servidor
  // -------------------------------------------------------------
  const processarArquivoFoto = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErroForm('Por favor, selecione um arquivo de imagem válido (JPEG, PNG, WEBP).');
      return;
    }

    setUploadandoFoto(true);
    setErroForm('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch(apiUrl('/api/upload'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify({ imageBase64: base64Data }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.sucesso && data.url) {
              setFormFotoUrl(data.url);
              mostrarToast('Foto enviada e armazenada no servidor com sucesso!');
              return;
            }
          }
          // Fallback offline: se o servidor estiver inacessível, armazena base64 localmente
          setFormFotoUrl(base64Data);
          mostrarToast('Foto salva localmente no aplicativo (offline).');
        } catch (e) {
          if (reader.result) {
            setFormFotoUrl(reader.result as string);
            mostrarToast('Foto salva localmente no aplicativo (offline).');
          } else {
            setErroForm('Erro ao processar imagem.');
          }
        } finally {
          setUploadandoFoto(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setErroForm('Falha ao ler o arquivo selecionado.');
      setUploadandoFoto(false);
    }
  };

  // -------------------------------------------------------------
  // 4. CRUD de Produtos (Local-First + Sincronização em Nuvem)
  // -------------------------------------------------------------
  const abrirModalCriarProduto = () => {
    setProdutoEmEdicao(null);
    setFormNome('');
    setFormCategoria(categorias[0]?.nome || 'Artesanal');
    setFormDescricao('');
    setFormPrecoVenda(28.0);
    setFormTempoPreparo(12);
    setFormAtivo(true);
    setFormFotoUrl('');
    setFormAdicionaisIds(adicionais.map((a) => a.id));
    setFormIngredientes([]);
    setFormCustoEmbalagem(1.15);
    setMotivoPreco('');
    setErroForm('');
    setModalProdutoAberto(true);
  };

  const abrirModalEditarProduto = (prod: ProdutoCardapio) => {
    setProdutoEmEdicao(prod);
    setFormNome(prod.nome);
    setFormCategoria(prod.categoria);
    setFormDescricao(prod.descricao || '');
    setFormPrecoVenda(prod.precoVenda);
    setFormTempoPreparo(prod.tempoPreparoMinutos || 12);
    setFormAtivo(prod.ativo);
    setFormFotoUrl(prod.fotoUrl || '');
    setFormAdicionaisIds(prod.adicionaisIds || adicionais.map((a) => a.id));
    setFormIngredientes([...(prod.ingredientes || [])]);
    setFormCustoEmbalagem(prod.custoEmbalagemManual || 1.15);
    setMotivoPreco('');
    setErroForm('');
    setModalProdutoAberto(true);
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setErroForm('O produto precisa de um nome obrigatório.');
      return;
    }
    if (formPrecoVenda <= 0) {
      setErroForm('O preço de venda deve ser maior que zero (R$).');
      return;
    }
    if (!formCategoria.trim()) {
      setErroForm('Selecione ou informe a categoria do produto.');
      return;
    }

    const payload = {
      nome: formNome.trim(),
      categoria: formCategoria.trim(),
      descricao: formDescricao.trim(),
      precoVenda: formPrecoVenda,
      tempoPreparoMinutos: formTempoPreparo,
      ativo: formAtivo,
      fotoUrl: formFotoUrl.trim() || undefined,
      adicionaisIds: formAdicionaisIds,
      ingredientes: formIngredientes,
      custoEmbalagemManual: formCustoEmbalagem,
      motivoPreco: motivoPreco.trim() || undefined,
    };

    try {
      if (produtoEmEdicao) {
        // Atualiza contexto local imediatamente (SQLite / AppContext)
        atualizarProdutoCtx(produtoEmEdicao.id, payload, motivoPreco || 'Edição no painel administrativo');
        setProdutos((prev) =>
          prev.map((p) => (p.id === produtoEmEdicao.id ? { ...p, ...payload } : p))
        );
        mostrarToast(`Produto "${formNome}" atualizado com sucesso!`);

        setPublicacaoPendente(true);

        // Sincroniza em segundo plano com servidor online se disponível
        try {
          await fetch(apiUrl(`/api/admin/produtos/${produtoEmEdicao.id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify(payload),
          });
        } catch {
          // Offline seguro
        }
      } else {
        const idLocal = `prod_${Date.now()}`;
        adicionarProdutoCtx({
          ...payload,
          id: idLocal,
        } as any);
        setProdutos((prev) => [...prev, ({ ...payload, id: idLocal } as unknown as ProdutoCardapio)]);
        setPublicacaoPendente(true);
        mostrarToast(`Produto "${formNome}" cadastrado e salvo com sucesso!`);

        // Sincroniza em segundo plano com servidor online se disponível
        try {
          const res = await fetch(apiUrl('/api/admin/produtos'), {
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
            if (data.produto?.id) {
              setProdutos((prev) =>
                prev.map((p) => (p.id === idLocal ? { ...p, id: data.produto.id } : p))
              );
            }
          }
        } catch {
          // Offline seguro
        }
      }

      setModalProdutoAberto(false);
    } catch (e) {
      setErroForm('Erro ao salvar produto.');
    }
  };

  const alternarDisponibilidadeProduto = async (prod: ProdutoCardapio) => {
    const novoStatus = !prod.ativo;
    setProdutos((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, ativo: novoStatus } : p))
    );
    inativarProdutoCtx(prod.id);
    mostrarToast(
      novoStatus
        ? `"${prod.nome}" agora está ATIVO e visível no cardápio.`
        : `"${prod.nome}" foi DESATIVADO temporariamente do cardápio.`
    );

    setPublicacaoPendente(true);

    try {
      await fetch(apiUrl(`/api/admin/produtos/${prod.id}/toggle-ativo`), {
        method: 'PATCH',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
    } catch {}
  };

  const confirmarExclusaoProduto = async () => {
    if (!produtoParaExcluir) return;

    setProdutos((prev) => prev.filter((p) => p.id !== produtoParaExcluir.id));
    excluirProdutoCtx(produtoParaExcluir.id);
    setPublicacaoPendente(true);
    mostrarToast(`Produto "${produtoParaExcluir.nome}" excluído do cardápio.`);

    try {
      await fetch(apiUrl(`/api/admin/produtos/${produtoParaExcluir.id}`), {
        method: 'DELETE',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
    } catch {} finally {
      setProdutoParaExcluir(null);
    }
  };

  // Reordenar produtos
  const moverOrdemProduto = async (index: number, direcao: 'cima' | 'baixo') => {
    const novoIndex = direcao === 'cima' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= produtos.length) return;

    const novos = [...produtos];
    const temp = novos[index];
    novos[index] = novos[novoIndex];
    novos[novoIndex] = temp;

    novos.forEach((p, idx) => {
      p.ordem = idx + 1;
    });

    setProdutos(novos);
    setPublicacaoPendente(true);

    try {
      await fetch(apiUrl('/api/admin/produtos/reorder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
        body: JSON.stringify({ ids: novos.map((p) => p.id) }),
      });
      mostrarToast('Ordem dos produtos atualizada!');
    } catch {}
  };

  // -------------------------------------------------------------
  // 5. CRUD de Categorias (Local-First)
  // -------------------------------------------------------------
  const abrirModalCriarCategoria = () => {
    setCategoriaEmEdicao(null);
    setFormCatNome('');
    setFormCatDescricao('');
    setFormCatAtiva(true);
    setErroCat('');
    setModalCategoriaAberto(true);
  };

  const abrirModalEditarCategoria = (cat: CategoriaCardapio) => {
    setCategoriaEmEdicao(cat);
    setFormCatNome(cat.nome);
    setFormCatDescricao(cat.descricao || '');
    setFormCatAtiva(cat.ativa);
    setErroCat('');
    setModalCategoriaAberto(true);
  };

  const salvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCatNome.trim()) {
      setErroCat('O nome da categoria é obrigatório.');
      return;
    }

    const payload = {
      nome: formCatNome.trim(),
      descricao: formCatDescricao.trim(),
      ativa: formCatAtiva,
    };

    try {
      if (categoriaEmEdicao) {
        const atualizadas = categorias.map((c) =>
          c.id === categoriaEmEdicao.id ? { ...c, ...payload } : c
        );
        setCategorias(atualizadas);
        localStorage.setItem('DBURGER_GESTAO_CATEGORIAS', JSON.stringify(atualizadas));
        setPublicacaoPendente(true);
        mostrarToast(`Categoria "${formCatNome}" atualizada com sucesso!`);

        try {
          await fetch(apiUrl(`/api/admin/categorias/${categoriaEmEdicao.id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify(payload),
          });
        } catch {}
      } else {
        const novaCat: CategoriaCardapio = {
          id: `cat_${Date.now()}`,
          nome: payload.nome,
          descricao: payload.descricao,
          ativa: payload.ativa,
          ordem: categorias.length + 1,
        };
        const atualizadas = [...categorias, novaCat];
        setCategorias(atualizadas);
        localStorage.setItem('DBURGER_GESTAO_CATEGORIAS', JSON.stringify(atualizadas));
        setPublicacaoPendente(true);
        mostrarToast(`Categoria "${formCatNome}" criada com sucesso!`);

        try {
          await fetch(apiUrl('/api/admin/categorias'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify(payload),
          });
        } catch {}
      }

      setModalCategoriaAberto(false);
    } catch {
      setErroCat('Erro ao salvar categoria.');
    }
  };

  const confirmarExclusaoCategoria = async () => {
    if (!categoriaParaExcluir) return;

    const filtradas = categorias.filter((c) => c.id !== categoriaParaExcluir.id);
    setCategorias(filtradas);
    localStorage.setItem('DBURGER_GESTAO_CATEGORIAS', JSON.stringify(filtradas));
    setPublicacaoPendente(true);
    mostrarToast(`Categoria "${categoriaParaExcluir.nome}" excluída.`);

    try {
      await fetch(apiUrl(`/api/admin/categorias/${categoriaParaExcluir.id}`), {
        method: 'DELETE',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
    } catch {} finally {
      setCategoriaParaExcluir(null);
    }
  };

  // -------------------------------------------------------------
  // 6. CRUD de Adicionais Personalizáveis (Local-First)
  // -------------------------------------------------------------
  const abrirModalCriarAdicional = () => {
    setAdicionalEmEdicao(null);
    setFormAdicNome('');
    setFormAdicPreco(3.0);
    setFormAdicDescricao('');
    setFormAdicFotoUrl('');
    setFormAdicMaximo(4);
    setFormAdicMinimo(0);
    setFormAdicObrigatorio(false);
    setFormAdicCategorias(['TODAS']);
    setFormAdicAtivo(true);
    setErroAdic('');
    setModalAdicionalAberto(true);
  };

  const abrirModalEditarAdicional = (adic: AdicionalCardapio) => {
    setAdicionalEmEdicao(adic);
    setFormAdicNome(adic.nome);
    setFormAdicPreco(adic.preco);
    setFormAdicDescricao(adic.descricao || '');
    setFormAdicFotoUrl(adic.fotoUrl || '');
    setFormAdicMaximo(adic.maximoPorLanche || 4);
    setFormAdicMinimo(adic.minimoPorLanche || 0);
    setFormAdicObrigatorio(Boolean(adic.obrigatorio));
    setFormAdicCategorias(adic.categoriasPermitidas || ['TODAS']);
    setFormAdicAtivo(adic.ativo);
    setErroAdic('');
    setModalAdicionalAberto(true);
  };

  const salvarAdicional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAdicNome.trim()) {
      setErroAdic('O nome do adicional é obrigatório (ex: Bacon extra).');
      return;
    }
    if (formAdicPreco < 0) {
      setErroAdic('O preço do adicional deve ser zero ou maior (R$).');
      return;
    }

    const payload = {
      nome: formAdicNome.trim(),
      preco: formAdicPreco,
      descricao: formAdicDescricao.trim() || undefined,
      fotoUrl: formAdicFotoUrl.trim() || undefined,
      maximoPorLanche: formAdicMaximo >= 1 ? formAdicMaximo : 4,
      minimoPorLanche: formAdicMinimo >= 0 ? formAdicMinimo : 0,
      obrigatorio: formAdicObrigatorio,
      categoriasPermitidas: formAdicCategorias.length > 0 ? formAdicCategorias : ['TODAS'],
      ativo: formAdicAtivo,
    };

    try {
      if (adicionalEmEdicao) {
        const atualizados = adicionais.map((a) =>
          a.id === adicionalEmEdicao.id ? { ...a, ...payload } : a
        );
        setAdicionais(atualizados);
        localStorage.setItem('DBURGER_GESTAO_ADICIONAIS', JSON.stringify(atualizados));
        setPublicacaoPendente(true);
        mostrarToast(`Adicional "${formAdicNome}" atualizado com sucesso!`);

        try {
          await fetch(apiUrl(`/api/admin/adicionais/${adicionalEmEdicao.id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify(payload),
          });
        } catch {}
      } else {
        const novoAdic: AdicionalCardapio = {
          id: `adic_${Date.now()}`,
          nome: payload.nome,
          preco: payload.preco,
          descricao: payload.descricao,
          fotoUrl: payload.fotoUrl,
          maximoPorLanche: payload.maximoPorLanche,
          minimoPorLanche: payload.minimoPorLanche,
          obrigatorio: payload.obrigatorio,
          categoriasPermitidas: payload.categoriasPermitidas,
          ativo: payload.ativo,
        };
        const atualizados = [...adicionais, novoAdic];
        setAdicionais(atualizados);
        localStorage.setItem('DBURGER_GESTAO_ADICIONAIS', JSON.stringify(atualizados));
        setPublicacaoPendente(true);
        mostrarToast(`Adicional "${formAdicNome}" cadastrado com sucesso!`);

        try {
          await fetch(apiUrl('/api/admin/adicionais'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAdminAuthHeader(),
              ...getLojaHeader(),
            },
            body: JSON.stringify(payload),
          });
        } catch {}
      }

      setModalAdicionalAberto(false);
    } catch {
      setErroAdic('Erro ao salvar adicional.');
    }
  };

  const alternarDisponibilidadeAdicional = async (adic: AdicionalCardapio) => {
    const novoStatus = !adic.ativo;
    const atualizados = adicionais.map((a) =>
      a.id === adic.id ? { ...a, ativo: novoStatus } : a
    );
    setAdicionais(atualizados);
    localStorage.setItem('DBURGER_GESTAO_ADICIONAIS', JSON.stringify(atualizados));
    setPublicacaoPendente(true);
    mostrarToast(
      novoStatus
        ? `"${adic.nome}" agora está ATIVO e disponível para os clientes.`
        : `"${adic.nome}" foi DESATIVADO temporariamente.`
    );

    try {
      await fetch(apiUrl(`/api/admin/adicionais/${adic.id}/toggle-ativo`), {
        method: 'PATCH',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
    } catch {}
  };

  const confirmarExclusaoAdicional = async () => {
    if (!adicionalParaExcluir) return;

    const filtrados = adicionais.filter((a) => a.id !== adicionalParaExcluir.id);
    setAdicionais(filtrados);
    localStorage.setItem('DBURGER_GESTAO_ADICIONAIS', JSON.stringify(filtrados));
    setPublicacaoPendente(true);
    mostrarToast(`Adicional "${adicionalParaExcluir.nome}" excluído.`);

    try {
      await fetch(apiUrl(`/api/admin/adicionais/${adicionalParaExcluir.id}`), {
        method: 'DELETE',
        headers: {
          ...getAdminAuthHeader(),
          ...getLojaHeader(),
        },
      });
    } catch {} finally {
      setAdicionalParaExcluir(null);
    }
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const renderModalCardapioCliente = () => {
    if (!modalCardapioClienteAberto) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <ExternalLink className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">Cardápio Público do Cliente</h3>
                <p className="text-[11px] text-zinc-400">Link HTTPS exclusivo da sua hamburgueria</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalCardapioClienteAberto(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
                Endereço Web Oficial
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={gerarUrlCardapioPublico()}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(gerarUrlCardapioPublico());
                      setCopiadoLinkPublico(true);
                      setTimeout(() => setCopiadoLinkPublico(false), 3000);
                      mostrarToast('Link copiado para a área de transferência!');
                    } catch {}
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition"
                >
                  {copiadoLinkPublico ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiadoLinkPublico ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Opção Principal Offline / Local (Evita erro de tela preta ou página indisponível) */}
            <button
              type="button"
              onClick={() => {
                setModalCardapioClienteAberto(false);
                window.history.pushState({}, '', '?view=cardapio');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
            >
              <Eye className="w-4 h-4 text-black" />
              <span>Visualizar Cardápio no App (100% Offline / Local)</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `🍔 Conheça nosso cardápio online e faça seu pedido direto pelo link:\n${gerarUrlCardapioPublico()}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Compartilhar no WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  const url = gerarUrlCardapioPublico();
                  if (typeof window !== 'undefined') {
                    window.open(url, '_system') || window.open(url, '_blank');
                  }
                }}
                className="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition"
              >
                <ExternalLink className="w-4 h-4 text-amber-400" />
                <span>Abrir no Navegador</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
              <div className="flex items-center justify-between text-zinc-300 font-semibold">
                <span>Servidor Online Destino:</span>
                <span className="text-cyan-400 font-mono text-[10px] truncate max-w-[180px]">
                  {getServidorOnlineUrl()}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Para testar seu cardápio no próprio celular sem erro de página indisponível, utilize a opção destacada em amarelo <strong>"Visualizar Cardápio no App (100% Offline)"</strong> acima. O link externo depende de compartilhamento ativo na internet.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">💡 Como funciona para os seus clientes?</p>
              <p>
                O cliente não precisa instalar o aplicativo administrativo. Basta abrir o link em qualquer
                navegador no celular ou computador, escolher os lanches, adicionar adicionais, informar o
                endereço e enviar o pedido com Pix automático ou pagamento na entrega.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setModalCardapioClienteAberto(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TELA DE LOGIN PRIVADO ADMINISTRATIVO (Se não autenticado)
  // -------------------------------------------------------------
  if (verificandoAuth) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-zinc-400 font-medium">Verificando credenciais de administrador...</p>
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Painel Administrativo Privado</h2>
            <p className="text-xs text-zinc-400">
              Área restrita para gerenciamento do cardápio, produtos, fotos, categorias e adicionais.
            </p>
          </div>

          {erroLogin && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{erroLogin}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Senha Administrativa
              </label>
              <div className="relative">
                <input
                  type={mostrarSenhaLogin ? 'text' : 'password'}
                  value={senhaLogin}
                  onChange={(e) => setSenhaLogin(e.target.value)}
                  placeholder="Digite sua senha de administrador..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhaLogin(!mostrarSenhaLogin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {mostrarSenhaLogin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Senha padrão: <code className="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">1234</code> ou <code className="bg-zinc-800 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">admin123</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loginCarregando}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-98 disabled:opacity-50"
            >
              {loginCarregando ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Entrar no Painel</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-zinc-800/80 text-center">
            <button
              type="button"
              onClick={() => setModalCardapioClienteAberto(true)}
              className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver Cardápio Público do Cliente</span>
            </button>
          </div>
        </div>

        {/* Modal acessível mesmo antes de efetuar login */}
        {renderModalCardapioCliente()}
      </div>
    );
  }

  // -------------------------------------------------------------
  // FILTRAGEM DOS PRODUTOS NO PAINEL
  // -------------------------------------------------------------
  const produtosFiltrados = produtos.filter((p) => {
    const matchBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(busca.toLowerCase()));
    const matchCat = categoriaAtiva === 'todas' || p.categoria === categoriaAtiva;
    return matchBusca && matchCat;
  });

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Toast Notificação de Sucesso */}
      {toastSucesso && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-black px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastSucesso}</span>
        </div>
      )}

      {/* Alerta de Publicação Pendente */}
      {publicacaoPendente && (
        <div className="bg-amber-950/70 border border-amber-500/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-200">
                Alterações Salvas no Dispositivo (Publicação Pendente)
              </p>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                Os produtos, preços ou categorias foram alterados localmente. Para que seus clientes na internet vejam o cardápio atualizado, clique no botão <strong>Publicar Cardápio Online</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={handlePublicarCardapio}
            disabled={publicandoNuvem}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 transition shadow-md shadow-emerald-600/30 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{publicandoNuvem ? 'Publicando...' : 'Publicar Cardápio Agora'}</span>
          </button>
        </div>
      )}

      {/* Header Administrativo com Abas e Ações */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Administrador Autenticado
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">Gestão Completa do Cardápio</h2>
            <p className="text-xs text-zinc-400">
              Produtos, fotos, adicionais personalizados e categorias com sincronização direta no banco de dados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModalCardapioClienteAberto(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition border border-amber-500/40"
              title="Visualizar, copiar ou compartilhar o cardápio público dos clientes"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Cardápio do Cliente</span>
            </button>

            <button
              onClick={handlePublicarCardapio}
              disabled={publicandoNuvem}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              title="Publicar e sincronizar cardápio na nuvem para clientes"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{publicandoNuvem ? 'Publicando...' : 'Publicar Cardápio Online'}</span>
            </button>

            <button
              onClick={() => setModalSenhaAberto(true)}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition border border-zinc-700"
              title="Trocar a senha de administrador"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Alterar Senha</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5 transition border border-rose-500/30"
              title="Sair do painel administrativo"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Barra de Sub-Abas do Painel */}
        <div className="flex gap-2 overflow-x-auto pb-1 border-t border-zinc-800 pt-3">
          <button
            onClick={() => setSubTab('produtos')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'produtos'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <span>🍔 Produtos do Cardápio</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">
              {produtos.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('adicionais')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'adicionais'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Gerenciar Adicionais</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">
              {adicionais.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('categorias')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'categorias'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Organizar Categorias</span>
            <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">
              {categorias.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('fichas')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'fichas'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Fichas Técnicas & CMV</span>
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* ABA 1: PRODUTOS DO CARDÁPIO */}
      {/* ============================================================= */}
      {subTab === 'produtos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar produto por nome ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={abrirModalCriarProduto}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Produto</span>
            </button>
          </div>

          {/* Filtros de Categoria */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['todas', ...categorias.map((c) => c.nome)].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  categoriaAtiva === cat
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat === 'todas' ? 'Todas as Categorias' : cat}
              </button>
            ))}
          </div>

          {/* Grid de Produtos */}
          {produtosFiltrados.length === 0 ? (
            <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-3xl space-y-3">
              <span className="text-4xl">🍔</span>
              <p className="text-zinc-400 text-sm">Nenhum produto cadastrado com esses filtros.</p>
              <button
                onClick={abrirModalCriarProduto}
                className="px-4 py-2 bg-amber-500 text-black font-bold text-xs rounded-xl"
              >
                Cadastrar primeiro hambúrguer
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produtosFiltrados.map((prod, idx) => (
                <div
                  key={prod.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                    prod.ativo
                      ? 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                      : 'bg-zinc-950/60 border-zinc-800/40 opacity-70'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Foto Real ou Placeholder */}
                      <div className="w-20 h-20 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                        {prod.fotoUrl ? (
                          <img
                            src={prod.fotoUrl}
                            alt={prod.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-zinc-700" />
                        )}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-zinc-300 px-1 rounded font-mono">
                          #{prod.ordem ?? idx + 1}
                        </span>
                      </div>

                      {/* Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {prod.categoria}
                          </span>

                          {/* Reordenação Rápida */}
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => moverOrdemProduto(idx, 'cima')}
                              disabled={idx === 0}
                              className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                              title="Subir ordem"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moverOrdemProduto(idx, 'baixo')}
                              disabled={idx === produtos.length - 1}
                              className="p-1 rounded text-zinc-500 hover:text-white disabled:opacity-30"
                              title="Descer ordem"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h3 className="font-extrabold text-sm text-white mt-1 truncate">{prod.nome}</h3>
                        <p className="font-mono font-black text-amber-400 text-sm mt-0.5">
                          {formatarMoeda(prod.precoVenda)}
                        </p>
                      </div>
                    </div>

                    {prod.descricao && (
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {prod.descricao}
                      </p>
                    )}

                    {/* Adicionais Permitidos Info */}
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>
                        {prod.adicionaisIds && prod.adicionaisIds.length > 0
                          ? `${prod.adicionaisIds.length} adicionais permitidos`
                          : 'Todos os adicionais permitidos'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Ações: Ativar/Desativar, Editar e Excluir */}
                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => alternarDisponibilidadeProduto(prod)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                        prod.ativo
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                      title={prod.ativo ? 'Clique para desativar' : 'Clique para ativar no cardápio'}
                    >
                      <span className={`w-2 h-2 rounded-full ${prod.ativo ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                      <span>{prod.ativo ? 'Disponível' : 'Indisponível'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => abrirModalEditarProduto(prod)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => setProdutoParaExcluir(prod)}
                        className="px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition border border-rose-500/20"
                        title="Excluir produto com confirmação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* ABA 2: GERENCIAR ADICIONAIS PERSONALIZÁVEIS */}
      {/* ============================================================= */}
      {subTab === 'adicionais' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
            <div>
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Sistema de Adicionais Personalizáveis
              </h3>
              <p className="text-xs text-zinc-400">
                Cadastre complementos (bacon, cheddar, queijo, ovo, carne extra) com regras de limite e precificação livre.
              </p>
            </div>

            <button
              onClick={abrirModalCriarAdicional}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Adicional</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adicionais.map((adic) => (
              <div
                key={adic.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                  adic.ativo
                    ? 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-950/60 border-zinc-800/40 opacity-70'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm">
                        +
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{adic.nome}</h4>
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {formatarMoeda(adic.preco)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        adic.ativo
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                      }`}
                    >
                      {adic.ativo ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  {adic.descricao && (
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {adic.descricao}
                    </p>
                  )}

                  <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/60 space-y-1 text-[11px] text-zinc-400">
                    <div className="flex justify-between">
                      <span>Limite por lanche:</span>
                      <strong className="text-white font-mono">{adic.maximoPorLanche ?? 4} unidades</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipo de escolha:</span>
                      <strong className={adic.obrigatorio ? 'text-amber-400' : 'text-zinc-300'}>
                        {adic.obrigatorio ? 'Obrigatório' : 'Opcional'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Disponível em:</span>
                      <span className="text-zinc-300 truncate max-w-[140px]">
                        {adic.categoriasPermitidas && adic.categoriasPermitidas.length > 0
                          ? adic.categoriasPermitidas.join(', ')
                          : 'Todas as categorias'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação do Adicional */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => alternarDisponibilidadeAdicional(adic)}
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition ${
                      adic.ativo
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {adic.ativo ? 'Pausar' : 'Ativar'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => abrirModalEditarAdicional(adic)}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => setAdicionalParaExcluir(adic)}
                      className="px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition border border-rose-500/20"
                      title="Excluir adicional"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* ABA 3: ORGANIZAR CATEGORIAS */}
      {/* ============================================================= */}
      {subTab === 'categorias' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800">
            <div>
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                Categorias do Cardápio
              </h3>
              <p className="text-xs text-zinc-400">
                Organize as seções do seu cardápio como Simples, Artesanais, Smash, Bebidas e Promoções.
              </p>
            </div>

            <button
              onClick={abrirModalCriarCategoria}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Categoria</span>
            </button>
          </div>

          <div className="space-y-2">
            {categorias.map((cat, idx) => (
              <div
                key={cat.id}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs font-mono">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{cat.nome}</h4>
                    {cat.descricao && <p className="text-xs text-zinc-400">{cat.descricao}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModalEditarCategoria(cat)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Editar</span>
                  </button>

                  <button
                    onClick={() => setCategoriaParaExcluir(cat)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition border border-rose-500/20"
                    title="Excluir categoria"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* ABA 4: FICHAS TÉCNICAS E CMV (Preservada do Projeto Original) */}
      {/* ============================================================= */}
      {subTab === 'fichas' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
            <h3 className="font-extrabold text-base text-white">Análise de CMV e Precificação</h3>
            <p className="text-xs text-zinc-400">
              Cálculo financeiro de custo dos ingredientes, embalagens e semáforo de margem de contribuição.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {produtos.map((prod) => {
              const analise = calcularAnaliseProduto(prod);
              return (
                <div
                  key={prod.id}
                  className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold uppercase">{prod.categoria}</span>
                      <h4 className="font-extrabold text-sm text-white">{prod.nome}</h4>
                    </div>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatarMoeda(prod.precoVenda)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">CMV Insumos:</span>
                      <strong className="text-rose-400 font-mono">{formatarMoeda(analise.cmv)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Margem Bruta:</span>
                      <strong className="text-emerald-400 font-mono">
                        {analise.margemBrutaIngredientesPercent.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalFichaProduto(prod)}
                    className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ver Receita ({prod.ingredientes?.length || 0} insumos)</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: ADICIONAR / EDITAR PRODUTO */}
      {/* ============================================================= */}
      {modalProdutoAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-white">
                  {produtoEmEdicao ? `Editar Produto: ${produtoEmEdicao.nome}` : 'Adicionar Novo Produto'}
                </h3>
                <p className="text-[11px] text-zinc-400">Preencha os dados e escolha a foto do produto</p>
              </div>
              <button
                type="button"
                onClick={() => setModalProdutoAberto(false)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            {(() => {
              const custoInsumosForm = formIngredientes.reduce((sum, item) => {
                const ins = insumos.find((i) => i.id === item.insumoId);
                return sum + (ins ? item.quantidadeConsumo * ins.custoUnitarioConsumo : 0);
              }, 0);
              const custoTotalForm = custoInsumosForm + (Number(formCustoEmbalagem) || 0);
              const cmvPercentForm = formPrecoVenda > 0 ? (custoTotalForm / formPrecoVenda) * 100 : 0;
              const margemBrutaReaisForm = Math.max(0, formPrecoVenda - custoTotalForm);
              const margemBrutaPercentForm = formPrecoVenda > 0 ? (margemBrutaReaisForm / formPrecoVenda) * 100 : 0;
              const precoSugerido40MargemForm = custoTotalForm > 0 ? Math.round((custoTotalForm / 0.60) * 100) / 100 : 0;
              const corStatusForm =
                custoTotalForm === 0
                  ? 'vermelho'
                  : cmvPercentForm <= 30
                  ? 'verde'
                  : cmvPercentForm <= 40
                  ? 'amarelo'
                  : 'vermelho';

              return (
                <form onSubmit={salvarProduto} className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
                  {erroForm && (
                    <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{erroForm}</span>
                    </div>
                  )}

                  {/* Nome e Preço */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-zinc-300 mb-1">Nome do Produto *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: D’ Burger Especial, Smash Bacon..."
                        value={formNome}
                        onChange={(e) => setFormNome(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-zinc-300">Preço de Venda (R$) *</label>
                        {precoSugerido40MargemForm > 0 && precoSugerido40MargemForm !== formPrecoVenda && (
                          <button
                            type="button"
                            onClick={() => setFormPrecoVenda(precoSugerido40MargemForm)}
                            className="text-[10px] text-amber-400 hover:underline font-bold"
                          >
                            Usar sugestão 40% ({formatarMoeda(precoSugerido40MargemForm)})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.10"
                        min="0.50"
                        required
                        placeholder="32.00"
                        value={formPrecoVenda}
                        onChange={(e) => setFormPrecoVenda(parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Categoria e Tempo de Preparo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-zinc-300">Categoria *</label>
                        <button
                          type="button"
                          onClick={() => setMostrandoCriarCatRapida(!mostrandoCriarCatRapida)}
                          className="text-[10px] text-amber-400 hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Nova Categoria</span>
                        </button>
                      </div>

                      {mostrandoCriarCatRapida && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <input
                            type="text"
                            placeholder="Nova categoria..."
                            value={novaCategoriaRapida}
                            onChange={(e) => setNovaCategoriaRapida(e.target.value)}
                            className="flex-1 bg-zinc-950 border border-amber-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={adicionarCategoriaRapida}
                            className="px-2.5 py-1.5 bg-amber-500 text-black font-extrabold text-[11px] rounded-xl hover:bg-amber-400"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMostrandoCriarCatRapida(false);
                              setNovaCategoriaRapida('');
                            }}
                            className="px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[11px]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <select
                        value={formCategoria}
                        onChange={(e) => setFormCategoria(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {categorias.map((cat) => (
                          <option key={cat.id} value={cat.nome}>
                            {cat.nome}
                          </option>
                        ))}
                        {!categorias.some((c) => c.nome.toLowerCase() === formCategoria.toLowerCase()) && (
                          <option value={formCategoria}>{formCategoria}</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-zinc-300 mb-1">Tempo Estimado de Preparo (min)</label>
                      <input
                        type="number"
                        min="1"
                        value={formTempoPreparo}
                        onChange={(e) => setFormTempoPreparo(parseInt(e.target.value, 10) || 12)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block font-bold text-zinc-300 mb-1">Descrição do Lanche</label>
                    <textarea
                      rows={2}
                      placeholder="Descreva o pão, o blend artesanal, o queijo derretido, molho especial..."
                      value={formDescricao}
                      onChange={(e) => setFormDescricao(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* FICHA TÉCNICA, INSUMOS & ANÁLISE DE CMV E MARGEM (REQUISITO 3) */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Calculator className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-white">
                            Ficha Técnica & Análise de CMV
                          </h4>
                          <p className="text-[10px] text-zinc-400">
                            Cálculo em tempo real do custo da porção, CMV e margem-alvo de 40%
                          </p>
                        </div>
                      </div>

                      {/* Badge de Classificação por Cor */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          corStatusForm === 'verde'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : corStatusForm === 'amarelo'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {corStatusForm === 'verde'
                          ? '● CMV Saudável (≤ 30%)'
                          : corStatusForm === 'amarelo'
                          ? '● Margem Moderada (30% - 40%)'
                          : custoTotalForm === 0
                          ? '● Sem Insumos Adicionados'
                          : '● Alerta: CMV Alto (> 40%)'}
                      </span>
                    </div>

                    {/* Seleção de Insumo e Quantidade */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                      <div className="sm:col-span-6">
                        <label className="text-[10px] text-zinc-400 font-bold block mb-1">
                          Insumo Cadastrado
                        </label>
                        <select
                          value={formInsumoId}
                          onChange={(e) => setFormInsumoId(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Selecione um insumo para a receita...</option>
                          {insumos.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.nome} ({ins.categoria}) — R$ {ins.custoUnitarioConsumo.toFixed(4)}/{ins.unidadeConsumo}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-zinc-400 font-bold block mb-1">
                          Qtd Consumo {formInsumoId ? `(${insumos.find((i) => i.id === formInsumoId)?.unidadeConsumo || 'un'})` : ''}
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          placeholder="Ex: 150 (g)"
                          value={formQtdConsumo}
                          onChange={(e) => setFormQtdConsumo(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-end">
                        <button
                          type="button"
                          onClick={adicionarIngredienteFicha}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/10"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar Insumo</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Insumos da Ficha Técnica */}
                    {formIngredientes.length === 0 ? (
                      <div className="p-3 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800 text-center text-zinc-500 text-[11px]">
                        Nenhum ingrediente adicionado à ficha técnica ainda. Adicione blend, pão, queijo e molhos acima para calcular o custo exato do lanche!
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 flex justify-between">
                          <span>Ingrediente</span>
                          <span>Qtd • Custo da Porção</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {formIngredientes.map((item) => {
                            const ins = insumos.find((i) => i.id === item.insumoId);
                            const custoPorcao = ins ? item.quantidadeConsumo * ins.custoUnitarioConsumo : 0;
                            return (
                              <div
                                key={item.insumoId}
                                className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  <span className="font-semibold text-white truncate max-w-[170px] sm:max-w-xs">
                                    {ins ? ins.nome : 'Insumo não encontrado'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <span className="text-zinc-400 font-mono text-[11px]">
                                    {item.quantidadeConsumo} {ins?.unidadeConsumo || 'un'}
                                  </span>
                                  <span className="font-mono font-bold text-amber-300 text-xs">
                                    {formatarMoeda(custoPorcao)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removerIngredienteFicha(item.insumoId)}
                                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                    title="Remover da receita"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Embalagem e Custo Total */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold block mb-1">
                          Custo Embalagem / Descartáveis (R$)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={formCustoEmbalagem}
                          onChange={(e) => setFormCustoEmbalagem(parseFloat(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 font-bold block mb-1">
                          Custo Total de Produção (Insumos + Embalagem)
                        </label>
                        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-rose-300 font-mono font-bold">
                          {formatarMoeda(custoTotalForm)}
                        </div>
                      </div>
                    </div>

                    {/* Resumo de Indicadores Financeiros */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">CMV (R$)</span>
                        <span className="font-mono font-black text-xs sm:text-sm text-rose-400">
                          {formatarMoeda(custoTotalForm)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">CMV (%)</span>
                        <span
                          className={`font-mono font-black text-xs sm:text-sm ${
                            cmvPercentForm <= 30
                              ? 'text-emerald-400'
                              : cmvPercentForm <= 40
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {cmvPercentForm.toFixed(1)}%
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block">Margem Bruta</span>
                        <span className="font-mono font-black text-xs sm:text-sm text-emerald-400">
                          {margemBrutaPercentForm.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-zinc-500 block">
                          {formatarMoeda(margemBrutaReaisForm)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-amber-300 font-bold block">Preço 40% Margem</span>
                          <span className="font-mono font-black text-xs sm:text-sm text-amber-400">
                            {precoSugerido40MargemForm > 0 ? formatarMoeda(precoSugerido40MargemForm) : '—'}
                          </span>
                        </div>
                        {precoSugerido40MargemForm > 0 && precoSugerido40MargemForm !== formPrecoVenda && (
                          <button
                            type="button"
                            onClick={() => setFormPrecoVenda(precoSugerido40MargemForm)}
                            className="mt-1 text-[9px] font-black bg-amber-500 text-black py-0.5 px-1.5 rounded-md hover:bg-amber-400 transition"
                          >
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

              {/* UPLOAD DE FOTO (Galeria / Câmera do Celular com Prévia) */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    Foto do Hambúrguer (Armazenamento Permanente)
                  </label>
                  {formFotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormFotoUrl('')}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Remover foto
                    </button>
                  )}
                </div>

                {/* Prévia da Foto */}
                {formFotoUrl ? (
                  <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                    <img
                      src={formFotoUrl}
                      alt="Prévia"
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-emerald-400 font-bold block">Foto pronta!</span>
                      <p className="text-[10px] text-zinc-400 truncate">{formFotoUrl}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    Selecione uma foto da galeria do celular ou tire uma foto com a câmera.
                  </p>
                )}

                {/* Inputs invisíveis para acionamento */}
                <input
                  type="file"
                  ref={fileInputGaleriaRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processarArquivoFoto(file);
                  }}
                />

                <input
                  type="file"
                  ref={fileInputCameraRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processarArquivoFoto(file);
                  }}
                />

                {/* Botões de Ação para Celular */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputGaleriaRef.current?.click()}
                    disabled={uploadandoFoto}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Galeria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputCameraRef.current?.click()}
                    disabled={uploadandoFoto}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Tirar Foto</span>
                  </button>
                </div>

                {uploadandoFoto && (
                  <div className="flex items-center gap-2 text-[11px] text-amber-400">
                    <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Enviando e salvando imagem no servidor...</span>
                  </div>
                )}
              </div>

              {/* Disponibilidade */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Disponibilidade no Cardápio</span>
                  <span className="text-[11px] text-zinc-400">
                    {formAtivo
                      ? 'Lanche ativo (visível para os clientes comprarem)'
                      : 'Lanche pausado (oculto temporariamente)'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formAtivo}
                  onChange={(e) => setFormAtivo(e.target.checked)}
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Adicionais Permitidos para este Lanche */}
              {adicionais.length > 0 && (
                <div className="space-y-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-white text-xs">Adicionais permitidos neste lanche</label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormAdicionaisIds(
                          formAdicionaisIds.length === adicionais.length ? [] : adicionais.map((a) => a.id)
                        )
                      }
                      className="text-[10px] text-amber-400 hover:underline font-bold"
                    >
                      {formAdicionaisIds.length === adicionais.length ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {adicionais.map((ad) => {
                      const marcado = formAdicionaisIds.includes(ad.id);
                      return (
                        <label
                          key={ad.id}
                          className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition text-[11px] ${
                            marcado ? 'bg-amber-500/10 border-amber-500/50 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => {
                              if (marcado) {
                                setFormAdicionaisIds(formAdicionaisIds.filter((id) => id !== ad.id));
                              } else {
                                setFormAdicionaisIds([...formAdicionaisIds, ad.id]);
                              }
                            }}
                            className="rounded text-amber-500 focus:ring-amber-500"
                          />
                          <span className="truncate">{ad.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botões do Formulário de Produto */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalProdutoAberto(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
                >
                  {produtoEmEdicao ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          );
        })()}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: ADICIONAR / EDITAR ADICIONAL */}
      {/* ============================================================= */}
      {modalAdicionalAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-white">
                  {adicionalEmEdicao ? `Editar Adicional: ${adicionalEmEdicao.nome}` : 'Cadastrar Novo Adicional'}
                </h3>
                <p className="text-[11px] text-zinc-400">Configure o nome, preço e limites de escolha</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAdicionalAberto(false)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarAdicional} className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
              {erroAdic && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{erroAdic}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Nome do Adicional *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bacon extra, Cheddar cremoso, Carne artesanal 150g..."
                  value={formAdicNome}
                  onChange={(e) => setFormAdicNome(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-300 mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    required
                    placeholder="3.00"
                    value={formAdicPreco}
                    onChange={(e) => setFormAdicPreco(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-300 mb-1">Máximo por Lanche *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formAdicMaximo}
                    onChange={(e) => setFormAdicMaximo(parseInt(e.target.value, 10) || 4)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Descrição Opcional</label>
                <input
                  type="text"
                  placeholder="Ex: Fatias generosas defumadas na chapa..."
                  value={formAdicDescricao}
                  onChange={(e) => setFormAdicDescricao(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Categorias permitidas */}
              <div className="space-y-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <label className="font-bold text-white text-xs block">
                  Disponível em quais categorias?
                </label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Simples', 'Artesanal', 'Smash', 'Promoções', 'Acompanhamentos'].map((cat) => {
                    const sel = formAdicCategorias.includes('TODAS') || formAdicCategorias.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => {
                          if (formAdicCategorias.includes('TODAS')) {
                            setFormAdicCategorias([cat]);
                          } else if (formAdicCategorias.includes(cat)) {
                            const filtrado = formAdicCategorias.filter((c) => c !== cat);
                            setFormAdicCategorias(filtrado.length > 0 ? filtrado : ['TODAS']);
                          } else {
                            setFormAdicCategorias([...formAdicCategorias, cat]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                          sel ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Disponibilidade</span>
                  <span className="text-[11px] text-zinc-400">Ativar adicional para pedidos dos clientes</span>
                </div>
                <input
                  type="checkbox"
                  checked={formAdicAtivo}
                  onChange={(e) => setFormAdicAtivo(e.target.checked)}
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAdicionalAberto(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
                >
                  {adicionalEmEdicao ? 'Salvar Alterações' : 'Cadastrar Adicional'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: ADICIONAR / EDITAR CATEGORIA */}
      {/* ============================================================= */}
      {modalCategoriaAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-white">
                  {categoriaEmEdicao ? `Editar Categoria: ${categoriaEmEdicao.nome}` : 'Nova Categoria'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCategoriaAberto(false)}
                className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarCategoria} className="p-4 space-y-4 text-xs">
              {erroCat && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
                  {erroCat}
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Smash, Artesanal, Simples, Bebidas..."
                  value={formCatNome}
                  onChange={(e) => setFormCatNome(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Hambúrgueres prensados na chapa ultra quente..."
                  value={formCatDescricao}
                  onChange={(e) => setFormCatDescricao(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalCategoriaAberto(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition"
                >
                  {categoriaEmEdicao ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO (PRODUTO) */}
      {/* ============================================================= */}
      {produtoParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-rose-500/40 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-white">Excluir Produto?</h3>
              <p className="text-xs text-zinc-400">
                Tem certeza que deseja excluir permanentemente o produto{' '}
                <strong className="text-white">"{produtoParaExcluir.nome}"</strong> do cardápio?
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setProdutoParaExcluir(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusaoProduto}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30"
              >
                Sim, Excluir Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 5: CONFIRMAÇÃO DE EXCLUSÃO (ADICIONAL) */}
      {/* ============================================================= */}
      {adicionalParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-rose-500/40 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-white">Excluir Adicional?</h3>
              <p className="text-xs text-zinc-400">
                Tem certeza que deseja excluir o adicional{' '}
                <strong className="text-white">"{adicionalParaExcluir.nome}"</strong>?
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAdicionalParaExcluir(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusaoAdicional}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30"
              >
                Sim, Excluir Adicional
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 6: CONFIRMAÇÃO DE EXCLUSÃO (CATEGORIA) */}
      {/* ============================================================= */}
      {categoriaParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-rose-500/40 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-white">Excluir Categoria?</h3>
              <p className="text-xs text-zinc-400">
                Tem certeza que deseja excluir a categoria{' '}
                <strong className="text-white">"{categoriaParaExcluir.nome}"</strong>?
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCategoriaParaExcluir(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusaoCategoria}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30"
              >
                Sim, Excluir Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 7: ALTERAR SENHA ADMINISTRATIVA */}
      {/* ============================================================= */}
      {modalSenhaAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base text-white">Alterar Senha do Administrador</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSenhaAberto(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {msgSenha && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  msgSenha.tipo === 'sucesso'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}
              >
                <span>{msgSenha.texto}</span>
              </div>
            )}

            <form onSubmit={handleAlterarSenha} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-300 mb-1">Senha Atual *</label>
                <input
                  type="password"
                  required
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Nova Senha * (mínimo 4 caracteres)</label>
                <input
                  type="password"
                  required
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-300 mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  value={confirmaNovaSenha}
                  onChange={(e) => setConfirmaNovaSenha(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalSenhaAberto(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 8: VISUALIZAR FICHA TÉCNICA */}
      {/* ============================================================= */}
      {modalFichaProduto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-black text-base text-white">{modalFichaProduto.nome}</h3>
                <p className="text-xs text-zinc-400">Composição de Insumos da Ficha Técnica</p>
              </div>
              <button
                type="button"
                onClick={() => setModalFichaProduto(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {modalFichaProduto.ingredientes && modalFichaProduto.ingredientes.length > 0 ? (
                modalFichaProduto.ingredientes.map((ing, i) => {
                  const insumoInfo = insumos.find((ins) => ins.id === ing.insumoId);
                  const custoIng = insumoInfo ? insumoInfo.custoUnitarioConsumo * ing.quantidadeConsumo : 0;

                  return (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white block">{insumoInfo?.nome || ing.insumoId}</span>
                        <span className="text-[11px] text-zinc-500">
                          {ing.quantidadeConsumo} {insumoInfo?.unidadeConsumo || 'un'}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-rose-400">{formatarMoeda(custoIng)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-zinc-500 text-xs py-4 text-center">Nenhum ingrediente cadastrado na ficha.</p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setModalFichaProduto(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 9: LINK DO CARDÁPIO PÚBLICO DO CLIENTE (SEGURO NO APK) */}
      {/* ============================================================= */}
      {renderModalCardapioCliente()}

      {/* ============================================================= */}
      {/* MODAL 10: RESULTADO DA PUBLICAÇÃO DO CARDÁPIO ONLINE */}
      {/* ============================================================= */}
      {modalPublicacao && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                  modalPublicacao.sucesso
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {modalPublicacao.sucesso ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <h3 className="font-black text-lg text-white">
                {modalPublicacao.sucesso ? 'Cardápio Publicado na Nuvem!' : 'Falha na Conexão com o Servidor Online'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{modalPublicacao.msg}</p>
            </div>

            {modalPublicacao.sucesso && modalPublicacao.url && (
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 block uppercase">Link Público Ativo</span>
                <p className="text-xs font-mono text-amber-400 break-all select-all">{modalPublicacao.url}</p>
              </div>
            )}

            {!modalPublicacao.sucesso && (
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-left text-xs space-y-2 text-zinc-300">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Por que o servidor não respondeu?</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  O aplicativo no aparelho tentou enviar os dados para o servidor (<code>{getServidorOnlineUrl()}</code>). Esse endereço requer que o backend esteja ativo e compartilhado na internet.
                </p>
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Seus dados locais estão 100% seguros!</span>
                  </div>
                  <p className="text-zinc-400">
                    Todos os produtos, adicionais e preços já estão salvos no SQLite do seu aparelho. Você pode visualizar o cardápio localmente a qualquer momento.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {modalPublicacao.sucesso ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalPublicacao(null);
                    setModalCardapioClienteAberto(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20"
                >
                  Ver Link & Compartilhar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalPublicacao(null);
                    setModalCardapioClienteAberto(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20"
                >
                  Visualizar Cardápio no App (100% Offline)
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalPublicacao(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
