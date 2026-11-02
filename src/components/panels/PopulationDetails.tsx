import { COUNTRY_STATISTICS, FIELDS, STAGES, STATISTICS_YEAR } from '../../game/data';
import { generation } from '../../game/metrics';
import { SOCIAL_PROFILES } from '../../game/population';
import type { Population } from '../../game/types';

const valueText = (value: number | null) =>
    value === null ? '未収録（モデル計算では中立値50を仮定）' : `${value.toFixed(1)} / 100`;
export function PopulationDetails({ point }: { point: Population }) {
    const profile = SOCIAL_PROFILES[point.country];
    return (
        <section className="observed-statistics">
            <h3 className="subheading">人口集団 #{point.id + 1}</h3>
            <p>
                {COUNTRY_STATISTICS[point.country].name} ／ {STATISTICS_YEAR}年初期値
            </p>
            <p>
                {['年少世代', '15–64歳', '高齢世代', '年齢未収録'][generation(point.age)]}・
                {FIELDS[point.field]}・{STAGES[point.stage]}
            </p>
            <dl>
                <div>
                    <dt>代表人口</dt>
                    <dd>{(point.weight / 10000).toFixed(1)}万人</dd>
                </div>
                <div>
                    <dt>元セル人口密度</dt>
                    <dd>{point.density.toFixed(0)}人/km²</dd>
                </div>
                <div>
                    <dt>デジタル接続性</dt>
                    <dd>{valueText(point.digital)}</dd>
                </div>
                <div>
                    <dt>教育水準の代理指標</dt>
                    <dd>
                        {valueText(point.education)}
                        {profile.educationYear !== null && `（${profile.educationYear}年）`}
                    </dd>
                </div>
                <div>
                    <dt>経済的余裕の代理指標</dt>
                    <dd>
                        {valueText(point.economic)}
                        {profile.incomeYear !== null && `（${profile.incomeYear}年）`}
                    </dd>
                </div>
                <div>
                    <dt>都市・地方モデル</dt>
                    <dd>{point.urban ? '都市相当' : '地方相当'}</dd>
                </div>
            </dl>
            <h3 className="subheading">心理・社会指標（仮定によるモデル）</h3>
            <dl>
                {(['trust', 'autonomy', 'vigilance', 'conformity'] as const).map((key, index) => (
                    <div key={key}>
                        <dt>{['AI信頼', '自律的判断', '警戒', '同調'][index]}</dt>
                        <dd>
                            {point[key].toFixed(1)} ／ 回帰先 {point.baseline[key].toFixed(1)}
                        </dd>
                    </div>
                ))}
                <div>
                    <dt>社会的つながり</dt>
                    <dd>{point.social.toFixed(1)} / 100</dd>
                </div>
                <div>
                    <dt>AI教育の経験</dt>
                    <dd>{(point.schoolExposure * 100).toFixed(1)}%</dd>
                </div>
            </dl>
            <small>
                人口：{point.demographicSource}
                。位置：GHSL。教育・所得は国別の代理指標で、個々の集団の実測値ではありません。心理・社会的つながり・同調・近隣接点はゲーム内の仮定です。
            </small>
        </section>
    );
}
