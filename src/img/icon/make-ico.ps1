# Builds an .ico (and a .png of every size side by side, each at its real size) from an SVG: Edge renders every size on a transparent page,
# each size at its own resolution, and the frames are stored as PNG entries in the .ico.
#   .\make-ico.ps1                      # foldex.svg -> foldex.ico + foldex.png
#   .\make-ico.ps1 -Svg other.svg
param(
    [string]$Svg = (Join-Path $PSScriptRoot 'foldex.svg'),
    [int[]]$Sizes = @(16, 20, 24, 32, 40, 48, 64, 256)
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$Svg = (Resolve-Path $Svg).Path
$base = [IO.Path]::ChangeExtension($Svg, $null).TrimEnd('.')
$work = Join-Path ([IO.Path]::GetTempPath()) ("make-ico-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $work | Out-Null
try {
    # All sizes side by side on one transparent sheet.
    $x = 0; $html = '<html><body style="margin:0;background:transparent">'
    $svgUrl = 'file:///' + ($Svg -replace '\\', '/')
    # A size with its own drawing (foldex-16.svg: the shapes on whole pixels of that size, so the small icons are
    # sharp) uses it; the others are drawn from the SVG itself.
    foreach ($s in $Sizes) {
        $own = "$base-$s.svg"
        $url = if (Test-Path $own) { 'file:///' + ((Resolve-Path $own).Path -replace '\\', '/') } else { $svgUrl }
        $html += "<img src=`"$url`" style=`"position:absolute;left:${x}px;top:0`" width=$s height=$s>"; $x += $s + 8
    }
    Set-Content "$work\sheet.html" ($html + '</body></html>') -Encoding ascii
    $height = ($Sizes | Measure-Object -Maximum).Maximum
    & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 `
        --window-size=$x,$height --screenshot="$work\sheet.png" "file:///$($work -replace '\\', '/')/sheet.html" 2>$null
    for ($i = 0; -not (Test-Path "$work\sheet.png") -and $i -lt 50; $i++) { Start-Sleep -Milliseconds 200 }

    $sheet = [Drawing.Bitmap]::new("$work\sheet.png")
    $frames = @(); $x = 0
    foreach ($s in $Sizes) {
        $b = $sheet.Clone([Drawing.Rectangle]::new($x, 0, $s, $s), [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $ms = [IO.MemoryStream]::new(); $b.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
        $frames += , @($s, $ms.ToArray())
        $b.Dispose(); $x += $s + 8
    }
    $sheet.Save("$base.png")
    $sheet.Dispose()

    # ICO: header, one 16-byte entry per frame (0 means 256), then the PNG data.
    $out = [IO.MemoryStream]::new(); $w = [IO.BinaryWriter]::new($out)
    $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($f in $frames) {
        $w.Write([byte]($f[0] -band 255)); $w.Write([byte]($f[0] -band 255)); $w.Write([byte]0); $w.Write([byte]0)
        $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$f[1].Length); $w.Write([uint32]$offset)
        $offset += $f[1].Length
    }
    foreach ($f in $frames) { $w.Write($f[1]) }
    [IO.File]::WriteAllBytes("$base.ico", $out.ToArray())
    "Wrote $base.ico and $base.png"
}
finally { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
