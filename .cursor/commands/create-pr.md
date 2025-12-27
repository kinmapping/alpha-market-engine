# PR を作成（2025 版・DDD 向け）

## 目的
PR を「差分の説明」ではなく「設計意図の共有」の場として活用し、レビューの負荷を下げて品質を高める。

## 事前準備
1. **ブランチの状態を確認**
   - すべての変更がコミットされていること
   - リモートへ push 済みであること
   - main（または trunk）と最新同期されていること

2. **セルフレビュー**
   - 自分で差分を一通り確認し、複雑な箇所は PR 内コメントで補足

3. **PR サイズの確認**
   - 目安: 500 行を超えるなら分割を検討
   - 大きな設計変更は Draft PR で早めに共有

## PR 本文テンプレート
> そのままコピーして使えるテンプレート。DDD 採用時は **DDD セクション**を必ず埋める。

```
## Summary
<!-- 1行で「何をしたか」 -->

## Why
<!-- なぜ必要か。課題・背景・目的。Issue/Jira を必ず貼る -->
- Issue: #
- 背景:

## What
<!-- 実装の要約（箇条書き） -->
- 例: Order ドメインに OrderConfirmed イベントを追加
- 例: OrderRepository のインターフェースを変更

## Out of Scope
<!-- 今回やらないこと / 後回しにしたこと -->

## Impact
<!-- 影響範囲・マイグレーション・互換性 -->
- 既存機能への影響:
- マイグレーション:
- 互換性/後方互換:

## Verification
<!-- 動作確認・テスト結果 -->
- [ ] 自動テスト: ``
- [ ] 手動テスト: 手順 / スクリーンショット
- ログやスクリーンショット（UI 変更がある場合は必須）

## DDD Notes
<!-- DDD の設計意図を共有する -->
### Ubiquitous Language
<!-- 合意済み用語の反映 -->
- 例: 「注文確定」を confirmOrder に統一

### Domain Logic Placement
<!-- なぜその層に置いたか -->
- 例: 重要な計算ルールのため Entity に実装

### Dependency Direction
<!-- 依存関係の正当性（DIP 等） -->
- 例: Domain → Infrastructure を参照しない設計

## Reviewer Notes
<!-- レビュアーが特に見てほしい点 -->
- 例: 仕様の解釈が正しいか、境界の切り方
```

## タイトルの付け方
- **形式**: `<type>(<scope>): <summary>`
- 例: `feat(order): WebSocket受信データをRedis Streamへ保存するUseCaseを実装`
- 避けたい例: `修正`, `対応`, `Refactor code`（何がどう変わったか不明）

## レビューを円滑にする Tips（2025）
- **Draft PR を活用**して設計の方向性を早めに共有
- **AI サマリーを確認**し、人間の補足で意図を明確化
- **セルフレビュー済み**である旨を明記

## 参考
- GitHub: Writing meaningful PR descriptions
- Google: How to write code reviews
