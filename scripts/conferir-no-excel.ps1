# Abre no Excel de verdade cada .xlsx de uma pasta, manda recalcular tudo e mostra,
# por arquivo: Valor de Material e de Serviço da Check-list, erros no valor (coluna L)
# da ADS, linhas sem descrição/unidade, data, X do Parcial e as linhas novas (vermelhas).
# Uso: powershell -File scripts\conferir-no-excel.ps1 <pasta>
param([string]$Pasta)
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false; $xl.AskToUpdateLinks = $false
try {
  foreach ($arq in Get-ChildItem $Pasta -Filter *.xlsx) {
    try {
      $wb = $xl.Workbooks.Open($arq.FullName, 0, $true)
      $xl.CalculateFull()
      $ws = $wb.Worksheets.Item('ADS'); $cl = $wb.Worksheets.Item('Check-list')
      $ult = $ws.Cells($ws.Rows.Count, 5).End(-4162).Row
      $errL = 0; $errFG = 0; $novas = @()
      for ($r = 2; $r -le $ult; $r++) {
        $e = $ws.Range("E$r").Value2
        if ($e -eq $null -or $e -is [int]) { continue }
        if ($ws.Range("L$r").Value2 -is [int]) { $errL++ }
        if ($ws.Range("F$r").Value2 -is [int] -or $ws.Range("G$r").Value2 -is [int] -or "$($ws.Range("F$r").Value2)" -eq '') { $errFG++ }
        if ($ws.Range("E$r").Font.Color -eq 255 -and "$($ws.Range("H$r").Value2)" -eq '0') { $novas += "$e/$($ws.Range("G$r").Value2)/L=$($ws.Range("L$r").Value2)" }
      }
      $q11 = $cl.Range('Q11').Value2; $q12 = $cl.Range('Q12').Value2
      $fmt = { param($v) if ($v -is [int]) { 'ERRO' } else { '{0:N2}' -f $v } }
      "{0}: Material={1} Servico={2} | erros no valor (L)={3} | sem descrição/unidade={4} | data={5} | parcial W7='{6}' | novas: {7}" -f $arq.BaseName, (& $fmt $q11), (& $fmt $q12), $errL, $errFG, $cl.Range('Q4').Text, $cl.Range('W7').Text, ($novas -join '  ')
      $wb.Close($false)
    } catch { "{0}: ERRO {1}" -f $arq.BaseName, $_.Exception.Message }
  }
} finally { $xl.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null }
