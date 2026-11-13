export interface MapRegion {
    id: string;
    path: string;
}

/** 公表済みの研究。地図上の波紋(伝播)表示に使う最小限の情報。 */
export interface PublishedResearch {
    id: string;
    instituteId: string;
    closedMonth: number;
}
