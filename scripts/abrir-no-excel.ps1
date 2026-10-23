# Abre um .xlsx gerado no Excel de verdade (sem mostrar), confere se abre sem erro
# e exporta as fichas em PDF para conferência visual.
# Uso: powershell -File scripts\abrir-no-excel.ps1 <arquivo.xlsx> <pasta-pdf> [abas separadas por ;]
param([string]$Arquivo, [string]$PastaPdf, [string]$Abas = 'Check-list;Ficha Medição Aterramento;Ficha Equipamento;Reparo - D5;DP')
New-Item -ItemType Directory -Force $PastaPdf | Out-Null
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AskToUpdateLinks = $false
try {
  $wb = $xl.Workbooks.Open($Arquivo, 0, $true)
  "Abriu sem erro: " + $wb.Name
  foreach ($n in $Abas.Split(';')) {
    $ws = $wb.Worksheets.Item($n)
    "{0}: visivel={1} formas={2}" -f $n, $ws.Visible, $ws.Shapes.Count
    if ($ws.Visible -eq -1) { $ws.ExportAsFixedFormat(0, (Join-Path $PastaPdf ($n + '.pdf'))) }
  }
  $wb.Close($false)
} catch { "ERRO: " + $_.Exception.Message; exit 1 }
finally { $xl.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null }
