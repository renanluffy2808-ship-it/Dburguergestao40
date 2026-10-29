import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Scale,
  Package,
  Calendar,
  Layers,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CategoriaInsumo, Insumo } from '../types';
import { UnidadeMedida, validarEConverterUnidades } from '../lib/financialMath';

export const InsumosView: React.FC = () => {
  const { insumos, fornecedores, adicionarInsumo, atualizarInsumo, inativarInsumo, excluirInsumo } = useApp();
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [insumoEdicao, setInsumoEdicao] = useState<Insumo | null>(null);
  const [historicoModalInsumo, setHistoricoModalInsumo] = useState<Insumo | null>(null);
  const [insumoParaExcluir, setInsumoParaExcluir] = useState<Insumo | null>(null);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState<CategoriaInsumo>('carnes');
  const [formUnidadeCompra, setFormUnidadeCompra] = useState<UnidadeMedida>('kg');
  const [formUnidadeConsumo, setFormUnidadeConsumo] = useState<UnidadeMedida>('g');
  const [formFatorConversao, setFormFatorConversao] = useState<number>(1000);
  const [formRendimentoPercent, setFormRendimentoPercent] = useState<number>(100);
  const [formPrecoCompraTotal, setFormPrecoCompraTotal] = useState<number>(0);
  const [formQtdComprada, setFormQtdComprada] = useState<number>(1);
  const [formEstoqueAtual, setFormEstoqueAtual] = useState<number>(0);
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState<number>(1000);
  const [formFornecedor, setFormFornecedor] = useState<string>('');
  const [formDataValidade, setFormDataValidade] = useState<string>('');
  const [formObservacoes, setFormObservacoes] = useState<string>('');
  const [erroForm, setErroForm] = useState<string>('');

  // Ao alterar unidade de compra ou consumo, atualizar o fator de conversão sugerido
  const handleUnidadeChange = (compra: UnidadeMedida, consumo: UnidadeMedida) => {
    setFormUnidadeCompra(compra);
    setFormUnidadeConsumo(consumo);

    const conv = validarEConverterUnidades(compra, consumo);
    if (conv.sucesso) {
      setFormFatorConversao(conv.fator);
      setErroForm('');
    } else {
      if (compra === 'pacote' || compra === 'caixa' || compra === 'fardo') {
        setFormFatorConversao(12); // sugestão inicial
      }
    }
  };

  // Cálculo prévio do custo unitário de consumo
  const convAtual = validarEConverterUnidades(formUnidadeCompra, formUnidadeConsumo, formFatorConversao);
  const fatorEfetivo = convAtual.sucesso ? convAtual.fator : formFatorConversao;
  const qtdTotalConsumoComprada = formQtdComprada * fatorEfetivo;
  const custoBasePorUnidadeConsumo =
    qtdTotalConsumoComprada > 0 ? formPrecoCompraTotal / qtdTotalConsumoComprada : 0;
  // Com perda de preparo (rendimento aproveitável)
  const rendimentoFator = Math.max(1, formRendimentoPercent) / 100;
  const custoRealUnitarioConsumo =
    rendimentoFator > 0 ? custoBasePorUnidadeConsumo / rendimentoFator : custoBasePorUnidadeConsumo;

  const abrirModalCriar = () => {
    setInsumoEdicao(null);
    setFormNome('');
    setFormCategoria('carnes');
    setFormUnidadeCompra('kg');
    setFormUnidadeConsumo('g');
    setFormFatorConversao(1000);
    setFormRendimentoPercent(95);
    setFormPrecoCompraTotal(36.0);
    setFormQtdComprada(1);
    setFormEstoqueAtual(5000);
    setFormEstoqueMinimo(2000);
    setFormFornecedor('');
    setFormDataValidade('');
    setFormObservacoes('');
    setErroForm('');
    setModalNovoAberto(true);
  };

  const abrirModalEditar = (insumo: Insumo) => {
    setInsumoEdicao(insumo);
    setFormNome(insumo.nome);
    setFormCategoria(insumo.categoria);
    setFormUnidadeCompra(insumo.unidadeCompra);
    setFormUnidadeConsumo(insumo.unidadeConsumo);
    setFormFatorConversao(insumo.fatorConversao);
    setFormRendimentoPercent(insumo.rendimentoAproveitavelPercent);
    setFormPrecoCompraTotal(insumo.custoUnitarioConsumo * insumo.fatorConversao);
    setFormQtdComprada(1);
    setFormEstoqueAtual(insumo.estoqueAtual);
    setFormEstoqueMinimo(insumo.estoqueMinimo);
    setFormFornecedor(insumo.fornecedorNome || '');
    setFormDataValidade(insumo.dataValidade || '');
    setFormObservacoes(insumo.observacoes || '');
    setErroForm('');
    setModalNovoAberto(true);
  };

  const salvarForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setErroForm('Informe o nome do insumo.');
      return;
    }

    if (!convAtual.sucesso && formFatorConversao <= 0) {
      setErroForm(
        convAtual.mensagem ||
          'Informe quantas unidades ou gramas estão contidas na embalagem de compra para converter com exatidão.'
      );
      return;
    }

    if (custoRealUnitarioConsumo <= 0) {
      setErroForm('O preço pago deve ser maior que zero para compor o custo da receita.');
      return;
    }

    if (insumoEdicao) {
      atualizarInsumo(insumoEdicao.id, {
        nome: formNome.trim(),
        categoria: formCategoria,
        unidadeCompra: formUnidadeCompra,
        unidadeConsumo: formUnidadeConsumo,
        fatorConversao: formFatorConversao,
        rendimentoAproveitavelPercent: formRendimentoPercent,
        custoUnitarioConsumo: Math.round(custoRealUnitarioConsumo * 10000) / 10000,
        estoqueAtual: formEstoqueAtual,
        estoqueMinimo: formEstoqueMinimo,
        fornecedorNome: formFornecedor.trim(),
        dataValidade: formDataValidade || undefined,
        observacoes: formObservacoes.trim(),
      });
    } else {
      adicionarInsumo({
        nome: formNome.trim(),
        categoria: formCategoria,
        unidadeCompra: formUnidadeCompra,
        unidadeConsumo: formUnidadeConsumo,
        fatorConversao: formFatorConversao,
        rendimentoAproveitavelPercent: formRendimentoPercent,
        custoUnitarioConsumo: Math.round(custoRealUnitarioConsumo * 10000) / 10000,
        estoqueAtual: formEstoqueAtual,
        estoqueMinimo: formEstoqueMinimo,
        fornecedorNome: formFornecedor.trim(),
        dataValidade: formDataValidade || undefined,
        observacoes: formObservacoes.trim(),
        ativo: true,
      });
    }

    setModalNovoAberto(false);
  };

  // Filtragem
  const insumosFiltrados = insumos.filter((ins) => {
    const matchBusca = ins.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCat = filtroCategoria === 'todos' || ins.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header com Busca e Novo Insumo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Insumos & Ingredientes</h2>
          <p className="text-xs text-zinc-400">
            Cadastre carnes, pães, queijos e embalagens com conversão exata e perdas de preparo.
          </p>
        </div>

        <button
          onClick={abrirModalCriar}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Insumo</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar ingrediente ou embalagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['todos', 'carnes', 'paes', 'queijos', 'molhos', 'hortifruti', 'embalagens', 'outros'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                filtroCategoria === cat
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Insumos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumosFiltrados.map((ins) => {
          const estoqueBaixo = ins.estoqueAtual > 0 && ins.estoqueAtual <= ins.estoqueMinimo;
          const estoqueZerado = ins.estoqueAtual <= 0;

          return (
            <div
              key={ins.id}
              className={`p-4 rounded-2xl border transition ${
                !ins.ativo
                  ? 'bg-zinc-900/30 border-zinc-800/40 opacity-60'
                  : estoqueZerado
                  ? 'bg-red-950/20 border-red-800/50'
                  : estoqueBaixo
                  ? 'bg-amber-950/20 border-amber-800/50'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    {ins.categoria}
                  </span>
                  <h3 className="font-extrabold text-sm text-white mt-1.5">{ins.nome}</h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setHistoricoModalInsumo(ins)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                    title="Histórico de Custos"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => abrirModalEditar(ins)}
                    className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition"
                    title="Editar Insumo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setInsumoParaExcluir(ins)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                    title="Excluir Insumo Permanentemente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Custo por {ins.unidadeConsumo}</span>
                  <span className="font-bold text-amber-400">
                    {formatarMoeda(ins.custoUnitarioConsumo)}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    (Rend: {ins.rendimentoAproveitavelPercent}%)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">Estoque Atual</span>
                  <span
                    className={`font-black text-sm ${
                      estoqueZerado
                        ? 'text-red-400'
                        : estoqueBaixo
                        ? 'text-amber-400'
                        : 'text-white'
                    }`}
                  >
                    {ins.estoqueAtual.toLocaleString('pt-BR')} {ins.unidadeConsumo}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    Mínimo: {ins.estoqueMinimo.toLocaleString('pt-BR')} {ins.unidadeConsumo}
                  </span>
                </div>
              </div>

              {ins.fornecedorNome && (
                <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span className="truncate">Fornec: {ins.fornecedorNome}</span>
                  {ins.dataValidade && (
                    <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                      Val: {new Date(ins.dataValidade).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-zinc-800/40 flex items-center justify-between">
                <button
                  onClick={() => inativarInsumo(ins.id)}
                  className={`text-[11px] font-semibold transition ${
                    ins.ativo ? 'text-zinc-500 hover:text-red-400' : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  {ins.ativo ? 'Inativar Insumo' : 'Reativar Insumo'}
                </button>

                {estoqueZerado ? (
                  <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ZERADO
                  </span>
                ) : estoqueBaixo ? (
                  <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ESTOQUE BAIXO
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {insumosFiltrados.length === 0 && (
        <div className="py-12 text-center text-zinc-500 text-xs">
          Nenhum insumo encontrado para os filtros selecionados.
        </div>
      )}

      {/* Modal de Criação / Edição de Insumo */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalNovoAberto(false)} />
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-base text-white">
                {insumoEdicao ? `Editar: ${insumoEdicao.nome}` : 'Cadastrar Novo Insumo'}
              </h3>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={salvarForm} className="mt-4 space-y-4">
              {erroForm && (
                <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{erroForm}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Nome do Insumo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Blend Acém/Peito 150g"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Categoria *</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as CategoriaInsumo)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="carnes">Carnes e Blends</option>
                    <option value="paes">Pães e Massas</option>
                    <option value="queijos">Queijos e Laticínios</option>
                    <option value="molhos">Molhos e Condimentos</option>
                    <option value="hortifruti">Hortifrúti e Saladas</option>
                    <option value="embalagens">Embalagens e Descartáveis</option>
                    <option value="bebidas">Bebidas</option>
                    <option value="outros">Outros Ingredientes</option>
                  </select>
                </div>
              </div>

              {/* Conversão de Unidades */}
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Regra de Conversão de Unidades
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1">
                      Unidade de Compra (Fornecedor)
                    </label>
                    <select
                      value={formUnidadeCompra}
                      onChange={(e) => handleUnidadeChange(e.target.value as UnidadeMedida, formUnidadeConsumo)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                    >
                      <option value="kg">kg (Quilograma)</option>
                      <option value="g">g (Grama)</option>
                      <option value="L">L (Litro)</option>
                      <option value="ml">ml (Mililitro)</option>
                      <option value="unidade">unidade</option>
                      <option value="pacote">pacote</option>
                      <option value="fardo">fardo</option>
                      <option value="caixa">caixa</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 font-medium block mb-1">
                      Unidade de Consumo (Ficha do Lanche)
                    </label>
                    <select
                      value={formUnidadeConsumo}
                      onChange={(e) => handleUnidadeChange(formUnidadeCompra, e.target.value as UnidadeMedida)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                    >
                      <option value="g">g (Grama)</option>
                      <option value="ml">ml (Mililitro)</option>
                      <option value="unidade">unidade</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                </div>

                {/* Fator de Equivalência quando necessário */}
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">
                    Equivalência: 1 {formUnidadeCompra} contém quantas {formUnidadeConsumo}?
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={formFatorConversao}
                    onChange={(e) => setFormFatorConversao(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Ex: Se você compra 1 pacote de pão com 12 unidades, digite 12. Se compra 1 kg de carne e gasta em gramas, digite 1000.
                  </p>
                </div>
              </div>

              {/* Custos e Rendimento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Preço Pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formPrecoCompraTotal}
                    onChange={(e) => setFormPrecoCompraTotal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Qtd Comprada</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={formQtdComprada}
                    onChange={(e) => setFormQtdComprada(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Rendimento Útil (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={formRendimentoPercent}
                    onChange={(e) => setFormRendimentoPercent(parseFloat(e.target.value) || 100)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-0.5">Ex: 95% desconta 5% de quebra.</p>
                </div>
              </div>

              {/* Card de Custo Calculado com Alta Precisão */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-400 font-semibold block">Custo Real por {formUnidadeConsumo}:</span>
                  <span className="text-[11px] text-zinc-400">
                    Calculado com precisão de 4 decimais descontando perdas.
                  </span>
                </div>
                <div className="text-lg font-black text-amber-400 font-mono">
                  {formatarMoeda(custoRealUnitarioConsumo)} / {formUnidadeConsumo}
                </div>
              </div>

              {/* Estoque */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">
                    Estoque Atual ({formUnidadeConsumo})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formEstoqueAtual}
                    onChange={(e) => setFormEstoqueAtual(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">
                    Estoque Mínimo para Alerta ({formUnidadeConsumo})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formEstoqueMinimo}
                    onChange={(e) => setFormEstoqueMinimo(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Fornecedor e Validade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Fornecedor Habitual</label>
                  <input
                    type="text"
                    placeholder="Nome do frigorífico, distribuidora..."
                    value={formFornecedor}
                    onChange={(e) => setFormFornecedor(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Data de Validade (opcional)</label>
                  <input
                    type="date"
                    value={formDataValidade}
                    onChange={(e) => setFormDataValidade(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Instruções de armazenamento, temperatura, corte..."
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20"
                >
                  {insumoEdicao ? 'Salvar Alterações' : 'Cadastrar Insumo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Histórico de Custos */}
      {historicoModalInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setHistoricoModalInsumo(null)} />
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-extrabold text-base text-white">Histórico de Custos</h3>
                <p className="text-xs text-amber-500">{historicoModalInsumo.nome}</p>
              </div>
              <button
                onClick={() => setHistoricoModalInsumo(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {historicoModalInsumo.historicoCustos.map((hist, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{hist.origem}</span>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(hist.data).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400 font-mono block">
                      {formatarMoeda(hist.custoUnitarioConsumo)} / {historicoModalInsumo.unidadeConsumo}
                    </span>
                    {hist.precoPago > 0 && (
                      <span className="text-[10px] text-zinc-400">
                        Total pago: {formatarMoeda(hist.precoPago)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Insumo */}
      {insumoParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setInsumoParaExcluir(null)} />
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-zinc-800">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">Excluir Insumo</h3>
            </div>

            <p className="mt-4 text-xs text-zinc-300 leading-relaxed">
              Deseja realmente excluir permanentemente o insumo <strong className="text-white">"{insumoParaExcluir.nome}"</strong>? 
              O histórico de custos e estoque deste ingrediente serão removidos.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInsumoParaExcluir(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  excluirInsumo(insumoParaExcluir.id);
                  setInsumoParaExcluir(null);
                }}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
