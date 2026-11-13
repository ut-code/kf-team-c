import { mapScene } from '../map/config';

export function StartScreen({ onStart }: { onStart: () => void }) {
    return (
        <main className="start-screen">
            <img className="start-map" src={mapScene.backgroundUrl} alt="" />
            <div className="start-content">
                <h1>Singularity Inc.</h1>
                <button type="button" className="title-start" onClick={onStart}>
                    ゲームを開始
                </button>
            </div>
            <footer className="start-credits">
                <a className="license-link" href="#licenses">
                    ライセンス・出典
                </a>
            </footer>
        </main>
    );
}
