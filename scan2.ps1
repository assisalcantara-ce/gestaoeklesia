$u8 = [System.Text.Encoding]::UTF8
$root = 'C:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\src'

$files = Get-ChildItem -Recurse $root -Filter "*.tsx"
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file.FullName, $u8)
    $mojibakeFound = $false
    $sampleChars = @()
    
    for ($i = 0; $i -lt $c.Length - 1; $i++) {
        $cp = [int][char]$c[$i]
        $cpNext = [int][char]$c[$i+1]
        
        # Padrao Ã + char baixo (mojibake de acentuado portugues 2-byte)
        if ($cp -eq 0x00C3 -and $cpNext -ge 0x0080 -and $cpNext -le 0x00BF) {
            $mojibakeFound = $true
            $sampleChars += ("U+{0:X4}+U+{1:X4}" -f $cp, $cpNext)
        }
        # Padrao Â + char baixo (mojibake 2-byte com Â)
        if ($cp -eq 0x00C2 -and $cpNext -ge 0x0080 -and $cpNext -le 0x00BF) {
            $mojibakeFound = $true
            $sampleChars += ("Â+U+{0:X4}" -f $cpNext)
        }
    }
    
    # Tambem checar chars no range C0-C5 seguidos de chars estranhos (unicode > 0x100)
    for ($i = 0; $i -lt $c.Length - 1; $i++) {
        $cp = [int][char]$c[$i]
        $cpNext = [int][char]$c[$i+1]
        if ($cp -eq 0x00E2 -and $cpNext -eq 0x20AC) {
            $mojibakeFound = $true
            $sampleChars += "E2+20AC(emoji/dash mojibake)"
            break
        }
        if ($cp -eq 0x00F0 -and $cpNext -eq 0x0178) {
            $mojibakeFound = $true
            $sampleChars += "F0+0178(emoji mojibake)"
            break
        }
    }
    
    if ($mojibakeFound) {
        $rel = $file.FullName.Replace($root, '')
        Write-Host "MOJIBAKE: $rel"
        Write-Host ("  Exemplos: " + ($sampleChars | Select-Object -First 5) -join ', ')
    }
}
Write-Host "--- Scan completo ---"
