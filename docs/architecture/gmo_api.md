## Public API

|name|method|url|description|
|---|---|---|---|
|取引所ステータス|GET|/public/v1/status|取引所の稼動状態を取得|
|最新レート|GET|/public/v1/ticker|指定した銘柄の最新レートを取得<br>symbolパラメータなしで、全銘柄の最新レート取得|
|板情報|GET|/public/v1/orderbooks|指定した銘柄の板情報(snapshot)を取得|
|取引履歴|GET|/public/v1/trades|指定した銘柄の取引履歴（取引日時の降順）を取得|
|KLine情報の取得|GET|/public/v1/klines|指定した銘柄の四本値と取引量（開始時刻の昇順）を取得|
|取引ルール|GET|/public/v1/symbols|取引ルールを取得|


## Private API

|name|method|url|description|
|---|---|---|---|
|余力情報取得|GET|/private/v1/account/margin|余力情報を取得|
|資産残高取得|GET|/private/v1/account/assets|資産残高を取得|
|取引高情報取得|GET|/private/v1/account/tradingVolume|取引高情報を取得|
|日本円の入金履歴の取得|GET|/private/v1/account/fiatDeposit/history|日本円の入金履歴を取得|
|日本円の出金履歴の取得|GET|/private/v1/account/fiatWithdrawal/history|日本円の出金履歴を取得|
|暗号資産の預入履歴の取得|GET|/private/v1/account/deposit/history|暗号資産の預入履歴を取得|
|暗号資産の送付履歴の取得|GET|/private/v1/account/withdrawal/history|暗号資産の送付履歴を取得|
|注文情報取得|GET|/private/v1/orders|指定した注文IDの注文情報を取得<br>対象: 現物取引、レバレッジ取引|
|有効注文一覧|GET|/private/v1/activeOrders|有効注文一覧を取得<br>対象: 現物取引、レバレッジ取引|
|約定情報取得|GET|/private/v1/executions|約定情報を取得<br>対象: 現物取引、レバレッジ取引|
|最新の約定一覧|GET|/private/v1/latestExecutions|最新約定一覧を取得<br>対象: 現物取引、レバレッジ取引<br>直近1日分の約定情報を返す|
|建玉一覧を取得|GET|/private/v1/openPositions|有効建玉一覧を取得<br>対象: レバレッジ取引|
|建玉サマリーを取得|GET|/private/v1/positionSummary|建玉サマリーを取得<br>対象: レバレッジ取引|
|口座振替|POST|/private/v1/account/transfer|暗号資産口座から外国為替FX口座へ、もしくは外国為替FXから暗号資産口座へ日本円を振替え(口座振替のリクエストは3分に1回が上限)|
|注文|POST|/private/v1/order|新規注文をします。<br>対象: 現物取引、レバレッジ取引|
|注文変更|POST|/private/v1/changeOrder|注文変更をします。<br>対象: 現物取引、レバレッジ取引|
|注文キャンセル|POST|/private/v1/cancelOrder|注文を取り消します。<br>対象: 現物取引、レバレッジ取引|
|複数注文キャンセル|POST|/private/v1/cancelOrders|複数の注文を取り消します。<br>対象: 現物取引、レバレッジ取引|
|注文の一括キャンセル|POST|/private/v1/cancelBulkOrder|一括で注文を取り消し<br>対象: 現物取引、レバレッジ取引|
|決済注文|POST|/private/v1/closeOrder|決済注文をします。<br>対象: レバレッジ取引|
|一括決済注文|POST|/private/v1/closeBulkOrder|一括決済注文をします。<br>対象: レバレッジ取引|
|ロスカットレート変更|POST|/private/v1/changeLosscutPrice|建玉のロスカットレート変更<br>対象: レバレッジ取引|


## 参考
[GMO コイン API](https://api.coin.z.com/docs/)