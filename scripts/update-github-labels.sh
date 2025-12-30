#!/bin/bash

# GitHub リポジトリの既存ラベルを日本語＋gitmoji形式の説明に更新するスクリプト
# 組織のデフォルトラベルは既存リポジトリには自動反映されないため、
# このスクリプトで既存リポジトリのラベルも更新する
# .github/labels.json からラベル定義を読み込む

set -e

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABELS_FILE="$PROJECT_ROOT/.github/labels.json"

# labels.json の存在確認
if [ ! -f "$LABELS_FILE" ]; then
	echo "❌ エラー: $LABELS_FILE が見つかりません"
	exit 1
fi

# jq の存在確認
if ! command -v jq &>/dev/null; then
	echo "❌ エラー: jq がインストールされていません"
	echo "   macOS: brew install jq"
	echo "   Ubuntu/Debian: sudo apt-get install jq"
	exit 1
fi

# リポジトリの確認
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 リポジトリ: $REPO"
echo "📄 ラベル定義ファイル: $LABELS_FILE"
echo ""

# JSON からラベルを読み込んで処理
label_count=$(jq 'length' "$LABELS_FILE")
echo "📋 処理対象ラベル数: $label_count"
echo ""

# 各ラベルを処理
jq -c '.[]' "$LABELS_FILE" | while read -r label; do
	label_name=$(echo "$label" | jq -r '.name')
	description=$(echo "$label" | jq -r '.description')
	color_raw=$(echo "$label" | jq -r '.color')
	# # から始まる場合は除去（gh コマンドは # なしの6文字16進数を期待）
	color="${color_raw#\#}"

	echo "🔄 ラベルを処理中: $label_name"

	# ラベルが存在するか確認（gh label list で検索）
	if gh label list | grep -q "^${label_name}[[:space:]]"; then
		# 既存ラベルを更新
		echo "  ✓ 既存ラベルを更新: ${label_name}"
		gh label edit "${label_name}" \
			--description "${description}" \
			--color "${color}"
	else
		# 新規ラベルを作成
		echo "  ➕ 新規ラベルを作成: ${label_name}"
		gh label create "${label_name}" \
			--description "${description}" \
			--color "${color}"
	fi

	echo ""
done

echo "✅ ラベルの更新が完了しました"
echo ""
echo "📋 更新されたラベル一覧:"
# JSON からラベル名を抽出して表示
label_names=$(jq -r '.[].name' "$LABELS_FILE" | tr '\n' '|' | sed 's/|$//')
gh label list | grep -E "^($label_names)"
