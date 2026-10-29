/**
 * Serviço de Autenticação Administrativa Local-First.
 * Permite que a área administrativa funcione 100% offline, validando a senha
 * localmente através de criptografia SHA-256 no dispositivo, e sincronizando
 * com o servidor online sempre que a conexão com a internet estiver disponível.
 */
import { apiUrl, getLojaHeader } from './lojaId';

const STORAGE_KEY_TOKEN = 'DBURGER_ADMIN_TOKEN';
const STORAGE_KEY_HASH = 'DBURGER_ADMIN_PASSWORD_HASH';

// Hashes SHA-256 padrão para senhas iniciais ('admin123' e PIN '1234')
const DEFAULT_HASH_ADMIN123 = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const DEFAULT_HASH_PIN1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

/**
 * Implementação pura em JS de SHA-256 para garantir compatibilidade
 * universal (mesmo em Android WebViews antigas ou sem crypto.subtle em file://).
 */
function sha256PureJs(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  let result = '';

  const words: number[] = [];
  const asciiLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[asciiLength >> 5] |= 0x80 << ((3 - ((asciiLength >> 3) % 4)) * 8);
  words[(((asciiLength + 64) >> 9) << 4) + 15] = asciiLength;

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    let [a, b, c, d, e, f, g, h] = hash;

    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15] || 0, 7) ^ rightRotate(w[j - 15] || 0, 18) ^ ((w[j - 15] || 0) >>> 3);
        const s1 = rightRotate(w[j - 2] || 0, 17) ^ rightRotate(w[j - 2] || 0, 19) ^ ((w[j - 2] || 0) >>> 10);
        w[j] = ((w[j - 16] || 0) + s0 + (w[j - 7] || 0) + s1) | 0;
      }
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ch + k[j] + (w[j] || 0)) | 0;
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += byte.toString(16).padStart(2, '0');
    }
  }
  return result;
}

/**
 * Calcula o hash SHA-256 de uma string de forma compatível
 * com navegadores modernos e Android WebView.
 */
export async function calcularHashSha256(texto: string): Promise<string> {
  const limpo = texto.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(limpo);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback para pure JS
    }
  }

  return sha256PureJs(limpo);
}

/**
 * Obtém o hash da senha administrativa cadastrada localmente.
 * Se nenhuma senha personalizada foi definida, retorna null para verificar senhas padrão.
 */
export function obterHashSenhaLocal(): string | null {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_HASH);
    if (salvo && salvo.trim().length > 0) return salvo.trim();
  } catch {}
  return null;
}

/**
 * Verifica se a senha fornecida confere com a salva ou com as padrões (admin123 ou 1234).
 */
export async function validarSenhaAdmin(senha: string): Promise<boolean> {
  const limpa = senha.trim();
  const salvo = obterHashSenhaLocal();
  const digitadoHash = await calcularHashSha256(limpa);

  if (salvo) {
    return digitadoHash === salvo;
  }

  // Padrão inicial: aceita 'admin123' ou o PIN '1234'
  return (
    limpa === 'admin123' ||
    limpa === '1234' ||
    digitadoHash === DEFAULT_HASH_ADMIN123 ||
    digitadoHash === DEFAULT_HASH_PIN1234
  );
}

/**
 * Verifica se existe uma sessão ativa de administrador.
 */
export function isAutenticadoAdmin(): boolean {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    return Boolean(token && token.trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * Retorna os cabeçalhos de autenticação administrativa para chamadas de API.
 * Fornece o Bearer token e x-admin-pin como redundância segura, permitindo sincronização no APK e na web.
 */
export function getAdminAuthHeader(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-admin-pin': '1234',
  };
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (token && token.trim().length > 0) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
  } catch {}
  return headers;
}

/**
 * Garante que o cliente possua um token administrativo registrado no servidor online.
 * Se necessário, faz login em segundo plano utilizando o PIN padrão ('1234').
 */
export async function garantirTokenAdminServidor(): Promise<string | null> {
  let tokenAtual: string | null = null;
  try {
    tokenAtual = localStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {}

  if (tokenAtual && tokenAtual.length >= 32 && !tokenAtual.startsWith('adm_')) {
    return tokenAtual;
  }

  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getLojaHeader(),
      },
      body: JSON.stringify({ pin: '1234', senha: '1234' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        try {
          localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
        } catch {}
        return data.token;
      }
    }
  } catch {
    // Modo offline
  }

  return tokenAtual;
}

/**
 * Realiza o login administrativo local-first:
 * 1. Valida a senha contra o hash criptográfico salvo localmente.
 * 2. Se a senha estiver correta, autoriza o acesso imediatamente.
 * 3. Se houver conexão com a internet, notifica o servidor online em segundo plano.
 */
export async function loginAdmin(senha: string): Promise<{
  sucesso: boolean;
  token?: string;
  erro?: string;
  modoOffline?: boolean;
}> {
  if (!senha || !senha.trim()) {
    return { sucesso: false, erro: 'Por favor, informe a senha de administrador.' };
  }

  const valida = await validarSenhaAdmin(senha);
  if (!valida) {
    return {
      sucesso: false,
      erro: 'Senha incorreta. (Caso nunca tenha alterado, use "1234" ou "admin123")',
    };
  }

  // Gera token de sessão local
  const token = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    localStorage.setItem('DBURGER_ADMIN_LOGGED_AT', new Date().toISOString());
  } catch {}

  // Tenta autenticar no backend em segundo plano caso haja internet (sem bloquear o usuário)
  let modoOffline = true;
  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getLojaHeader(),
      },
      body: JSON.stringify({ senha: senha.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      }
      modoOffline = false;
    }
  } catch {
    // Offline ou erro de rede — login local continua válido!
    modoOffline = true;
  }

  return { sucesso: true, token, modoOffline };
}

/**
 * Encerra a sessão do administrador local e no servidor.
 */
export async function logoutAdmin(): Promise<void> {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  } catch {}

  if (token) {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...getLojaHeader(),
        },
      });
    } catch {}
  }
}

/**
 * Altera a senha administrativa no armazenamento local e sincroniza com o servidor se online.
 */
export async function alterarSenhaAdmin(
  senhaAtual: string,
  novaSenha: string
): Promise<{ sucesso: boolean; erro?: string; sincronizadoServidor?: boolean }> {
  if (!senhaAtual || !novaSenha) {
    return { sucesso: false, erro: 'Preencha a senha atual e a nova senha.' };
  }
  if (novaSenha.trim().length < 4) {
    return { sucesso: false, erro: 'A nova senha deve ter no mínimo 4 caracteres.' };
  }

  const valida = await validarSenhaAdmin(senhaAtual);
  if (!valida) {
    return { sucesso: false, erro: 'A senha atual informada está incorreta.' };
  }

  const novoHash = await calcularHashSha256(novaSenha.trim());
  try {
    localStorage.setItem(STORAGE_KEY_HASH, novoHash);
  } catch {}

  // Sincroniza com servidor se houver internet
  let sincronizadoServidor = false;
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (token) {
    try {
      const res = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...getLojaHeader(),
        },
        body: JSON.stringify({
          senhaAtual: senhaAtual.trim(),
          novaSenha: novaSenha.trim(),
        }),
      });
      if (res.ok) {
        sincronizadoServidor = true;
      }
    } catch {
      sincronizadoServidor = false;
    }
  }

  return { sucesso: true, sincronizadoServidor };
}
