// Mão de obra do Ceará: tipos da lista de vozes (base opcional "mao-de-obra") e os papéis que a Leitura do CAD usa.
export type Letra = 'A' | 'B'
export type Aba = 'adicao' | 'devolucao'
export const PAPEIS = [
  'poste-mt', 'poste-bt', 'retirada-poste-mt', 'retirada-poste-bt',
  'retirada-poste-lv-passante', 'retirada-poste-lv-encabecamento', 'cava-rocha',
  'cruzeta-nu', 'cruzeta-isolado', 'retirada-cruzeta-passante', 'retirada-cruzeta-encabecamento',
  'lv-instalacao-passante', 'lv-retirada-passante', 'lv-instalacao-encabecamento', 'lv-retirada-encabecamento',
  'armacao-bt', 'retirada-armacao-bt',
  'trafo', 'estrutura-trafo', 'retirada-trafo', 'retirada-estrutura-trafo',
  'caixa', 'conector-4-saidas', 'tensionar', 'operacao-equipamento',
] as const
export type Papel = (typeof PAPEIS)[number]
/** Uma linha da lista de precificação, sem o R$. `voz` sem sufixo (ex. XX110); `variante`: "GRP A -" ou "(TELECONT)". */
export interface VozDaLista { voz: string; letra: Letra; numero: string; descricao: string; unidade: string; variante: boolean }
export interface RegraCabo { grupo: 'mt' | 'bt-nu' | 'bt-multi'; situacao: 'novo' | 'retirado'; voz: string; por: 'metro' | 'condutor'; bitolas?: string[] }
/** MT: `exige` tem uma expressão e vale por estrutura. BT: todas as expressões acham uma estrutura (1) do poste; vale a de maior `qtd` do poste. */
export interface RegraTensionar { rede: 'mt' | 'bt'; exige: string[]; qtd: number }
export interface BaseMaoDeObra { lista: VozDaLista[]; papeis: Record<Papel, string>; regrasCabo: RegraCabo[]; tensionar: RegraTensionar[] }
