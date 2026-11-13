import { ArrowLeft } from 'lucide-react';

export function LicensePage() {
    return (
        <main className="license-page">
            <div className="license-page-inner">
                <a className="license-back" href="#title">
                    <ArrowLeft size={16} aria-hidden="true" />
                    開始画面に戻る
                </a>
                <h1>ライセンス・出典</h1>
                <div className="license-content">
                    <h2>地図・統計データ</h2>
                    <p>
                        <a
                            href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            NASA Blue Marble Next Generation
                        </a>{' '}
                        — 衛星画像の投影と色調を加工しています。
                    </p>
                    <p>
                        <a
                            href="https://www.naturalearthdata.com/about/terms-of-use/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Made with Natural Earth
                        </a>{' '}
                        — パブリックドメイン。行政境界と水域をゲーム用に加工しています。
                    </p>
                    <p>
                        <a
                            href="https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GHS-POP R2023A
                        </a>{' '}
                        — Schiavina, M.; Freire, S.; Carioli, A.; MacManus, K. 2023. European
                        Commission, Joint Research Centre. © European Union.{' '}
                        <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            CC BY 4.0
                        </a>
                        。人口を37地域へ集計し、地図の都市起点に使用しています。
                    </p>
                    <p>
                        <a
                            href="https://datacatalog.worldbank.org/public-licenses"
                            target="_blank"
                            rel="noreferrer"
                        >
                            World Bank WDI
                        </a>{' '}
                        — CC BY 4.0。2020年の人口・通信・就業等の統計を地域単位に加工しています。
                    </p>
                    <p>
                        <a
                            href="https://www.ris.gov.tw/info-liferay/app/channel/newsEnglishDetail/20282028"
                            target="_blank"
                            rel="noreferrer"
                        >
                            台湾内政部
                        </a>{' '}
                        — 2020年9月末の年齢構成を補足値として使用しています。
                    </p>
                    <h2>背景素材</h2>
                    <p>
                        <a href="https://heropatterns.com/" target="_blank" rel="noreferrer">
                            Circuit Board — Hero Patterns
                        </a>
                        。Steve Schoger作。
                        <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            CC BY 4.0
                        </a>
                        。スキルツリーの背景に使用し、色と表示サイズを調整しています。
                    </p>
                    <h2>ソフトウェア</h2>
                    <p>
                        React・React DOM・Scheduler・Zustand・PSRD noise はMIT License、LucideはISC
                        LicenseおよびMIT Licenseで提供されています。
                    </p>
                    <a
                        href={`${import.meta.env.BASE_URL}licenses.txt`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        著作権表示・ライセンス全文
                    </a>
                </div>
            </div>
        </main>
    );
}
