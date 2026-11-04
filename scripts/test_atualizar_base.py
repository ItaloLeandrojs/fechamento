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

    def test_env_ausente_diz_onde_criar(self):
        with self.assertRaises(ab.ErroBase) as e:
            ab.ler_env('Z:/nao/existe/supabase.env')
        self.assertIn('supabase.env', str(e.exception))


if __name__ == '__main__':
    unittest.main()
