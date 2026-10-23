# Gera a logo "FECHAMENTO" no mesmo desenho da marca Cosampa.
# Reaproveita C, O, A e M do SVG da Cosampa; F, E, H, N, T são desenhados
# na mesma espessura de haste (234,7) e altura (433,6 a 1295,4).
import re, sys
src = r'C:\Users\italo.silva\Desktop\LINKEDIN\cosampa-site\public\logo-cosampa.svg'
d = re.findall(r'<path[^>]*d="([^"]+)"', open(src, encoding='utf8').read())[0]
subs = re.split(r'(?=M)', d.strip())
GLIFO = {'C': subs[9] + subs[18], 'O': subs[10] + subs[16], 'A': subs[12], 'M': subs[13] + subs[19]}
ESQ = {'C': -36, 'O': 1013, 'A': 2903.8, 'M': 3950.1}
LARG = {'C': 929, 'O': 950, 'A': 889.8, 'M': 982.1, 'F': 640, 'E': 660, 'H': 800, 'N': 820, 'T': 760}
T0, B = 433.6, 1295.4
def poli(pts, x0):
    return 'M' + 'L'.join(f'{x0 + x:.1f} {y:.1f}' for x, y in pts) + 'Z'
NOVOS = {
    'F': [(0,T0),(640,T0),(640,640.5),(234.7,640.5),(234.7,761),(590,761),(590,968),(234.7,968),(234.7,B),(0,B)],
    'E': [(0,T0),(660,T0),(660,640.5),(234.7,640.5),(234.7,761),(610,761),(610,968),(234.7,968),(234.7,1088.5),(660,1088.5),(660,B),(0,B)],
    'H': [(0,T0),(234.7,T0),(234.7,761),(565.3,761),(565.3,T0),(800,T0),(800,B),(565.3,B),(565.3,968),(234.7,968),(234.7,B),(0,B)],
    'N': [(0,T0),(234.7,T0),(585.3,950),(585.3,T0),(820,T0),(820,B),(585.3,B),(234.7,779),(234.7,B),(0,B)],
    'T': [(0,T0),(760,T0),(760,640.5),(497.65,640.5),(497.65,B),(262.35,B),(262.35,640.5),(0,640.5)],
}
def palavra(texto, gap=130):
    x = 0; partes = []
    for i, ch in enumerate(texto):
        g = gap
        if i and ('A' in (ch, texto[i-1])): g = 70
        if i and texto[i-1] == 'T' and ch == 'O': g = 60
        if i: x += g
        if ch in NOVOS:
            partes.append((ch, f'<path d="{poli(NOVOS[ch], x)}"/>'))
        else:
            partes.append((ch, f'<path transform="translate({x - ESQ[ch]:.1f} 0)" d="{GLIFO[ch]}"/>'))
        x += LARG[ch]
    return partes, x
partes, largura = palavra('FECHAMENTO')
open(sys.argv[1], 'w', encoding='utf8').write('\n'.join(f'{c}\t{p}' for c, p in partes) + f'\nLARGURA\t{largura:.1f}\n')
print('largura', round(largura))
