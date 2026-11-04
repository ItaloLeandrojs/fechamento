// Regiões do painel. EDP e Ceará (estrutura e material pelo CAD) prontas; Sergipe em breve.
export type RegiaoId = 'edp' | 'ceara' | 'sergipe'

export interface Regiao {
  id: RegiaoId
  numero: string
  nome: string
  descricao: string
  estado: 'pronto' | 'em-breve'
}

export const REGIOES: Regiao[] = [
  {
    id: 'edp',
    numero: '01',
    nome: 'EDP',
    descricao: 'Inventário vira ADS, com conferência automática antes de baixar.',
    estado: 'pronto',
  },
  {
    id: 'ceara',
    numero: '02',
    nome: 'Ceará',
    descricao: 'Contagem de estrutura e material pelo CAD, pronta em Excel.',
    estado: 'pronto',
  },
  {
    id: 'sergipe',
    numero: '03',
    nome: 'Sergipe',
    descricao: 'Book de obras da Energisa montado com as fotos de cada estrutura.',
    estado: 'em-breve',
  },
]
