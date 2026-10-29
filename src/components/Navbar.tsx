import React, { useState } from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  Boxes,
  BookOpen,
  DollarSign,
  ShoppingCart,
  Wallet,
  FileSpreadsheet,
  Settings,
  FlaskConical,
  Smartphone,
  Menu,
  X,
  AlertTriangle,
  CreditCard,
  ShoppingBag,
  ExternalLink,
  Share2,
  Copy,
  Check,
  Eye,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { gerarUrlCardapioPublico, isAndroidApp } from '../lib/lojaId';

export type TabType =
  | 'dashboard'
  | 'pedidos-online'
  | 'pagamentos-pedidos'
  | 'insumos'
  | 'compras'
  | 'estoque'
  | 'cardapio'
  | 'pdv'
  | 'caixa'
  | 'relatorios'
  | 'config'
  | 'testes'
  | 'android';

interface NavbarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { indicadores, config } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalCardapioAberto, setModalCardapioAberto] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(false);

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Painel', icon: LayoutDashboard },
    { id: 'pedidos-online' as TabType, label: 'Pedidos Web', icon: ShoppingBag, highlight: true },
    { id: 'pagamentos-pedidos' as TabType, label: 'Pagamentos e Pedidos', icon: CreditCard },
    { id: 'insumos' as TabType, label: 'Insumos', icon: UtensilsCrossed },
    { id: 'compras' as TabType, label: 'Compras/Notas', icon: Receipt },
    { id: 'estoque' as TabType, label: 'Estoque', icon: Boxes, badge: indicadores.insumosEstoqueBaixo.length + indicadores.insumosEstoqueZerado.length },
    { id: 'cardapio' as TabType, label: 'Cardápio & Fichas', icon: BookOpen },
    { id: 'pdv' as TabType, label: 'Vendas / PDV', icon: ShoppingCart },
    { id: 'caixa' as TabType, label: 'Fluxo de Caixa', icon: Wallet },
    { id: 'relatorios' as TabType, label: 'Relatórios', icon: FileSpreadsheet },
    { id: 'config' as TabType, label: 'Configurações', icon: Settings },
    { id: 'testes' as TabType, label: 'Testes das Regras', icon: FlaskConical },
    { id: 'android' as TabType, label: 'Código Android & APK', icon: Smartphone, special: true },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 text-zinc-100 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 md:hidden transition"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-amber-500" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-black text-black text-lg shadow-lg shadow-amber-500/20">
                {config.nomeHamburgueria?.trim().charAt(0).toUpperCase() || 'D'}
              </div>
              <div>
                <h1 className="font-extrabold text-base leading-tight tracking-tight text-white flex items-center gap-1.5">
                  {config.nomeHamburgueria}
                  <span className="hidden sm:inline-block text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Gestão Integrada
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  100% Offline • SQLite Local
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {indicadores.insumosEstoqueBaixo.length > 0 && (
              <button
                onClick={() => setCurrentTab('estoque')}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{indicadores.insumosEstoqueBaixo.length} estoque baixo</span>
              </button>
            )}

            <button
              onClick={() => setModalCardapioAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold active:scale-95 transition"
              title="Abrir ou compartilhar o Cardápio Digital"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cardápio do Cliente</span>
              <span className="sm:hidden">Cardápio</span>
            </button>

            <button
              onClick={() => setCurrentTab('android')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 text-xs font-bold shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-95 transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Projeto Android</span>
              <span>APK</span>
            </button>
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <div className="hidden md:flex max-w-7xl mx-auto mt-2.5 space-x-1 overflow-x-auto pb-1 scrollbar-none border-t border-zinc-800/60 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition relative ${
                  active
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-zinc-950' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-1 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-bold">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-zinc-900 border-r border-zinc-800 h-full p-4 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-black">
                    {config.nomeHamburgueria?.trim().charAt(0).toUpperCase() || 'D'}
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-white">{config.nomeHamburgueria}</h2>
                    <p className="text-[10px] text-zinc-400">Menu Principal</p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                        active
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setModalCardapioAberto(true);
                  }}
                  className="w-full mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
                >
                  <div className="flex items-center gap-3">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Cardápio do Cliente</span>
                  </div>
                </button>
              </nav>
            </div>

            <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 text-center">
              D’ Burger Gestão v1.0 • Desenvolvido para Hamburguerias Artesanais
            </div>
          </div>
        </div>
      )}

      {/* Modal Cardápio do Cliente */}
      {modalCardapioAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Cardápio Digital do Cliente</h3>
                  <p className="text-xs text-zinc-400">Visualização offline e link para clientes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCardapioAberto(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Botão de Visualização Local Offline (Funciona 100% no APK Android) */}
              <button
                type="button"
                onClick={() => {
                  setModalCardapioAberto(false);
                  window.history.pushState({}, '', '?view=cardapio');
                  window.dispatchEvent(new Event('popstate'));
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <Eye className="w-4 h-4 text-black" />
                <span>Visualizar Cardápio no App (100% Offline / Local)</span>
              </button>

              {/* Endereço Web Público */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
                  Link Público para Clientes (HTTPS)
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
                        setCopiadoLink(true);
                        setTimeout(() => setCopiadoLink(false), 3000);
                      } catch {}
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition"
                  >
                    {copiadoLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiadoLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Compartilhamento e Acesso Externo */}
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
                  <span>Enviar no WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const url = gerarUrlCardapioPublico();
                    if (typeof window !== 'undefined') {
                      window.open(url, '_blank');
                    }
                  }}
                  className="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition"
                >
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>Abrir no Navegador</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile (One-Hand Operation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 md:hidden flex items-center justify-around py-1.5 px-2 safe-bottom">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition ${
            currentTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Painel</span>
        </button>

        <button
          onClick={() => setCurrentTab('insumos')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition ${
            currentTab === 'insumos' ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5 mb-0.5" />
          <span>Insumos</span>
        </button>

        <button
          onClick={() => setCurrentTab('pdv')}
          className="flex flex-col items-center -mt-4 bg-gradient-to-tr from-amber-500 to-amber-400 text-zinc-950 p-3 rounded-full shadow-lg shadow-amber-500/30 active:scale-95 transition"
        >
          <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
          <span className="text-[9px] font-extrabold mt-0.5">VENDER</span>
        </button>

        <button
          onClick={() => setCurrentTab('cardapio')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition ${
            currentTab === 'cardapio' ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Cardápio</span>
        </button>

        <button
          onClick={() => setCurrentTab('caixa')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] transition ${
            currentTab === 'caixa' ? 'text-amber-400 font-bold' : 'text-zinc-400'
          }`}
        >
          <Wallet className="w-5 h-5 mb-0.5" />
          <span>Caixa</span>
        </button>
      </nav>
    </>
  );
};
