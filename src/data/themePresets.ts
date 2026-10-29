import { CardapioThemeConfig } from '../types';
import { TEMA_CARDAPIO_PADRAO } from './initialData';

export interface ThemePreset {
  id: string;
  nome: string;
  descricao: string;
  corAmostra: string;
  theme: Partial<CardapioThemeConfig>;
}

export const PRESETS_TEMA_CARDAPIO: ThemePreset[] = [
  {
    id: 'dburger-classico',
    nome: "D’ Burger Noturno (Padrão)",
    descricao: 'Dark mode elegante com detalhes dourados em âmbar. Ideal para hamburguerias artesanais e smash.',
    corAmostra: '#f59e0b',
    theme: {
      ...TEMA_CARDAPIO_PADRAO,
      nomeLoja: "D’ Burger",
      subtituloLoja: "Hambúrgueres Artesanais & Smash",
      fundoTipo: 'solido',
      corFundo: '#09090b',
      corFundoSecao: '#18181b',
      corBordaCartao: '#27272a',
      corTextoPrincipal: '#ffffff',
      corTextoSecundario: '#a1a1aa',
      corDestaque: '#f59e0b',
      corPreco: '#f59e0b',
      corBotao: '#f59e0b',
      corTextoBotao: '#09090b',
      corBadgeCategoria: '#f59e0b',
      fonteFamilia: 'sans',
      arredondamentoCartoes: 'medio',
      arredondamentoBotoes: 'medio',
    },
  },
  {
    id: 'batataria-rustica',
    nome: 'Batataria & Petiscos Rústicos',
    descricao: 'Tons quentes de queijo derretido e batata assada. Perfeito para batatas recheadas, porções e petiscos.',
    corAmostra: '#ea580c',
    theme: {
      ...TEMA_CARDAPIO_PADRAO,
      nomeLoja: 'Batata Show Gourmet',
      subtituloLoja: 'Batatas Recheadas & Porções Especiais',
      fraseApresentacao: 'As mais recheadas e crocantes da cidade',
      descricaoLoja: 'Batatas assadas na brasa com recheios generosos e queijo gratinado.',
      fundoTipo: 'solido',
      corFundo: '#1c1917', // stone-900
      corFundoSecao: '#292524', // stone-800
      corBordaCartao: '#44403c',
      corTextoPrincipal: '#fafaf9',
      corTextoSecundario: '#d6d3d1',
      corDestaque: '#ea580c', // orange-600
      corPreco: '#f97316',
      corBotao: '#ea580c',
      corTextoBotao: '#ffffff',
      corBadgeCategoria: '#ea580c',
      fonteFamilia: 'sans',
      arredondamentoCartoes: 'grande',
      arredondamentoBotoes: 'grande',
    },
  },
  {
    id: 'lanchonete-clean',
    nome: 'Lanchonete Clara & Clean',
    descricao: 'Visual iluminado, fundo branco com cartões suaves e contraste alto. Excelente legibilidade sob a luz do dia.',
    corAmostra: '#dc2626',
    theme: {
      ...TEMA_CARDAPIO_PADRAO,
      nomeLoja: 'Sabor & Cia Lanches',
      subtituloLoja: 'Lanches Tradicionais & Sucos Naturais',
      fraseApresentacao: 'Peça online com entrega rápida e quentinha',
      descricaoLoja: 'Ingredientes frescos e selecionados para o seu momento de lazer.',
      fundoTipo: 'solido',
      corFundo: '#f4f4f5', // zinc-100
      corFundoSecao: '#ffffff', // white
      corBordaCartao: '#e4e4e7', // zinc-200
      corTextoPrincipal: '#18181b', // zinc-900
      corTextoSecundario: '#71717a', // zinc-500
      corDestaque: '#dc2626', // red-600
      corPreco: '#dc2626',
      corBotao: '#dc2626',
      corTextoBotao: '#ffffff',
      corBadgeCategoria: '#dc2626',
      fonteFamilia: 'sans',
      arredondamentoCartoes: 'medio',
      arredondamentoBotoes: 'medio',
    },
  },
  {
    id: 'acai-tropical',
    nome: 'Açaí & Sobremesas Tropical',
    descricao: 'Fundo roxo profundo e detalhes vibrantes em verde lima e magenta. Perfeito para açaí, doces e sorvetes.',
    corAmostra: '#9333ea',
    theme: {
      ...TEMA_CARDAPIO_PADRAO,
      nomeLoja: 'Ponto do Açaí Tropical',
      subtituloLoja: 'Açaí Artesanal, Cremes & Sorvetes',
      fraseApresentacao: 'Monte sua tigela com frutas frescas e adicionais',
      descricaoLoja: 'Açaí puro e cremoso batido na hora com os melhores complementos.',
      fundoTipo: 'solido',
      corFundo: '#170c24',
      corFundoSecao: '#26123c',
      corBordaCartao: '#491e70',
      corTextoPrincipal: '#fdf4ff',
      corTextoSecundario: '#e879f9',
      corDestaque: '#a855f7',
      corPreco: '#22c55e',
      corBotao: '#a855f7',
      corTextoBotao: '#ffffff',
      corBadgeCategoria: '#a855f7',
      fonteFamilia: 'sans',
      arredondamentoCartoes: 'completo',
      arredondamentoBotoes: 'completo',
    },
  },
  {
    id: 'artesanal-gourmet',
    nome: 'Bistrô & Gourmet Sofisticado',
    descricao: 'Estilo clássico e elegante com tipografia refinada e tons de bronze e preto fosco.',
    corAmostra: '#d97706',
    theme: {
      ...TEMA_CARDAPIO_PADRAO,
      nomeLoja: 'Empório & Grill Gourmet',
      subtituloLoja: 'Cortes Especiais & Gastronomia Artesanal',
      fraseApresentacao: 'Uma experiência gastronômica completa na sua casa',
      fundoTipo: 'solido',
      corFundo: '#0c0a09',
      corFundoSecao: '#1c1917',
      corBordaCartao: '#292524',
      corTextoPrincipal: '#f5f5f4',
      corTextoSecundario: '#a8a29e',
      corDestaque: '#d97706',
      corPreco: '#f59e0b',
      corBotao: '#d97706',
      corTextoBotao: '#ffffff',
      corBadgeCategoria: '#d97706',
      fonteFamilia: 'serif',
      arredondamentoCartoes: 'pequeno',
      arredondamentoBotoes: 'pequeno',
    },
  },
];
