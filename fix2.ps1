$u8 = [System.Text.Encoding]::UTF8
$bom = New-Object System.Text.UTF8Encoding($true)

$keys = @(
    ([string][char]0x00C3+[string][char]0x00A9),
    ([string][char]0x00C3+[string][char]0x00A3),
    ([string][char]0x00C3+[string][char]0x00A7),
    ([string][char]0x00C3+[string][char]0x00B5),
    ([string][char]0x00C3+[string][char]0x00A1),
    ([string][char]0x00C3+[string][char]0x00AA),
    ([string][char]0x00C3+[string][char]0x00B3),
    ([string][char]0x00C3+[string][char]0x00AD),
    ([string][char]0x00C3+[string][char]0x00A2),
    ([string][char]0x00C3+[string][char]0x00BA),
    ([string][char]0x00C3+[string][char]0x00A0),
    ([string][char]0x00C3+[string][char]0x00B4),
    ([string][char]0x00C3+[string][char]0x00B1),
    ([string][char]0x00C3+[string][char]0x00A8),
    ([string][char]0x00C3+[string][char]0x0192),
    ([string][char]0x00C3+[string][char]0x2021),
    ([string][char]0x00C3+[string][char]0x2030),
    ([string][char]0x00C3+[string][char]0x0086),
    ([string][char]0x00C3+[string][char]0x0093),
    ([string][char]0x00C3+[string][char]0x0094),
    ([string][char]0x00C3+[string][char]0x0095),
    ([string][char]0x00C3+[string][char]0x0161),
    ([string][char]0x00C3+[string][char]0x009C),
    ([string][char]0x00C3+[string][char]0x0080),
    ([string][char]0x00C2+[string][char]0x00B7),
    ([string][char]0x00C2+[string][char]0x00A7),
    ([string][char]0x00C2+[string][char]0x00B0),
    ([string][char]0x00C2+[string][char]0x00A9),
    ([string][char]0x00C2+[string][char]0x00AE),
    ([string][char]0x00C2+[string][char]0x00BD),
    ([string][char]0x00C2+[string][char]0x00A0),
    ([string][char]0x00C2+[string][char]0x00B1),
    ([string][char]0x00C2+[string][char]0x00A3),
    ([string][char]0x00C2+[string][char]0x00B2),
    ([string][char]0x00C2+[string][char]0x00B3),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x00A2),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x201C),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x201D),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x2026),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x2122),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x017E),
    ([string][char]0x00E2+[string][char]0x20AC+[string][char]0x0153),
    ([string][char]0x00EF+[string][char]0x00B8+[string][char]0x008F),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201C+[string][char]0x201E),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201C+[string][char]0x0161),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201C+[string][char]0x2122),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x2018+[string][char]0x00A4),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x2019+[string][char]0x00B0),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x2018+[string][char]0x00A5),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201D+[string][char]0x2019),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201C+[string][char]0x2026),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201C+[string][char]0x008A),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x0081+[string][char]0x00A6),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x2018+[string][char]0x00A3),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x2019+[string][char]0x201C),
    ([string][char]0x00F0+[string][char]0x0178+[string][char]0x201D+[string][char]0x201D)
)

$vals = @(
    [string][char]0x00E9, # e agudo
    [string][char]0x00E3, # a til
    [string][char]0x00E7, # c cedilha
    [string][char]0x00F5, # o til
    [string][char]0x00E1, # a agudo
    [string][char]0x00EA, # e circunflexo
    [string][char]0x00F3, # o agudo
    [string][char]0x00ED, # i agudo
    [string][char]0x00E2, # a circunflexo
    [string][char]0x00FA, # u agudo
    [string][char]0x00E0, # a grave
    [string][char]0x00F4, # o circunflexo
    [string][char]0x00F1, # n til
    [string][char]0x00E8, # e grave
    [string][char]0x00C3, # A til (Ã)
    [string][char]0x00C7, # C cedilha maiusc
    [string][char]0x00C9, # E agudo maiusc
    [string][char]0x00C6, # AE maiusc
    [string][char]0x00D3, # O agudo maiusc
    [string][char]0x00D4, # O circunf maiusc
    [string][char]0x00D5, # O til maiusc
    [string][char]0x00DA, # U agudo maiusc
    [string][char]0x00DC, # U umlaut maiusc
    [string][char]0x00C0, # A grave maiusc
    [string][char]0x00B7, # middle dot
    [string][char]0x00A7, # section sign
    [string][char]0x00B0, # degree sign
    [string][char]0x00A9, # copyright
    [string][char]0x00AE, # registered
    [string][char]0x00BD, # 1/2
    [string][char]0x00A0, # nbsp
    [string][char]0x00B1, # plus-minus
    [string][char]0x00A3, # pound sign
    [string][char]0x00B2, # superscript 2
    [string][char]0x00B3, # superscript 3
    [string][char]0x2022, # bullet
    [string][char]0x2013, # en dash
    [string][char]0x2014, # em dash
    [string][char]0x2026, # ellipsis
    [string][char]0x2122, # trademark
    [string][char]0x017E, # z caron
    [string][char]0x0153, # oe ligature
    [string][char]0xFE0F, # variation selector
    ([string][char]0xD83D+[string][char]0xDCC4), # emoji 📄
    ([string][char]0xD83D+[string][char]0xDCDA), # emoji 📚
    ([string][char]0xD83D+[string][char]0xDCCB), # emoji 📋
    ([string][char]0xD83D+[string][char]0xDC64), # emoji 👤
    ([string][char]0xD83D+[string][char]0xDCB0), # emoji 💰
    ([string][char]0xD83D+[string][char]0xDC65), # emoji 👥
    ([string][char]0xD83D+[string][char]0xDD11), # emoji 🔑
    ([string][char]0xD83D+[string][char]0xDCC5), # emoji 📅
    ([string][char]0xD83D+[string][char]0xDCCA), # emoji 📊
    ([string][char]0xD83C+[string][char]0xDFE6), # emoji 🏦
    ([string][char]0xD83D+[string][char]0xDCC3), # emoji 📃
    ([string][char]0xD83D+[string][char]0xDCB3), # emoji 💳
    ([string][char]0xD83D+[string][char]0xDD12)  # emoji 🔒
)

$total = 0
$files = Get-ChildItem -Recurse "C:\BACKUP\DESENVOLVIMENTO\gestaoeklesia\src" -Filter "*.tsx"
foreach ($file in $files) {
    $c = [System.IO.File]::ReadAllText($file.FullName, $u8)
    $orig = $c
    for ($i = 0; $i -lt $keys.Length; $i++) {
        $c = $c.Replace($keys[$i], $vals[$i])
    }
    if ($c -ne $orig) {
        [System.IO.File]::WriteAllText($file.FullName, $c, $bom)
        $total++
        Write-Host "Corrigido: $($file.FullName)"
    }
}
Write-Host "--- Total: $total arquivos corrigidos ---"
