// Leitor mínimo de DXF (texto), só o que a contagem do Ceará usa: textos do desenho
// (TEXT e MTEXT do espaço do modelo) e cotas (DIMENSION), que é como os vãos de cabo
// de MT costumam vir (o estilo da cota traz o cabo, ex. "(1)P3AN004<>", e o CAD mede o vão).

export interface TextoDxf {
  tipo: 'TEXT' | 'MTEXT'
  /** Texto cru, com os códigos de formatação do MTEXT. */
  bruto: string
  camada: string
  x: number
  y: number
}

export interface CotaDxf {
  /** Texto do estilo com o "<>" no lugar da medida, ex. "(1)P3AN004<>". */
  modelo: string
  /** Texto escrito à mão na cota (quando a pessoa substituiu a medida). */
  substituto: string
  /** Medida calculada pelo CAD (m). */
  medida: number
  camada: string
}

export interface Dxf {
  versao: string
  textos: TextoDxf[]
  cotas: CotaDxf[]
}

/** DXF de 2007 em diante é UTF-8; os antigos usam a página de código do Windows. */
function decodificar(bytes: Uint8Array): string {
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 4000))
  const ver = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d{4})/.exec(inicio)?.[1] ?? ''
  const utf8 = ver >= 'AC1021'
  return new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(bytes)
}

export function lerDxf(bytes: Uint8Array): Dxf {
  const texto = decodificar(bytes)
  const L = texto.split(/\r?\n/)
  const versao = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d{4})/.exec(texto.slice(0, 4000))?.[1] ?? ''
  const textos: TextoDxf[] = []
  const cotasCruas: { estilo: string; medida: number; substituto: string; camada: string }[] = []
  const estilos = new Map<string, string>()

  let secao = ''
  let ent: { tipo: string; bruto: string; camada: string; x: number; y: number; papel: boolean; estilo: string; medida: number; sub: string } | null = null
  let dimstyle: { nome: string; post: string } | null = null
  const fechar = () => {
    if (ent && !ent.papel) {
      if (ent.tipo === 'TEXT' || ent.tipo === 'MTEXT') textos.push({ tipo: ent.tipo, bruto: ent.bruto, camada: ent.camada, x: ent.x, y: ent.y })
      else if (ent.tipo === 'DIMENSION') cotasCruas.push({ estilo: ent.estilo, medida: ent.medida, substituto: ent.sub, camada: ent.camada })
    }
    if (dimstyle?.nome) estilos.set(dimstyle.nome, dimstyle.post)
    ent = null
    dimstyle = null
  }

  for (let i = 0; i + 1 < L.length; i += 2) {
    const codigo = L[i].trim()
    const valor = L[i + 1]
    if (codigo === '0') {
      fechar()
      if (valor === 'SECTION') {
        secao = (L[i + 3] ?? '').trim()
        continue
      }
      if (secao === 'TABLES' && valor === 'DIMSTYLE') dimstyle = { nome: '', post: '' }
      // só o espaço do modelo (ENTITIES); blocos não inseridos e folhas de impressão ficam de fora
      else if (secao === 'ENTITIES' && ['TEXT', 'MTEXT', 'DIMENSION'].includes(valor)) ent = { tipo: valor, bruto: '', camada: '', x: 0, y: 0, papel: false, estilo: '', medida: 0, sub: '' }
      continue
    }
    if (dimstyle) {
      if (codigo === '2') dimstyle.nome = valor.trim()
      else if (codigo === '3') dimstyle.post = valor.trim()
      continue
    }
    if (!ent) continue
    switch (codigo) {
      case '1':
        if (ent.tipo === 'DIMENSION') ent.sub = valor
        else ent.bruto += valor
        break
      case '3':
        if (ent.tipo === 'DIMENSION') ent.estilo = valor.trim()
        else ent.bruto += valor // continuação de MTEXT longo
        break
      case '8':
        ent.camada = valor.trim()
        break
      case '10':
        ent.x = Number(valor)
        break
      case '20':
        ent.y = Number(valor)
        break
      case '42':
        ent.medida = Number(valor)
        break
      case '67':
        ent.papel = valor.trim() === '1'
        break
    }
  }
  fechar()

  const cotas = cotasCruas.map((c) => ({ modelo: estilos.get(c.estilo) ?? '', substituto: c.substituto, medida: c.medida, camada: c.camada }))
  return { versao, textos, cotas }
}
