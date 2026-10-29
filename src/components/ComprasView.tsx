import React, { useState, useRef } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Camera,
  Upload,
  Calendar,
  Building2,
  DollarSign,
  ArrowRight,
  Eye,
  Info,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CompraNota, ItemCompra } from '../types';
import { UnidadeMedida, validarEConverterUnidades, calcularCustoMedioPonderado } from '../lib/financialMath';

export const ComprasView: React.FC = () => {
  const { compras, insumos, fornecedores, salvarCompraConfirmada } = useApp();
  const [modalNovaCompra, setModalNovaCompra] = useState(false);
  const [compraDetalhe, setCompraDetalhe] = useState<CompraNota | null>(null);
  const [busca, setBusca] = useState('');

  // Form states
  const [numeroNota, setNumeroNota] = useState('');
  const [semNumeroNota, setSemNumeroNota] = useState(false);
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0]);
  const [valorTotalInformado, setValorTotalInformado] = useState<number>(0);
  const [observacoes, setObservacoes] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string>('');
  const [modalFotoAmpliada, setModalFotoAmpliada] = useState<string | null>(null);
  const fileGaleriaRef = useRef<HTMLInputElement>(null);
  const fileCameraRef = useRef<HTMLInputElement>(null);

  // Itens da compra atual
  const [itens, setItens] = useState<ItemCompra[]>([]);

  // Item sendo adicionado no formulário
  const [itemInsumoId, setItemInsumoId] = useState('');
  const [itemQtd, setItemQtd] = useState<number>(1);
  const [itemUnidade, setItemUnidade] = useState<UnidadeMedida>('kg');
  const [itemPrecoUnitario, setItemPrecoUnitario] = useState<number>(0);
  const [itemDesconto, setItemDesconto] = useState<number>(0);
  const [itemAcrescimo, setItemAcrescimo] = useState<number>(0);

  const [erroMsg, setErroMsg] = useState('');
  const [sucessoMsg, setSucessoMsg] = useState('');

  // Quando o usuário escolhe um insumo, preenche a unidade de compra padrão dele
  const handleSelecionarInsumo = (insId: string) => {
    setItemInsumoId(insId);
    const ins = insumos.find((i) => i.id === insId);
    if (ins) {
      setItemUnidade(ins.unidadeCompra);
      setItemPrecoUnitario(ins.custoUnitarioConsumo * ins.fatorConversao);
    }
  };

  const adicionarItemNaLista = () => {
    if (!itemInsumoId) {
      setErroMsg('Selecione um insumo para o item.');
      return;
    }
    const ins = insumos.find((i) => i.id === itemInsumoId);
    if (!ins) return;

    if (itemQtd <= 0 || itemPrecoUnitario <= 0) {
      setErroMsg('Quantidade e Preço Unitário devem ser maiores que zero.');
      return;
    }

    const subtotalBruto = itemQtd * itemPrecoUnitario;
    const subtotalFinal = Math.max(0, subtotalBruto - itemDesconto + itemAcrescimo);

    const novoItem: ItemCompra = {
      insumoId: ins.id,
      insumoNome: ins.nome,
      quantidadeCompra: itemQtd,
      unidadeCompra: itemUnidade,
      precoUnitarioCompra: itemPrecoUnitario,
      desconto: itemDesconto,
      acrescimo: itemAcrescimo,
      subtotal: Math.round(subtotalFinal * 100) / 100,
    };

    setItens((prev) => [...prev, novoItem]);

    // Atualiza automaticamente o valor total informado se estiver zerado
    if (valorTotalInformado === 0) {
      setValorTotalInformado(novoItem.subtotal);
    } else {
      setValorTotalInformado((prev) => prev + novoItem.subtotal);
    }

    // Reset campos do item
    setItemInsumoId('');
    setItemQtd(1);
    setItemPrecoUnitario(0);
    setItemDesconto(0);
    setItemAcrescimo(0);
    setErroMsg('');
  };

  const removerItemDaLista = (index: number) => {
    const itemRemovido = itens[index];
    setItens((prev) => prev.filter((_, i) => i !== index));
    if (valorTotalInformado > 0 && itemRemovido) {
      setValorTotalInformado((prev) => Math.max(0, prev - itemRemovido.subtotal));
    }
  };

  const totalSomaItens = itens.reduce((acc, it) => acc + it.subtotal, 0);
  const diferencaConferencia = Math.abs(valorTotalInformado - totalSomaItens);

  const salvarCompra = () => {
    if (itens.length === 0) {
      setErroMsg('Adicione pelo menos um item à compra.');
      return;
    }

    if (!fornecedorNome.trim()) {
      setErroMsg('Informe o nome do fornecedor da compra.');
      return;
    }

    if (diferencaConferencia > 0.05) {
      setErroMsg(
        `A soma dos itens (R$ ${totalSomaItens.toFixed(2)}) é diferente do total informado (R$ ${valorTotalInformado.toFixed(2)}). Corrija antes de confirmar para evitar distorção no custo médio.`
      );
      return;
    }

    const res = salvarCompraConfirmada({
      numeroNota: semNumeroNota ? 'S/N' : numeroNota.trim() || 'S/N',
      data: dataCompra,
      fornecedorNome: fornecedorNome.trim(),
      valorTotalInformado,
      valorSomaItens: totalSomaItens,
      itens,
      conferido: true,
      observacoes,
      fotoComprovanteUrl: fotoUrl || undefined,
    });

    if (res.sucesso) {
      setSucessoMsg('Compra confirmada com sucesso! Estoque e custo médio atualizados.');
      setTimeout(() => {
        setModalNovaCompra(false);
        setSucessoMsg('');
        setItens([]);
        setNumeroNota('');
        setFornecedorNome('');
        setValorTotalInformado(0);
        setObservacoes('');
        setFotoUrl('');
      }, 1200);
    } else {
      setErroMsg(res.erro || 'Erro ao registrar compra.');
    }
  };

  // Processamento de Foto de Nota Fiscal (Permanente em Base64 e Suporte a Câmera / Galeria no Android)
  const processarFotoComprovante = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErroMsg('Por favor, selecione um arquivo de imagem válido (JPEG, PNG).');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setFotoUrl(base64);
        setSucessoMsg(
          'Foto da nota fiscal anexada com sucesso! Confira os itens e preços antes de confirmar.'
        );
        setErroMsg('');
      };
      reader.onerror = () => {
        setErroMsg('Não foi possível ler a imagem selecionada.');
      };
      reader.readAsDataURL(file);
    } catch {
      setErroMsg('Erro ao processar imagem.');
    }
  };

  const formatarMoeda = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const comprasFiltradas = compras.filter((c) => {
    return (
      c.fornecedorNome.toLowerCase().includes(busca.toLowerCase()) ||
      c.numeroNota.toLowerCase().includes(busca.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-extrabold text-white">Notas Fiscais & Compras de Insumos</h2>
          <p className="text-xs text-zinc-400">
            Lançamento com conferência de soma, cálculo de Custo Médio Ponderado (CMP) e entrada de estoque.
          </p>
        </div>

        <button
          onClick={() => {
            setItens([]);
            setModalNovaCompra(true);
            setErroMsg('');
            setSucessoMsg('');
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Lançar Nova Compra / NF</span>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar compra por fornecedor ou número de nota..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Lista de Compras */}
      <div className="space-y-3">
        {comprasFiltradas.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-2xl border border-zinc-800">
            Nenhuma compra registrada. Clique em "Lançar Nova Compra" para dar entrada em carnes, pães e embalagens!
          </div>
        ) : (
          comprasFiltradas.map((compra) => (
            <div
              key={compra.id}
              className="p-4 bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">{compra.fornecedorNome}</span>
                    <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded font-mono text-zinc-300">
                      NF: {compra.numeroNota}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(compra.data).toLocaleDateString('pt-BR')} • {compra.itens.length} iten(s)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-zinc-500 block">Valor Total</span>
                  <span className="font-black text-sm text-amber-400 font-mono">
                    {formatarMoeda(compra.valorTotalInformado)}
                  </span>
                </div>

                <button
                  onClick={() => setCompraDetalhe(compra)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Itens</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nova Compra com Múltiplos Itens */}
      {modalNovaCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setModalNovaCompra(false)} />
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-extrabold text-base text-white">Lançar Compra / Nota Fiscal</h3>
              <button
                onClick={() => setModalNovaCompra(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            {erroMsg && (
              <div className="mt-4 p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{erroMsg}</span>
              </div>
            )}

            {sucessoMsg && (
              <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{sucessoMsg}</span>
              </div>
            )}

            {/* Cabeçalho da Nota */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Fornecedor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Frigorífico Boi Gordo"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Data da Compra</label>
                  <input
                    type="date"
                    value={dataCompra}
                    onChange={(e) => setDataCompra(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-zinc-400 font-medium">Número da Nota Fiscal</label>
                    <label className="text-[11px] text-zinc-400 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={semNumeroNota}
                        onChange={(e) => setSemNumeroNota(e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      Sem número (S/N)
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={semNumeroNota}
                    placeholder={semNumeroNota ? 'Compra sem nota' : 'Ex: 10459'}
                    value={semNumeroNota ? '' : numeroNota}
                    onChange={(e) => setNumeroNota(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">
                    Valor Total Informado na Nota (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={valorTotalInformado || ''}
                    onChange={(e) => setValorTotalInformado(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Upload Foto / Comprovante (Galeria & Câmera 100% compatível com Android) */}
              <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Comprovante / Foto da Nota Fiscal</span>
                  </div>
                  {fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="text-[11px] text-rose-400 hover:underline font-bold"
                    >
                      Remover Foto
                    </button>
                  )}
                </div>

                {fotoUrl ? (
                  <div className="flex items-center gap-3 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                    <img
                      src={fotoUrl}
                      alt="Comprovante"
                      onClick={() => setModalFotoAmpliada(fotoUrl)}
                      className="w-14 h-14 rounded-lg object-cover cursor-pointer border border-zinc-700 hover:opacity-80 transition shrink-0"
                      title="Clique para ampliar"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-emerald-400 font-bold block">Foto da nota anexada!</span>
                      <button
                        type="button"
                        onClick={() => setModalFotoAmpliada(fotoUrl)}
                        className="text-[11px] text-amber-400 hover:underline mt-0.5 inline-block"
                      >
                        Ver foto ampliada
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    Tire uma foto ou selecione da galeria para conferência dos preços e insumos.
                  </p>
                )}

                <input
                  type="file"
                  ref={fileGaleriaRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => processarFotoComprovante(e.target.files?.[0])}
                />
                <input
                  type="file"
                  ref={fileCameraRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => processarFotoComprovante(e.target.files?.[0])}
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileGaleriaRef.current?.click()}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Galeria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileCameraRef.current?.click()}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-zinc-700 transition active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tirar Foto</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Adicionar Itens */}
            <div className="mt-5 p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Itens Comprados (Atualizam Custo Médio e Estoque)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-zinc-400 block mb-0.5">Insumo Cadastrado</label>
                  <select
                    value={itemInsumoId}
                    onChange={(e) => handleSelecionarInsumo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                  >
                    <option value="">Selecione um insumo...</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome} ({i.categoria})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-0.5">Unidade</label>
                  <select
                    value={itemUnidade}
                    onChange={(e) => setItemUnidade(e.target.value as UnidadeMedida)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="unidade">unidade</option>
                    <option value="pacote">pacote</option>
                    <option value="fardo">fardo</option>
                    <option value="caixa">caixa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-0.5">Qtd Comprada</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={itemQtd}
                    onChange={(e) => setItemQtd(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-0.5">Preço Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={itemPrecoUnitario}
                    onChange={(e) => setItemPrecoUnitario(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-0.5">Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemDesconto}
                    onChange={(e) => setItemDesconto(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={adicionarItemNaLista}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabela de Itens Adicionados */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-zinc-400 block">Itens na Compra ({itens.length})</span>
              {itens.length === 0 ? (
                <div className="py-4 text-center text-zinc-600 text-xs">Nenhum item adicionado à lista.</div>
              ) : (
                itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{it.insumoNome}</span>
                      <span className="text-[11px] text-zinc-400">
                        {it.quantidadeCompra} {it.unidadeCompra} × {formatarMoeda(it.precoUnitarioCompra)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-black text-amber-400 font-mono">{formatarMoeda(it.subtotal)}</span>
                      <button
                        type="button"
                        onClick={() => removerItemDaLista(idx)}
                        className="text-zinc-500 hover:text-red-400 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Painel de Conferência de Valores */}
            <div
              className={`mt-5 p-3 rounded-xl border flex items-center justify-between text-xs ${
                diferencaConferencia <= 0.05
                  ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300'
                  : 'bg-red-950/30 border-red-800/60 text-red-300'
              }`}
            >
              <div>
                <span className="font-bold block">Conferência da Nota Fiscal</span>
                <span className="text-[11px] opacity-80">
                  Total Informado: {formatarMoeda(valorTotalInformado)} | Soma dos Itens: {formatarMoeda(totalSomaItens)}
                </span>
              </div>
              {diferencaConferencia <= 0.05 ? (
                <span className="font-extrabold flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Valores Batendo!
                </span>
              ) : (
                <span className="font-extrabold flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-4 h-4" /> Diferença de {formatarMoeda(diferencaConferencia)}
                </span>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNovaCompra(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarCompra}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-amber-500/20"
              >
                Confirmar Compra & Atualizar Estoque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes de Compra Existente */}
      {compraDetalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setCompraDetalhe(null)} />
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="font-extrabold text-base text-white">{compraDetalhe.fornecedorNome}</h3>
                <p className="text-xs text-amber-500">
                  NF: {compraDetalhe.numeroNota} • Data: {new Date(compraDetalhe.data).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setCompraDetalhe(null)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 bg-zinc-800 rounded-md"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-zinc-400 block">Itens Desta Compra</span>
              {compraDetalhe.itens.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{it.insumoNome}</span>
                    <span className="text-[11px] text-zinc-400">
                      {it.quantidadeCompra} {it.unidadeCompra} × {formatarMoeda(it.precoUnitarioCompra)}
                    </span>
                  </div>
                  <span className="font-bold text-amber-400 font-mono">{formatarMoeda(it.subtotal)}</span>
                </div>
              ))}
            </div>

            {compraDetalhe.fotoComprovanteUrl && (
              <div className="mt-4 pt-3 border-t border-zinc-800 space-y-1.5">
                <span className="text-xs font-semibold text-zinc-400 block">Comprovante Anexado:</span>
                <div className="flex items-center gap-3 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <img
                    src={compraDetalhe.fotoComprovanteUrl}
                    alt="Comprovante"
                    onClick={() => setModalFotoAmpliada(compraDetalhe.fotoComprovanteUrl!)}
                    className="w-16 h-16 rounded-lg object-cover cursor-pointer border border-zinc-700 hover:opacity-80 transition"
                  />
                  <div className="text-xs">
                    <span className="text-emerald-400 font-bold block">Foto disponível</span>
                    <button
                      type="button"
                      onClick={() => setModalFotoAmpliada(compraDetalhe.fotoComprovanteUrl!)}
                      className="text-amber-400 hover:underline text-[11px]"
                    >
                      Ver comprovante em tamanho real
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
              <span className="text-zinc-400">Valor Total Pago:</span>
              <span className="font-black text-sm text-white font-mono">
                {formatarMoeda(compraDetalhe.valorTotalInformado)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Foto Ampliada */}
      {modalFotoAmpliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setModalFotoAmpliada(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setModalFotoAmpliada(null)}
              className="absolute -top-10 right-0 p-1.5 text-white bg-zinc-800 hover:bg-zinc-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={modalFotoAmpliada}
              alt="Comprovante"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-zinc-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
