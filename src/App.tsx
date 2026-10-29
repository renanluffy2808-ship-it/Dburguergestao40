import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { AppProvider } from './context/AppContext';
import { Navbar, TabType } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { InsumosView } from './components/InsumosView';
import { ComprasView } from './components/ComprasView';
import { EstoqueView } from './components/EstoqueView';
import { CardapioView } from './components/CardapioView';
import { PdvView } from './components/PdvView';
import { CaixaView } from './components/CaixaView';
import { RelatoriosView } from './components/RelatoriosView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { TestesView } from './components/TestesView';
import { AndroidProjectView } from './components/AndroidProjectView';
import { PagamentosPedidosConfigView } from './components/PagamentosPedidosConfigView';
import { PedidosOnlineAdminView } from './components/PedidosOnlineAdminView';
import { CardapioPublicoView } from './components/CardapioPublicoView';

import { isAutenticadoAdmin, loginAdmin } from './lib/authService';
import { isAndroidApp } from './lib/lojaId';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [autenticado, setAutenticado] = useState<boolean>(() => isAutenticadoAdmin());
  const [solicitouAdmin, setSolicitouAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = window.location.search || '';
    return search.includes('admin') || search.includes('login') || search.includes('painel');
  });

  const [modoCliente, setModoCliente] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = window.location.search || '';
    const pathname = window.location.pathname || '';
    return (
      search.includes('view=cardapio') ||
      search.includes('modo=publico') ||
      search.includes('token=') ||
      search.includes('pedido=') ||
      pathname.endsWith('/cardapio')
    );
  });

  // Estados do formulário de acesso administrativo web
  const [senhaAdminInput, setSenhaAdminInput] = useState('');
  const [mostrarSenhaAdmin, setMostrarSenhaAdmin] = useState(false);
  const [erroLoginAdmin, setErroLoginAdmin] = useState('');
  const [entrandoAdmin, setEntrandoAdmin] = useState(false);

  useEffect(() => {
    const checkView = () => {
      const search = window.location.search || '';
      const pathname = window.location.pathname || '';
      setModoCliente(
        search.includes('view=cardapio') ||
        search.includes('modo=publico') ||
        search.includes('token=') ||
        search.includes('pedido=') ||
        pathname.endsWith('/cardapio')
      );
      setSolicitouAdmin(search.includes('admin') || search.includes('login') || search.includes('painel'));
      setAutenticado(isAutenticadoAdmin());
    };
    window.addEventListener('popstate', checkView);
    return () => window.removeEventListener('popstate', checkView);
  }, []);

  const handleLoginLojista = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntrandoAdmin(true);
    setErroLoginAdmin('');
    try {
      const res = await loginAdmin(senhaAdminInput);
      if (res.sucesso) {
        setAutenticado(true);
        setSolicitouAdmin(false);
        setModoCliente(false);
        setSenhaAdminInput('');
        window.history.pushState({}, '', window.location.pathname);
      } else {
        setErroLoginAdmin(res.erro || 'Senha incorreta.');
      }
    } catch {
      setErroLoginAdmin('Erro ao validar credenciais.');
    } finally {
      setEntrandoAdmin(false);
    }
  };

  const alternarParaAdmin = () => {
    window.history.pushState({}, '', window.location.pathname);
    setModoCliente(false);
  };

  const isAndroid = isAndroidApp();

  // 1. TELA DE LOGIN ADMINISTRATIVO SE ACESSO FOI SOLICITADO NA WEB E NÃO ESTÁ LOGADO
  if (solicitouAdmin && !autenticado && !isAndroid) {
    return (
      <AppProvider>
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-white">Acesso do Lojista</h2>
              <p className="text-xs text-zinc-400">
                Área administrativa restrita da D’ Burger Gestão.
              </p>
            </div>

            {erroLoginAdmin && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{erroLoginAdmin}</span>
              </div>
            )}

            <form onSubmit={handleLoginLojista} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  Senha Administrativa
                </label>
                <div className="relative">
                  <input
                    type={mostrarSenhaAdmin ? 'text' : 'password'}
                    value={senhaAdminInput}
                    onChange={(e) => setSenhaAdminInput(e.target.value)}
                    placeholder="Digite sua senha de administrador..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaAdmin(!mostrarSenhaAdmin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {mostrarSenhaAdmin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={entrandoAdmin}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {entrandoAdmin ? 'Entrando...' : 'Entrar no Painel'}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', window.location.pathname);
                  setSolicitouAdmin(false);
                }}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
              >
                Voltar ao Cardápio
              </button>
            </form>
          </div>
        </div>
      </AppProvider>
    );
  }

  // 2. BLINDAGEM DE ACESSO: CLIENTES NO NAVEGADOR NUNCA VEEM O PAINEL DE GESTÃO
  // Se for cliente, ou se estiver em navegador web sem autenticação prévia, exibe estritamente o Cardápio Público
  const deveExibirCardapioPublico = modoCliente || (!isAndroid && !autenticado);

  if (deveExibirCardapioPublico) {
    return (
      <AppProvider>
        <CardapioPublicoView
          onVoltarPainel={isAndroid && autenticado ? alternarParaAdmin : undefined}
          isAdmin={isAndroid && autenticado}
        />
      </AppProvider>
    );
  }

  // 3. ÁREA DE GESTÃO (LOJISTA AUTENTICADO OU NO APLICATIVO ANDROID)
  return (
    <AppProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
        {/* Navigation & Header */}
        <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        {/* Main View Area */}
        <main className="flex-1 w-full">
          {currentTab === 'dashboard' && <DashboardView setCurrentTab={setCurrentTab} />}
          {currentTab === 'pedidos-online' && <PedidosOnlineAdminView />}
          {currentTab === 'pagamentos-pedidos' && <PagamentosPedidosConfigView />}
          {currentTab === 'insumos' && <InsumosView />}
          {currentTab === 'compras' && <ComprasView />}
          {currentTab === 'estoque' && <EstoqueView />}
          {currentTab === 'cardapio' && <CardapioView />}
          {currentTab === 'pdv' && <PdvView />}
          {currentTab === 'caixa' && <CaixaView />}
          {currentTab === 'relatorios' && <RelatoriosView />}
          {currentTab === 'config' && <ConfiguracoesView />}
          {currentTab === 'testes' && <TestesView />}
          {currentTab === 'android' && <AndroidProjectView />}
        </main>
      </div>
    </AppProvider>
  );
}
