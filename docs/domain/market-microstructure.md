# 市場構造（Market Microstructure）

alpha-market-engine が扱う市場の“内側の動作”を理解するための文書。
板の厚さ、流動性、スプレッドなど、取引コストと約定の根幹となる概念を整理する。

---

## 1. スプレッド（Spread）

- BID（買い気配）と ASK（売り気配）の差
- 実質的な取引コスト
- 成行注文は常にスプレッド分の損失を即時に受ける

例：
BID = 5,000,000
ASK = 5,005,000
→ Spread = 5,000円（0.1%）

---

## 2. 板の厚さ（Depth）

- 各価格帯に並ぶ注文数量の多さ
- “厚い”ほど大口注文でも価格が動きにくい
- “薄い”市場では少額の成行でも価格が飛ぶ（スリッページ）

---

## 3. 流動性（Liquidity）

流動性が高い市場の特徴：

- スプレッドが狭い
- 約定が高速
- 板が厚い
- ボラティリティが安定しやすい
- bot 戦略の再現性が高い

Binance は世界最高レベルの流動性を持つ。

---

## 4. スリッページ（Slippage）

成行注文や板が薄い時に発生しやすい。

例：
5,000,000 の売り板を想定して成行買い →
実際には 5,005,000 や 5,010,000 の板を食ってしまう。

→ 平均約定価格が想定より不利になる。

---

## 5. 約定の仕組み（Matching Engine）

取引所は Price-Time Priority（価格優先・時間優先）で約定を決定する。

- 最も有利な価格同士からマッチング
- 価格が同じなら、先に置かれた注文が優先
- 部分約定も発生可能

Matching Engine の性能が高いほど約定の遅延が少ない。

---

## 6. 市場構造が bot に与える影響

| 市場特性 | 良い場合 | 悪い場合 |
|-----------|------------|------------|
| スプレッド | 手数料がほぼゼロ | コスト負担で戦略が崩壊 |
| 板厚 | 滑りにくい | 価格が飛びやすい |
| 流動性 | 取引が安定 | 約定しない・損切り不能 |
| ボラティリティ | 収益機会あり | ノイズが多くて損失増 |

---

## 7. 結論

alpha-market-engine の運用では、
以下の市場条件を満たすと勝率が上がる：

- スプレッドが 0.05% 未満
- 板が厚い
- 流動性が高い
- 約定速度が速い
- ボラティリティが適度

この観点で、
**GMO → BitFlyer → Binance** の順に市場品質は高くなる。


# 各取引所 API 比較（GMOコイン / BitFlyer Lightning / Binance）

alpha-market-engine で実装する Exchange Adapter の基礎となる API 仕様の差分をわかりやすくまとめる。


---

## 1. 基本比較表

| 項目 | GMOコイン | BitFlyer Lightning | Binance |
|------|-------------|-----------------------|----------|
| API種類 | REST / WS | REST / WS | REST / WS |
| 板の厚さ | 中 | 中〜高 | 非常に高 |
| スプレッド | やや広い〜狭い（時間帯依存） | 狭い | 極小 |
| Maker/Taker 手数料 | 0% / 0% | 0.01% / 0.04% | 0.02% / 0.04% |
| WebSocket品質 | 安定 | 高速 | 最高速 |
| REST速度 | 中 | 高速 | 非常に高速 |
| 認証方式 | HMAC-SHA256 | HMAC-SHA256 | HMAC-SHA256 |
| 市場種類 | 現物 | 現物/FX/先物 | 多種（現物/先物） |
| レバレッジ | 無し | あり | あり |

---

## 2. エンドポイント比較（主要 REST）

### 2.1 注文（POST /order）

| 機能 | GMO | BitFlyer | Binance |
|------|------|-----------|---------|
| 成行 | ○ | ○ | ○ |
| 指値 | ○ | ○ | ○ |
| 部分約定 | ○ | ○ | ○ |
| ストップ注文 | △（IFD等あり） | ○ | ○ |
| キャンセル | ○ | ○ | ○ |

---

## 3. WebSocket 比較

| 種類 | GMO | BitFlyer | Binance |
|------|-------|-------------|-----------|
| ticker | ○ | ○ | ○ |
| executions（約定） | ○ | ○ | ○ |
| orderbook（板） | ○ | ○ | ○ |
| depth-level | 低頻度更新 | 高頻度更新 | 超高頻度（100ms/20ms） |
| private WS | × | × | ○（注文イベント） |

Binance は唯一 **Private WebSocket（注文の約定・キャンセルイベント）** を持つ。

---

## 4. Alpha-Market-Engine における実装難度

| 項目 | GMO | BitFlyer | Binance |
|------|------|-----------|----------|
| 実装の簡単さ | ◎ | ○ | △ |
| パフォーマンス | ○ | ◎ | ◎◎ |
| ストラテジー精度 | ○ | ◎ | ◎◎ |
| 開発おすすめ度 | 初期 | 中期 | 上級 |

---

## 5. 結論

- **GMO**：初期構築に最適。仕様が単純で手数料0%
- **BitFlyer Lightning**：板が厚く、デイトレ・短期 bot 向き
- **Binance**：世界基準。AI活用・高速 bot の本命

alpha-market-engine の拡張モジュールとして、
`exchanges/gmo`, `exchanges/bitflyer`, `exchanges/binance` の順で実装するのが最も現実的。


---
## 参考

[Binance API](https://www.binance.com/en/binance-api)
[BitFlyer Lightning API](https://lightning.bitflyer.com/docs?lang=ja&_gl=1*xm38o5*_gcl_au*MTIzOTUxMzA0Ni4xNzYzNzEyNDAy*_ga*MTU0OTY5OTU5Mi4xNzYzNzEyNDAy*_ga_3VYMQNCVSM*czE3NjQ4ODY5OTgkbzIkZzAkdDE3NjQ4ODY5OTgkajYwJGwwJGgw)
[GMOコイン API](https://api.coin.z.com/docs/)