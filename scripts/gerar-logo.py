# Gera a logo "COSAMPA / FECHAMENTO" no mesmo desenho da marca Cosampa (v2).
# Uso: python scripts/gerar-logo.py   (a partir da raiz do projeto)
#
# Reaproveita O, A e M do SVG da Cosampa; o C de FECHAMENTO é um anel aberto
# (o C original é um crescente e parecia "(" ao lado de E e H); F, E, H, N, T são
# desenhados na mesma espessura de haste (234,7) e altura (433,6 a 1295,4).
# A linha de cima é a palavra COSAMPA com os glifos originais da marca, em escala 0,32.
#
# Saídas: src/components/logoLetras.ts, public/logo-fechamento.svg, public/favicon.svg
# e docs/amostra/logo-v2.html (prévia de aprovação, fora do public/).
import json, math, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('LOGO_COSAMPA_SVG', r'C:\Users\italo.silva\Desktop\LINKEDIN\cosampa-site\public\logo-cosampa.svg')
d = re.findall(r'<path[^>]*d="([^"]+)"', open(SRC, encoding='utf8').read())[0]
subs = re.split(r'(?=M)', d.strip())

# glifos grandes da marca (cada letra = contorno + furo, quando tem)
GLIFO = {'O': subs[10] + subs[16], 'A': subs[12], 'M': subs[13] + subs[19]}
ESQ = {'O': 1013, 'A': 2903.8, 'M': 3950.1}
LARG = {'O': 950, 'A': 889.8, 'M': 982.1, 'F': 640, 'E': 660, 'H': 800, 'N': 820, 'T': 760}
T0, B, HASTE = 433.6, 1295.4, 234.7

# --- C de anel aberto -------------------------------------------------------
# Mesma altura e sobra do O da marca (y 416 a 1314). Pontas cortadas na vertical.
C_TOPO, C_BASE = 416.0, 1314.0
C_RY = (C_BASE - C_TOPO) / 2          # 449
C_RX = 475.0                          # largura do O da marca / 2
C_CX, C_CY = C_RX, (C_TOPO + C_BASE) / 2
C_RXI, C_RYI = C_RX - HASTE, C_RY - HASTE
C_CORTE = float(os.environ.get('C_CORTE', 200))   # x do corte vertical, a partir do centro
LARG['C'] = C_RX + C_CORTE

def c_aberto(x0):
    yo = C_RY * math.sqrt(1 - (C_CORTE / C_RX) ** 2)
    yi = C_RYI * math.sqrt(1 - (C_CORTE / C_RXI) ** 2)
    xc = x0 + C_CX + C_CORTE
    cy = C_CY
    return (f'M{xc:.1f} {cy - yo:.1f}A{C_RX} {C_RY} 0 1 0 {xc:.1f} {cy + yo:.1f}'
            f'L{xc:.1f} {cy + yi:.1f}A{C_RXI:.1f} {C_RYI:.1f} 0 1 1 {xc:.1f} {cy - yi:.1f}Z')

def poli(pts, x0):
    return 'M' + 'L'.join(f'{x0 + x:.1f} {y:.1f}' for x, y in pts) + 'Z'
NOVOS = {
    'F': [(0,T0),(640,T0),(640,640.5),(234.7,640.5),(234.7,761),(590,761),(590,968),(234.7,968),(234.7,B),(0,B)],
    'E': [(0,T0),(660,T0),(660,640.5),(234.7,640.5),(234.7,761),(610,761),(610,968),(234.7,968),(234.7,1088.5),(660,1088.5),(660,B),(0,B)],
    'H': [(0,T0),(234.7,T0),(234.7,761),(565.3,761),(565.3,T0),(800,T0),(800,B),(565.3,B),(565.3,968),(234.7,968),(234.7,B),(0,B)],
    'N': [(0,T0),(234.7,T0),(585.3,950),(585.3,T0),(820,T0),(820,B),(585.3,B),(234.7,779),(234.7,B),(0,B)],
    'T': [(0,T0),(760,T0),(760,640.5),(497.65,640.5),(497.65,B),(262.35,B),(262.35,640.5),(0,640.5)],
}
GAP_C_SEGUINTE = float(os.environ.get('GAP_C', 110))   # a boca aberta do C já dá respiro

def palavra(texto, gap=130):
    x = 0; partes = []
    for i, ch in enumerate(texto):
        g = gap
        if i and ('A' in (ch, texto[i-1])): g = 70
        if i and texto[i-1] == 'T' and ch == 'O': g = 60
        if i and texto[i-1] == 'C': g = GAP_C_SEGUINTE
        if i: x += g
        if ch == 'C':
            partes.append({'d': c_aberto(x), 'a': False})
        elif ch in NOVOS:
            partes.append({'d': poli(NOVOS[ch], x), 'a': False})
        else:
            partes.append({'d': GLIFO[ch], 't': f'translate({x - ESQ[ch]:.1f} 0)', 'a': False})
        x += LARG[ch]
    return partes, x

partes, largura = palavra('FECHAMENTO')
partes[4]['a'] = True            # o A de FECHAMENTO é amarelo
assert partes[4]['d'] == GLIFO['A']

# --- COSAMPA com os glifos originais -----------------------------------------
ESC = 0.32
COSAMPA_D = ''.join(subs[i] for i in (9, 18, 10, 16, 11, 20, 12, 13, 19, 14, 17, 15))
BASE_COSAMPA = T0 - 150                      # linha de base de COSAMPA, acima de FECHAMENTO
TX = 36 * ESC                                # borda esquerda do C original (x = -36) fica em 0
TY = BASE_COSAMPA - B * ESC
COSAMPA = [{'d': COSAMPA_D, 't': f'translate({TX:.1f} {TY:.1f}) scale({ESC})'}]

VX0, VY0 = -30, -10
VW, VH = round(largura) + 60, 1335
VIEWBOX = f'{VX0} {VY0} {VW} {VH}'

# --- logoLetras.ts -----------------------------------------------------------
ts = ('// Gerado por scripts/gerar-logo.py: COSAMPA / FECHAMENTO no desenho da marca Cosampa (v2).\n'
      f"export const LOGO_VIEWBOX = '{VIEWBOX}'\n"
      'export const LOGO_LETRAS: { d: string; t?: string; a: boolean }[] = '
      + json.dumps(partes, ensure_ascii=False) + '\n'
      'export const LOGO_COSAMPA: { d: string; t?: string }[] = '
      + json.dumps(COSAMPA, ensure_ascii=False) + '\n')
open(os.path.join(RAIZ, 'src', 'components', 'logoLetras.ts'), 'w', encoding='utf8').write(ts)

# --- SVGs estáticos (fundo claro: grafite e amarelo mais escuro) ---------------
def caminhos(cor, cor_a):
    out = [f'<path fill="{cor}" fill-rule="evenodd" transform="{c["t"]}" d="{c["d"]}"/>' for c in COSAMPA]
    for p in partes:
        t = f' transform="{p["t"]}"' if 't' in p else ''
        out.append(f'<path fill="{cor_a if p["a"] else cor}" fill-rule="evenodd"{t} d="{p["d"]}"/>')
    return ''.join(out)

def svg(cor='#282829', cor_a='#E8A400', extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" role="img" aria-label="Cosampa Fechamento"{extra}>'
            + caminhos(cor, cor_a) + '</svg>')

open(os.path.join(RAIZ, 'public', 'logo-fechamento.svg'), 'w', encoding='utf8').write(svg())

A = GLIFO['A']
FAVICON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#282829"/>'
           f'<g transform="translate(9 9) scale(0.0515) translate(-2903.8 -433.6)"><path fill="#F2B705" d="{A}"/></g></svg>')
open(os.path.join(RAIZ, 'public', 'favicon.svg'), 'w', encoding='utf8').write(FAVICON)

# --- prévia de aprovação (docs/amostra) -------------------------------------
def v2(altura, cor, cor_a):
    return svg(cor, cor_a, f' height="{altura}" width="{altura * VW / VH:.1f}"')

v1_arq = os.path.join(RAIZ, 'docs', 'amostra', 'logo-v1.svg')
v1_txt = open(v1_arq, encoding='utf8').read() if os.path.exists(v1_arq) else ''
def v1(altura, cor, cor_a):
    m = re.search(r'viewBox="([^"]+)"', v1_txt)
    _, _, w, h = map(float, m.group(1).split())
    s = v1_txt.replace('#282829', cor).replace('#E8A400', cor_a)
    return s.replace('<svg ', f'<svg height="{altura}" width="{altura * w / h:.1f}" ', 1)

CLARO = ('#191d21', '#F2B705'); ESCURO = ('#e8ebee', '#F2B705')
def bloco(rotulo, fundo, cores, fn):
    linhas = ''.join(
        f'<div class="lin"><span class="rot">{nome}</span>{fn(h, *cores)}</div>' for nome, h in
        (('40 px (cabeçalho)', 40), ('24 px', 24), ('grande', 100)))
    return f'<div class="col {fundo}"><h3>{rotulo}</h3>{linhas}</div>'
def fav(fundo):
    return f'<div class="lin"><span class="rot">favicon 64 / 32 / 16</span>' + ''.join(
        FAVICON.replace('<svg ', f'<svg width="{t}" height="{t}" ', 1) for t in (64, 32, 16)) + '</div>'
html = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Logo v2 - prévia para aprovação</title>
<style>
body{{margin:0;font:15px/1.4 system-ui,sans-serif;background:#fff;color:#191d21}}
h1{{font-size:22px;margin:0;padding:20px 24px 4px}} p{{margin:0;padding:0 24px 16px;max-width:90ch}}
.grade{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
.col{{padding:20px 24px 24px}} .col h3{{margin:0 0 12px;font-size:15px}}
.claro{{background:#fff;color:#191d21}} .escuro{{background:#15181b;color:#e8ebee}}
.lin{{display:flex;align-items:center;gap:16px;margin:0 0 18px;flex-wrap:nowrap}}
.rot{{flex:0 0 130px;font-size:13px;opacity:.7}} svg{{display:block;max-width:100%}}
</style></head><body>
<h1>Logo v2: C legível e COSAMPA com os glifos da marca</h1>
<p>Esquerda: v1 (atual). Direita: v2 (proposta). Acima, fundo claro; abaixo, fundo escuro. O A fica amarelo nas duas.</p>
<div class="grade">
{bloco('v1, fundo claro', 'claro', CLARO, v1)}{bloco('v2, fundo claro', 'claro', CLARO, v2)}
{bloco('v1, fundo escuro', 'escuro', ESCURO, v1)}{bloco('v2, fundo escuro', 'escuro', ESCURO, v2)}
</div>
<div class="col claro">{fav('claro')}</div>
</body></html>'''
open(os.path.join(RAIZ, 'docs', 'amostra', 'logo-v2.html'), 'w', encoding='utf8').write(html)
print('largura', round(largura), 'viewBox', VIEWBOX)
