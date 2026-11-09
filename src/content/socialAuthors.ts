export interface SocialCountry {
    nationality: string;
    code: string;
    names: string[];
}

/** 国籍は投稿者のプロフィール。広域の地域名を国籍として表示しない。人物はすべて架空。 */
export const SOCIAL_COUNTRIES: Record<string, SocialCountry[]> = {
    'us-west': [
        { nationality: 'アメリカ', code: 'US', names: ['Maya Chen', 'Alex Rivera', '夜勤明け'] },
    ],
    'us-east': [
        { nationality: 'アメリカ', code: 'US', names: ['Jordan', 'Sam Brooks', '通勤中のひと'] },
    ],
    canada: [{ nationality: 'カナダ', code: 'CA', names: ['Camille', 'Noah', '北の匿名'] }],
    mexico: [
        { nationality: 'メキシコ', code: 'MX', names: ['Sofía', 'Diego', '昼休み'] },
        { nationality: 'グアテマラ', code: 'GT', names: ['Lucía', '匿名の働き手'] },
    ],
    caribbean: [
        { nationality: 'ジャマイカ', code: 'JM', names: ['Alicia', '島のひと'] },
        { nationality: 'ドミニカ共和国', code: 'DO', names: ['Luis', 'Marisol'] },
    ],
    andes: [
        { nationality: 'コロンビア', code: 'CO', names: ['Valentina', '街角の声'] },
        { nationality: 'ペルー', code: 'PE', names: ['Mateo', '匿名の学生'] },
    ],
    brazil: [{ nationality: 'ブラジル', code: 'BR', names: ['Beatriz', 'Rafael', '休憩中'] }],
    'southern-cone': [
        { nationality: 'アルゼンチン', code: 'AR', names: ['Martina', 'Nicolás'] },
        { nationality: 'チリ', code: 'CL', names: ['Antonia', '匿名の利用者'] },
    ],
    'west-europe': [
        { nationality: 'ドイツ', code: 'DE', names: ['Lena', 'Jonas', '現場のひと'] },
        { nationality: 'フランス', code: 'FR', names: ['Chloé', 'Lucas', '匿名の会社員'] },
        { nationality: 'オランダ', code: 'NL', names: ['Sanne', 'Daan'] },
    ],
    'north-europe': [
        { nationality: 'イギリス', code: 'GB', names: ['Amelia', 'Oliver', '紅茶が冷めた'] },
        { nationality: 'スウェーデン', code: 'SE', names: ['Elin', '匿名の読者'] },
        { nationality: 'ノルウェー', code: 'NO', names: ['Ingrid', 'Emil'] },
    ],
    'south-europe': [
        { nationality: 'スペイン', code: 'ES', names: ['Carmen', 'Pablo'] },
        { nationality: 'イタリア', code: 'IT', names: ['Giulia', '匿名の先生'] },
    ],
    'east-europe': [
        { nationality: 'ポーランド', code: 'PL', names: ['Zofia', 'Jakub'] },
        { nationality: 'ウクライナ', code: 'UA', names: ['Olena', '匿名の利用者'] },
    ],
    'russia-west': [
        { nationality: 'ロシア', code: 'RU', names: ['Anna', 'Mikhail', '窓際のひと'] },
    ],
    'central-asia': [
        { nationality: 'カザフスタン', code: 'KZ', names: ['Amina', '匿名の開発者'] },
        { nationality: 'ウズベキスタン', code: 'UZ', names: ['Aziz', '仕事帰り'] },
    ],
    siberia: [{ nationality: 'ロシア', code: 'RU', names: ['Daria', 'Ivan', '遠くの匿名'] }],
    maghreb: [
        { nationality: 'モロッコ', code: 'MA', names: ['Salma', 'Youssef'] },
        { nationality: 'アルジェリア', code: 'DZ', names: ['Amira', '匿名の学生'] },
    ],
    nile: [{ nationality: 'エジプト', code: 'EG', names: ['Nour', 'Omar', '帰り道'] }],
    'middle-east': [
        { nationality: 'サウジアラビア', code: 'SA', names: ['Sara', 'Khalid'] },
        { nationality: 'アラブ首長国連邦', code: 'AE', names: ['Maryam', '匿名の会社員'] },
    ],
    'west-africa': [
        { nationality: 'ナイジェリア', code: 'NG', names: ['Ada', 'Tunde', '朝の利用者'] },
        { nationality: 'ガーナ', code: 'GH', names: ['Ama', 'Kwame'] },
        { nationality: 'セネガル', code: 'SN', names: ['Awa', '匿名の読者'] },
    ],
    'central-africa': [
        { nationality: 'カメルーン', code: 'CM', names: ['Marie', '匿名の働き手'] },
        { nationality: 'コンゴ民主共和国', code: 'CD', names: ['Joseph', '通りすがり'] },
    ],
    'east-africa': [
        { nationality: 'ケニア', code: 'KE', names: ['Akinyi', 'Brian'] },
        { nationality: 'エチオピア', code: 'ET', names: ['Hana', '匿名の学生'] },
        { nationality: 'タンザニア', code: 'TZ', names: ['Neema', 'Juma'] },
    ],
    'south-africa': [
        { nationality: '南アフリカ', code: 'ZA', names: ['Lerato', 'Sipho'] },
        { nationality: 'アンゴラ', code: 'AO', names: ['Ana', '匿名の利用者'] },
    ],
    pakistan: [{ nationality: 'パキスタン', code: 'PK', names: ['Ayesha', 'Ali', '匿名の学生'] }],
    'india-north': [
        { nationality: 'インド', code: 'IN', names: ['Aarav', 'Ananya', '仕事帰りの人'] },
    ],
    'india-south': [
        { nationality: 'インド', code: 'IN', names: ['Kavya', 'Arjun', '匿名の開発者'] },
    ],
    bengal: [
        { nationality: 'バングラデシュ', code: 'BD', names: ['Nusrat', 'Hasan', '教室のすみ'] },
    ],
    'china-coast': [{ nationality: '中国', code: 'CN', names: ['小林', '雨辰', '通勤する人'] }],
    'china-inland': [{ nationality: '中国', code: 'CN', names: ['小雨', '明', '匿名の利用者'] }],
    japan: [
        {
            nationality: '日本',
            code: 'JP',
            names: ['みずき', '田中', 'まちの会社員', '匿名の学生'],
        },
    ],
    korea: [{ nationality: '韓国', code: 'KR', names: ['ジウ', 'ミンジュン', '夜の利用者'] }],
    mekong: [
        { nationality: 'タイ', code: 'TH', names: ['Pim', 'Niran'] },
        { nationality: 'カンボジア', code: 'KH', names: ['Sophea', '匿名の学生'] },
    ],
    vietnam: [{ nationality: 'ベトナム', code: 'VN', names: ['Linh', 'Minh', '仕事の合間'] }],
    malay: [
        { nationality: 'マレーシア', code: 'MY', names: ['Aina', 'Amir'] },
        { nationality: 'シンガポール', code: 'SG', names: ['Jia', '匿名の利用者'] },
    ],
    indonesia: [
        { nationality: 'インドネシア', code: 'ID', names: ['Putri', 'Rizky', '帰り道のひと'] },
    ],
    philippines: [
        { nationality: 'フィリピン', code: 'PH', names: ['Andrea', 'Miguel', '匿名の働き手'] },
    ],
    australia: [
        { nationality: 'オーストラリア', code: 'AU', names: ['Chloe', 'Jack', '朝の通勤'] },
    ],
    pacific: [
        { nationality: 'ニュージーランド', code: 'NZ', names: ['Aroha', 'Noah'] },
        { nationality: 'フィジー', code: 'FJ', names: ['Litia', '島の匿名'] },
    ],
};
