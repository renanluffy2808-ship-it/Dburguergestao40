import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  FileCode,
  Folder,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Terminal,
  HelpCircle,
  Layers,
  Sparkles,
  Github,
  Zap,
  Share2,
  Home,
  Monitor,
  Flame,
} from 'lucide-react';
import { getAndroidProjectFiles, gerarZipProjetoAndroid, AndroidFile } from '../lib/androidProjectGenerator';
import { getAdminAuthHeader } from '../lib/authService';

export const AndroidProjectView: React.FC = () => {
  const [arquivos] = useState<AndroidFile[]>(() => getAndroidProjectFiles());
  const [arquivoSelecionado, setArquivoSelecionado] = useState<AndroidFile>(arquivos[0]);
  const [baixandoZip, setBaixandoZip] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [abaInstrucao, setAbaInstrucao] = useState<'render' | 'oquee' | 'celular' | 'atalho' | 'computador' | 'arquivos'>('render');

  const baixarZip = async () => {
    try {
      setBaixandoZip(true);
      // Tenta primeiro o download direto pelo servidor (mais rápido e 100% confiável)
      const res = await fetch('/api/android/download-project-zip', {
        headers: getAdminAuthHeader(),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dburger-gestao-completo-v2.6.0.zip`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {}

    // Fallback: empacotamento local no cliente via JSZip
    try {
      const blob = await gerarZipProjetoAndroid();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dburger-gestao-completo-v2.6.0.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao gerar ZIP:', e);
    } finally {
      setBaixandoZip(false);
    }
  };

  const copiarCodigo = () => {
    if (arquivoSelecionado) {
      navigator.clipboard.writeText(arquivoSelecionado.content);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Aviso de Honestidade Técnica */}
      <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-4 text-emerald-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-sm text-white">
              Versão 2.6.0 — APK 100% Autônomo com Assets Embutidos
            </h3>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              O problema da tela preta foi diagnosticado e eliminado: o aplicativo Android agora é 100% autônomo e carrega seus próprios arquivos de produção embutidos no APK (<code>app.js</code> e <code>app.css</code>). Ele abre imediatamente, não depende de URLs remotas instáveis e salva todos os seus dados em banco local!
            </p>
          </div>
        </div>
      </div>

      {/* Botão de Download do Projeto Completo em ZIP */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
            v2.6.0 Oficial • APK Android (Design 100% Idêntico ao Preview • Offline Nativo)
          </span>
          <h2 className="text-xl font-extrabold text-white mt-1.5">
            D’ Burger Gestão — Projeto Android Completo
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Código-fonte e assets de produção 100% sincronizados: Cardápio Digital personalizado, Fotos, Insumos, Compras, PDV com baixa automática, Fluxo de Caixa nas 3 gavetas, Estoque, Relatórios e Configurações.
          </p>
        </div>

        <button
          onClick={baixarZip}
          disabled={baixandoZip}
          className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition shrink-0"
        >
          <Download className={`w-4 h-4 ${baixandoZip ? 'animate-bounce' : ''}`} />
          <span>{baixandoZip ? 'Compactando...' : 'Baixar Projeto Completo (.ZIP)'}</span>
        </button>
      </div>

      {/* Seletor de Guias com Destaque para Render e GitHub */}
      <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setAbaInstrucao('render')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'render'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 text-cyan-400" />
          <span>Publicar no Render (Backend Online)</span>
        </button>

        <button
          onClick={() => setAbaInstrucao('oquee')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'oquee'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>O que é o GitHub? (Explicação Simples)</span>
        </button>

        <button
          onClick={() => setAbaInstrucao('atalho')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'atalho'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>Usar no Celular AGORA (Sem Compilar)</span>
        </button>

        <button
          onClick={() => setAbaInstrucao('celular')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'celular'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Github className="w-4 h-4" />
          <span>Gerar APK pelo GitHub (Robô na Nuvem)</span>
        </button>

        <button
          onClick={() => setAbaInstrucao('computador')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'computador'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>Compilar no PC (Android Studio)</span>
        </button>

        <button
          onClick={() => setAbaInstrucao('arquivos')}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            abaInstrucao === 'arquivos'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Ver Códigos ({arquivos.length} arquivos)</span>
        </button>
      </div>

      {/* ABA 0: PUBLICAR NO RENDER (BACKEND ONLINE 100% PÚBLICO) */}
      {abaInstrucao === 'render' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Como Publicar o Backend no Render (Passo a Passo pelo Celular)
              </h3>
              <p className="text-xs text-zinc-400">
                Obtenha uma URL pública HTTPS permanente e gratuita para seu cardápio e APK sem qualquer barreira de login da conta Google.
              </p>
            </div>
          </div>

          <div className="p-4 bg-cyan-950/30 border border-cyan-800/50 rounded-2xl text-xs text-cyan-200 space-y-2">
            <div className="font-bold flex items-center gap-2 text-cyan-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>Arquivos de Deploy Já Configurados no ZIP do Projeto:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-cyan-200/90 text-[11px]">
              <li><code>render.yaml</code> na raiz: Define build <code>npm install && npm run build</code> e inicialização <code>npm start</code>.</li>
              <li><code>Dockerfile</code> e <code>.dockerignore</code>: Caso prefira rodar via contêiner universal.</li>
              <li><code>server.ts</code> otimizado: Suporta a porta dinâmica (<code>process.env.PORT</code>), rota de saúde <code>/api/health</code> e CORS aberto.</li>
              <li><code>data/store.json</code>: Inclui todos os 21 produtos oficiais, categorias e adicionais de fábrica.</li>
            </ul>
          </div>

          <div className="space-y-3 text-xs text-zinc-300">
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">1</span>
                <span>Baixe o ZIP e Envie para o seu Repositório GitHub</span>
              </div>
              <p className="text-zinc-400 pl-7 leading-relaxed">
                Toque no botão amarelo <strong>"Baixar Projeto Completo (.ZIP)"</strong> no topo desta página. Descompacte o arquivo e envie todo o conteúdo para um novo repositório seu no GitHub (ex: <code>dburger-gestao</code>).
              </p>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[10px] font-black">2</span>
                <span>Acesse o Render e Crie um Web Service</span>
              </div>
              <p className="text-zinc-400 pl-7 leading-relaxed">
                Pelo celular ou computador, acesse <a href="https://render.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline font-bold">render.com</a>, faça login com sua conta GitHub, toque em <strong>"New +"</strong> e selecione <strong>"Web Service"</strong>.
              </p>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black">3</span>
                <span>Conecte o Repositório e Confirme</span>
              </div>
              <p className="text-zinc-400 pl-7 leading-relaxed">
                Selecione o seu repositório <code>dburger-gestao</code>. O Render lerá o <code>render.yaml</code> automaticamente. Escolha o plano <strong>Free</strong> e toque em <strong>"Create Web Service"</strong>.
              </p>
            </div>

            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-purple-500 text-black flex items-center justify-center text-[10px] font-black">4</span>
                <span>Copie a URL Pública Gerada e Configure no App</span>
              </div>
              <p className="text-zinc-400 pl-7 leading-relaxed">
                O Render gerará um endereço público seguro (ex: <code>https://dburger-gestao.onrender.com</code>). Copie essa URL, vá na aba <strong>Configurações &gt; Servidor Online</strong> deste aplicativo (ou no seu APK), toque em <strong>"Alterar URL"</strong>, cole o endereço e salve!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 1: O QUE É O GITHUB (EXPLICAÇÃO CLARA E DIDÁTICA) */}
      {abaInstrucao === 'oquee' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Entenda o que é o GitHub com a Analogia da Hamburgueria
              </h3>
              <p className="text-xs text-zinc-400">
                Uma explicação sem palavras difíceis para quem gerencia uma chapa e não programa computador.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Bloco 1 */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-amber-500 block">1. O Código-Fonte</span>
              <h4 className="font-bold text-sm text-white">É a Ficha Técnica / Receita Escrita</h4>
              <p className="text-zinc-400 leading-relaxed">
                Tudo o que criamos aqui (Kotlin, contas, telas) é como a <strong>receita anotada no caderno</strong>: 
                diz exatamente quais ingredientes misturar e como montar cada lanche. Mas o celular não sabe "comer" papel.
              </p>
            </div>

            {/* Bloco 2 */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-blue-400 block">2. O Arquivo APK</span>
              <h4 className="font-bold text-sm text-white">É o Hambúrguer Pronto na Caixa</h4>
              <p className="text-zinc-400 leading-relaxed">
                O <strong>APK</strong> é o lanche pronto, embalado e quentinho, pronto para o cliente instalar e usar. 
                Para transformar a receita em hambúrguer pronto, você precisa de uma <strong>chapa industrial</strong> (chamada <em>Compilador Android</em>).
              </p>
            </div>

            {/* Bloco 3 */}
            <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-bold uppercase text-emerald-400 block">3. O GitHub</span>
              <h4 className="font-bold text-sm text-white">É uma Cozinha Industrial Grátis</h4>
              <p className="text-zinc-400 leading-relaxed">
                O <strong>GitHub</strong> é um site da Microsoft onde as pessoas guardam programas. Ele possui <strong>computadores-robôs gratuitos na nuvem</strong> (chamados <em>GitHub Actions</em>) que têm essa chapa instalada. Eles pegam a receita do D' Burger e assam o APK para você, de graça!
              </p>
            </div>
          </div>

          {/* Comparativo de Opções */}
          <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Qual é o melhor caminho para você hoje?</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <button
                onClick={() => setAbaInstrucao('atalho')}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/40 rounded-xl text-left transition"
              >
                <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
                  <span>Caminho Mais Fácil (Recomendado)</span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <strong className="text-white block">Instalar direto pelo Chrome</strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Sem mexer com GitHub ou computador. Funciona offline em tela cheia na hora.
                </p>
              </button>

              <button
                onClick={() => setAbaInstrucao('celular')}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition"
              >
                <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                  <span>Gerar o Arquivo .APK</span>
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <strong className="text-white block">Robô do GitHub</strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Se você faz questão do arquivo com final <code className="text-white">.apk</code> para guardar ou enviar.
                </p>
              </button>

              <button
                onClick={() => setAbaInstrucao('computador')}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition"
              >
                <div className="flex items-center justify-between text-blue-400 font-bold mb-1">
                  <span>Tem um Amigo com PC?</span>
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <strong className="text-white block">Android Studio</strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Envie o arquivo ZIP para alguém que tenha computador: gera o APK em 1 minuto.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: USAR NO CELULAR AGORA MESMO (ATALHO / PWA) */}
      {abaInstrucao === 'atalho' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Como usar o D’ Burger no seu celular AGORA (Sem complicação)
              </h3>
              <p className="text-xs text-zinc-400">
                Você não precisa compilar nada para ter o aplicativo com ícone na tela do seu celular e funcionando sem internet!
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-zinc-300">
            <div className="flex items-start gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-black flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <strong className="text-white block">Abra este link no Google Chrome do seu celular</strong>
                <p className="text-zinc-400 mt-0.5">
                  Copie o link desta página e abra no navegador Google Chrome do seu aparelho Android.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-black flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <strong className="text-white block">Toque nos 3 pontinhos (⋮) no canto superior direito do Chrome</strong>
                <p className="text-zinc-400 mt-0.5">
                  Vai abrir o menu de opções do navegador.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-black flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <strong className="text-white block">Toque em "Adicionar à tela inicial" ou "Instalar aplicativo"</strong>
                <p className="text-zinc-400 mt-0.5">
                  O Chrome criará o ícone do <strong>D’ Burger Gestão</strong> direto na tela inicial do seu celular, junto com seus outros aplicativos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-zinc-950 font-black flex items-center justify-center shrink-0">
                4
              </span>
              <div>
                <strong className="text-white block">Pronto! Use em tela cheia e offline</strong>
                <p className="text-zinc-400 mt-0.5">
                  Ele abre como um app normal (sem barra de pesquisa), funciona mesmo se você desligar o Wi-Fi e salva tudo na memória do aparelho.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PASSO A PASSO GITHUB ACTIONS (COMPILAR APK NA NUVEM) */}
      {abaInstrucao === 'celular' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Passo a Passo: Como o Robô do GitHub Cria o APK Para Você
              </h3>
              <p className="text-xs text-zinc-400">
                Um guia detalhado com o que você deve clicar caso queira gerar o arquivo .apk instalável.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-zinc-300">
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                  1
                </span>
                <span>Baixe o arquivo ZIP no botão amarelo acima</span>
              </div>
              <p className="text-zinc-400 pl-7">
                Clique no botão amarelo <strong>"Baixar Projeto Completo (.ZIP)"</strong> no topo desta página. Ele vai salvar um arquivo chamado <code className="text-white">dburger-gestao-android-nativo.zip</code> na pasta de Downloads do seu celular.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                <span>Crie uma conta gratuita no GitHub</span>
              </div>
              <p className="text-zinc-400 pl-7">
                Abra o site <a href="https://github.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold">github.com</a> no navegador do seu celular e faça um cadastro simples com seu e-mail (é 100% gratuito).
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                  3
                </span>
                <span>Crie uma pasta chamada "Repositório"</span>
              </div>
              <p className="text-zinc-400 pl-7">
                No GitHub, toque no botão verde <strong>"New"</strong> (Novo) ou no sinal de <strong>+</strong> e escolha <strong>"New repository"</strong>. Coloque o nome <code className="text-white">dburger-gestao</code> e toque no botão verde no final da página <strong>"Create repository"</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                  4
                </span>
                <span>Envie os arquivos (Upload)</span>
              </div>
              <p className="text-zinc-400 pl-7">
                Na página que abrir, toque em <strong>"uploading an existing file"</strong> (enviar um arquivo existente). Selecione os arquivos descompactados do ZIP.
              </p>
            </div>

            {/* CAIXA DE AJUDA ESPECÍFICA: QUANDO APARECEM PLUGINS / TEMPLATES */}
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Está vendo apenas plugins ou sugestões na aba Actions? (Resolva em 1 minuto)</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                Isso acontece porque o celular não enviou a pasta oculta <code className="text-amber-400">.github</code>. Não tem problema! Para resolver em 30 segundos:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-zinc-300">
                <li>
                  Na tela de Actions (onde estão os plugins), procure e clique no link pequeno: <strong className="text-white underline">"set up a workflow yourself -&gt;"</strong>.
                </li>
                <li>
                  Vai abrir uma tela de texto. Apague o que estiver lá e cole o código do robô abaixo.
                </li>
                <li>
                  Clique no botão verde no canto superior direito: <strong className="text-emerald-400">"Commit changes..."</strong>.
                </li>
              </ol>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const yamlCode = `name: Build Android APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build:
    name: Compilar APK Android
    runs-on: ubuntu-latest

    steps:
    - name: Baixar codigo do repositorio
      uses: actions/checkout@v4

    - name: Extrair ZIP ou organizar arquivos
      run: |
        if ls *.zip 1> /dev/null 2>&1; then
          echo "Arquivo ZIP detectado! Descompactando..."
          unzip -o *.zip
        fi
        if [ ! -f "settings.gradle.kts" ] && [ ! -f "settings.gradle" ]; then
          SUBDIR=$(find . -maxdepth 2 -name "settings.gradle*" -exec dirname {} \\; | head -n 1)
          if [ -n "$SUBDIR" ] && [ "$SUBDIR" != "." ]; then
            echo "Movendo arquivos de $SUBDIR para a raiz..."
            cp -r $SUBDIR/* .
          fi
        fi

    - name: Configurar Java 17
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Instalar Gradle 8.5
      uses: gradle/actions/setup-gradle@v4
      with:
        gradle-version: '8.5'
        cache-disabled: true

    - name: Aceitar Licencas do Android SDK
      run: |
        yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses || true
        echo "sdk.dir=$ANDROID_HOME" > local.properties

    - name: Limpar e Recriar Recursos XML
      run: |
        rm -rf app/src/main/res/values/*
        mkdir -p app/src/main/res/values
        echo '<?xml version="1.0" encoding="utf-8"?>' > app/src/main/res/values/strings.xml
        echo '<resources><string name="app_name">DBurger Gestao</string></resources>' >> app/src/main/res/values/strings.xml
        echo '<?xml version="1.0" encoding="utf-8"?>' > app/src/main/res/values/themes.xml
        echo '<resources><style name="Theme.DBurgerGestao" parent="@android:style/Theme.Material.NoActionBar" /></resources>' >> app/src/main/res/values/themes.xml
        touch app/proguard-rules.pro

    - name: Compilar APK Android
      run: |
        chmod +x gradlew 2>/dev/null || true
        gradle assembleDebug --no-daemon --stacktrace

    - name: Salvar APK para Download
      uses: actions/upload-artifact@v4
      with:
        name: dburger-gestao-apk
        path: app/build/outputs/apk/debug/*.apk
`;
                    navigator.clipboard.writeText(yamlCode);
                    alert('Código definitivo copiado! Cole no seu GitHub no arquivo .github/workflows/main.yml e clique em Commit changes.');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-md"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Código Definitivo do Robô</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center text-[10px] font-black">
                  5
                </span>
                <span>O Robô compila e te entrega o APK</span>
              </div>
              <p className="text-zinc-400 pl-7">
                Assim que você fizer isso, volte na aba <strong>"Actions"</strong>. A engrenagem amarela estará rodando! Em 2 minutos fica verde ✅. Toque nela e baixe o arquivo <strong>dburger-gestao-debug-apk</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: ANDROID STUDIO NO COMPUTADOR */}
      {abaInstrucao === 'computador' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Como Compilar Usando um Computador (Android Studio)
              </h3>
              <p className="text-xs text-zinc-400">
                Se você ou alguém da sua família tiver um notebook, este é o jeito mais rápido de gerar o APK.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-zinc-300">
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-white block">1. Descompacte o arquivo ZIP</strong>
              <p className="text-zinc-400 mt-1">
                Extraia a pasta <code className="text-white">dburger-gestao-android-nativo.zip</code> no computador.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-white block">2. Abra o Android Studio</strong>
              <p className="text-zinc-400 mt-1">
                Clique em <strong>File &gt; Open</strong> e selecione a pasta extraída. O Android Studio vai ler os arquivos e baixar as dependências automaticamente.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-white block">3. Clique em Gerar APK</strong>
              <p className="text-zinc-400 mt-1">
                No menu superior, vá em: <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <strong className="text-white block">4. Envie para o WhatsApp do seu celular</strong>
              <p className="text-zinc-400 mt-1">
                O arquivo <code className="text-emerald-400 font-mono">app-debug.apk</code> estará na pasta <code className="text-zinc-400">app/build/outputs/apk/debug/</code>. Basta enviar para você mesmo pelo WhatsApp Web e tocar para instalar no celular!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: EXPLORADOR DE CÓDIGO NATIVO */}
      {abaInstrucao === 'arquivos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 max-h-[550px] overflow-y-auto">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3">
              Arquivos Gerados ({arquivos.length})
            </span>
            <div className="space-y-1">
              {arquivos.map((arq) => (
                <button
                  key={arq.path}
                  onClick={() => setArquivoSelecionado(arq)}
                  className={`w-full text-left p-2 rounded-xl text-xs transition flex items-center justify-between ${
                    arquivoSelecionado.path === arq.path
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="truncate font-mono text-[11px]">{arq.path}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h4 className="font-extrabold text-xs text-white font-mono">{arquivoSelecionado.path}</h4>
                  <p className="text-[11px] text-zinc-500">{arquivoSelecionado.description}</p>
                </div>
                <button
                  onClick={copiarCodigo}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiado ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiado ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="mt-3 p-3 bg-zinc-900/90 rounded-xl text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[440px] leading-relaxed border border-zinc-800/60">
                {arquivoSelecionado.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
