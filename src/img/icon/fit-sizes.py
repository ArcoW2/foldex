# Writes the icon's SVGs: foldex.svg (256 px) and a drawing per small size (foldex-16.svg ...), the same shapes with
# every edge on a whole pixel of that size, so the small icons are sharp; and the same in the green version
# (foldex-green.svg ...). Then make-ico.ps1 makes the .ico and .png of each:
#   python fit-sizes.py
#   .\make-ico.ps1; .\make-ico.ps1 -Svg foldex-green.svg

VERSIONS = {'foldex': '#e04f47', 'foldex-green': '#2e8b47'}   # the square's colour: red, the one used; green kept
TAB = '#ecb43c'        # the folder's back and its tab
PANE = '#f2bf4a'       # the docked pane at its left
FOLDER = '#f7cf5c'     # the folder's front
SMALL = [16, 20, 24, 32, 40, 48, 64]


def svg(s, back):
    k = s / 256
    r = lambda v: int(v * k + 0.5)
    rx_bg = max(1, r(56))
    rx = max(1, r(10)) if s >= 24 else 1
    left, right = r(36), r(220)
    tab_top, tab_end, slope_end, back_top = r(54), r(104), r(122), r(76)
    slope_end = max(slope_end, tab_end + 1)
    back_top = max(back_top, tab_top + 1)
    top, bottom = max(r(96), back_top + 1), r(216)
    pane, gap = r(88), max(1, r(6))   # the hole between the pane and the rest shows the square
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}"><defs><clipPath id="front">'
            f'<rect x="{left}" y="{top}" width="{right - left}" height="{bottom - top}" rx="{rx}"/></clipPath></defs>'
            f'<rect width="{s}" height="{s}" rx="{rx_bg}" fill="{back}"/>'
            f'<path d="M{left} {tab_top + rx} Q{left} {tab_top} {left + rx} {tab_top} H{tab_end} L{slope_end} {back_top} '
            f'H{right - rx} Q{right} {back_top} {right} {back_top + rx} V{top + rx} H{left} Z" fill="{TAB}"/>'
            # The back goes on under the front's round corners; not in the hole.
            f'<rect x="{pane}" y="{top}" width="{gap}" height="{rx}" fill="{back}"/>'
            f'<g clip-path="url(#front)">'
            f'<rect x="{left}" y="{top}" width="{pane - left}" height="{bottom - top}" fill="{PANE}"/>'
            f'<rect x="{pane + gap}" y="{top}" width="{right - pane - gap}" height="{bottom - top}" fill="{FOLDER}"/>'
            f'</g></svg>\n')


for name, back in VERSIONS.items():
    open(f'{name}.svg', 'w', newline='\n').write(svg(256, back))
    for s in SMALL:
        open(f'{name}-{s}.svg', 'w', newline='\n').write(svg(s, back))
