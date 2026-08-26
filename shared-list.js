/* ------------------------------------------------------------------
 * LINEグループで共有された商品のマスタ。
 * amazon-list.html の「共有リストを読み込む」で取り込める。
 *
 * stores には2種類の情報を入れる:
 *   state: 'あり'   … グループで実際に在庫が確認された店舗
 *   state: '未確認' … カテゴリから見て優先して回るべき店舗（★印のメモ）
 * どちらも、自分で店頭確認した記録（未確認以外）は上書きしない。
 * ------------------------------------------------------------------ */

window.SHARED_LIST = {
  updated: '2026-08-26',
  items: [
    {
      asin: 'B0CVKSCNN9',
      name: 'デオシート消臭ラボ 抗菌ドライフィルター レギュラー 4枚',
      jan: '4520699688045',
      sharedAt: '2026-08-26 00:00',
      memo: 'ユニ・チャーム ペット／犬用トイレシステム用の取替フィルター（消耗品）',
      stores: [
        { id: 'valor-suzuka', state: '未確認', memo: '★最優先：ペットショップ「ペット大好き」併設' },
        { id: 'aoki-sumiyoshi', state: '未確認', memo: '★優先：ドラッグストア' },
        { id: 'aoki-sanjo', state: '未確認', memo: '★優先：ドラッグストア' },
        { id: 'sugi-sumiyoshi', state: '未確認', memo: '★優先：ドラッグストア' },
        { id: 'komeri-suzuka', state: '未確認', memo: '次点：ホームセンターのペット売場' },
        { id: 'kohnan-aeontown', state: '未確認', memo: '次点：ホームセンターのペット売場' }
      ]
    },
    {
      asin: 'B01IQKT0AG',
      name: 'ALESPLANNING(アレスプランニング) アレスカラー シルバーシャンプー 200ml クリーム 200ミリリットル (x 1)',
      jan: '4989868007214',
      sharedAt: '2026-08-26 00:00',
      memo: 'カラーシャンプー。通販・業務用卸が中心。イオンネットスーパー税込1,958円 / @cosme 2,090円で価格差が薄く、店舗せどり向きではない',
      stores: [
        { id: 'aeonmall-suzuka', state: '未確認', memo: '★イオンネットスーパーで取扱いあり。値下げ品のみ狙い目' },
        { id: 'aeon-suzuka', state: '未確認', memo: '★イオンネットスーパーで取扱いあり' }
      ]
    },
    {
      asin: 'B0H7GMPZL6',
      name: '[バンダイ(BANDAI)] おしゃべりうさぎ パジャマつきセット 対象年齢 6 才以上',
      jan: '',
      sharedAt: '2026-08-26 00:00',
      memo: 'ちいかわシリーズ／2026年8月8日発売／希望小売価格 税込7,700円。JANは「パジャマつきセット」版が未確認（単体版4570118242662を流用しないこと）。人気IPのため出品制限の有無を要確認',
      stores: [
        { id: 'yamada-suzuka', state: 'あり', memo: 'グループ共有：「ヤマダ電機にあった」。どの店舗かまでは共有されていないため鈴鹿店かは要確認' },
        { id: 'aeonmall-suzuka', state: '未確認', memo: '★優先：玩具売場' },
        { id: 'suzuka-hunter', state: '未確認', memo: '★優先：玩具売場' },
        { id: 'mega-donki-uny', state: '未確認', memo: '次点：玩具売場' }
      ]
    },
    {
      asin: 'B0DJVMRWGH',
      name: 'アズマ アズマジック 浴室用ソフトブラシ お風呂掃除ブラシ BT763',
      jan: '4970190479046',
      sharedAt: '2026-08-26 00:00',
      memo: 'アズマ工業／標準価格 税抜1,050円（ヨドバシ993円）。SNSでバズって品薄：楽天公式は次回入荷未定、公式Yahoo!店は1人1個制限、アズワンは受注停止。店頭に定価で残っていれば狙い目',
      stores: [
        { id: 'kohnan-aeontown', state: '未確認', memo: '★最優先：掃除用品売場' },
        { id: 'vivahome-suzuka', state: '未確認', memo: '★最優先：掃除用品売場' },
        { id: 'dcm-suzuka', state: '未確認', memo: '★最優先：掃除用品売場' },
        { id: 'komeri-suzuka', state: '未確認', memo: '★優先：掃除用品売場' },
        { id: 'valor-suzuka', state: '未確認', memo: '★優先：掃除用品売場' },
        { id: 'aeonmall-suzuka', state: '未確認', memo: 'Green Beans（イオンのネットスーパー）で取扱いあり' },
        { id: 'aeon-suzuka', state: '未確認', memo: 'Green Beans（イオンのネットスーパー）で取扱いあり' },
        { id: 'sugi-sumiyoshi', state: '未確認', memo: '次点：日用品売場' },
        { id: 'mega-donki-uny', state: '未確認', memo: '次点：日用品売場' }
      ]
    }
  ]
};
