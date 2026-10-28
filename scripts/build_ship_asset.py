"""KenneyのCC0貨物船モデルを真上から投影し、細部を省いた船影SVGを生成する。"""
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def main():
    source = ROOT / 'data/transport/watercraft/ship-cargo-a.obj'
    positions = []
    faces = []
    for line in source.read_text(encoding='utf-8').splitlines():
        values = line.split()
        if not values:
            continue
        if values[0] == 'v':
            positions.append([float(value) for value in values[1:4]])
        elif values[0] == 'f':
            indices = [int(value.split('/')[0])-1 for value in values[1:]]
            faces.extend([[indices[0], indices[i], indices[i+1]] for i in range(1, len(indices)-1)])
    positions = np.array(positions)
    faces = np.array(faces)
    triangles = positions[faces]
    normal = np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0])
    visible = triangles[normal[:, 1] > .0001]
    shapes = []
    scale = min(160/np.ptp(positions[:, 0]), 480/np.ptp(positions[:, 2]))
    center_z = (positions[:, 2].max()+positions[:, 2].min())/2
    maximum_height = positions[:, 1].max()
    # 上面だけを描き、側面・水中部分・影を持ち込まない。
    for triangle in sorted(visible, key=lambda item: item[:, 1].mean()):
        height = float(triangle[:, 1].mean())
        color = '#a1b2b7' if height < maximum_height*.35 else '#cdd1c7' if height < maximum_height*.7 else '#7b8d93'
        coordinates = ' '.join(f'{96+x*scale:.2f},{256-(z-center_z)*scale:.2f}' for x, _, z in triangle)
        shapes.append(f'<polygon fill="{color}" points="{coordinates}"/>')
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512">'+''.join(shapes)+'</svg>\n'
    (ROOT / 'public/ui/traffic/ship.svg').write_text(svg, encoding='utf-8')
    print(f'俯瞰の船影: {len(shapes)}面')


if __name__ == '__main__':
    main()
