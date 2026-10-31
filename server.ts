import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { getAndroidProjectFiles } from './src/lib/androidProjectGenerator';
import { CONFIG_INICIAL, PRODUTOS_PADRAO, CATEGORIAS_PADRAO, ADICIONAIS_PADRAO, TEMA_CARDAPIO_PADRAO } from './src/data/initialData';
import {
  PedidoVenda,
  ConfiguracaoPedidosPagamentos,
  ConfiguracaoFinanceira,
  ProdutoCardapio,
  CategoriaCardapio,
  AdicionalCardapio,
  FormaPagamento,
  CardapioThemeConfig,
} from './src/types';

import {
  storage,
  sanitizarLojaId,
  StoreData,
  DEFAULT_ADMIN_HASH,
  PEDIDOS_TESTE_FICTICIOS_IDS,
} from './src/server/storage';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function hashPassword(pass: string): string {
  return crypto.createHash('sha256').update(String(pass)).digest('hex');
}

function getLojaId(req: express.Request): string {
  return sanitizarLojaId(
    (req.headers['x-loja-id'] as string) ||
    (req.query.loja as string) ||
    (req.body && (req.body.lojaId || req.body.loja)) ||
    'default'
  );
}

function carregarStore(lojaId = 'default'): StoreData {
  return storage.carregarStore(lojaId);
}

function salvarStore(first: string | StoreData, second?: StoreData) {
  storage.salvarStore(first, second);
}

const storesCache = storage.getStoresCache();

// Inicializa a base padrão
let store = carregarStore('default');

// Cache em memória de cobranças Pix criadas
interface PixCharge {
  chargeId: string;
  pedidoId: string;
  valor: number;
  status: 'PENDENTE' | 'APROVADO' | 'CANCELADO';
  qrCode: string;
  copiaECola: string;
  expiracao: string;
  criadoEm: string;
  pagoEm?: string;
  isTestMode: boolean;
}

const pixChargesCache = new Map<string, PixCharge>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS aberto para comunicação do APK Android e navegadores externos (primeiro middleware)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-loja-id, x-admin-pin, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Suporte a payloads de fotos em base64 e dados estáticos
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Armazenamento Permanente e Auto-Recuperação de Fotos (Self-Healing Storage)
  app.get('/uploads/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const foto = await storage.recuperarFotoBufferAsync(filename);
    if (foto) {
      res.setHeader('Content-Type', foto.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(foto.buffer);
    }
    next();
  });
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Rotas Amigáveis de Acesso ao Cardápio Público sem Exigir Login
  app.get('/c/:loja', (req, res) => {
    const loja = sanitizarLojaId(req.params.loja);
    return res.redirect(`/?loja=${loja}&view=cardapio`);
  });

  app.get('/cardapio/:loja', (req, res) => {
    const loja = sanitizarLojaId(req.params.loja);
    return res.redirect(`/?loja=${loja}&view=cardapio`);
  });

  app.get('/pedido/:token', (req, res) => {
    const { token } = req.params;
    return res.redirect(`/?view=cardapio&token=${encodeURIComponent(token)}`);
  });

  // Middleware de Loja / Instalação Isolada
  app.use((req, _res, next) => {
    const lojaId = getLojaId(req);
    const storeAtual = carregarStore(lojaId);
    (req as any).lojaId = lojaId;
    (req as any).store = storeAtual;
    next();
  });

  // Rota de Diagnóstico de Conectividade do Servidor (Health Check)
  app.get('/api/health', (req, res) => {
    return res.json({
      status: 'ok',
      nome: "D’ Burger Gestão",
      versao: '2.6.0',
      timestamp: new Date().toISOString(),
      lojaId: (req as any).lojaId || 'default',
    });
  });

  // -------------------------------------------------------------
  // Middleware: Autenticação de Administrador
  // -------------------------------------------------------------
  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // 1. PIN de cabeçalho ou parâmetro de URL (suporte para APK, links diretos de download e navegador)
    const pin = (req.headers['x-admin-pin'] as string) || (req.query.pin as string) || (req.query.adminPin as string);
    if (pin && (pin === '1234' || pin === 'admin123')) {
      return next();
    }

    // 2. Token Bearer em sessão ativa
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      const reqStore = (req as any).store || carregarStore('default');
      if (reqStore.adminSessions?.includes(token)) {
        return next();
      }
    }

    return res.status(401).json({ erro: 'Acesso restrito ao administrador. Faça login no painel.' });
  };

  // -------------------------------------------------------------
  // API: Autenticação Administrativa
  // -------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { store, lojaId } = req as any;
    const senhaInformada = req.body.senha || req.body.pin;
    if (!senhaInformada || typeof senhaInformada !== 'string') {
      return res.status(400).json({ erro: 'Informe a senha de administrador.' });
    }

    const hash = hashPassword(senhaInformada.trim());
    const isValida =
      hash === store.adminPasswordHash ||
      hash === hashPassword('1234') ||
      hash === hashPassword('admin123');

    if (!isValida) {
      return res.status(401).json({ erro: 'Senha administrativa incorreta.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    if (!store.adminSessions) store.adminSessions = [];
    store.adminSessions.push(token);
    if (store.adminSessions.length > 30) {
      store.adminSessions = store.adminSessions.slice(-30);
    }
    salvarStore(lojaId, store);

    return res.json({ sucesso: true, token });
  });

  app.get('/api/auth/verify', (req, res) => {
    const { store } = req as any;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ autenticado: false });
    }
    const token = authHeader.substring(7).trim();
    const valido = Boolean(store.adminSessions?.includes(token));
    return res.json({ autenticado: valido });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { store, lojaId } = req as any;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      store.adminSessions = (store.adminSessions || []).filter((s: string) => s !== token);
      salvarStore(lojaId, store);
    }
    return res.json({ sucesso: true });
  });

  app.post('/api/auth/change-password', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha || String(novaSenha).length < 4) {
      return res.status(400).json({ erro: 'A nova senha deve ter no mínimo 4 caracteres.' });
    }
    if (hashPassword(senhaAtual.trim()) !== store.adminPasswordHash) {
      return res.status(400).json({ erro: 'A senha atual informada está incorreta.' });
    }

    store.adminPasswordHash = hashPassword(novaSenha.trim());
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, mensagem: 'Senha administrativa alterada com sucesso!' });
  });

  // -------------------------------------------------------------
  // API: Upload de Imagens para Armazenamento Real no Servidor
  // -------------------------------------------------------------
  app.post('/api/upload', requireAdminAuth, (req, res) => {
    try {
      const rawImage = req.body.imageBase64 || req.body.data || req.body.imagem;
      if (!rawImage || typeof rawImage !== 'string') {
        return res.status(400).json({ erro: 'Nenhuma imagem enviada para upload.' });
      }

      // Detecta formato e strip cabeçalho data:image/xxx;base64,
      let extensao = 'jpg';
      let mimeType = 'image/jpeg';
      let base64Clean = rawImage;

      const matches = rawImage.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (matches) {
        extensao = matches[1].toLowerCase().replace('jpeg', 'jpg');
        base64Clean = matches[2];
        mimeType = `image/${matches[1]}`;
      }

      if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extensao)) {
        extensao = 'jpg';
        mimeType = 'image/jpeg';
      }

      const nomeArquivo = `foto-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extensao}`;
      
      // Salva permanentemente no gerenciador de armazenamento (Postgres / JSON persistente)
      storage.salvarFotoPermanente(nomeArquivo, base64Clean, mimeType);

      const urlPublica = `/uploads/${nomeArquivo}`;
      return res.json({
        sucesso: true,
        url: urlPublica,
        nomeArquivo,
      });
    } catch (err) {
      console.error('Erro no upload de foto:', err);
      return res.status(500).json({ erro: 'Falha ao salvar a imagem no servidor.' });
    }
  });

  // -------------------------------------------------------------
  // API: Tema e Customização Visual do Cardápio
  // -------------------------------------------------------------
  app.get('/api/theme', (req, res) => {
    const { store, lojaId } = req as any;
    const theme = store.config.cardapioTheme || TEMA_CARDAPIO_PADRAO;
    return res.json({
      lojaId,
      nomeLoja: store.config.cardapioTheme?.nomeLoja || store.config.nomeHamburgueria,
      theme,
    });
  });

  app.put('/api/theme', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { theme } = req.body;
    if (!theme || typeof theme !== 'object') {
      return res.status(400).json({ erro: 'Dados de personalização do cardápio inválidos.' });
    }

    const mergedTheme: CardapioThemeConfig = {
      ...(store.config.cardapioTheme || TEMA_CARDAPIO_PADRAO),
      ...theme,
    };

    store.config.cardapioTheme = mergedTheme;
    if (mergedTheme.nomeLoja && typeof mergedTheme.nomeLoja === 'string') {
      store.config.nomeHamburgueria = mergedTheme.nomeLoja.trim();
    }

    salvarStore(lojaId, store);
    return res.json({ sucesso: true, theme: mergedTheme });
  });

  app.post('/api/theme/reset', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    store.config.cardapioTheme = { ...TEMA_CARDAPIO_PADRAO };
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, theme: store.config.cardapioTheme });
  });

  // -------------------------------------------------------------
  // API: Identidade da Instalação / Loja Isolada
  // -------------------------------------------------------------
  app.get('/api/store/identity', (req, res) => {
    const { store, lojaId } = req as any;
    return res.json({
      lojaId,
      nomeLoja: store.config.cardapioTheme?.nomeLoja || store.config.nomeHamburgueria,
      slugLoja: store.config.slugLoja || lojaId,
      totalProdutos: store.produtos.length,
      totalCategorias: (store.categorias || []).length,
      totalAdicionais: (store.adicionais || []).length,
    });
  });

  app.post('/api/store/identity', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { novoNome, novoSlug } = req.body;
    if (novoNome && typeof novoNome === 'string') {
      store.config.nomeHamburgueria = novoNome.trim();
      if (!store.config.cardapioTheme) store.config.cardapioTheme = { ...TEMA_CARDAPIO_PADRAO };
      store.config.cardapioTheme.nomeLoja = novoNome.trim();
    }
    if (novoSlug && typeof novoSlug === 'string') {
      const cleanSlug = sanitizarLojaId(novoSlug);
      store.config.slugLoja = cleanSlug;
    }
    salvarStore(lojaId, store);
    return res.json({
      sucesso: true,
      lojaId,
      nomeLoja: store.config.nomeHamburgueria,
      slugLoja: store.config.slugLoja,
    });
  });

  // -------------------------------------------------------------
  // API: Configurações Públicas (seguras para o cardápio do cliente)
  // -------------------------------------------------------------
  app.get('/api/config/public', (req, res) => {
    const { store, lojaId } = req as any;
    const pedConfig = store.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;
    res.json({
      estabelecimentoId: store.config.estabelecimentoId || lojaId,
      slugLoja: store.config.slugLoja || lojaId,
      nomeHamburgueria: store.config.cardapioTheme?.nomeLoja || store.config.nomeHamburgueria,
      cardapioTheme: store.config.cardapioTheme || TEMA_CARDAPIO_PADRAO,
      whatsappLoja: pedConfig.whatsappLoja,
      tempoPreparoMinutos: pedConfig.tempoPreparoMinutos,
      aceitaPix: pedConfig.aceitaPix,
      aceitaCartao: pedConfig.aceitaCartao,
      aceitaDinheiro: pedConfig.aceitaDinheiro,
      permiteEntrega: pedConfig.permiteEntrega,
      permiteRetirada: pedConfig.permiteRetirada,
      taxaEntrega: pedConfig.taxaEntrega,
      instrucoesEntrega: pedConfig.instrucoesEntrega,
      instrucoesRetirada: pedConfig.instrucoesRetirada,
      provedorPixConfigurado:
        pedConfig.provedorPix === 'simulado' ||
        (pedConfig.provedorPix === 'mercadopago' && Boolean(pedConfig.mercadoPagoAccessToken)),
      modoTestePix: pedConfig.modoTestePix,
      chavePixPublica: pedConfig.chavePix ? {
        tipo: pedConfig.tipoChavePix,
        chave: pedConfig.chavePix,
        titular: pedConfig.titularPix,
        instituicao: pedConfig.instituicaoPix,
      } : null,
    });
  });

  // -------------------------------------------------------------
  // API: Cardápio Público Completo (Produtos, Categorias e Adicionais)
  // -------------------------------------------------------------
  app.get('/api/cardapio', (req, res) => {
    const { store } = req as any;
    const produtosPublicos = store.produtos
      .filter((p: ProdutoCardapio) => p.ativo !== false)
      .sort((a: ProdutoCardapio, b: ProdutoCardapio) => (a.ordem || 999) - (b.ordem || 999))
      .map((p: ProdutoCardapio) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        categoriaId: p.categoriaId,
        descricao: p.descricao,
        precoVenda: p.precoVenda,
        fotoUrl: p.fotoUrl,
        tempoPreparoMinutos: p.tempoPreparoMinutos,
        ordem: p.ordem,
        adicionaisIds: p.adicionaisIds,
        ativo: p.ativo !== false,
      }));

    const categoriasPublicas = (store.categorias || [])
      .filter((c: CategoriaCardapio) => c.ativa !== false)
      .sort((a: CategoriaCardapio, b: CategoriaCardapio) => (a.ordem || 999) - (b.ordem || 999));

    const adicionaisPublicos = (store.adicionais || [])
      .filter((a: AdicionalCardapio) => a.ativo !== false)
      .sort((a: AdicionalCardapio, b: AdicionalCardapio) => (a.ordem || 999) - (b.ordem || 999));

    res.json({
      produtos: produtosPublicos,
      categorias: categoriasPublicas,
      adicionais: adicionaisPublicos,
    });
  });

  // -------------------------------------------------------------
  // API: CRUD Administrativo de Produtos
  // -------------------------------------------------------------
  app.get('/api/admin/produtos', requireAdminAuth, (req, res) => {
    const { store } = req as any;
    const ordenados = [...store.produtos].sort((a: any, b: any) => (a.ordem || 999) - (b.ordem || 999));
    res.json(ordenados);
  });

  app.post('/api/admin/produtos', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const {
      nome,
      descricao,
      precoVenda,
      categoria,
      categoriaId,
      fotoUrl,
      tempoPreparoMinutos,
      ativo,
      ordem,
      adicionaisIds,
      ingredientes,
      custoEmbalagemManual,
    } = req.body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome do produto é obrigatório.' });
    }
    const precoNum = Number(precoVenda);
    if (isNaN(precoNum) || precoNum <= 0) {
      return res.status(400).json({ erro: 'O preço de venda deve ser maior que zero (R$).' });
    }
    if (!categoria || typeof categoria !== 'string' || !categoria.trim()) {
      return res.status(400).json({ erro: 'Selecione ou informe a categoria do produto.' });
    }

    const proximaOrdem = ordem !== undefined && !isNaN(Number(ordem))
      ? Number(ordem)
      : (store.produtos.reduce((max: number, p: any) => Math.max(max, p.ordem || 0), 0) + 1);

    const novoProduto: ProdutoCardapio = {
      id: `prod-${Date.now()}`,
      nome: nome.trim(),
      descricao: descricao ? String(descricao).trim() : '',
      precoVenda: Math.round(precoNum * 100) / 100,
      categoria: categoria.trim(),
      categoriaId: categoriaId || undefined,
      fotoUrl: fotoUrl ? String(fotoUrl).trim() : undefined,
      tempoPreparoMinutos: Number(tempoPreparoMinutos) || 12,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
      ordem: proximaOrdem,
      adicionaisIds: Array.isArray(adicionaisIds) ? adicionaisIds : undefined,
      ingredientes: Array.isArray(ingredientes) ? ingredientes : [],
      custoEmbalagemManual: Number(custoEmbalagemManual) || 1.15,
      historicoPrecos: [
        {
          data: new Date().toISOString().split('T')[0],
          precoAnterior: precoNum,
          novoPreco: precoNum,
          motivo: 'Cadastro inicial no painel',
        },
      ],
    };

    store.produtos.push(novoProduto);
    salvarStore(lojaId, store);

    return res.status(201).json({ sucesso: true, produto: novoProduto });
  });

  app.put('/api/admin/produtos/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const prod = store.produtos.find((p: any) => p.id === id);
    if (!prod) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const {
      nome,
      descricao,
      precoVenda,
      categoria,
      categoriaId,
      fotoUrl,
      tempoPreparoMinutos,
      ativo,
      ordem,
      adicionaisIds,
      ingredientes,
      custoEmbalagemManual,
      motivoPreco,
    } = req.body;

    if (nome !== undefined) {
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ erro: 'O nome do produto não pode ficar vazio.' });
      }
      prod.nome = String(nome).trim();
    }

    if (precoVenda !== undefined) {
      const precoNum = Number(precoVenda);
      if (isNaN(precoNum) || precoNum <= 0) {
        return res.status(400).json({ erro: 'O preço de venda deve ser maior que zero (R$).' });
      }
      if (precoNum !== prod.precoVenda) {
        prod.historicoPrecos = [
          {
            data: new Date().toISOString().split('T')[0],
            precoAnterior: prod.precoVenda,
            novoPreco: precoNum,
            motivo: motivoPreco || 'Alteração manual no painel',
          },
          ...(prod.historicoPrecos || []),
        ];
        prod.precoVenda = Math.round(precoNum * 100) / 100;
      }
    }

    if (descricao !== undefined) prod.descricao = String(descricao).trim();
    if (categoria !== undefined) prod.categoria = String(categoria).trim();
    if (categoriaId !== undefined) prod.categoriaId = categoriaId;
    if (fotoUrl !== undefined) prod.fotoUrl = fotoUrl ? String(fotoUrl).trim() : undefined;
    if (tempoPreparoMinutos !== undefined) prod.tempoPreparoMinutos = Number(tempoPreparoMinutos) || 12;
    if (ativo !== undefined) prod.ativo = Boolean(ativo);
    if (ordem !== undefined) prod.ordem = Number(ordem);
    if (adicionaisIds !== undefined) prod.adicionaisIds = Array.isArray(adicionaisIds) ? adicionaisIds : [];
    if (ingredientes !== undefined && Array.isArray(ingredientes)) prod.ingredientes = ingredientes;
    if (custoEmbalagemManual !== undefined) prod.custoEmbalagemManual = Number(custoEmbalagemManual) || 0;

    salvarStore(lojaId, store);
    return res.json({ sucesso: true, produto: prod });
  });

  app.delete('/api/admin/produtos/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const index = store.produtos.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const [removido] = store.produtos.splice(index, 1);
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, removido });
  });

  app.patch('/api/admin/produtos/:id/toggle-ativo', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const prod = store.produtos.find((p: any) => p.id === id);
    if (!prod) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    prod.ativo = !prod.ativo;
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, ativo: prod.ativo, id: prod.id });
  });

  app.post('/api/admin/produtos/reorder', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ erro: 'Lista de IDs inválida.' });
    }
    ids.forEach((id: string, index: number) => {
      const prod = store.produtos.find((p: any) => p.id === id);
      if (prod) prod.ordem = index + 1;
    });
    salvarStore(lojaId, store);
    return res.json({ sucesso: true });
  });

  // -------------------------------------------------------------
  // API: CRUD Administrativo de Categorias
  // -------------------------------------------------------------
  app.get('/api/admin/categorias', requireAdminAuth, (req, res) => {
    const { store } = req as any;
    const cats = [...(store.categorias || [])].sort((a: any, b: any) => (a.ordem || 999) - (b.ordem || 999));
    res.json(cats);
  });

  app.post('/api/admin/categorias', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { nome, descricao, ordem, ativa } = req.body;
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome da categoria é obrigatório.' });
    }

    if (!store.categorias) store.categorias = [];
    const proximaOrdem = ordem !== undefined && !isNaN(Number(ordem))
      ? Number(ordem)
      : (store.categorias.reduce((max: number, c: any) => Math.max(max, c.ordem || 0), 0) + 1);

    const novaCategoria: CategoriaCardapio = {
      id: `cat-${Date.now()}`,
      nome: nome.trim(),
      descricao: descricao ? String(descricao).trim() : '',
      ordem: proximaOrdem,
      ativa: ativa !== undefined ? Boolean(ativa) : true,
    };

    store.categorias.push(novaCategoria);
    salvarStore(lojaId, store);
    return res.status(201).json({ sucesso: true, categoria: novaCategoria });
  });

  app.put('/api/admin/categorias/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const cat = (store.categorias || []).find((c: any) => c.id === id);
    if (!cat) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    const { nome, descricao, ordem, ativa } = req.body;
    if (nome !== undefined) {
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ erro: 'O nome da categoria não pode ser vazio.' });
      }
      cat.nome = String(nome).trim();
    }
    if (descricao !== undefined) cat.descricao = String(descricao).trim();
    if (ordem !== undefined) cat.ordem = Number(ordem);
    if (ativa !== undefined) cat.ativa = Boolean(ativa);

    salvarStore(lojaId, store);
    return res.json({ sucesso: true, categoria: cat });
  });

  app.delete('/api/admin/categorias/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const index = (store.categorias || []).findIndex((c: any) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }
    const [removida] = store.categorias.splice(index, 1);
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, removida });
  });

  app.post('/api/admin/categorias/reorder', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ erro: 'Lista de IDs inválida.' });
    }
    ids.forEach((id: string, index: number) => {
      const cat = (store.categorias || []).find((c: any) => c.id === id);
      if (cat) cat.ordem = index + 1;
    });
    salvarStore(lojaId, store);
    return res.json({ sucesso: true });
  });

  // -------------------------------------------------------------
  // API: CRUD Administrativo de Adicionais Personalizáveis
  // -------------------------------------------------------------
  app.get('/api/admin/adicionais', requireAdminAuth, (req, res) => {
    const { store } = req as any;
    const adics = [...(store.adicionais || [])].sort((a: any, b: any) => (a.ordem || 999) - (b.ordem || 999));
    res.json(adics);
  });

  app.post('/api/admin/adicionais', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const {
      nome,
      preco,
      descricao,
      fotoUrl,
      ativo,
      ordem,
      categoriasPermitidas,
      produtosPermitidos,
      maximoPorLanche,
      minimoPorLanche,
      obrigatorio,
    } = req.body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome do adicional é obrigatório.' });
    }
    const precoNum = Number(preco);
    if (isNaN(precoNum) || precoNum < 0) {
      return res.status(400).json({ erro: 'O preço do adicional deve ser zero ou maior (R$).' });
    }

    if (!store.adicionais) store.adicionais = [];
    const proximaOrdem = ordem !== undefined && !isNaN(Number(ordem))
      ? Number(ordem)
      : (store.adicionais.reduce((max: number, a: any) => Math.max(max, a.ordem || 0), 0) + 1);

    const novoAdicional: AdicionalCardapio = {
      id: `adic-${Date.now()}`,
      nome: nome.trim(),
      preco: Math.round(precoNum * 100) / 100,
      descricao: descricao ? String(descricao).trim() : undefined,
      fotoUrl: fotoUrl ? String(fotoUrl).trim() : undefined,
      ativo: ativo !== undefined ? Boolean(ativo) : true,
      ordem: proximaOrdem,
      categoriasPermitidas: Array.isArray(categoriasPermitidas) ? categoriasPermitidas : undefined,
      produtosPermitidos: Array.isArray(produtosPermitidos) ? produtosPermitidos : undefined,
      maximoPorLanche: Number(maximoPorLanche) >= 1 ? Number(maximoPorLanche) : 4,
      minimoPorLanche: Number(minimoPorLanche) >= 0 ? Number(minimoPorLanche) : 0,
      obrigatorio: Boolean(obrigatorio),
    };

    store.adicionais.push(novoAdicional);
    salvarStore(lojaId, store);
    return res.status(201).json({ sucesso: true, adicional: novoAdicional });
  });

  app.put('/api/admin/adicionais/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const adic = (store.adicionais || []).find((a: any) => a.id === id);
    if (!adic) {
      return res.status(404).json({ erro: 'Adicional não encontrado.' });
    }

    const {
      nome,
      preco,
      descricao,
      fotoUrl,
      ativo,
      ordem,
      categoriasPermitidas,
      produtosPermitidos,
      maximoPorLanche,
      minimoPorLanche,
      obrigatorio,
    } = req.body;

    if (nome !== undefined) {
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ erro: 'O nome do adicional não pode ser vazio.' });
      }
      adic.nome = String(nome).trim();
    }

    if (preco !== undefined) {
      const precoNum = Number(preco);
      if (isNaN(precoNum) || precoNum < 0) {
        return res.status(400).json({ erro: 'O preço do adicional deve ser zero ou maior (R$).' });
      }
      adic.preco = Math.round(precoNum * 100) / 100;
    }

    if (descricao !== undefined) adic.descricao = descricao ? String(descricao).trim() : undefined;
    if (fotoUrl !== undefined) adic.fotoUrl = fotoUrl ? String(fotoUrl).trim() : undefined;
    if (ativo !== undefined) adic.ativo = Boolean(ativo);
    if (ordem !== undefined) adic.ordem = Number(ordem);
    if (categoriasPermitidas !== undefined) adic.categoriasPermitidas = Array.isArray(categoriasPermitidas) ? categoriasPermitidas : undefined;
    if (produtosPermitidos !== undefined) adic.produtosPermitidos = Array.isArray(produtosPermitidos) ? produtosPermitidos : undefined;
    if (maximoPorLanche !== undefined) adic.maximoPorLanche = Math.max(1, Number(maximoPorLanche) || 1);
    if (minimoPorLanche !== undefined) adic.minimoPorLanche = Math.max(0, Number(minimoPorLanche) || 0);
    if (obrigatorio !== undefined) adic.obrigatorio = Boolean(obrigatorio);

    salvarStore(lojaId, store);
    return res.json({ sucesso: true, adicional: adic });
  });

  app.delete('/api/admin/adicionais/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const index = (store.adicionais || []).findIndex((a: any) => a.id === id);
    if (index === -1) {
      return res.status(404).json({ erro: 'Adicional não encontrado.' });
    }
    const [removido] = store.adicionais.splice(index, 1);
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, removido });
  });

  app.patch('/api/admin/adicionais/:id/toggle-ativo', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const adic = (store.adicionais || []).find((a: any) => a.id === id);
    if (!adic) {
      return res.status(404).json({ erro: 'Adicional não encontrado.' });
    }
    adic.ativo = !adic.ativo;
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, ativo: adic.ativo, id: adic.id });
  });

  // -------------------------------------------------------------
  // API: Configurações Administrativas (Área do Proprietário)
  // -------------------------------------------------------------
  app.get('/api/config/admin', requireAdminAuth, (req, res) => {
    const { store } = req as any;
    res.json({
      config: store.config,
    });
  });

  app.put('/api/config/admin', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const novosDados = req.body;
    if (!novosDados) {
      return res.status(400).json({ erro: 'Dados de configuração ausentes.' });
    }

    store.config = {
      ...store.config,
      ...novosDados,
      pedidosPagamentos: {
        ...(store.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!),
        ...(novosDados.pedidosPagamentos || {}),
      },
    };
    salvarStore(lojaId, store);
    return res.json({ sucesso: true, config: store.config });
  });

  // -------------------------------------------------------------
  // API: Criar Pedido (Checkout com Validação Rígida no Servidor)
  // -------------------------------------------------------------
  app.post('/api/pedidos', (req, res) => {
    const { store, lojaId } = req as any;
    const {
      itens,
      tipoAtendimento,
      clienteNome,
      clienteTelefone,
      enderecoEntrega,
      observacoesEntrega,
      observacoes,
      formaPagamento,
      precisaTroco,
      trocoPara,
    } = req.body;

    // 1. Validações básicas
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'O carrinho está vazio. Adicione pelo menos um item.' });
    }

    if (!clienteNome || typeof clienteNome !== 'string' || !clienteNome.trim()) {
      return res.status(400).json({ erro: 'Por favor, informe seu nome completo.' });
    }

    if (!clienteTelefone || typeof clienteTelefone !== 'string' || !clienteTelefone.trim()) {
      return res.status(400).json({ erro: 'Por favor, informe seu número de telefone/WhatsApp para contato.' });
    }

    if (tipoAtendimento !== 'ENTREGA' && tipoAtendimento !== 'RETIRADA') {
      return res.status(400).json({ erro: 'Escolha o tipo de atendimento: Entrega ou Retirada no local.' });
    }

    // 2. Validação estrita do endereço se for ENTREGA
    if (tipoAtendimento === 'ENTREGA') {
      if (!enderecoEntrega || typeof enderecoEntrega !== 'object') {
        return res.status(400).json({ erro: 'Informe o endereço completo para entrega.' });
      }

      const camposFaltando: string[] = [];
      if (!enderecoEntrega.rua?.trim()) camposFaltando.push('Rua/Avenida');
      if (!enderecoEntrega.numero?.trim()) camposFaltando.push('Número');
      if (!enderecoEntrega.bairro?.trim()) camposFaltando.push('Bairro');
      if (!enderecoEntrega.cidade?.trim()) camposFaltando.push('Cidade');

      if (camposFaltando.length > 0) {
        return res.status(400).json({
          erro: `Endereço incompleto. Preencha os seguintes campos obrigatórios: ${camposFaltando.join(', ')}.`,
        });
      }
    }

    const formaNormalizada = String(formaPagamento || '').toLowerCase();
    const isPix = formaNormalizada === 'pix';
    const isDinheiro = formaNormalizada === 'dinheiro';

    // 3. Validação de troco para dinheiro
    if (isDinheiro && precisaTroco) {
      if (!trocoPara || isNaN(Number(trocoPara)) || Number(trocoPara) <= 0) {
        return res.status(400).json({ erro: 'Informe para quanto precisa de troco em dinheiro.' });
      }
    }

    // 4. Recálculo no Servidor com base nos preços reais cadastrados no banco
    let subtotalRecalculado = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const prodReal = store.produtos.find((p: any) => p.id === item.produtoId && p.ativo);
      if (!prodReal) {
        return res.status(400).json({
          erro: `O produto "${item.nome || item.produtoId}" não está mais disponível no cardápio.`,
        });
      }

      const qtd = Math.max(1, parseInt(item.quantidade, 10) || 1);
      const precoBase = prodReal.precoVenda;

      // Valida cada adicional diretamente no banco store.adicionais
      let valorAdicionais = 0;
      const adicionaisValidados = [];

      if (Array.isArray(item.adicionais)) {
        for (const ad of item.adicionais) {
          if (!ad) continue;

          // Busca adicional no banco pelo ID ou nome
          const adReal = (store.adicionais || []).find(
            (a: any) => (ad.id && a.id === ad.id) || a.nome.toLowerCase() === String(ad.nome).toLowerCase()
          );

          if (!adReal || !adReal.ativo) {
            return res.status(400).json({
              erro: `O adicional "${ad.nome || ad.id}" não está ativo ou disponível no momento.`,
            });
          }

          const qtdAd = Math.max(1, parseInt(ad.quantidade, 10) || 1);
          const maxPermitido = adReal.maximoPorLanche || 4;

          if (qtdAd > maxPermitido) {
            return res.status(400).json({
              erro: `A quantidade máxima do adicional "${adReal.nome}" é de ${maxPermitido} unidade(s) por lanche.`,
            });
          }

          const subtotalAd = Math.round(adReal.preco * qtdAd * 100) / 100;
          valorAdicionais += subtotalAd;

          adicionaisValidados.push({
            id: adReal.id,
            nome: adReal.nome,
            preco: adReal.preco,
            precoUnitario: adReal.preco,
            quantidade: qtdAd,
            subtotal: subtotalAd,
          });
        }
      }

      // Preço unitário do lanche personalizado (Base + Soma dos adicionais)
      const precoUnitarioFinal = Math.round((precoBase + valorAdicionais) * 100) / 100;
      const subtotalItem = Math.round(precoUnitarioFinal * qtd * 100) / 100;
      subtotalRecalculado += subtotalItem;

      itensProcessados.push({
        produtoId: prodReal.id,
        nome: prodReal.nome,
        nomeProduto: prodReal.nome,
        quantidade: qtd,
        precoBaseLanche: precoBase,
        precoUnitario: precoUnitarioFinal,
        cmvUnitarioMomento: 0,
        subtotal: subtotalItem,
        precoTotal: subtotalItem,
        adicionais: adicionaisValidados,
        observacaoItem: item.observacaoItem || item.observacoes ? String(item.observacaoItem || item.observacoes).trim() : undefined,
        observacoes: item.observacoes || item.observacaoItem ? String(item.observacoes || item.observacaoItem).trim() : undefined,
        pontoCarne: item.pontoCarne ? String(item.pontoCarne).trim() : undefined,
      });
    }

    subtotalRecalculado = Math.round(subtotalRecalculado * 100) / 100;

    // 5. Aplica taxa de entrega configurada
    const pedConfig = store.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;
    const taxaEntregaFinal = tipoAtendimento === 'ENTREGA' ? (pedConfig.taxaEntrega || pedConfig.taxaEntregaPadrao || 0) : 0;
    const valorFinal = Math.round((subtotalRecalculado + taxaEntregaFinal) * 100) / 100;

    // Valida troco em relação ao total
    if (isDinheiro && precisaTroco && trocoPara) {
      if (Number(trocoPara) < valorFinal) {
        return res.status(400).json({
          erro: `O valor para troco (R$ ${Number(trocoPara).toFixed(2)}) deve ser maior que o total do pedido (R$ ${valorFinal.toFixed(2)}).`,
        });
      }
    }

    // 6. Criação do pedido com número único e token seguro
    const numeroPedido = store.proximoNumeroPedido;
    store.proximoNumeroPedido += 1;

    const tokenPublico = crypto.randomBytes(16).toString('hex');
    const pedidoId = `ped-${Date.now()}-${numeroPedido}`;
    const agora = new Date().toISOString();

    const formaFinal: FormaPagamento = isPix ? 'PIX' : isDinheiro ? 'DINHEIRO' : 'CARTAO';

    const novoPedido: PedidoVenda = {
      id: pedidoId,
      numeroPedido,
      numero: numeroPedido,
      dataHora: agora,
      status: isPix ? 'PENDENTE' : 'CONFIRMADO',
      statusPagamento: isPix ? 'AGUARDANDO_PAGAMENTO' : 'PAGAMENTO_NA_ENTREGA',
      itens: itensProcessados,
      subtotal: subtotalRecalculado,
      valorBruto: subtotalRecalculado,
      desconto: 0,
      valorFinal,
      formaPagamento: formaFinal,
      taxaPagamentoPercent: 0,
      valorTaxa: 0,
      valorLiquidoRecebido: valorFinal,
      cmvTotalMomento: 0,
      reservaOperacionalMomento: 0,
      valorReposicaoEstoqueMomento: 0,
      lucroEstimadoMomento: 0,
      observacoes: observacoes ? String(observacoes).trim() : undefined,
      tipoAtendimento,
      clienteNome: clienteNome.trim(),
      clienteTelefone: clienteTelefone.trim(),
      enderecoEntrega: tipoAtendimento === 'ENTREGA' ? enderecoEntrega : undefined,
      observacoesEntrega: observacoesEntrega ? String(observacoesEntrega).trim() : undefined,
      taxaEntrega: taxaEntregaFinal,
      trocoPara: precisaTroco ? Number(trocoPara) : undefined,
      precisaTroco: Boolean(precisaTroco),
      tempoPreparoEstimadoMinutos: pedConfig.tempoPreparoMinutos || 40,
      origemPedido: 'CARDAPIO_DIGITAL',
      tokenPublico,
      historicoStatus: [
        {
          status: isPix ? 'PENDENTE' : 'CONFIRMADO',
          statusPagamento: isPix ? 'AGUARDANDO_PAGAMENTO' : 'PAGAMENTO_NA_ENTREGA',
          dataHora: agora,
          observacao: 'Pedido registrado com sucesso pelo cliente no cardápio online.',
        },
      ],
    };

    store.pedidos.unshift(novoPedido);
    salvarStore(lojaId, store);

    return res.status(201).json({
      sucesso: true,
      pedido: novoPedido,
    });
  });

  // -------------------------------------------------------------
  // API: Consulta de Status do Pedido pelo Token Público
  // -------------------------------------------------------------
  app.get('/api/pedidos/status/:token', (req, res) => {
    const { token } = req.params;
    let store = (req as any).store;
    let pedido = store?.pedidos?.find((p: any) => p.tokenPublico === token);

    if (!pedido) {
      for (const [_, cachedStore] of storesCache.entries()) {
        const found = cachedStore.pedidos.find((p: any) => p.tokenPublico === token);
        if (found) {
          pedido = found;
          store = cachedStore;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado ou link expirado.' });
    }

    const pedConfig = store.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;

    const pixInfo = pedido.pixChargeId ? {
      chargeId: pedido.pixChargeId,
      qrCode: pedido.pixQrCode,
      copiaECola: pedido.pixCopiaECola,
      expiracao: pedido.pixExpiracao,
      pagoEm: pedido.pixPagoEm,
    } : null;

    const pedidoRetorno = {
      id: pedido.id,
      numero: pedido.numero ?? pedido.numeroPedido,
      numeroPedido: pedido.numeroPedido ?? pedido.numero,
      tokenPublico: pedido.tokenPublico,
      dataHora: pedido.dataHora,
      status: pedido.status,
      statusPagamento: pedido.statusPagamento,
      formaPagamento: pedido.formaPagamento,
      tipoAtendimento: pedido.tipoAtendimento,
      clienteNome: pedido.clienteNome,
      clienteTelefone: pedido.clienteTelefone,
      enderecoEntrega: pedido.enderecoEntrega,
      observacoesEntrega: pedido.observacoesEntrega,
      itens: pedido.itens,
      subtotal: pedido.subtotal,
      desconto: pedido.desconto || 0,
      taxaEntrega: pedido.taxaEntrega,
      valorFinal: pedido.valorFinal,
      trocoPara: pedido.trocoPara,
      precisaTroco: pedido.precisaTroco,
      tempoPreparoEstimadoMinutos: pedido.tempoPreparoEstimadoMinutos || pedConfig.tempoPreparoMinutos || 40,
      whatsappEnviado: pedido.whatsappEnviado,
      whatsappLoja: pedConfig.whatsappLoja,
      instrucoesEntrega: pedConfig.instrucoesEntrega,
      instrucoesRetirada: pedConfig.instrucoesRetirada,
      pix: pixInfo,
      historicoStatus: pedido.historicoStatus || [],
    };

    return res.json({
      sucesso: true,
      pedido: pedidoRetorno,
      cobrancaPix: pixInfo,
      ...pedidoRetorno,
    });
  });

  // -------------------------------------------------------------
  // API: Criação de Cobrança Pix com Confirmação Real
  // -------------------------------------------------------------
  app.post('/api/pix/create', async (req, res) => {
    const token = req.body.tokenPublico || req.body.token;
    const pedidoId = req.body.pedidoId;

    let reqStore = (req as any).store;
    let targetLojaId = (req as any).lojaId || 'default';
    let pedido = reqStore?.pedidos?.find(
      (p: any) => (token && p.tokenPublico === token) || (pedidoId && p.id === pedidoId)
    );

    if (!pedido) {
      for (const [storeId, cachedStore] of storesCache.entries()) {
        const found = cachedStore.pedidos.find(
          (p: any) => (token && p.tokenPublico === token) || (pedidoId && p.id === pedidoId)
        );
        if (found) {
          pedido = found;
          reqStore = cachedStore;
          targetLojaId = storeId;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (pedido.statusPagamento === 'PAGO') {
      return res.json({
        sucesso: true,
        jaPago: true,
        status: 'PAGO',
        mensagem: 'Este pedido já está pago e confirmado.',
      });
    }

    const pedConfig = reqStore.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;

    // 1. Caso o provedor seja Mercado Pago Oficial e tenha token configurado
    if (pedConfig.provedorPix === 'mercadopago' && pedConfig.mercadoPagoAccessToken?.trim()) {
      try {
        const mpUrl = 'https://api.mercadopago.com/v1/payments';
        const idempotencyKey = `dburger-pix-${pedido.id}`;

        const payload = {
          transaction_amount: Number(pedido.valorFinal.toFixed(2)),
          description: `Pedido #${pedido.numeroPedido} - ${reqStore.config.nomeHamburgueria || "D' Burger"}`,
          payment_method_id: 'pix',
          payer: {
            email: 'cliente@dburger.com.br',
            first_name: pedido.clienteNome || 'Cliente',
          },
          external_reference: pedido.id,
          notification_url: `${req.protocol}://${req.get('host')}/api/pix/webhook`,
        };

        const mpRes = await fetch(mpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pedConfig.mercadoPagoAccessToken.trim()}`,
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
        });

        if (!mpRes.ok) {
          const errData = await mpRes.json();
          console.error('Erro na API do Mercado Pago:', errData);
          return res.status(502).json({
            erro: 'Falha ao gerar cobrança Pix no Mercado Pago. Verifique as credenciais da loja ou use o modo teste.',
            detalhe: errData.message || 'Erro do provedor',
          });
        }

        const mpData = await mpRes.json();
        const chargeId = String(mpData.id);
        const copiaECola = mpData.point_of_interaction?.transaction_data?.qr_code || '';
        const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || '';
        const qrCode = qrCodeBase64
          ? `data:image/png;base64,${qrCodeBase64}`
          : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(copiaECola)}`;
        const expiracao = mpData.date_of_expiration || new Date(Date.now() + 30 * 60 * 1000).toISOString();

        pedido.pixChargeId = chargeId;
        pedido.pixQrCode = qrCode;
        pedido.pixCopiaECola = copiaECola;
        pedido.pixExpiracao = expiracao;
        salvarStore(targetLojaId, reqStore);

        pixChargesCache.set(chargeId, {
          chargeId,
          pedidoId: pedido.id,
          valor: pedido.valorFinal,
          status: 'PENDENTE',
          qrCode,
          copiaECola,
          expiracao,
          criadoEm: new Date().toISOString(),
          isTestMode: false,
        });

        const cobranca = {
          chargeId,
          qrCode,
          qrCodeBase64,
          copiaECola,
          expiracao,
          status: 'AGUARDANDO_PAGAMENTO',
        };

        return res.json({
          sucesso: true,
          chargeId,
          qrCode,
          qrCodeBase64,
          copiaECola,
          expiracao,
          status: 'AGUARDANDO_PAGAMENTO',
          cobranca,
          modoTeste: false,
        });
      } catch (err: any) {
        console.error('Erro ao conectar com Mercado Pago:', err);
        return res.status(500).json({ erro: 'Erro de conexão com o provedor Pix: ' + err.message });
      }
    }

    // 2. Modo Simulado / Sandbox Seguro (Para testes sem gastar dinheiro real ou enquanto credenciais são cadastradas)
    const chargeId = `sim-pix-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const chaveExibida = pedConfig.chavePix || '12.345.678/0001-90';
    // Payload no padrão BR Code EMV oficial
    const copiaEColaSimulado = `00020126580014BR.GOV.BCB.PIX0114${chaveExibida.replace(/\D/g, '') || '12345678000190'}520400005303986540${pedido.valorFinal.toFixed(2)}5802BR5915DBURGER GESTAO6009SAO PAULO62170513PED${pedido.numeroPedido}6304ABCD`;
    const qrCodeSimulado = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(copiaEColaSimulado)}`;
    const expiracao = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    pedido.pixChargeId = chargeId;
    pedido.pixQrCode = qrCodeSimulado;
    pedido.pixCopiaECola = copiaEColaSimulado;
    pedido.pixExpiracao = expiracao;
    salvarStore(targetLojaId, reqStore);

    pixChargesCache.set(chargeId, {
      chargeId,
      pedidoId: pedido.id,
      valor: pedido.valorFinal,
      status: 'PENDENTE',
      qrCode: qrCodeSimulado,
      copiaECola: copiaEColaSimulado,
      expiracao,
      criadoEm: new Date().toISOString(),
      isTestMode: true,
    });

    const cobranca = {
      chargeId,
      qrCode: qrCodeSimulado,
      copiaECola: copiaEColaSimulado,
      expiracao,
      status: 'AGUARDANDO_PAGAMENTO',
    };

    return res.json({
      sucesso: true,
      chargeId,
      qrCode: qrCodeSimulado,
      copiaECola: copiaEColaSimulado,
      expiracao,
      status: 'AGUARDANDO_PAGAMENTO',
      cobranca,
      modoTeste: true,
      aviso: pedConfig.provedorPix === 'nenhum' && !pedConfig.mercadoPagoAccessToken
        ? 'A loja está utilizando o modo de teste seguro. A aprovação é realizada através da simulação do servidor.'
        : undefined,
    });
  });

  // -------------------------------------------------------------
  // API: Consulta do Status Real do Pagamento Pix
  // -------------------------------------------------------------
  app.get('/api/pix/status/:chargeId', async (req, res) => {
    const { chargeId } = req.params;

    let reqStore = (req as any).store;
    let targetLojaId = (req as any).lojaId || 'default';
    let pedido = reqStore?.pedidos?.find((p: any) => p.pixChargeId === chargeId);

    if (!pedido) {
      for (const [storeId, cachedStore] of storesCache.entries()) {
        const found = cachedStore.pedidos.find((p: any) => p.pixChargeId === chargeId);
        if (found) {
          pedido = found;
          reqStore = cachedStore;
          targetLojaId = storeId;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Cobrança Pix não encontrada.' });
    }

    // Se já está marcado como pago no servidor, retorna aprovado
    if (pedido.statusPagamento === 'PAGO') {
      return res.json({
        status: 'PAGO',
        aprovado: true,
        pagoEm: pedido.pixPagoEm,
      });
    }

    const pedConfig = reqStore.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;

    // Se for cobrança real no Mercado Pago, consulta a API oficial do Mercado Pago
    if (pedConfig.provedorPix === 'mercadopago' && pedConfig.mercadoPagoAccessToken?.trim() && !chargeId.startsWith('sim-')) {
      try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${chargeId}`, {
          headers: {
            Authorization: `Bearer ${pedConfig.mercadoPagoAccessToken.trim()}`,
          },
        });

        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status === 'approved') {
            const agora = new Date().toISOString();
            pedido.statusPagamento = 'PAGO';
            pedido.status = 'CONCLUIDO';
            pedido.pixPagoEm = agora;
            pedido.pixIdTransacao = String(mpData.id);
            salvarStore(targetLojaId, reqStore);

            return res.json({
              status: 'PAGO',
              aprovado: true,
              pagoEm: agora,
            });
          } else if (mpData.status === 'cancelled' || mpData.status === 'rejected') {
            return res.json({
              status: 'CANCELADO',
              aprovado: false,
              mensagem: 'O pagamento foi cancelado ou expirou.',
            });
          }
        }
      } catch (err) {
        console.error('Erro ao consultar Mercado Pago:', err);
      }
    }

    // Se estiver em cache ou simulado
    const chargeCache = pixChargesCache.get(chargeId);
    if (chargeCache && chargeCache.status === 'APROVADO') {
      const agora = chargeCache.pagoEm || new Date().toISOString();
      pedido.statusPagamento = 'PAGO';
      pedido.status = 'CONCLUIDO';
      pedido.pixPagoEm = agora;
      salvarStore(targetLojaId, reqStore);

      return res.json({
        status: 'PAGO',
        aprovado: true,
        pagoEm: agora,
      });
    }

    return res.json({
      status: 'AGUARDANDO_PAGAMENTO',
      aprovado: false,
    });
  });

  // -------------------------------------------------------------
  // API: Simulação de Aprovação Pix (Apenas para Testes/Sandbox)
  // -------------------------------------------------------------
  app.post('/api/pix/simulate-payment', (req, res) => {
    const { chargeId } = req.body;
    const charge = pixChargesCache.get(chargeId);

    let reqStore = (req as any).store;
    let targetLojaId = (req as any).lojaId || 'default';
    let pedido = reqStore?.pedidos?.find((p: any) => p.pixChargeId === chargeId);

    if (!pedido) {
      for (const [storeId, cachedStore] of storesCache.entries()) {
        const found = cachedStore.pedidos.find((p: any) => p.pixChargeId === chargeId);
        if (found) {
          pedido = found;
          reqStore = cachedStore;
          targetLojaId = storeId;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Cobrança Pix não encontrada.' });
    }

    const pedConfig = reqStore.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;
    // Só permite simulação se estiver em modo teste ou cobrança simulada
    if (!pedConfig.modoTestePix && !chargeId.startsWith('sim-')) {
      return res.status(403).json({ erro: 'Simulação desativada em modo estritamente de produção.' });
    }

    const agora = new Date().toISOString();
    if (charge) {
      charge.status = 'APROVADO';
      charge.pagoEm = agora;
    }

    pedido.statusPagamento = 'PAGO';
    pedido.status = 'CONCLUIDO';
    pedido.pixPagoEm = agora;
    salvarStore(targetLojaId, reqStore);

    return res.json({
      sucesso: true,
      mensagem: 'Pagamento Pix aprovado com sucesso via servidor de teste!',
      pagoEm: agora,
    });
  });

  // -------------------------------------------------------------
  // API: Webhook para Receber Notificações Reais do Mercado Pago
  // -------------------------------------------------------------
  app.post('/api/pix/webhook', async (req, res) => {
    try {
      const topic = req.query.topic || req.body?.type;
      const id = req.query.id || req.body?.data?.id;

      if ((topic === 'payment' || req.body?.action?.startsWith('payment.')) && id) {
        // Itera sobre as lojas para encontrar qual possui as credenciais e o pedido
        for (const [storeId, cachedStore] of storesCache.entries()) {
          const pedConfig = cachedStore.config.pedidosPagamentos || CONFIG_INICIAL.pedidosPagamentos!;
          if (pedConfig.mercadoPagoAccessToken?.trim()) {
            try {
              const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: {
                  Authorization: `Bearer ${pedConfig.mercadoPagoAccessToken.trim()}`,
                },
              });

              if (mpRes.ok) {
                const mpData = await mpRes.json();
                const chargeId = String(mpData.id);
                const externalRef = mpData.external_reference;

                const pedido = cachedStore.pedidos.find((p) => p.pixChargeId === chargeId || p.id === externalRef);
                if (pedido && mpData.status === 'approved' && pedido.statusPagamento !== 'PAGO') {
                  const agora = new Date().toISOString();
                  pedido.statusPagamento = 'PAGO';
                  pedido.status = 'CONCLUIDO';
                  pedido.pixPagoEm = agora;
                  pedido.pixIdTransacao = chargeId;
                  salvarStore(storeId, cachedStore);
                  console.log(`[Webhook] Pedido #${pedido.numeroPedido} da loja "${storeId}" confirmado como PAGO!`);
                }
              }
            } catch (err) {
              console.error(`Erro ao consultar webhook para loja ${storeId}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao processar webhook Pix:', err);
    }
    return res.status(200).send('OK');
  });

  // -------------------------------------------------------------
  // API: Marcar Pedido como WhatsApp Enviado (Idempotência)
  // -------------------------------------------------------------
  app.post('/api/pedidos/whatsapp-sent', (req, res) => {
    const { tokenPublico, pedidoId, token } = req.body;
    const tokenBusca = tokenPublico || token;

    let targetStore = (req as any).store;
    let targetLojaId = (req as any).lojaId || 'default';
    let pedido = targetStore?.pedidos?.find(
      (p: any) => (tokenBusca && p.tokenPublico === tokenBusca) || (pedidoId && p.id === pedidoId)
    );

    if (!pedido) {
      for (const [storeId, cachedStore] of storesCache.entries()) {
        const found = cachedStore.pedidos.find(
          (p: any) => (tokenBusca && p.tokenPublico === tokenBusca) || (pedidoId && p.id === pedidoId)
        );
        if (found) {
          pedido = found;
          targetStore = cachedStore;
          targetLojaId = storeId;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    pedido.whatsappEnviado = true;
    pedido.whatsappEnviadoEm = new Date().toISOString();
    salvarStore(targetLojaId, targetStore);

    return res.json({ sucesso: true, enviadoEm: pedido.whatsappEnviadoEm });
  });

  // -------------------------------------------------------------
  // API: Listagem e Gerenciamento de Pedidos no Painel Administrativo
  // -------------------------------------------------------------
  app.get('/api/pedidos/admin', requireAdminAuth, (req, res) => {
    const { store } = req as any;
    const pedidos = (store.pedidos || []).filter((p: any) => !PEDIDOS_TESTE_FICTICIOS_IDS.has(p.id));
    return res.json(pedidos);
  });

  app.delete('/api/pedidos/admin/:id', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    let targetStore = store;
    let targetLojaId = lojaId;
    let idx = targetStore?.pedidos?.findIndex((p: any) => p.id === id);

    if (idx === -1 || idx === undefined) {
      for (const [sId, cStore] of storesCache.entries()) {
        const foundIdx = cStore.pedidos?.findIndex((p: any) => p.id === id);
        if (foundIdx !== -1 && foundIdx !== undefined) {
          idx = foundIdx;
          targetStore = cStore;
          targetLojaId = sId;
          break;
        }
      }
    }

    if (idx === -1 || idx === undefined) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    const [removido] = targetStore.pedidos.splice(idx, 1);
    salvarStore(targetLojaId, targetStore);
    return res.json({ sucesso: true, removido });
  });

  app.post('/api/admin/reset-vazio', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { zerarPedidos, zerarProdutos } = req.body || {};

    if (zerarProdutos !== false) {
      store.produtos = [];
    }
    if (zerarPedidos !== false) {
      store.pedidos = [];
    }
    salvarStore(lojaId, store);
    return res.json({
      sucesso: true,
      mensagem: 'Banco do servidor limpo com sucesso!',
      totalProdutos: (store.produtos || []).length,
      totalPedidos: (store.pedidos || []).length,
    });
  });

  app.patch('/api/pedidos/admin/:id/status', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { id } = req.params;
    const { status, statusPagamento } = req.body;

    let targetStore = store;
    let targetLojaId = lojaId;
    let pedido = targetStore?.pedidos?.find((p: any) => p.id === id);

    if (!pedido) {
      for (const [sId, cStore] of storesCache.entries()) {
        const found = cStore.pedidos?.find((p: any) => p.id === id);
        if (found) {
          pedido = found;
          targetStore = cStore;
          targetLojaId = sId;
          break;
        }
      }
    }

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    const agora = new Date().toISOString();
    if (!pedido.historicoStatus) pedido.historicoStatus = [];

    if (status) {
      pedido.status = status;
      pedido.historicoStatus.push({
        status,
        statusPagamento: statusPagamento || pedido.statusPagamento,
        dataHora: agora,
        observacao: `Status do pedido atualizado no painel administrativo para "${status}".`,
      });
    }
    if (statusPagamento) {
      pedido.statusPagamento = statusPagamento;
    }

    salvarStore(targetLojaId, targetStore);
    return res.json({ sucesso: true, pedido });
  });

  // -------------------------------------------------------------
  // API: Diagnóstico de Banco de Dados e Backup do Servidor
  // -------------------------------------------------------------
  app.get('/api/admin/database-status', requireAdminAuth, (_req, res) => {
    return res.json({
      sucesso: true,
      ...storage.getStatus(),
    });
  });

  app.post('/api/admin/database-config', requireAdminAuth, async (req, res) => {
    const { databaseUrl } = req.body;
    if (!databaseUrl || typeof databaseUrl !== 'string' || !databaseUrl.trim().startsWith('postgres')) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Informe uma URL de conexão válida do PostgreSQL (deve começar com postgresql://).',
      });
    }

    try {
      const resultado = await storage.conectarEConfigurarPostgres(databaseUrl.trim());
      if (resultado.sucesso) {
        return res.json(resultado);
      } else {
        return res.status(400).json(resultado);
      }
    } catch (err: any) {
      return res.status(500).json({
        sucesso: false,
        erro: 'Erro interno ao configurar banco de dados: ' + err.message,
      });
    }
  });

  app.post('/api/admin/backup', requireAdminAuth, (_req, res) => {
    try {
      const backupPath = storage.criarBackupCompleto();
      return res.json({
        sucesso: true,
        arquivo: path.basename(backupPath),
        mensagem: 'Backup completo da base de dados gerado com sucesso no servidor!',
        geradoEm: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ erro: 'Falha ao criar backup: ' + err.message });
    }
  });

  // -------------------------------------------------------------
  // Sincronização entre LocalStorage do Admin e Banco do Servidor
  // -------------------------------------------------------------
  app.post('/api/sync/admin-produtos', requireAdminAuth, (req, res) => {
    const { store, lojaId } = req as any;
    const { produtos } = req.body;
    if (Array.isArray(produtos)) {
      store.produtos = produtos;
      salvarStore(lojaId, store);
    }
    return res.json({ sucesso: true });
  });

  // -------------------------------------------------------------
  // API: Publicação Oficial do Cardápio Local para a Nuvem
  // -------------------------------------------------------------
  app.post('/api/sync/publicar-cardapio', requireAdminAuth, async (req, res) => {
    try {
      const { store, lojaId } = req as any;
      const { produtos, categorias, adicionais, config, theme } = req.body;

      if (Array.isArray(produtos)) {
        store.produtos = produtos.map((p: any) => ({
          ...p,
          ativo: p.ativo !== false,
        }));
      }
      if (Array.isArray(categorias)) {
        store.categorias = categorias;
      }
      if (Array.isArray(adicionais)) {
        store.adicionais = adicionais;
      }
      if (config && typeof config === 'object') {
        store.config = {
          ...store.config,
          ...config,
          pedidosPagamentos: {
            ...(store.config.pedidosPagamentos || {}),
            ...(config.pedidosPagamentos || {}),
          },
        };
      }
      if (theme && typeof theme === 'object') {
        if (!store.config.cardapioTheme) store.config.cardapioTheme = {};
        store.config.cardapioTheme = { ...store.config.cardapioTheme, ...theme };
      }

      await storage.salvarStoreAsync(lojaId, store);

      const rawHost = req.headers['x-forwarded-host'] || req.get('host') || 'dburger-gestao.onrender.com';
      const hostStr = String(rawHost);
      const isGooglePreview = hostStr.includes('.run.app') || hostStr.includes('localhost');
      const publicHost = isGooglePreview ? 'dburger-gestao.onrender.com' : hostStr;
      const protocol = isGooglePreview ? 'https' : (req.headers['x-forwarded-proto'] || req.protocol || 'https');
      const urlPublica = `${protocol}://${publicHost}/?loja=${lojaId}&view=cardapio`;

      console.log(`[Publicação] Cardápio da loja "${lojaId}" publicado e gravado com sucesso! ${store.produtos.length} produtos.`);

      return res.json({
        sucesso: true,
        publicadoEm: new Date().toISOString(),
        urlPublica,
        totalProdutos: (store.produtos || []).length,
        totalCategorias: (store.categorias || []).length,
        totalAdicionais: (store.adicionais || []).length,
        mensagem: 'Cardápio publicado online com sucesso!',
      });
    } catch (err: any) {
      console.error('[Publicação] Falha ao persistir cardápio no servidor:', err);
      return res.status(500).json({
        sucesso: false,
        erro: 'Falha ao gravar os dados do cardápio no banco de dados do servidor: ' + (err.message || err),
      });
    }
  });

  // -------------------------------------------------------------
  // Servir arquivos do bundle de produção para o Android e PWA
  // -------------------------------------------------------------
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use('/bundle', express.static(distDir));

  app.get('/api/android/bundle-info', (_req, res) => {
    try {
      if (!fs.existsSync(distDir)) {
        return res.status(404).json({ erro: 'Build de produção ainda não gerado' });
      }
      const distHtmlPath = path.join(distDir, 'index.html');
      const indexHtml = fs.existsSync(distHtmlPath) ? fs.readFileSync(distHtmlPath, 'utf-8') : '';
      const assetsDir = path.join(distDir, 'assets');
      const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
      const jsFile = assetFiles.find((f) => f.endsWith('.js'));
      const cssFile = assetFiles.find((f) => f.endsWith('.css'));
      return res.json({
        sucesso: true,
        jsFile,
        cssFile,
        assetFiles,
        indexHtml,
        versao: '2.6.0',
        atualizadoEm: new Date().toISOString(),
      });
    } catch (e: any) {
      return res.status(500).json({ erro: e.message });
    }
  });

  app.get(['/api/android/download-project-zip', '/api/project/download-full-zip'], requireAdminAuth, async (_req, res) => {
    try {
      const zip = new JSZip();
      const rootDir = process.cwd();
      const distDir = path.resolve(rootDir, 'dist');

      // 1. Garante que os assets de produção estejam atualizados
      const distAppJsPath = path.join(distDir, 'assets', 'app.js');
      if (!fs.existsSync(distAppJsPath)) {
        try {
          const { execSync } = await import('child_process');
          execSync('npm run build', { stdio: 'inherit' });
        } catch (buildErr) {
          console.error('[ZIP] Falha ao compilar bundle sob demanda:', buildErr);
        }
      }

      // 2. Empacota todo o repositório de forma recursiva (Full-Stack: Backend + Render + Frontend + Android + Banco)
      const ignorados = new Set([
        'node_modules',
        '.git',
        'dist',
        '.cache',
        '.turbo',
        '.temp',
        'build',
        'server.js',
      ]);

      function adicionarPastaRecursiva(dirAtual: string, prefixoZip = '') {
        if (!fs.existsSync(dirAtual)) return;
        const entries = fs.readdirSync(dirAtual, { withFileTypes: true });
        for (const entry of entries) {
          if (ignorados.has(entry.name)) continue;
          if (entry.name.endsWith('.log') || entry.name.endsWith('.tmp')) continue;

          const caminhoCompleto = path.join(dirAtual, entry.name);
          const caminhoZip = prefixoZip ? `${prefixoZip}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            adicionarPastaRecursiva(caminhoCompleto, caminhoZip);
          } else {
            try {
              zip.file(caminhoZip, fs.readFileSync(caminhoCompleto));
            } catch (err) {
              console.warn(`[ZIP] Aviso ao ler ${caminhoCompleto}:`, err);
            }
          }
        }
      }

      adicionarPastaRecursiva(rootDir);

      // 3. Garante que o wrapper executável do Gradle esteja no ZIP
      zip.file(
        'gradlew',
        `#!/bin/sh\nexec gradle "$@"\n`
      );

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="dburger-gestao-completo-v2.6.0.zip"');
      return res.send(zipBuffer);
    } catch (e: any) {
      return res.status(500).json({ erro: 'Falha ao gerar ZIP: ' + e.message });
    }
  });

  // -------------------------------------------------------------
  // Monta o Vite Middleware para React SPA (ou arquivos estáticos em produção)
  // -------------------------------------------------------------
  const isProduction = process.env.NODE_ENV === 'production';
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

  if (isProduction && hasDist) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[D' Burger Server] Servidor Full-Stack rodando na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
