"""本採用の地形・海・国境を順番に再生成する。比較候補は生成しない。"""
import build_generalized
import build_oceans
import build_map


if __name__ == '__main__':
    build_generalized.main()
    build_oceans.main()
    build_map.main()
