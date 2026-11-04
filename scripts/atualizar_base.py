# Confere e sobe as bases do site Fechamento para o Supabase (roda no PC do Italo).
#
#   python scripts/atualizar_base.py enel "<planilha.xlsx>" [--seco] [--sim]
#   python scripts/atualizar_base.py edp ../bases/kits-edp.json [--seco] [--sim]
#
# --seco: lê, confere e grava ../bases/enel.json, mas NÃO sobe nada e não usa a internet.
# --sim:  não pergunta nada quando a base cai mais de 2% (os problemas que param continuam parando).
#
# A chave secreta fica em AUTOMACAO KIT MATERIAL\supabase.env (SUPABASE_URL e
# SUPABASE_SERVICE_ROLE_KEY), fora do repositório.
import argparse
import gzip
import hashlib
import json
import pathlib
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
                  'kits': 'kits', 'itens': 'itens'}


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
    for linha in caminho.read_text(encoding='utf-8').splitlines():
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


def executar(nome, origem, seco=False, sim=False):
    if nome == 'enel':
        base = ler_enel(origem)
        novas = contagens(base)
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
        local = PASTA_BASES / 'enel.json'
        anterior = contagens(json.loads(local.read_text(encoding='utf-8'))) if nome == 'enel' and local.exists() else None
    else:
        url, chave = ler_env()
        linha_antiga = ler_linha(url, chave, nome)
        anterior = (linha_antiga or {}).get('contagens')

    problemas = conferir(base, anterior) if nome == 'enel' else _quedas(novas, anterior)
    paradas = [p for p in problemas if p.startswith('PARA:')]
    if paradas:
        raise ErroBase('\n'.join(paradas) + '\nNada foi enviado.')

    _mostrar(anterior, novas)
    _confirmar(problemas, sim)

    if nome == 'enel':
        PASTA_BASES.mkdir(exist_ok=True)
        destino = PASTA_BASES / 'enel.json'
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
    gravar_linha(url, chave, {'nome': nome, 'versao': v, 'arquivo': arquivo, 'contagens': novas})
    if antigo:
        apagar_arquivos(url, chave, [antigo])
    print(f'Base "{nome}" enviada: versão {v}.')


def main(argv=None):
    p = argparse.ArgumentParser(description='Confere e sobe uma base para o Supabase.')
    p.add_argument('nome', choices=['enel', 'edp'])
    p.add_argument('origem', help='planilha .xlsx (enel) ou kits-edp.json (edp)')
    p.add_argument('--seco', action='store_true', help='só confere; não usa a internet')
    p.add_argument('--sim', action='store_true', help='não perguntar quando a base cair')
    a = p.parse_args(argv)
    try:
        executar(a.nome, a.origem, a.seco, a.sim)
    except ErroBase as e:
        print(f'ERRO: {e}')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
