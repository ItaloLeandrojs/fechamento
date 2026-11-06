# Testes do atualizar_base.py. Só dados inventados. Rodar:
#   python -m unittest scripts/test_atualizar_base.py -v
import contextlib
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

import openpyxl

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import atualizar_base as ab  # noqa: E402


def montar_planilha(pasta, sem_aba_kits=False):
    wb = openpyxl.Workbook()
    mat = wb.active
    mat.title = 'MATERIAL E4E'
    mat.append([None, 'DE', 'PARA'])
    mat.append(['Localizador', 'Código SIE', 'Código E4E', 'Descrição', 'Unidade de Medida'])
    mat.append(['x1', 1, 100001, 'Parafuso inventado', 'UN'])
    mat.append(['x2', 2, 100002, 'Cabo inventado', 'M'])
    mat.append(['x3', 3, 100003, 'Sem unidade', None])
    if not sem_aba_kits:
        kit = wb.create_sheet('KIT_ESTRUTURAS E4E')
        kit.append([None, 'DE', 'PARA'])
        kit.append(['Localizador', 'CODIGO_KIT', 'CODIGO_KIT_E4E', 'Descrição_KIT', 'CODIGO_MATERIAL_SIE',
                    'CODIGO_MATERIAL_E4E', 'Descrição_Material', 'UNIDADE_MEDIDA_PADRAO', 'QTD_MATERIA DO KIT',
                    'Considerar', 'Quantidade Real'])
        kit.append(['k1', 'KITA', 'EA', 'Estrutura A', 1, 100001, 'Parafuso', 'UN', 2, 'Sim', 9])
        kit.append([None, 'KITA', 'EA', 'Estrutura A', 2, 100002, 'Cabo', 'M', 1, None, None])
        kit.append(['k3', 'KITB', 'EB', 'Estrutura B', 1, 100001, 'Parafuso', 'UN', 4, None, None])
        kit.append(['k4', 'KITB', 'EB', 'Estrutura B', None, None, None, None, None, None, None])
    caminho = os.path.join(pasta, 'base.xlsx')
    wb.save(caminho)
    return caminho


def base(n_mat=3, n_est=100, n_linhas=10):
    return {'materiais': {str(i): ['d', 'UN'] for i in range(n_mat)},
            'estruturas': {str(i): 'e' for i in range(n_est)},
            'kits': {'K': [['1', 1]] * n_linhas}}


BOM = bytes([0xEF, 0xBB, 0xBF])
NL = bytes([10])


class LeituraEConferencia(unittest.TestCase):
    def test_le_kits_pela_qtd_do_kit(self):
        with tempfile.TemporaryDirectory() as pasta:
            r = ab.ler_enel(montar_planilha(pasta))
        self.assertEqual(r['kits']['KITA'], [['100001', 2], ['100002', 1]])
        self.assertEqual(r['kits']['KITB'], [['100001', 4]])  # linha sem material é ignorada
        self.assertEqual(r['estruturas'], {'KITA': 'Estrutura A', 'KITB': 'Estrutura B'})
        self.assertEqual(r['materiais']['100003'], ['Sem unidade', ''])

    def test_aba_faltando(self):
        with tempfile.TemporaryDirectory() as pasta:
            caminho = montar_planilha(pasta, sem_aba_kits=True)
            with self.assertRaises(ab.ErroBase) as e:
                ab.ler_enel(caminho)
        self.assertIn('KIT_ESTRUTURAS E4E', str(e.exception))

    def test_queda_grande_pede_confirmacao(self):
        r = ab.conferir(base(n_est=97), {'materiais': 3, 'estruturas': 100, 'linhas_kit': 10})
        self.assertTrue(any('100' in x and '97' in x and x.startswith('AVISO') for x in r), r)

    def test_queda_pequena_nao_avisa(self):
        r = ab.conferir(base(n_est=99), {'materiais': 3, 'estruturas': 100, 'linhas_kit': 10})
        self.assertEqual(r, [])

    def test_base_vazia_para(self):
        r = ab.conferir(base(n_mat=0), None)
        self.assertTrue(any(x.startswith('PARA') for x in r), r)

    def test_versao_estavel(self):
        gz = ab.gerar_gz(base())
        self.assertEqual(ab.versao(gz), ab.versao(ab.gerar_gz(base())))
        self.assertEqual(len(ab.versao(gz)), 12)


class Resposta:
    def __init__(self, corpo=b''):
        self.corpo = corpo

    def read(self):
        return self.corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class SubidaComRedeFalsa(unittest.TestCase):
    def setUp(self):
        self.chamadas = []
        self.linha_antiga = None

    def falso(self, req, timeout=None):
        self.chamadas.append(req)
        if req.get_method() == 'GET':
            return Resposta(json.dumps([self.linha_antiga] if self.linha_antiga else []).encode())
        return Resposta()

    def rodar(self, pasta, **kw):
        env = pathlib.Path(pasta) / 'supabase.env'
        env.write_text('SUPABASE_URL=https://abc.supabase.co/\nSUPABASE_SERVICE_ROLE_KEY=segredo-falso\n')
        xlsx = montar_planilha(pasta)
        with mock.patch.object(ab, 'ARQUIVO_ENV', env), mock.patch.object(ab, 'PASTA_BASES', pathlib.Path(pasta) / 'bases'), \
                mock.patch('urllib.request.urlopen', self.falso), contextlib.redirect_stdout(io.StringIO()):
            ab.executar('enel', xlsx, **kw)

    def test_linha_leva_atualizado_em_em_utc(self):
        with tempfile.TemporaryDirectory() as pasta:
            self.rodar(pasta)
        linha = json.loads([c for c in self.chamadas if c.full_url.endswith('/rest/v1/bases') and c.get_method() == 'POST'][0].data)
        self.assertTrue(linha['atualizado_em'].endswith('+00:00'))

    def test_sobe_novo_grava_linha_e_apaga_o_antigo(self):
        self.linha_antiga = {'nome': 'enel', 'arquivo': 'enel-antigo.json.gz',
                             'contagens': {'materiais': 3, 'estruturas': 2, 'linhas_kit': 3}}
        with tempfile.TemporaryDirectory() as pasta:
            self.rodar(pasta)
        metodos = [(c.get_method(), c.full_url) for c in self.chamadas]
        self.assertEqual([m for m, _ in metodos], ['GET', 'POST', 'POST', 'DELETE'])
        self.assertTrue(metodos[1][1].startswith('https://abc.supabase.co/storage/v1/object/bases/enel-'))
        self.assertTrue(metodos[1][1].endswith('.json.gz'))
        self.assertEqual(metodos[2][1], 'https://abc.supabase.co/rest/v1/bases')
        self.assertEqual(metodos[3][1], 'https://abc.supabase.co/storage/v1/object/bases')
        up, linha, apagar = self.chamadas[1:]
        for c in self.chamadas:
            self.assertEqual(c.get_header('Apikey'), 'segredo-falso')
            self.assertEqual(c.get_header('Authorization'), 'Bearer segredo-falso')
        self.assertEqual(up.get_header('Content-type'), 'application/gzip')
        self.assertEqual(up.get_header('X-upsert'), 'true')
        self.assertEqual(linha.get_header('Prefer'), 'resolution=merge-duplicates')
        corpo = json.loads(linha.data)
        self.assertEqual(corpo['nome'], 'enel')
        self.assertEqual(corpo['contagens'], {'materiais': 3, 'estruturas': 2, 'linhas_kit': 3})
        self.assertEqual(up.full_url.rsplit('/', 1)[1], corpo['arquivo'])
        self.assertEqual(json.loads(apagar.data), {'prefixes': ['enel-antigo.json.gz']})

    def test_mesma_versao_nao_faz_nada(self):
        with tempfile.TemporaryDirectory() as pasta:
            self.rodar(pasta)
            enviado = json.loads(self.chamadas[2].data)
            self.chamadas.clear()
            self.linha_antiga = enviado
            self.rodar(pasta)
        self.assertEqual([c.get_method() for c in self.chamadas], ['GET'])

    def test_seco_nao_usa_rede_nem_env(self):
        with tempfile.TemporaryDirectory() as pasta:
            xlsx = montar_planilha(pasta)
            with mock.patch.object(ab, 'ARQUIVO_ENV', pathlib.Path(pasta) / 'nao-existe.env'), \
                    mock.patch.object(ab, 'PASTA_BASES', pathlib.Path(pasta) / 'bases'), \
                    mock.patch('urllib.request.urlopen', side_effect=AssertionError('usou a rede')), \
                    contextlib.redirect_stdout(io.StringIO()):
                ab.executar('enel', xlsx, seco=True)
            self.assertTrue((pathlib.Path(pasta) / 'bases' / 'enel.json').exists())

    def test_env_com_bom_do_powershell(self):
        with tempfile.TemporaryDirectory() as pasta:
            env = pathlib.Path(pasta) / 'supabase.env'
            env.write_bytes(BOM + b'SUPABASE_URL=https://abc.supabase.co' + NL + b'SUPABASE_SERVICE_ROLE_KEY=segredo-falso' + NL)
            url, chave = ab.ler_env(env)
        self.assertEqual(url, 'https://abc.supabase.co')
        self.assertEqual(chave, 'segredo-falso')

    def test_env_ausente_diz_onde_criar(self):
        with self.assertRaises(ab.ErroBase) as e:
            ab.ler_env('Z:/nao/existe/supabase.env')
        self.assertIn('supabase.env', str(e.exception))


# ---------- mão de obra ----------

CAB_PRECIFICACAO = ['Código Serviço', 'Descrição Serviço', 'TOTAL(R$)', 'Unidade', 'Grupo', 'Departamento', 'Zona']
PAPEIS_TESTE = ['poste-mt', 'poste-bt', 'retirada-poste-mt', 'retirada-poste-bt',
                'retirada-poste-lv-passante', 'retirada-poste-lv-encabecamento', 'cava-rocha',
                'cruzeta-nu', 'cruzeta-isolado', 'retirada-cruzeta-passante', 'retirada-cruzeta-encabecamento',
                'lv-instalacao-passante', 'lv-retirada-passante', 'lv-instalacao-encabecamento', 'lv-retirada-encabecamento',
                'armacao-bt', 'retirada-armacao-bt',
                'trafo', 'estrutura-trafo', 'retirada-trafo', 'retirada-estrutura-trafo',
                'caixa', 'conector-4-saidas', 'tensionar', 'operacao-equipamento']


def montar_precificacao(pasta, linhas, cabecalho=None):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Sheet1'
    ws.append(cabecalho or CAB_PRECIFICACAO)
    for l in linhas:
        ws.append(l)
    caminho = os.path.join(pasta, 'preco.xlsx')
    wb.save(caminho)
    return caminho


def linha(numero, desc, dep='MULTISERVICOS SUL', zona='Urbana', unidade='UN'):
    return [numero, desc, 1.5, unidade, 'GRUPO', dep, zona]


def papeis_teste(voz='XX110'):
    p = {k: voz for k in PAPEIS_TESTE}
    p['tensionar'] = 'XX212'
    return p


def regras_teste(**mudar):
    r = {'papeis': papeis_teste(),
         'regrasCabo': [{'grupo': 'mt', 'situacao': 'novo', 'voz': 'XX212', 'por': 'metro', 'bitolas': ['004']}],
         'tensionar': [{'rede': 'mt', 'exige': ['^M3'], 'qtd': 1}]}
    r.update(mudar)
    return r


def lista_teste():
    return [{'voz': 'XX110', 'letra': 'A', 'numero': '9000000001', 'descricao': 'Servico um', 'unidade': 'UN', 'variante': False},
            {'voz': 'XX212', 'letra': 'A', 'numero': '9000000002', 'descricao': 'Servico dois', 'unidade': 'UN', 'variante': False},
            {'voz': 'XX110', 'letra': 'B', 'numero': '9000000003', 'descricao': 'Servico tres', 'unidade': 'UN', 'variante': False}]


def base_mo(lista=None, **regras):
    return ab.montar_mao_de_obra(lista if lista is not None else lista_teste(), regras_teste(**regras))


def paradas(r):
    return [x for x in r if x.startswith('PARA:')]


class MaoDeObra(unittest.TestCase):
    def ler(self, linhas, **kw):
        with tempfile.TemporaryDirectory() as pasta:
            return ab.ler_precificacao(montar_precificacao(pasta, linhas, **kw))

    def test_le_precificacao_uma_por_numero(self):
        r = self.ler([linha(9000000001, 'XX110_A_Descricao C.SUL', 'MULTISERVICOS C.SUL'),
                      linha(9000000001, 'XX110_A_Descricao LESTE', 'MULTISERVICOS LESTE'),
                      linha(9000000001, 'XX110_A_Descricao SUL', 'MULTISERVICOS SUL')])
        self.assertEqual(r, [{'voz': 'XX110', 'letra': 'A', 'numero': '9000000001',
                              'descricao': 'XX110_A_Descricao SUL', 'unidade': 'UN', 'variante': False, 'zona': 'A'}])

    def test_sem_sul_fica_a_primeira(self):
        r = self.ler([linha(9000000001, 'XX110_A_Primeira', 'MULTISERVICOS LESTE'),
                      linha(9000000001, 'XX110_A_Segunda', 'MULTISERVICOS C.SUL')])
        self.assertEqual([x['descricao'] for x in r], ['XX110_A_Primeira'])

    def test_variantes_marcadas(self):
        r = self.ler([linha(9000000010, 'XX212_A_GRP A - Descricao'),
                      linha(9000000011, 'XX212_A_(TELECONT) Descricao'),
                      linha(9000000012, 'XX212_A_TENSIONAR coisa')])
        self.assertEqual({x['numero']: x['variante'] for x in r},
                         {'9000000010': True, '9000000011': True, '9000000012': False})

    def test_linha_sem_prefixo_pulada(self):
        r = self.ler([linha(9000000001, 'XX110_A_Boa'), linha(9000000002, 'Descricao sem prefixo'),
                      linha(9000000003, 'XX11_A_curto')])
        self.assertEqual(len(r), 1)
        self.assertEqual(r.puladas, 2)

    def test_cabecalho_mudou_para(self):
        cab = list(CAB_PRECIFICACAO)
        cab[6] = 'Outra'
        with tempfile.TemporaryDirectory() as pasta:
            caminho = montar_precificacao(pasta, [linha(9000000001, 'XX110_A_Boa')], cabecalho=cab)
            with self.assertRaises(ab.ErroBase) as e:
                ab.ler_precificacao(caminho)
        self.assertIn('coluna G', str(e.exception))
        self.assertIn('zona', str(e.exception))

    def test_base_valida_nao_para(self):
        self.assertEqual(paradas(ab.conferir_mao_de_obra(base_mo())), [])

    def test_lista_vazia_para(self):
        self.assertTrue(paradas(ab.conferir_mao_de_obra(base_mo(lista=[]))))

    def test_letra_diferente_da_zona_para(self):
        r = self.ler([linha(9000000001, 'XX110_A_Boa', zona='Rural'), linha(9000000002, 'XX212_A_Boa')])
        b = ab.montar_mao_de_obra(r, regras_teste())
        self.assertTrue(any('XX110' in x and x.startswith('PARA:') for x in ab.conferir_mao_de_obra(b)))

    def test_bitolas_null_para(self):
        cabo = [{'grupo': 'mt', 'situacao': 'novo', 'voz': 'XX212', 'por': 'metro', 'bitolas': None}]
        self.assertTrue(any('bitolas' in x for x in paradas(ab.conferir_mao_de_obra(base_mo(regrasCabo=cabo)))))
        # sem a chave continua valendo (todas as bitolas)
        sem = [{'grupo': 'mt', 'situacao': 'novo', 'voz': 'XX212', 'por': 'metro'}]
        self.assertEqual(paradas(ab.conferir_mao_de_obra(base_mo(regrasCabo=sem))), [])

    def _expressao_para(self, x):
        b = base_mo(tensionar=[{'rede': 'mt', 'exige': [x], 'qtd': 1}])
        return [p for p in paradas(ab.conferir_mao_de_obra(b)) if 'JavaScript' in p]

    def test_expressao_so_python_para(self):
        for x in ('(?P<tipo>M)3', '(?P<t>M)(?P=t)', r'M3\Z', r'\AM3', '(?i)m3', '(?i:m)3', '(?#nota)M3'):
            with self.subTest(x=x):
                self.assertTrue(self._expressao_para(x))

    def test_expressao_comum_passa(self):
        # r'M3\\Z' é uma barra de verdade seguida de Z: vale nos dois
        for x in ('^M3', '^(M|N)B?3', '^S2[NC]$', '(?:CCN|CSR)', '(?=M)M3', r'M3\\Z'):
            with self.subTest(x=x):
                self.assertEqual(self._expressao_para(x), [])

    def test_papel_com_voz_fora_para(self):
        b = base_mo(papeis={**papeis_teste(), 'caixa': 'XX999'})
        self.assertTrue(any('XX999' in x for x in paradas(ab.conferir_mao_de_obra(b))))

    def test_papel_so_com_variante_para(self):
        lista = lista_teste()
        lista[0]['variante'] = True
        lista[2]['variante'] = True
        b = base_mo(lista=lista)
        self.assertTrue(any('XX110' in x for x in paradas(ab.conferir_mao_de_obra(b))))

    def test_papel_com_voz_ambigua_para(self):
        lista = lista_teste() + [{'voz': 'XX110', 'letra': 'A', 'numero': '9000000004', 'descricao': 'Outra', 'unidade': 'UN', 'variante': False}]
        r = ab.conferir_mao_de_obra(base_mo(lista=lista))
        self.assertTrue(any('XX110' in x and 'mais de uma' in x for x in paradas(r)), r)

    def test_voz_ambigua_fora_de_papel_so_avisa(self):
        lista = lista_teste() + [{'voz': 'XX300', 'letra': 'A', 'numero': '9000000005', 'descricao': 'a', 'unidade': 'UN', 'variante': False},
                                 {'voz': 'XX300', 'letra': 'A', 'numero': '9000000006', 'descricao': 'b', 'unidade': 'UN', 'variante': False}]
        r = ab.conferir_mao_de_obra(base_mo(lista=lista))
        self.assertEqual(paradas(r), [])
        self.assertTrue(any(x.startswith('AVISO') and 'XX300' in x for x in r), r)

    def test_regra_com_voz_fora_para(self):
        b = base_mo(regrasCabo=[{'grupo': 'mt', 'situacao': 'novo', 'voz': 'XX999', 'por': 'metro'}])
        self.assertTrue(any('XX999' in x for x in paradas(ab.conferir_mao_de_obra(b))))

    def test_regra_de_cabo_valor_invalido_para(self):
        b = base_mo(regrasCabo=[{'grupo': 'mt', 'situacao': 'novo', 'voz': 'XX212', 'por': 'litro'}])
        self.assertTrue(paradas(ab.conferir_mao_de_obra(b)))

    def test_tensionar_expressao_invalida_para(self):
        b = base_mo(tensionar=[{'rede': 'mt', 'exige': ['^(M'], 'qtd': 1}])
        self.assertTrue(any('tensionar' in x for x in paradas(ab.conferir_mao_de_obra(b))))

    def test_tensionar_mt_com_duas_expressoes_para(self):
        b = base_mo(tensionar=[{'rede': 'mt', 'exige': ['^M3', '^M4'], 'qtd': 1}])
        self.assertTrue(paradas(ab.conferir_mao_de_obra(b)))

    def test_tensionar_qtd_invalida_para(self):
        b = base_mo(tensionar=[{'rede': 'bt', 'exige': ['^S2N$'], 'qtd': 0}])
        self.assertTrue(paradas(ab.conferir_mao_de_obra(b)))

    def test_papel_faltando_para(self):
        p = papeis_teste()
        del p['caixa']
        self.assertTrue(any('caixa' in x for x in paradas(ab.conferir_mao_de_obra(base_mo(papeis=p)))))

    def test_numero_fora_do_padrao_para(self):
        lista = lista_teste()
        lista[0]['numero'] = '123'
        self.assertTrue(paradas(ab.conferir_mao_de_obra(base_mo(lista=lista))))

    def test_queda_de_vozes_avisa(self):
        r = ab.conferir_mao_de_obra(base_mo(), {'vozes': 100, 'regras': 27})
        self.assertTrue(any(x.startswith('AVISO') and 'vozes' in x for x in r), r)

    def test_contagens(self):
        self.assertEqual(ab.contagens_mao_de_obra(base_mo()), {'vozes': 3, 'regras': 27})

    def test_ler_regras_sem_parte_para(self):
        with tempfile.TemporaryDirectory() as pasta:
            f = pathlib.Path(pasta) / 'r.json'
            f.write_text(json.dumps({'papeis': {}}), encoding='utf-8')
            with self.assertRaises(ab.ErroBase):
                ab.ler_regras(f)
            with self.assertRaises(ab.ErroBase):
                ab.ler_regras(pathlib.Path(pasta) / 'nao-existe.json')

    def test_ler_regras_ok(self):
        with tempfile.TemporaryDirectory() as pasta:
            f = pathlib.Path(pasta) / 'r.json'
            f.write_text(json.dumps(regras_teste()), encoding='utf-8')
            self.assertEqual(ab.ler_regras(f), regras_teste())

    def test_seco_grava_json_sem_internet(self):
        with tempfile.TemporaryDirectory() as pasta:
            xlsx = montar_precificacao(pasta, [linha(9000000001, 'XX110_A_Servico um'), linha(9000000002, 'XX212_A_Servico dois'),
                                               linha(9000000003, 'XX110_B_Servico tres', zona='Rural'),
                                               linha(9000000004, 'XX212_B_Servico quatro', zona='Rural')])
            regras = pathlib.Path(pasta) / 'regras.json'
            regras.write_text(json.dumps(regras_teste()), encoding='utf-8')
            with mock.patch.object(ab, 'ARQUIVO_ENV', pathlib.Path(pasta) / 'nao-existe.env'), \
                    mock.patch.object(ab, 'PASTA_BASES', pathlib.Path(pasta) / 'bases'), \
                    mock.patch.object(ab, '_chamar', side_effect=AssertionError('usou a rede')), \
                    mock.patch('urllib.request.urlopen', side_effect=AssertionError('usou a rede')), \
                    contextlib.redirect_stdout(io.StringIO()) as saida:
                self.assertEqual(ab.main(['mao-de-obra', xlsx, '--regras', str(regras), '--seco']), 0)
            gravado = json.loads((pathlib.Path(pasta) / 'bases' / 'mao-de-obra.json').read_text(encoding='utf-8'))
        self.assertEqual(len(gravado['lista']), 4)
        self.assertNotIn('zona', gravado['lista'][0])
        self.assertEqual(gravado['papeis']['tensionar'], 'XX212')
        self.assertIn('Modo seco', saida.getvalue())

    def test_seco_com_problema_nao_grava(self):
        with tempfile.TemporaryDirectory() as pasta:
            xlsx = montar_precificacao(pasta, [linha(9000000001, 'XX110_A_Servico um')])
            regras = pathlib.Path(pasta) / 'regras.json'
            regras.write_text(json.dumps(regras_teste()), encoding='utf-8')  # XX212 não existe na planilha
            with mock.patch.object(ab, 'PASTA_BASES', pathlib.Path(pasta) / 'bases'), \
                    contextlib.redirect_stdout(io.StringIO()) as saida:
                self.assertEqual(ab.main(['mao-de-obra', xlsx, '--regras', str(regras), '--seco']), 1)
            self.assertFalse((pathlib.Path(pasta) / 'bases' / 'mao-de-obra.json').exists())
        self.assertIn('XX212', saida.getvalue())


if __name__ == '__main__':
    unittest.main()
