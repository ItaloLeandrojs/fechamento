# Gera src/data/enel-catalogo.json a partir da base DE-PARA da Enel Ceará
# (ceara-teste/referencia/Base - Estruturas DE PARA.xlsx, fora do git).
# O JSON também fica fora do git: a base é da Enel e o repositório é público.
# Quando a base passar para o Supabase, este arquivo deixa de existir.
#
#   python scripts/gerar-catalogo-enel.py
import json
import pathlib
import warnings

import openpyxl

warnings.filterwarnings('ignore')
raiz = pathlib.Path(__file__).resolve().parent.parent
origem = raiz.parent / 'ceara-teste' / 'referencia' / 'Base - Estruturas DE PARA.xlsx'
destino = raiz / 'src' / 'data' / 'enel-catalogo.json'

wb = openpyxl.load_workbook(origem, read_only=True, data_only=True)

materiais = {}
for r in wb['MATERIAL E4E'].iter_rows(min_row=3, values_only=True):
    codigo, descricao, unidade = r[2], r[3], r[4]
    if codigo is None or descricao is None:
        continue
    materiais[str(codigo).strip()] = [str(descricao).strip(), str(unidade or '').strip()]

estruturas = {}
for r in wb['KIT_ESTRUTURAS E4E'].iter_rows(min_row=3, values_only=True):
    kit, descricao = r[1], r[3]
    if kit:
        estruturas.setdefault(str(kit).strip(), str(descricao or '').strip())

destino.write_text(json.dumps({'materiais': materiais, 'estruturas': estruturas}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(materiais)} materiais e {len(estruturas)} estruturas em {destino}')
