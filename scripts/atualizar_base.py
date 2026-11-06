# Confere e sobe as bases do site Fechamento para o Supabase (roda no PC do Italo).
#
#   python scripts/atualizar_base.py enel "<planilha.xlsx>" [--seco] [--sim]
#   python scripts/atualizar_base.py edp ../bases/kits-edp.json [--seco] [--sim]
#   python scripts/atualizar_base.py mao-de-obra "<precificação.xlsx>" --regras ../bases/regras-mao-de-obra.json [--seco] [--sim]
#
# --seco: lê, confere e grava ../bases/enel.json (ou mao-de-obra.json), mas NÃO sobe nada e não usa a internet.
# --sim:  não pergunta nada quando a base cai mais de 2% (os problemas que param continuam parando).
#
# A chave secreta fica em AUTOMACAO KIT MATERIAL\supabase.env (SUPABASE_URL e
# SUPABASE_SERVICE_ROLE_KEY), fora do repositório.
import argparse
import datetime
import gzip
import hashlib
import json
import pathlib
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import warnings

QUEDA_MAXIMA = 0.02

PASTA_SCRIPT = pathlib.Path(__file__).resolve().parent
PASTA_BASES = PASTA_SCRIPT.parent.parent / 'bases'
ARQUIVO_ENV = PASTA_SCRIPT.parent.parent / 'supabase.env'

ABA_MATERIAL = 'MATERIAL E4E'
ABA_KITS = 'KIT_ESTRUTURAS E4E'

NOMES_CONTAGEM = {'materiais': 'materiais', 'estruturas': 'estruturas', 'linhas_kit': 'linhas de kit',
                  'kits': 'kits', 'itens': 'itens', 'vozes': 'vozes', 'regras': 'regras'}


class ErroBase(Exception):
    """Problema que a pessoa precisa resolver; a mensagem já vem pronta em português."""


# ---------- leitura da planilha ----------

def _texto(v):
    return '' if v is None else str(v).strip()


def _codigo(v):
    """Código como texto. O Excel às vezes entrega número (100001 ou 100001.0)."""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return _texto(v)


def _sem_acento(s):
    return unicodedata.normalize('NFKD', _texto(s)).encode('ascii', 'ignore').decode().lower()


def _conferir_cabecalho(aba, linha, esperado):
    """esperado: {indice da coluna: trecho do título, sem acento e em minúsculas}."""
    for i, trecho in esperado.items():
        titulo = linha[i] if i < len(linha) else None
        if trecho not in _sem_acento(titulo):
            raise ErroBase(f'Na aba "{aba}" a coluna {chr(65 + i)} deveria ter "{trecho}" no título, '
                           f'mas está "{_texto(titulo)}". A planilha mudou de layout?')


def ler_enel(caminho):
    import openpyxl
    warnings.filterwarnings('ignore')
    try:
        wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    except FileNotFoundError:
        raise ErroBase(f'Não achei a planilha: {caminho}')
    try:
        for aba in (ABA_MATERIAL, ABA_KITS):
            if aba not in wb.sheetnames:
                raise ErroBase(f'A planilha não tem a aba "{aba}".')

        cab = next(wb[ABA_MATERIAL].iter_rows(min_row=2, max_row=2, values_only=True), ())
        _conferir_cabecalho(ABA_MATERIAL, cab, {2: 'e4e', 3: 'descri', 4: 'unidade'})
        materiais = {}
        for r in wb[ABA_MATERIAL].iter_rows(min_row=3, values_only=True):
            codigo, descricao, unidade = (list(r) + [None] * 5)[2:5]
            if codigo is None or descricao is None:
                continue
            materiais[_codigo(codigo)] = [_texto(descricao), _texto(unidade)]

        cab = next(wb[ABA_KITS].iter_rows(min_row=2, max_row=2, values_only=True), ())
        _conferir_cabecalho(ABA_KITS, cab, {1: 'codigo_kit', 3: 'descri', 5: 'codigo_material_e4e', 8: 'qtd'})
        estruturas, kits = {}, {}
        for r in wb[ABA_KITS].iter_rows(min_row=3, values_only=True):
            r = list(r) + [None] * 9
            kit = _codigo(r[1])
            if not kit:
                continue
            estruturas.setdefault(kit, _texto(r[3]))
            material = _codigo(r[5])
            if not material:
                continue
            qtd = r[8]
            if not isinstance(qtd, (int, float)):
                raise ErroBase(f'Quantidade inválida no kit {kit}, material {material}: "{_texto(qtd)}".')
            kits.setdefault(kit, []).append([material, int(qtd) if float(qtd).is_integer() else qtd])
        return {'materiais': materiais, 'estruturas': estruturas, 'kits': kits}
    finally:
        wb.close()


# ---------- conferência ----------

def contagens(base):
    return {'materiais': len(base['materiais']),
            'estruturas': len(base['estruturas']),
            'linhas_kit': sum(len(v) for v in base['kits'].values())}


def _quedas(novas, anteriores):
    saida = []
    for chave, a in (anteriores or {}).items():
        n = novas.get(chave)
        if n is not None and a and n < a and (a - n) / a > QUEDA_MAXIMA:
            saida.append(f'AVISO: {NOMES_CONTAGEM.get(chave, chave)} caiu de {a} para {n} ({(a - n) / a:.1%}).')
    return saida


def conferir(nova, anterior):
    """Lista de textos. 'PARA:' = problema que para o script; 'AVISO:' = queda de mais de 2%.
    `anterior` são as contagens da versão anterior (ou None na primeira vez)."""
    c = contagens(nova)
    saida = [f'PARA: a base nova não tem {NOMES_CONTAGEM[k]}.' for k, v in c.items() if v == 0]
    return saida + _quedas(c, anterior)


def conferir_edp(kits):
    if not isinstance(kits, list) or not kits:
        raise ErroBase('O arquivo dos kits da EDP está vazio ou não é uma lista.')
    for i, k in enumerate(kits):
        if not (isinstance(k, dict) and isinstance(k.get('kit'), str) and isinstance(k.get('itens'), list)):
            raise ErroBase(f'Kit número {i + 1} fora do formato esperado (precisa de "kit" em texto e "itens" em lista).')


def contagens_edp(kits):
    return {'kits': len(kits), 'itens': sum(len(k['itens']) for k in kits)}


# ---------- mão de obra (lista de vozes + regras) ----------

PAPEIS = [
    'poste-mt', 'poste-bt', 'retirada-poste-mt', 'retirada-poste-bt',
    'retirada-poste-lv-passante', 'retirada-poste-lv-encabecamento', 'cava-rocha',
    'cruzeta-nu', 'cruzeta-isolado', 'retirada-cruzeta-passante', 'retirada-cruzeta-encabecamento',
    'lv-instalacao-passante', 'lv-retirada-passante', 'lv-instalacao-encabecamento', 'lv-retirada-encabecamento',
    'armacao-bt', 'retirada-armacao-bt',
    'trafo', 'estrutura-trafo', 'retirada-trafo', 'retirada-estrutura-trafo',
    'caixa', 'conector-4-saidas', 'tensionar', 'operacao-equipamento',
]  # mesma lista de src/ceara/maoDeObra.ts

_PREFIXO_VOZ = re.compile(r'^([A-Za-z]{2,3}\d{3})_([AB])_(.*)$', re.DOTALL)
_ZONA_LETRA = {'urbana': 'A', 'rural': 'B'}


class ListaPrecificacao(list):
    """Lista de entradas; `puladas` conta as linhas cuja descrição não começa com <voz>_<A|B>_."""
    puladas = 0


def _e_sul(departamento):
    partes = _sem_acento(departamento).split()
    return bool(partes) and partes[-1] == 'sul'


def ler_precificacao(caminho):
    import openpyxl
    warnings.filterwarnings('ignore')
    try:
        wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    except FileNotFoundError:
        raise ErroBase(f'Não achei a planilha: {caminho}')
    try:
        ws = wb.worksheets[0]
        cab = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
        _conferir_cabecalho(ws.title, cab, {0: 'digo', 1: 'descri', 3: 'unidade', 6: 'zona'})
        entradas = {}  # (voz, letra, numero) -> (entrada, veio do SUL)
        puladas = 0
        for r in ws.iter_rows(min_row=2, values_only=True):
            r = list(r) + [None] * 7  # a coluna C (R$) nunca é lida
            if all(v is None for v in r):
                continue
            descricao = _texto(r[1])
            m = _PREFIXO_VOZ.match(descricao)
            if not m:
                puladas += 1
                continue
            voz, letra, resto = m.group(1).upper(), m.group(2), m.group(3)
            entrada = {'voz': voz, 'letra': letra, 'numero': _codigo(r[0]), 'descricao': descricao,
                       'unidade': _texto(r[3]), 'variante': resto.startswith('GRP A') or resto.startswith('(TELECONT)'),
                       'zona': _ZONA_LETRA.get(_sem_acento(r[6]))}
            chave = (voz, letra, entrada['numero'])
            sul = _e_sul(r[5])
            if chave not in entradas:
                entradas[chave] = (entrada, sul)
            elif sul and not entradas[chave][1]:
                entradas[chave] = (entrada, True)
        lista = ListaPrecificacao(e for e, _ in entradas.values())
        lista.puladas = puladas
        return lista
    finally:
        wb.close()


def ler_regras(caminho):
    try:
        regras = json.loads(pathlib.Path(caminho).read_text(encoding='utf-8-sig'))
    except FileNotFoundError:
        raise ErroBase(f'Não achei o arquivo de regras: {caminho}')
    except json.JSONDecodeError as e:
        raise ErroBase(f'O arquivo de regras não é um JSON válido ({caminho}): {e}')
    if not isinstance(regras, dict):
        raise ErroBase('O arquivo de regras precisa ser um objeto com "papeis", "regrasCabo" e "tensionar".')
    for parte, tipo in (('papeis', dict), ('regrasCabo', list), ('tensionar', list)):
        if not isinstance(regras.get(parte), tipo):
            raise ErroBase(f'O arquivo de regras está sem "{parte}" (ou fora do formato).')
    return regras


def montar_mao_de_obra(lista, regras):
    return {'lista': [dict(e) for e in lista], 'papeis': dict(regras['papeis']),
            'regrasCabo': list(regras['regrasCabo']), 'tensionar': list(regras['tensionar'])}


def _vozes_nao_variantes(base):
    """{(voz, letra): [numeros das entradas não variantes]}"""
    m = {}
    for e in base['lista']:
        if isinstance(e, dict) and not e.get('variante'):
            m.setdefault((e.get('voz'), e.get('letra')), []).append(e.get('numero'))
    return m


# O Python aceita e o JavaScript do site (new RegExp) recusa ou lê diferente.
_SO_PYTHON = (
    (re.compile(r'\(\?P[<=]'), 'grupo com nome no jeito do Python'),
    (re.compile(r'(?<!\\)(?:\\\\)*\\[AZ]'), r'\A ou \Z'),
    (re.compile(r'\(\?[aiLmsux-]+[:)]'), 'opção dentro da expressão, como (?i)'),
    (re.compile(r'\(\?#'), 'comentário (?#'),
)


def _fora_do_js(expressao):
    """O motivo, se a expressão usa algo que só o Python aceita; senão None."""
    for padrao, motivo in _SO_PYTHON:
        if padrao.search(expressao):
            return motivo
    return None


def conferir_mao_de_obra(base, anterior=None):
    """Lista de textos: 'PARA:' = problema que para o script; 'AVISO:' = só avisa. `anterior` = contagens anteriores."""
    saida = []
    if not isinstance(base, dict) or not isinstance(base.get('lista'), list) or not base['lista']:
        return ['PARA: a lista de vozes da mão de obra está vazia.']
    textos = ('voz', 'descricao', 'unidade')
    vozes = set()
    for i, e in enumerate(base['lista']):
        if not (isinstance(e, dict) and all(isinstance(e.get(k), str) for k in textos)):
            saida.append(f'PARA: a entrada {i + 1} da lista está sem texto de voz, descrição ou unidade.')
            continue
        vozes.add(e['voz'])
        if e.get('letra') not in ('A', 'B'):
            saida.append(f'PARA: a voz {e["voz"]} tem letra fora de A/B.')
        elif e.get('zona') is not None and e['zona'] != e['letra']:
            saida.append(f'PARA: a voz {e["voz"]} (número {e.get("numero")}) tem letra {e["letra"]} na descrição, '
                         f'mas a zona da planilha é {e["zona"]}.')
        if not (isinstance(e.get('numero'), str) and re.fullmatch(r'\d{10}', e['numero'])):
            saida.append(f'PARA: a voz {e["voz"]} tem número fora do padrão de 10 dígitos ({e.get("numero")!r}).')
        if not isinstance(e.get('variante'), bool):
            saida.append(f'PARA: a voz {e["voz"]} está sem a marca "variante".')

    papeis = base.get('papeis')
    usadas = {}  # voz -> de onde vem
    if not isinstance(papeis, dict):
        saida.append('PARA: falta "papeis" na base.')
    else:
        for p in PAPEIS:
            v = papeis.get(p)
            if not isinstance(v, str):
                saida.append(f'PARA: o papel "{p}" não aponta para uma voz.')
            else:
                usadas.setdefault(v, f'o papel "{p}"')
    regras_cabo = base.get('regrasCabo')
    if not isinstance(regras_cabo, list):
        saida.append('PARA: falta "regrasCabo" na base.')
        regras_cabo = []
    for i, r in enumerate(regras_cabo):
        if not (isinstance(r, dict) and r.get('grupo') in ('mt', 'bt-nu', 'bt-multi')
                and r.get('situacao') in ('novo', 'retirado') and r.get('por') in ('metro', 'condutor')):
            saida.append(f'PARA: a regra de cabo {i + 1} tem valor inválido.')
            continue
        if not isinstance(r.get('voz'), str):
            saida.append(f'PARA: a regra de cabo {i + 1} está sem voz.')
            continue
        # sem bitolas = a chave não existe; "bitolas": null o site recusa
        b = r.get('bitolas')
        if 'bitolas' in r and not (isinstance(b, list) and all(isinstance(x, str) for x in b)):
            saida.append(f'PARA: a regra de cabo {i + 1} tem bitolas inválidas.')
        usadas.setdefault(r['voz'], f'a regra de cabo {i + 1} ({r["grupo"]} {r["situacao"]})')
    tensionar = base.get('tensionar')
    if not isinstance(tensionar, list):
        saida.append('PARA: falta "tensionar" na base.')
        tensionar = []
    for i, t in enumerate(tensionar):
        n = f'a regra de tensionar {i + 1}'
        if not (isinstance(t, dict) and t.get('rede') in ('mt', 'bt')):
            saida.append(f'PARA: {n} tem rede inválida.')
            continue
        ex = t.get('exige')
        if not (isinstance(ex, list) and ex and all(isinstance(x, str) for x in ex)):
            saida.append(f'PARA: {n} está sem expressões.')
            continue
        if t['rede'] == 'mt' and len(ex) > 1:
            saida.append(f'PARA: {n} (MT) tem mais de uma expressão.')
        for x in ex:
            try:
                re.compile(x)
            except re.error:
                saida.append(f'PARA: {n} tem uma expressão que não compila: {x}')
                continue
            fora = _fora_do_js(x)
            if fora:
                saida.append(f'PARA: {n} tem uma expressão que o site (JavaScript) não lê ({fora}): {x}')
        q = t.get('qtd')
        if isinstance(q, bool) or not isinstance(q, (int, float)) or not q > 0:
            saida.append(f'PARA: {n} tem quantidade inválida.')

    nao_variantes = _vozes_nao_variantes(base)
    for v, origem in usadas.items():
        if v not in vozes:
            saida.append(f'PARA: {origem} aponta para a voz {v}, que não está na lista.')
            continue
        total = 0
        for letra in ('A', 'B'):
            n = len(nao_variantes.get((v, letra), []))
            total += n
            if n > 1:
                saida.append(f'PARA: a voz {v} ({origem}) tem mais de uma entrada não variante na letra {letra}.')
        if total == 0:
            saida.append(f'PARA: {origem} aponta para a voz {v}, que só tem entradas variantes.')
        else:
            falta = [l for l in ('A', 'B') if not nao_variantes.get((v, l))]
            if falta:
                saida.append(f'AVISO: a voz {v} ({origem}) não tem entrada não variante na letra {falta[0]}.')

    ambiguas = sorted({v for (v, l), nums in nao_variantes.items() if len(nums) > 1 and v not in usadas})
    if ambiguas:
        saida.append(f'AVISO: {len(ambiguas)} voz(es) fora dos papéis têm mais de uma entrada não variante na mesma letra: '
                     + ', '.join(ambiguas) + '.')
    if anterior is not None:
        saida += _quedas(contagens_mao_de_obra(base), anterior)
    return saida


def contagens_mao_de_obra(base):
    return {'vozes': len(base['lista']),
            'regras': len(base['papeis']) + len(base['regrasCabo']) + len(base['tensionar'])}


def _para_arquivo(base):
    """Tira o que só serve para conferir (a zona da planilha)."""
    saida = dict(base)
    saida['lista'] = [{k: v for k, v in e.items() if k != 'zona'} for e in base['lista']]
    return saida


# ---------- arquivo ----------

def gerar_gz(base):
    # mtime=0 e chaves em ordem: o mesmo conteúdo sempre dá o mesmo arquivo (e a mesma versão)
    texto = json.dumps(base, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    return gzip.compress(texto.encode('utf-8'), mtime=0)


def versao(gz):
    return hashlib.sha256(gz).hexdigest()[:12]


# ---------- Supabase (uma função por chamada) ----------

def ler_env(caminho=None):
    caminho = pathlib.Path(caminho or ARQUIVO_ENV)
    if not caminho.exists():
        raise ErroBase(f'Falta o arquivo {caminho}. Crie com duas linhas:\n'
                       'SUPABASE_URL=https://seu-projeto.supabase.co\n'
                       'SUPABASE_SERVICE_ROLE_KEY=a chave secreta (service_role)')
    valores = {}
    for linha in caminho.read_text(encoding='utf-8-sig').splitlines():
        linha = linha.strip()
        if linha and not linha.startswith('#') and '=' in linha:
            k, v = linha.split('=', 1)
            valores[k.strip()] = v.strip().strip('"').strip("'")
    for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
        if not valores.get(k):
            raise ErroBase(f'Falta {k} no arquivo {caminho}.')
    return valores['SUPABASE_URL'].rstrip('/'), valores['SUPABASE_SERVICE_ROLE_KEY']


def _chamar(url, chave, metodo, corpo=None, tipo=None, extra=None):
    cab = {'apikey': chave, 'Authorization': f'Bearer {chave}'}
    if tipo:
        cab['Content-Type'] = tipo
    cab.update(extra or {})
    req = urllib.request.Request(url, data=corpo, method=metodo, headers=cab)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode('utf-8', 'replace')[:300]
        raise ErroBase(f'O Supabase recusou ({metodo} {url.split("?")[0]}): {e.code} {detalhe}')
    except urllib.error.URLError as e:
        raise ErroBase(f'Sem conexão com o Supabase: {e.reason}')


def ler_linha(url, chave, nome):
    dados = json.loads(_chamar(f'{url}/rest/v1/bases?nome=eq.{nome}&select=*', chave, 'GET') or b'[]')
    return dados[0] if dados else None


def subir_arquivo(url, chave, arquivo, gz):
    # x-upsert: se uma rodada anterior subiu o arquivo mas falhou na linha, a nova tentativa não trava em 409
    _chamar(f'{url}/storage/v1/object/bases/{arquivo}', chave, 'POST', gz, 'application/gzip',
            {'x-upsert': 'true'})


def gravar_linha(url, chave, linha):
    _chamar(f'{url}/rest/v1/bases', chave, 'POST', json.dumps(linha).encode('utf-8'),
            'application/json', {'Prefer': 'resolution=merge-duplicates'})


def apagar_arquivos(url, chave, arquivos):
    _chamar(f'{url}/storage/v1/object/bases', chave, 'DELETE',
            json.dumps({'prefixes': arquivos}).encode('utf-8'), 'application/json')


# ---------- comando ----------

def _mostrar(antes, depois):
    print('Contagens (antes -> depois):')
    for chave, n in depois.items():
        print(f'  {NOMES_CONTAGEM.get(chave, chave)}: {(antes or {}).get(chave, "-")} -> {n}')


def _confirmar(avisos, sim):
    for a in avisos:
        print(a)
    if avisos and not sim:
        if input('Continuar? (s/n) ').strip().lower() != 's':
            raise ErroBase('Cancelado. Nada foi enviado.')


def executar(nome, origem, seco=False, sim=False, regras=None):
    if nome == 'enel':
        base = ler_enel(origem)
        novas = contagens(base)
    elif nome == 'mao-de-obra':
        lista = ler_precificacao(origem)
        base = montar_mao_de_obra(lista, ler_regras(regras or PASTA_BASES / 'regras-mao-de-obra.json'))
        novas = contagens_mao_de_obra(base)
        if lista.puladas:
            print(f'{lista.puladas} linha(s) da planilha puladas (descrição sem <voz>_<A|B>_).')
    else:
        try:
            base = json.loads(pathlib.Path(origem).read_text(encoding='utf-8'))
        except FileNotFoundError:
            raise ErroBase(f'Não achei o arquivo: {origem}')
        conferir_edp(base)
        novas = contagens_edp(base)

    url = chave = linha_antiga = None
    if seco:
        # sem internet: compara com a cópia local da última rodada, se houver
        local = PASTA_BASES / f'{nome}.json'
        anterior = None
        if nome in ('enel', 'mao-de-obra') and local.exists():
            antiga = json.loads(local.read_text(encoding='utf-8'))
            anterior = (contagens if nome == 'enel' else contagens_mao_de_obra)(antiga)
    else:
        url, chave = ler_env()
        linha_antiga = ler_linha(url, chave, nome)
        anterior = (linha_antiga or {}).get('contagens')

    if nome == 'enel':
        problemas = conferir(base, anterior)
    elif nome == 'mao-de-obra':
        problemas = conferir_mao_de_obra(base, anterior)
    else:
        problemas = _quedas(novas, anterior)
    paradas = [p for p in problemas if p.startswith('PARA:')]
    if paradas:
        raise ErroBase('\n'.join(paradas) + '\nNada foi enviado.')

    _mostrar(anterior, novas)
    _confirmar(problemas, sim)

    if nome == 'mao-de-obra':
        base = _para_arquivo(base)  # sem a zona da planilha
    if nome in ('enel', 'mao-de-obra'):
        PASTA_BASES.mkdir(exist_ok=True)
        destino = PASTA_BASES / f'{nome}.json'
        destino.write_text(json.dumps(base, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print(f'Gravado {destino}')

    gz = gerar_gz(base)
    v = versao(gz)
    arquivo = f'{nome}-{v}.json.gz'
    if seco:
        print(f'Modo seco: nada foi enviado. A versão seria {v} ({len(gz) // 1024} KB).')
        return
    antigo = (linha_antiga or {}).get('arquivo')
    if antigo == arquivo:
        print(f'A base "{nome}" no Supabase já está na versão {v}. Nada a fazer.')
        return
    # ordem segura: arquivo novo, depois a linha, e só então apaga o antigo
    subir_arquivo(url, chave, arquivo, gz)
    gravar_linha(url, chave, {'nome': nome, 'versao': v, 'arquivo': arquivo, 'contagens': novas,
                                  'atualizado_em': datetime.datetime.now(datetime.timezone.utc).isoformat()})
    if antigo:
        apagar_arquivos(url, chave, [antigo])
    print(f'Base "{nome}" enviada: versão {v}.')


def main(argv=None):
    p = argparse.ArgumentParser(description='Confere e sobe uma base para o Supabase.')
    p.add_argument('nome', choices=['enel', 'edp', 'mao-de-obra'])
    p.add_argument('origem', help='planilha .xlsx (enel e mao-de-obra) ou kits-edp.json (edp)')
    p.add_argument('--regras', help='regras-mao-de-obra.json (mao-de-obra); padrão: ../bases/regras-mao-de-obra.json')
    p.add_argument('--seco', action='store_true', help='só confere; não usa a internet')
    p.add_argument('--sim', action='store_true', help='não perguntar quando a base cair')
    a = p.parse_args(argv)
    try:
        executar(a.nome, a.origem, a.seco, a.sim, a.regras)
    except ErroBase as e:
        print(f'ERRO: {e}')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
