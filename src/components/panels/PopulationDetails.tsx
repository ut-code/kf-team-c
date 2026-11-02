import { COUNTRY_STATISTICS, FIELDS, STAGES, STATISTICS_YEAR } from '../../game/data';
import { generation } from '../../game/engine';
import type { Population } from '../../game/types';
import { percent } from '../widgets';

export function PopulationDetails({ point }: { point: Population }) {
    return (
        <>
            <div className="point-inspection">
                <b>人口集団 #{point.id + 1}</b>
                <span>
                    {['年少世代', '15–64歳', '高齢世代', '年齢未収録'][generation(point.age)]} ·{' '}
                    {FIELDS[point.field]} · {STAGES[point.stage]}
                </span>
                <small>
                    浸透係数（モデル） {point.susceptibility.toFixed(2)} / 近隣{' '}
                    {point.neighbors.length}集団
                </small>
            </div>

            <section className="observed-statistics">
                <h3 className="subheading">人口点の参照統計</h3>
                <p>
                    {COUNTRY_STATISTICS[point.country].name} / {STATISTICS_YEAR}年
                </p>
                <dl>
                    <div>
                        <dt>代表人口</dt>
                        <dd>{(point.weight / 10000).toFixed(1)}万人</dd>
                    </div>
                    <div>
                        <dt>元セルの人口密度</dt>
                        <dd>{point.density.toFixed(0)}人/km²</dd>
                    </div>
                    <div>
                        <dt>国のインターネット利用率</dt>
                        <dd>{point.internet === null ? '未収録' : percent(point.internet)}</dd>
                    </div>
                    <div>
                        <dt>国の都市人口比率</dt>
                        <dd>
                            {COUNTRY_STATISTICS[point.country].urban === null
                                ? '未収録'
                                : `${COUNTRY_STATISTICS[point.country].urban!.toFixed(1)}%`}
                        </dd>
                    </div>
                    <div>
                        <dt>国の就業率（15歳以上）</dt>
                        <dd>{point.employment === null ? '未収録' : percent(point.employment)}</dd>
                    </div>
                    <div>
                        <dt>産業区分の標本</dt>
                        <dd>
                            {point.sector === null
                                ? '該当なし・未収録'
                                : {
                                      agriculture: '農業',
                                      industry: '工業',
                                      services: 'サービス業',
                                  }[point.sector]}
                        </dd>
                    </div>
                </dl>
                <small>
                    位置・密度：GHSL。年齢区分・国別特性：公表統計。接点・浸透係数はゲーム内モデルです。
                </small>
            </section>
        </>
    );
}
