/**
 * Transforma o texto do CAD em linhas limpas: tira os códigos de formatação do MTEXT
 * (cor, fonte, altura, alinhamento...), troca a quebra de linha \P por linha nova e os
 * códigos %%c/%%d/%%p dos textos simples pelos símbolos.
 */
export function linhasDoTexto(bruto: string): string[] {
  let s = ''
  for (let i = 0; i < bruto.length; i++) {
    const ch = bruto[i]
    if (ch === '{' || ch === '}') continue
    if (ch !== '\\') {
      s += ch
      continue
    }
    const cod = bruto[i + 1]
    if (cod === undefined) break
    if (cod === 'P') {
      s += '\n'
      i++
    } else if (cod === '~') {
      s += ' '
      i++
    } else if (cod === '\\' || cod === '{' || cod === '}') {
      s += cod
      i++
    } else if (cod === 'U' && bruto[i + 2] === '+') {
      s += String.fromCharCode(parseInt(bruto.slice(i + 3, i + 7), 16))
      i += 6
    } else if ('ACcfFHQTWpS'.includes(cod)) {
      // código com argumento até o ";"
      const fim = bruto.indexOf(';', i)
      i = fim < 0 ? bruto.length : fim
    } else if ('LlOoKkN'.includes(cod)) {
      i++ // liga/desliga sublinhado etc.: sem argumento
    } else {
      s += cod
      i++
    }
  }
  return s
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%%/g, '%')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
