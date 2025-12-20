# Redis CLI の出力形式について

## 概要

Redis CLI (`redis-cli`) の出力形式は、**RESP (REdis Serialization Protocol)** の人間可読形式がデフォルトです。これは JSON でも YAML でもなく、Redis 独自の形式です。

## 出力形式の種類

### 1. デフォルト形式（人間可読形式）

```bash
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO GROUPS md:ticker
```

**出力例**:
```
1)  1) "name"
    2) "strategy"
    3) "consumers"
    4) (integer) 1
    5) "pending"
    6) (integer) 10189
    7) "last-delivered-id"
    8) "1765640161811-0"
    9) "entries-read"
   10) (integer) 10211
   11) "lag"
   12) (integer) 0
```

**特徴**:
- 配列は `1)`, `2)`, `3)` のように番号付きで表示
- 文字列は `"文字列"` のように引用符付き
- 整数は `(integer) 値` のように型情報付き
- ネストされた配列はインデントで表現

**この形式が決まる理由**:
- Redis の RESP プロトコルに基づく
- 人間が読みやすいように整形された形式
- 型情報が明示的に表示される

### 2. JSON 形式

Redis CLI 8.0 以降では `--json` オプションで JSON 形式で出力できます。

```bash
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XINFO GROUPS md:ticker
```

**出力例**:
```json
[{"name":"strategy","consumers":1,"pending":10189,"last-delivered-id":"1765640161811-0","entries-read":10211,"lag":0}]
```

**特徴**:
- JSON 形式で出力される
- プログラムでパースしやすい
- 型情報は JSON の型で表現される

### 3. CSV 形式

`--csv` オプションで CSV 形式で出力できます。

```bash
docker-compose -f docker-compose.local.yml exec redis redis-cli --csv XINFO GROUPS md:ticker
```

**特徴**:
- カンマ区切りの形式
- スプレッドシートなどで扱いやすい

### 4. Raw 形式

`--raw` オプションで生の形式で出力できます。

```bash
docker-compose -f docker-compose.local.yml exec redis redis-cli --raw XINFO GROUPS md:ticker
```

**出力例**:
```
name
strategy
consumers
1
pending
10191
last-delivered-id
1765640341672-0
entries-read
10215
lag
0
```

**特徴**:
- 型情報や配列の番号が表示されない
- シンプルな形式
- パースが簡単

## 形式の選択

### 用途別の推奨形式

| 用途 | 推奨形式 | コマンド例 |
|------|----------|-----------|
| 人間が読む | デフォルト形式 | `redis-cli XINFO GROUPS md:ticker` |
| プログラムで処理 | JSON 形式 | `redis-cli --json XINFO GROUPS md:ticker` |
| スクリプトで処理 | Raw 形式 | `redis-cli --raw XINFO GROUPS md:ticker` |
| スプレッドシート | CSV 形式 | `redis-cli --csv XINFO GROUPS md:ticker` |

## 実際の使用例

### デフォルト形式（人間が読む場合）

```bash
# Consumer Group の情報を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO GROUPS md:ticker
```

### JSON 形式（プログラムで処理する場合）

```bash
# JSON 形式で取得して jq で整形
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XINFO GROUPS md:ticker | jq

# または Python で処理
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XINFO GROUPS md:ticker | python3 -m json.tool
```

### Raw 形式（スクリプトで処理する場合）

```bash
# シェルスクリプトで処理
docker-compose -f docker-compose.local.yml exec redis redis-cli --raw XINFO GROUPS md:ticker | while read key; do
  read value
  echo "$key: $value"
done
```

## RESP プロトコルについて

**RESP (REdis Serialization Protocol)** は、Redis がクライアントとサーバー間でデータを交換するために使用するプロトコルです。

### RESP のデータ型

- **Simple String**: `+OK\r\n`
- **Error**: `-ERR message\r\n`
- **Integer**: `:1234\r\n`
- **Bulk String**: `$5\r\nhello\r\n`
- **Array**: `*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n`

### デフォルト形式との対応

Redis CLI のデフォルト形式は、この RESP プロトコルを人間が読みやすいように整形したものです。

- 配列 (`*`) → `1)`, `2)`, `3)` のように番号付き
- 整数 (`:`) → `(integer) 値`
- 文字列 (`$`) → `"文字列"`

## まとめ

- **デフォルト形式**: RESP プロトコルを人間可読に整形した形式
- **JSON 形式**: `--json` オプションで JSON 形式で出力
- **Raw 形式**: `--raw` オプションで生の形式で出力
- **CSV 形式**: `--csv` オプションで CSV 形式で出力

用途に応じて適切な形式を選択してください。

