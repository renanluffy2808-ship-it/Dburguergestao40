import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import {
  ConfiguracaoFinanceira,
  ProdutoCardapio,
  CategoriaCardapio,
  AdicionalCardapio,
  PedidoVenda,
  CardapioThemeConfig,
} from '../types';
import { CONFIG_INICIAL, PRODUTOS_PADRAO, CATEGORIAS_PADRAO, ADICIONAIS_PADRAO, TEMA_CARDAPIO_PADRAO } from '../data/initialData';

export interface StoreData {
  config: ConfiguracaoFinanceira;
  produtos: ProdutoCardapio[];
  categorias: CategoriaCardapio[];
  adicionais: AdicionalCardapio[];
  pedidos: PedidoVenda[];
  proximoNumeroPedido: number;
  adminPasswordHash?: string;
  adminSessions?: string[];
}

export interface FotoArmazenada {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  base64Data: string;
  tamanho: number;
  criadoEm: string;
}

export interface DatabaseStatusInfo {
  engine: 'postgresql' | 'local_json';
  isConnected: boolean;
  persistentAcrossRestarts: boolean;
  databaseHost?: string;
  databaseName?: string;
  totalLojas: number;
  totalPedidos: number;
  totalProdutos: number;
  totalFotos: number;
  ultimoBackupEm?: string;
  connectionError?: string | null;
  dadosMigradosParaNuvem?: boolean;
  aviso?: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORES_DIR = path.resolve(DATA_DIR, 'stores');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const FOTOS_DB_FILE = path.join(DATA_DIR, 'fotos.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const DB_CONN_FILE = path.join(DATA_DIR, 'db-connection.txt');
const ENV_FILE = path.resolve(process.cwd(), '.env');

// Garante pastas essenciais
[DATA_DIR, STORES_DIR, BACKUPS_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function hashPassword(pass: string): string {
  return crypto.createHash('sha256').update(String(pass)).digest('hex');
}

export const DEFAULT_ADMIN_HASH = hashPassword('admin123');

// Lista oficial dos 8 pedidos de teste/fictícios para exclusão definitiva e prevenção de recriação
export const PEDIDOS_TESTE_FICTICIOS_IDS = new Set([
  'ped-1792727185420-101',
  'ped-1792727223639-102',
  'ped-1792727316486-103',
  'ped-1792767960506-104',
  'ped-1792949698460-105',
  'ped-1792949709922-106',
  'ped-1792950156237-107',
  'ped-1792950206672-108',
]);

export function sanitizarLojaId(raw?: any): string {
  if (!raw || typeof raw !== 'string') return 'default';
  const limpo = raw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  if (!limpo || limpo === 'dburger' || limpo === 'default') return 'default';
  return limpo;
}

// -------------------------------------------------------------
// Gerenciador de Armazenamento Híbrido (PostgreSQL / Local JSON)
// -------------------------------------------------------------
class StorageManager {
  private pgPool: pg.Pool | null = null;
  private isPgReady = false;
  private connectionError: string | null = null;
  private storesCache = new Map<string, StoreData>();
  private fotosCache = new Map<string, FotoArmazenada>();
  private fotosDbLoaded = false;
  private ultimoBackup: string | null = null;
  private dadosMigrados = false;

  constructor() {
    this.carregarFotosLocais();
    this.iniciarPostgresSeDisponivel();
  }

  private carregarFotosLocais() {
    if (this.fotosDbLoaded) return;
    try {
      if (fs.existsSync(FOTOS_DB_FILE)) {
        const raw = fs.readFileSync(FOTOS_DB_FILE, 'utf-8');
        const lista: FotoArmazenada[] = JSON.parse(raw);
        for (const item of lista) {
          this.fotosCache.set(item.nomeArquivo, item);
        }
      }
      this.fotosDbLoaded = true;
    } catch (err) {
      console.error('[Storage] Erro ao ler fotos.json:', err);
    }
  }

  private salvarFotosLocais() {
    try {
      const lista = Array.from(this.fotosCache.values());
      const tempPath = `${FOTOS_DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(lista, null, 2), 'utf-8');
      fs.renameSync(tempPath, FOTOS_DB_FILE);
    } catch (err) {
      console.error('[Storage] Erro ao salvar fotos.json:', err);
    }
  }

  private obterUrlBancoDisponivel(): string | null {
    // 1. Variáveis de ambiente
    const envUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
    if (envUrl && envUrl.trim().startsWith('postgres')) {
      return envUrl.trim();
    }

    // 2. Arquivo de conexão local seguro (configurado pelo admin no painel)
    if (fs.existsSync(DB_CONN_FILE)) {
      try {
        const salvo = fs.readFileSync(DB_CONN_FILE, 'utf-8').trim();
        if (salvo.startsWith('postgres')) {
          return salvo;
        }
      } catch {}
    }

    return null;
  }

  public async iniciarPostgresSeDisponivel(): Promise<boolean> {
    const dbUrl = this.obterUrlBancoDisponivel();
    if (!dbUrl) {
      this.isPgReady = false;
      this.connectionError = null;
      console.log('[Storage] DATABASE_URL não detectada. Operando no modo autônomo com persistência local segura.');
      return false;
    }

    try {
      console.log('[Storage] Conectando ao PostgreSQL na nuvem...');
      const pool = new pg.Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });

      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS dburger_stores (
            id VARCHAR(64) PRIMARY KEY,
            config JSONB NOT NULL,
            admin_password_hash VARCHAR(128),
            admin_sessions JSONB,
            proximo_numero_pedido INT DEFAULT 101,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS dburger_produtos (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ativo BOOLEAN DEFAULT true,
            ordem INT DEFAULT 999,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_categorias (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ordem INT DEFAULT 999,
            ativa BOOLEAN DEFAULT true,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_adicionais (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ordem INT DEFAULT 999,
            ativo BOOLEAN DEFAULT true,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_pedidos (
            id VARCHAR(128) PRIMARY KEY,
            loja_id VARCHAR(64) NOT NULL,
            numero_pedido INT NOT NULL,
            token_publico VARCHAR(64) UNIQUE,
            status VARCHAR(32) NOT NULL,
            status_pagamento VARCHAR(32) NOT NULL,
            dados JSONB NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS dburger_fotos (
            id VARCHAR(128) PRIMARY KEY,
            nome_arquivo VARCHAR(256) UNIQUE NOT NULL,
            mime_type VARCHAR(64) NOT NULL,
            base64_data TEXT NOT NULL,
            tamanho INT NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        this.pgPool = pool;
        this.isPgReady = true;
        this.connectionError = null;
        console.log('[Storage] PostgreSQL conectado e tabelas verificadas com sucesso!');

        // Executa auto-migração segura dos dados locais para o PostgreSQL se o banco estiver vazio
        await this.migrarDadosLocaisParaPostgres(client);

        // Carrega dados do PostgreSQL para o cache de memória
        await this.carregarTodasLojasDoPostgres(client);

        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[Storage] Falha ao conectar ao PostgreSQL:', err.message || err);
      this.isPgReady = false;
      this.connectionError = err.message || 'Erro de conexão com o PostgreSQL';
      this.pgPool = null;
      return false;
    }
  }

  /**
   * Conecta dinamicamente ao PostgreSQL a partir de uma Connection String informada pelo Admin.
   * Valida a conexão, salva de forma segura e migra os dados sem sobrescrever.
   */
  public async conectarEConfigurarPostgres(dbUrl: string): Promise<{
    sucesso: boolean;
    mensagem: string;
    erro?: string;
    migrados?: { lojas: number; pedidos: number; produtos: number; fotos: number };
  }> {
    if (!dbUrl || typeof dbUrl !== 'string' || !dbUrl.trim().startsWith('postgres')) {
      return {
        sucesso: false,
        mensagem: 'A URL do banco deve começar com "postgresql://" ou "postgres://".',
        erro: 'Formato de URL inválido',
      };
    }

    const cleanUrl = dbUrl.trim();
    try {
      const testPool = new pg.Pool({
        connectionString: cleanUrl,
        ssl: cleanUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 7000,
      });

      const client = await testPool.connect();
      try {
        // Testa consulta simples
        await client.query('SELECT NOW()');

        // Cria tabelas
        await client.query(`
          CREATE TABLE IF NOT EXISTS dburger_stores (
            id VARCHAR(64) PRIMARY KEY,
            config JSONB NOT NULL,
            admin_password_hash VARCHAR(128),
            admin_sessions JSONB,
            proximo_numero_pedido INT DEFAULT 101,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS dburger_produtos (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ativo BOOLEAN DEFAULT true,
            ordem INT DEFAULT 999,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_categorias (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ordem INT DEFAULT 999,
            ativa BOOLEAN DEFAULT true,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_adicionais (
            id VARCHAR(64) NOT NULL,
            loja_id VARCHAR(64) NOT NULL,
            dados JSONB NOT NULL,
            ordem INT DEFAULT 999,
            ativo BOOLEAN DEFAULT true,
            PRIMARY KEY (id, loja_id)
          );

          CREATE TABLE IF NOT EXISTS dburger_pedidos (
            id VARCHAR(128) PRIMARY KEY,
            loja_id VARCHAR(64) NOT NULL,
            numero_pedido INT NOT NULL,
            token_publico VARCHAR(64) UNIQUE,
            status VARCHAR(32) NOT NULL,
            status_pagamento VARCHAR(32) NOT NULL,
            dados JSONB NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS dburger_fotos (
            id VARCHAR(128) PRIMARY KEY,
            nome_arquivo VARCHAR(256) UNIQUE NOT NULL,
            mime_type VARCHAR(64) NOT NULL,
            base64_data TEXT NOT NULL,
            tamanho INT NOT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Migra dados locais existentes para o PostgreSQL
        const migrados = await this.migrarDadosLocaisParaPostgres(client);

        // Assume o pool novo
        if (this.pgPool) {
          try {
            await this.pgPool.end();
          } catch {}
        }
        this.pgPool = testPool;
        this.isPgReady = true;
        this.connectionError = null;

        // Salva a configuração de forma persistente
        try {
          fs.writeFileSync(DB_CONN_FILE, cleanUrl, 'utf-8');
          // Grava no .env
          let envContent = '';
          if (fs.existsSync(ENV_FILE)) {
            envContent = fs.readFileSync(ENV_FILE, 'utf-8');
          }
          if (envContent.includes('DATABASE_URL=')) {
            envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${cleanUrl}"`);
          } else {
            envContent += `\nDATABASE_URL="${cleanUrl}"\n`;
          }
          fs.writeFileSync(ENV_FILE, envContent, 'utf-8');
          process.env.DATABASE_URL = cleanUrl;
        } catch (err) {
          console.error('[Storage] Aviso ao gravar arquivo de conexão:', err);
        }

        // Carrega as lojas do PostgreSQL para a memória
        await this.carregarTodasLojasDoPostgres(client);

        return {
          sucesso: true,
          mensagem: 'Banco de dados PostgreSQL conectado com sucesso! Dados migrados com segurança.',
          migrados,
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('[Storage] Erro ao conectar ao PostgreSQL:', err);
      return {
        sucesso: false,
        mensagem: 'Não foi possível conectar ao PostgreSQL: ' + (err.message || 'Verifique a string de conexão e permissões do banco.'),
        erro: err.message,
      };
    }
  }

  /**
   * Auto-migração dos dados locais (JSON) para o PostgreSQL
   * Somente insere registros que ainda não existem, sem duplicar nem sobrescrever.
   */
  private async migrarDadosLocaisParaPostgres(client: pg.PoolClient): Promise<{
    lojas: number;
    pedidos: number;
    produtos: number;
    fotos: number;
  }> {
    let countLojas = 0;
    let countPedidos = 0;
    let countProdutos = 0;
    let countFotos = 0;

    try {
      // 1. Carrega todas as lojas existentes do disco local
      const lojasLocais = new Map<string, StoreData>();

      // Loja padrão
      if (fs.existsSync(STORE_FILE)) {
        try {
          const raw = fs.readFileSync(STORE_FILE, 'utf-8');
          lojasLocais.set('default', JSON.parse(raw));
        } catch {}
      }

      // Outras lojas
      if (fs.existsSync(STORES_DIR)) {
        try {
          const files = fs.readdirSync(STORES_DIR).filter((f) => f.endsWith('.json'));
          for (const file of files) {
            const lojaId = file.replace('.json', '');
            const raw = fs.readFileSync(path.join(STORES_DIR, file), 'utf-8');
            lojasLocais.set(lojaId, JSON.parse(raw));
          }
        } catch {}
      }

      // 2. Insere lojas, produtos e pedidos no PostgreSQL
      for (const [lojaId, store] of lojasLocais.entries()) {
        const safeId = sanitizarLojaId(lojaId);
        await client.query(
          `INSERT INTO dburger_stores (id, config, admin_password_hash, admin_sessions, proximo_numero_pedido, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             config = EXCLUDED.config,
             proximo_numero_pedido = GREATEST(dburger_stores.proximo_numero_pedido, EXCLUDED.proximo_numero_pedido)`,
          [
            safeId,
            JSON.stringify(store.config || {}),
            store.adminPasswordHash || DEFAULT_ADMIN_HASH,
            JSON.stringify(store.adminSessions || []),
            store.proximoNumeroPedido || 101,
          ]
        );
        countLojas++;

        // Produtos
        if (Array.isArray(store.produtos)) {
          for (const prod of store.produtos) {
            await client.query(
              `INSERT INTO dburger_produtos (id, loja_id, dados, ativo, ordem, updated_at)
               VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
               ON CONFLICT (id, loja_id) DO NOTHING`,
              [prod.id, safeId, JSON.stringify(prod), prod.ativo !== false, prod.ordem || 999]
            );
            countProdutos++;
          }
        }

        // Categorias
        if (Array.isArray(store.categorias)) {
          for (const cat of store.categorias) {
            await client.query(
              `INSERT INTO dburger_categorias (id, loja_id, dados, ordem, ativa)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id, loja_id) DO NOTHING`,
              [cat.id, safeId, JSON.stringify(cat), cat.ordem || 999, cat.ativa !== false]
            );
          }
        }

        // Adicionais
        if (Array.isArray(store.adicionais)) {
          for (const adic of store.adicionais) {
            await client.query(
              `INSERT INTO dburger_adicionais (id, loja_id, dados, ordem, ativo)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id, loja_id) DO NOTHING`,
              [adic.id, safeId, JSON.stringify(adic), adic.ordem || 999, adic.ativo !== false]
            );
          }
        }

        // Pedidos existentes (ignora definitivamente os 8 pedidos de teste fictícios)
        if (Array.isArray(store.pedidos)) {
          for (const ped of store.pedidos) {
            if (PEDIDOS_TESTE_FICTICIOS_IDS.has(ped.id)) continue;
            await client.query(
              `INSERT INTO dburger_pedidos (id, loja_id, numero_pedido, token_publico, status, status_pagamento, dados, criado_em, atualizado_em)
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
               ON CONFLICT (id) DO UPDATE SET
                 status = EXCLUDED.status,
                 status_pagamento = EXCLUDED.status_pagamento,
                 dados = EXCLUDED.dados`,
              [
                ped.id,
                safeId,
                ped.numeroPedido ?? ped.numero ?? 0,
                ped.tokenPublico || null,
                ped.status || 'PENDENTE',
                ped.statusPagamento || 'PENDENTE',
                JSON.stringify(ped),
              ]
            );
            countPedidos++;
          }
        }
      }

      // 3. Fotos em Base64
      for (const foto of this.fotosCache.values()) {
        await client.query(
          `INSERT INTO dburger_fotos (id, nome_arquivo, mime_type, base64_data, tamanho, criado_em)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (nome_arquivo) DO NOTHING`,
          [foto.id, foto.nomeArquivo, foto.mimeType, foto.base64Data, foto.tamanho]
        );
        countFotos++;
      }

      this.dadosMigrados = true;
      console.log(`[Storage] Auto-migração concluída com sucesso: ${countLojas} lojas, ${countPedidos} pedidos, ${countProdutos} produtos e ${countFotos} fotos migradas.`);
    } catch (err) {
      console.error('[Storage] Erro durante auto-migração para PostgreSQL:', err);
    }

    return { lojas: countLojas, pedidos: countPedidos, produtos: countProdutos, fotos: countFotos };
  }

  /**
   * Carrega todas as lojas do PostgreSQL para a memória (storesCache)
   */
  private async carregarTodasLojasDoPostgres(client: pg.PoolClient) {
    try {
      const resStores = await client.query('SELECT * FROM dburger_stores');
      for (const row of resStores.rows) {
        const lojaId = row.id;

        // Produtos da loja (respeita lista vazia se o cardápio foi zerado)
        const resProd = await client.query('SELECT dados FROM dburger_produtos WHERE loja_id = $1 ORDER BY ordem ASC', [lojaId]);
        const produtos = resProd.rows.map((r) => r.dados);

        // Categorias
        const resCat = await client.query('SELECT dados FROM dburger_categorias WHERE loja_id = $1 ORDER BY ordem ASC', [lojaId]);
        const categorias = resCat.rows.map((r) => r.dados);

        // Adicionais
        const resAdic = await client.query('SELECT dados FROM dburger_adicionais WHERE loja_id = $1 ORDER BY ordem ASC', [lojaId]);
        const adicionais = resAdic.rows.map((r) => r.dados);

        // Pedidos (filtra qualquer pedido fictício remanescente)
        const resPed = await client.query('SELECT dados FROM dburger_pedidos WHERE loja_id = $1 ORDER BY criado_em DESC', [lojaId]);
        const pedidos = resPed.rows
          .map((r) => r.dados)
          .filter((p) => p && !PEDIDOS_TESTE_FICTICIOS_IDS.has(p.id));

        const storeData: StoreData = {
          config: {
            ...CONFIG_INICIAL,
            ...(row.config || {}),
            estabelecimentoId: lojaId,
            cardapioTheme: row.config?.cardapioTheme || TEMA_CARDAPIO_PADRAO,
          },
          produtos: Array.isArray(produtos) ? produtos : [],
          categorias: Array.isArray(categorias) && categorias.length > 0 ? categorias : CATEGORIAS_PADRAO,
          adicionais: Array.isArray(adicionais) && adicionais.length > 0 ? adicionais : ADICIONAIS_PADRAO,
          pedidos,
          proximoNumeroPedido: row.proximo_numero_pedido || 101,
          adminPasswordHash: row.admin_password_hash || DEFAULT_ADMIN_HASH,
          adminSessions: Array.isArray(row.admin_sessions) ? row.admin_sessions : [],
        };

        this.storesCache.set(lojaId, storeData);
      }
      console.log(`[Storage] ${resStores.rows.length} lojas carregadas do PostgreSQL.`);
    } catch (err) {
      console.error('[Storage] Erro ao carregar lojas do PostgreSQL:', err);
    }
  }

  public getCaminhoLoja(lojaId: string): string {
    const safeId = sanitizarLojaId(lojaId);
    if (safeId === 'default' || safeId === 'dburger') {
      return STORE_FILE;
    }
    return path.join(STORES_DIR, `${safeId}.json`);
  }

  public carregarStore(lojaId = 'default'): StoreData {
    const safeId = sanitizarLojaId(lojaId);
    if (this.storesCache.has(safeId)) {
      return this.storesCache.get(safeId)!;
    }

    const caminho = this.getCaminhoLoja(safeId);
    try {
      if (fs.existsSync(caminho)) {
        const raw = fs.readFileSync(caminho, 'utf-8');
        const parsed = JSON.parse(raw);
        const data: StoreData = {
          config: {
            ...CONFIG_INICIAL,
            ...parsed.config,
            estabelecimentoId: safeId,
            cardapioTheme: parsed.config?.cardapioTheme || TEMA_CARDAPIO_PADRAO,
          },
          produtos: Array.isArray(parsed.produtos) ? parsed.produtos : PRODUTOS_PADRAO,
          categorias: Array.isArray(parsed.categorias) ? parsed.categorias : CATEGORIAS_PADRAO,
          adicionais: Array.isArray(parsed.adicionais) ? parsed.adicionais : ADICIONAIS_PADRAO,
          pedidos: (Array.isArray(parsed.pedidos) ? parsed.pedidos : []).filter((p: any) => p && !PEDIDOS_TESTE_FICTICIOS_IDS.has(p.id)),
          proximoNumeroPedido: parsed.proximoNumeroPedido || 101,
          adminPasswordHash: parsed.adminPasswordHash || DEFAULT_ADMIN_HASH,
          adminSessions: Array.isArray(parsed.adminSessions) ? parsed.adminSessions : [],
        };
        this.storesCache.set(safeId, data);
        return data;
      }
    } catch (err) {
      console.error(`[Storage] Erro ao ler store ${safeId}:`, err);
    }

    const initialStore: StoreData = {
      config: {
        ...CONFIG_INICIAL,
        estabelecimentoId: safeId,
        slugLoja: safeId,
        cardapioTheme: { ...TEMA_CARDAPIO_PADRAO },
      },
      produtos: PRODUTOS_PADRAO,
      categorias: CATEGORIAS_PADRAO,
      adicionais: ADICIONAIS_PADRAO,
      pedidos: [],
      proximoNumeroPedido: 101,
      adminPasswordHash: DEFAULT_ADMIN_HASH,
      adminSessions: [],
    };
    this.salvarStore(safeId, initialStore);
    return initialStore;
  }

  public salvarStore(lojaIdOrData: string | StoreData, maybeData?: StoreData): void {
    let safeId = 'default';
    let storeData: StoreData;
    if (typeof lojaIdOrData === 'string') {
      safeId = sanitizarLojaId(lojaIdOrData);
      storeData = maybeData!;
    } else {
      storeData = lojaIdOrData;
      safeId = sanitizarLojaId(storeData.config?.estabelecimentoId || 'default');
    }

    this.storesCache.set(safeId, storeData);

    // 1. Gravação local com atomic rename (evita corrupção)
    try {
      const caminho = this.getCaminhoLoja(safeId);
      const tempPath = `${caminho}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(storeData, null, 2), 'utf-8');
      fs.renameSync(tempPath, caminho);
    } catch (err) {
      console.error(`[Storage] Erro ao gravar store no disco (${safeId}):`, err);
    }

    // 2. Gravação assíncrona no PostgreSQL se disponível
    if (this.isPgReady && this.pgPool) {
      this.persistirNoPostgres(safeId, storeData).catch((err) => {
        console.error(`[Storage] Erro ao persistir store ${safeId} no PostgreSQL:`, err);
      });
    }
  }

  private async persistirNoPostgres(lojaId: string, store: StoreData) {
    if (!this.pgPool) return;
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      // Store Master
      await client.query(
        `INSERT INTO dburger_stores (id, config, admin_password_hash, admin_sessions, proximo_numero_pedido, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           config = EXCLUDED.config,
           admin_password_hash = EXCLUDED.admin_password_hash,
           admin_sessions = EXCLUDED.admin_sessions,
           proximo_numero_pedido = EXCLUDED.proximo_numero_pedido,
           updated_at = CURRENT_TIMESTAMP`,
        [
          lojaId,
          JSON.stringify(store.config),
          store.adminPasswordHash || DEFAULT_ADMIN_HASH,
          JSON.stringify(store.adminSessions || []),
          store.proximoNumeroPedido || 101,
        ]
      );

      // Produtos
      if (store.produtos.length === 0) {
        await client.query('DELETE FROM dburger_produtos WHERE loja_id = $1', [lojaId]);
      } else {
        const idsProdutos = store.produtos.map((p) => p.id);
        await client.query('DELETE FROM dburger_produtos WHERE loja_id = $1 AND NOT (id = ANY($2))', [lojaId, idsProdutos]);
      }
      for (const prod of store.produtos) {
        await client.query(
          `INSERT INTO dburger_produtos (id, loja_id, dados, ativo, ordem, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (id, loja_id) DO UPDATE SET
             dados = EXCLUDED.dados,
             ativo = EXCLUDED.ativo,
             ordem = EXCLUDED.ordem,
             updated_at = CURRENT_TIMESTAMP`,
          [prod.id, lojaId, JSON.stringify(prod), prod.ativo, prod.ordem || 999]
        );
      }

      // Pedidos (remove pedidos apagados/zerados e ignora pedidos fictícios de teste)
      const pedidosReais = (store.pedidos || []).filter((p) => p && !PEDIDOS_TESTE_FICTICIOS_IDS.has(p.id));
      if (pedidosReais.length === 0) {
        await client.query('DELETE FROM dburger_pedidos WHERE loja_id = $1', [lojaId]);
      } else {
        const idsPedidos = pedidosReais.map((p) => p.id);
        await client.query('DELETE FROM dburger_pedidos WHERE loja_id = $1 AND NOT (id = ANY($2))', [lojaId, idsPedidos]);
      }
      for (const ped of pedidosReais) {
        await client.query(
          `INSERT INTO dburger_pedidos (id, loja_id, numero_pedido, token_publico, status, status_pagamento, dados, criado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             status_pagamento = EXCLUDED.status_pagamento,
             dados = EXCLUDED.dados,
             atualizado_em = CURRENT_TIMESTAMP`,
          [
            ped.id,
            lojaId,
            ped.numeroPedido ?? ped.numero ?? 0,
            ped.tokenPublico || null,
            ped.status,
            ped.statusPagamento || 'PENDENTE',
            JSON.stringify(ped),
          ]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------
  // Fotos: Armazenamento e Restauração Automática On-the-Fly
  // -------------------------------------------------------------
  public salvarFotoPermanente(nomeArquivo: string, base64Data: string, mimeType = 'image/jpeg'): FotoArmazenada {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const fotoItem: FotoArmazenada = {
      id: `foto-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      nomeArquivo,
      mimeType,
      base64Data: cleanBase64,
      tamanho: buffer.length,
      criadoEm: new Date().toISOString(),
    };

    // 1. Salva no cache e JSON local
    this.fotosCache.set(nomeArquivo, fotoItem);
    this.salvarFotosLocais();

    // 2. Salva fisicamente em uploads para servir rápido
    try {
      const dest = path.join(UPLOADS_DIR, nomeArquivo);
      fs.writeFileSync(dest, buffer);
    } catch (err) {
      console.error('[Storage] Erro ao gravar foto no disco temporário:', err);
    }

    // 3. Salva no PostgreSQL se disponível
    if (this.isPgReady && this.pgPool) {
      this.pgPool
        .query(
          `INSERT INTO dburger_fotos (id, nome_arquivo, mime_type, base64_data, tamanho, criado_em)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (nome_arquivo) DO UPDATE SET
             base64_data = EXCLUDED.base64_data,
             tamanho = EXCLUDED.tamanho`,
          [fotoItem.id, fotoItem.nomeArquivo, fotoItem.mimeType, fotoItem.base64Data, fotoItem.tamanho]
        )
        .catch((e) => console.error('[Storage] Erro ao gravar foto no PG:', e));
    }

    return fotoItem;
  }

  public recuperarFotoBuffer(nomeArquivo: string): { buffer: Buffer; mimeType: string } | null {
    // 1. Se já existe em disco, lê direto
    const filePath = path.join(UPLOADS_DIR, nomeArquivo);
    if (fs.existsSync(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        return { buffer: buf, mimeType: 'image/jpeg' };
      } catch {}
    }

    // 2. Se o arquivo sumiu do disco (ex: contêiner reiniciou), recupera do cache/JSON
    const fotoItem = this.fotosCache.get(nomeArquivo);
    if (fotoItem && fotoItem.base64Data) {
      try {
        const buf = Buffer.from(fotoItem.base64Data, 'base64');
        fs.writeFileSync(filePath, buf);
        return { buffer: buf, mimeType: fotoItem.mimeType };
      } catch (e) {
        console.error('[Storage] Erro ao reconstituir foto do cache:', e);
      }
    }

    return null;
  }

  public async recuperarFotoBufferAsync(nomeArquivo: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const s = this.recuperarFotoBuffer(nomeArquivo);
    if (s) return s;

    // Se estiver no PostgreSQL, recupera da tabela dburger_fotos
    if (this.isPgReady && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT base64_data, mime_type FROM dburger_fotos WHERE nome_arquivo = $1', [nomeArquivo]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const buf = Buffer.from(row.base64_data, 'base64');
          const filePath = path.join(UPLOADS_DIR, nomeArquivo);
          try {
            fs.writeFileSync(filePath, buf);
          } catch {}
          return { buffer: buf, mimeType: row.mime_type || 'image/jpeg' };
        }
      } catch (err) {
        console.error('[Storage] Erro ao buscar foto no PG:', err);
      }
    }

    return null;
  }

  // -------------------------------------------------------------
  // Backups e Diagnóstico
  // -------------------------------------------------------------
  public criarBackupCompleto(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `backup-${timestamp}.json`);
    const dados = {
      criadoEm: new Date().toISOString(),
      lojas: Object.fromEntries(this.storesCache.entries()),
      totalFotos: this.fotosCache.size,
    };
    fs.writeFileSync(backupFile, JSON.stringify(dados, null, 2), 'utf-8');
    this.ultimoBackup = new Date().toISOString();

    // Mantém apenas os 10 últimos backups
    try {
      const arquivos = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('backup-') && f.endsWith('.json'));
      if (arquivos.length > 10) {
        arquivos.sort();
        const aRemover = arquivos.slice(0, arquivos.length - 10);
        for (const rem of aRemover) {
          fs.unlinkSync(path.join(BACKUPS_DIR, rem));
        }
      }
    } catch {}

    return backupFile;
  }

  public getStatus(): DatabaseStatusInfo {
    let totalPedidos = 0;
    let totalProdutos = 0;
    for (const s of this.storesCache.values()) {
      totalPedidos += (s.pedidos || []).length;
      totalProdutos += (s.produtos || []).length;
    }

    const hasPg = Boolean(this.isPgReady && this.pgPool);
    const dbUrl = this.obterUrlBancoDisponivel() || '';
    let hostName = 'sistema-de-arquivos-local';
    let dbName = 'data/store.json';

    if (hasPg && dbUrl) {
      try {
        const parsed = new URL(dbUrl);
        hostName = parsed.hostname;
        dbName = parsed.pathname.replace(/^\//, '');
      } catch {}
    }

    return {
      engine: hasPg ? 'postgresql' : 'local_json',
      isConnected: true,
      persistentAcrossRestarts: hasPg,
      databaseHost: hostName,
      databaseName: dbName,
      totalLojas: Math.max(1, this.storesCache.size),
      totalPedidos,
      totalProdutos,
      totalFotos: this.fotosCache.size,
      ultimoBackupEm: this.ultimoBackup || undefined,
      connectionError: this.connectionError,
      dadosMigradosParaNuvem: this.dadosMigrados || hasPg,
      aviso: hasPg
        ? 'Banco de dados PostgreSQL na nuvem conectado. Todos os dados e pedidos são definitivos e compartilhados entre instâncias.'
        : this.connectionError
        ? `Falha ao conectar no PostgreSQL: ${this.connectionError}. O sistema continua operando em modo local seguro.`
        : 'Operando com armazenamento autônomo com proteção contra corrupção. Conecte sua URL do Neon no painel para ativar a persistência multinstância.',
    };
  }

  public getStoresCache(): Map<string, StoreData> {
    return this.storesCache;
  }
}

export const storage = new StorageManager();
