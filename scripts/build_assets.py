"""本採用の地形・海・国境を順番に再生成する。ゲーム内の比較版も生成する。"""
import build_generalized
import build_oceans
import build_map
import build_map_comparison
import build_country_index


if __name__ == '__main__':
    build_generalized.main()
    build_oceans.main()
    build_map.main()
    build_map_comparison.main()
    build_country_index.main()
