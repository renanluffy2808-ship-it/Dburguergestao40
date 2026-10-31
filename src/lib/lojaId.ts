/**
 * Utilitário para gerenciamento do Identificador da Instalação (Loja ID),
 * URLs da Camada Online e Base de API para o aplicativo Android e Web.
 */

const STORAGE_KEY_LOJA = 'DBURGER_LOJA_ID';
const STORAGE_KEY_SERVER_URL = 'DBURGER_SERVER_URL';

// URL oficial do backend online de produção no Render para o cardápio público e sincronização
export const SERVIDOR_ONLINE_PADRAO = 'https://dburger-gestao.onrender.com';

/**
 * Obtém o ID da loja/estabelecimento desta instalação.
 */
export function obterLojaIdAtual(): string {
  if (typeof window === 'undefined') return 'default';

  // 1. Prioridade: Parâmetro da URL (?loja=...)
  const params = new URLSearchParams(window.location.search);
  const lojaUrl = params.get('loja');
  if (lojaUrl && lojaUrl.trim()) {
    const limpo = lojaUrl.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (limpo) {
      try {
        localStorage.setItem(STORAGE_KEY_LOJA, limpo);
      } catch {}
      return limpo;
    }
  }

  // 2. LocalStorage do dispositivo (instalação persistente no celular)
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_LOJA);
    if (salvo && salvo.trim()) {
      const limpo = salvo.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
      if (limpo) return limpo;
    }
  } catch {}

  return 'default';
}

export function definirLojaId(novoId: string): string {
  const limpo = novoId.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'default';
  try {
    localStorage.setItem(STORAGE_KEY_LOJA, limpo);
  } catch {}
  return limpo;
}

/**
 * Verifica se o app está rodando dentro do APK Android (WebView local)
 */
export function isAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin || '';
  const href = window.location.href || '';
  return (
    origin.includes('appassets.androidplatform.net') ||
    href.startsWith('file://') ||
    href.includes('/android_asset/')
  );
}

/**
 * Obtém a URL base do servidor online oficial para acesso público
 */
export function getServidorOnlineUrl(): string {
  if (typeof window === 'undefined') return SERVIDOR_ONLINE_PADRAO;

  // 1. Configuração personalizada pelo admin no localStorage
  try {
    const custom = localStorage.getItem(STORAGE_KEY_SERVER_URL);
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {}

  // 2. Se estiver rodando na web no Render ou domínio público próprio (não em localhost e não no preview protegido do AI Studio)
  const origin = window.location.origin || '';
  if (
    !isAndroidApp() &&
    origin &&
    origin.startsWith('http') &&
    !origin.includes('localhost') &&
    !origin.includes('.run.app')
  ) {
    return origin.replace(/\/+$/, '');
  }

  // 3. Servidor oficial de produção no Render
  return SERVIDOR_ONLINE_PADRAO;
}

export function definirServidorOnlineUrl(url: string): void {
  const limpo = url.trim().replace(/\/+$/, '');
  try {
    if (limpo) {
      localStorage.setItem(STORAGE_KEY_SERVER_URL, limpo);
    } else {
      localStorage.removeItem(STORAGE_KEY_SERVER_URL);
    }
  } catch {}
}

export function isServidorCustomizado(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const custom = localStorage.getItem(STORAGE_KEY_SERVER_URL);
    return Boolean(custom && custom.trim().startsWith('http'));
  } catch {
    return false;
  }
}

export interface ResultadoConexaoServidor {
  sucesso: boolean;
  statusHttp?: number;
  mensagem: string;
  detalhes?: string;
  tempoRespostaMs?: number;
}

/**
 * Testa a conexão real com a rota de saúde do servidor /api/health
 */
export async function testarConexaoServidor(urlAlvo?: string): Promise<ResultadoConexaoServidor> {
  const base = (urlAlvo || getServidorOnlineUrl()).replace(/\/+$/, '');
  const start = performance.now();

  if (!base || !base.startsWith('http')) {
    return {
      sucesso: false,
      mensagem: 'URL do servidor inválida. A URL deve iniciar com http:// ou https://',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${base}/api/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const tempo = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        sucesso: true,
        statusHttp: res.status,
        mensagem: `Conexão bem-sucedida! Servidor respondendo (${tempo}ms).`,
        detalhes: data.nome ? `${data.nome} v${data.versao || '2.6.0'}` : undefined,
        tempoRespostaMs: tempo,
      };
    }

    if (res.status === 404) {
      return {
        sucesso: false,
        statusHttp: 404,
        mensagem: 'Erro 404: Servidor não encontrado nesta URL.',
        detalhes:
          'O aplicativo ainda não foi compartilhado ou implantado nesse endereço web. Se estiver no AI Studio, ative o botão Compartilhar (Share) ou configure a URL da sua hospedagem pública.',
        tempoRespostaMs: tempo,
      };
    }

    return {
      sucesso: false,
      statusHttp: res.status,
      mensagem: `Servidor retornou status HTTP ${res.status}.`,
      tempoRespostaMs: tempo,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const tempo = Math.round(performance.now() - start);
    const isTimeout = err.name === 'AbortError';
    const isGoogleAiStudioUrl = base.includes('ais-pre-') || base.includes('ais-dev-');

    if (isGoogleAiStudioUrl) {
      return {
        sucesso: false,
        mensagem: 'Bloqueio de Autenticação Google AI Studio (Redirecionamento / CORS).',
        detalhes:
          'A URL "ais-pre-*.run.app" pertence ao ambiente de desenvolvimento do AI Studio protegido pelo Google Auth Bridge. O APK instalado não possui os cookies da sua conta Google, gerando erro de CORS no WebView. Para o APK e para clientes públicos acessarem sem login Google, informe a URL pública de produção (ex: Render, Railway, Fly.io ou IP local da rede Wi-Fi http://192.168.x.x:3000).',
        tempoRespostaMs: tempo,
      };
    }

    return {
      sucesso: false,
      mensagem: isTimeout
        ? 'Tempo limite esgotado (timeout 6s). O servidor não respondeu a tempo.'
        : 'Não foi possível alcançar o servidor (falha de rede / CORS).',
      detalhes: isTimeout
        ? 'Verifique se o backend está ligado e conectado à internet.'
        : 'Verifique se a URL está correta, com http:// ou https:// e acessível pela internet.',
      tempoRespostaMs: tempo,
    };
  }
}

/**
 * Obtém a URL base para chamadas de API (fetch).
 * No APK Android, redireciona para o backend online HTTPS.
 * No ambiente Web preview, utiliza o caminho relativo do próprio host.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  if (isAndroidApp()) {
    return getServidorOnlineUrl();
  }
  return '';
}

/**
 * Monta o endpoint completo de uma chamada de API.
 */
export function apiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Gera o link público real e compartilhável do cardápio do cliente (HTTPS).
 * Esse link pode ser aberto por qualquer pessoa em qualquer celular ou navegador.
 */
export function gerarUrlCardapioPublico(lojaId?: string): string {
  const id = lojaId || obterLojaIdAtual();
  const base = getServidorOnlineUrl();
  return `${base}/?loja=${id}&view=cardapio`;
}

/**
 * Gera o link público para acompanhamento de um pedido pelo cliente.
 */
export function gerarUrlAcompanhamentoPedido(tokenPublico: string, lojaId?: string): string {
  const id = lojaId || obterLojaIdAtual();
  const base = getServidorOnlineUrl();
  return `${base}/?loja=${id}&view=cardapio&token=${encodeURIComponent(tokenPublico)}`;
}

export function getLojaHeader(): Record<string, string> {
  return {
    'x-loja-id': obterLojaIdAtual(),
  };
}
