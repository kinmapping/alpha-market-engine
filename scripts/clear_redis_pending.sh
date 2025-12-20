#!/bin/bash
# Redis Stream の pending メッセージを確認・クリアするスクリプト

set -e

# デフォルト値
STREAM_NAME="${1:-md:ticker}"
GROUP_NAME="${2:-strategy}"
ACTION="${3:-check}"

echo "=========================================="
echo "Redis Stream Pending Messages Manager"
echo "=========================================="
echo "Stream: $STREAM_NAME"
echo "Group: $GROUP_NAME"
echo "Action: $ACTION"
echo ""

case "$ACTION" in
  check)
    echo "Checking pending messages..."
    docker-compose -f docker-compose.local.yml exec redis redis-cli --json XPENDING "$STREAM_NAME" "$GROUP_NAME"
    echo ""
    echo "Pending message details (first 10):"
    docker-compose -f docker-compose.local.yml exec redis redis-cli XPENDING "$STREAM_NAME" "$GROUP_NAME" - + 10
    ;;
  clear)
    echo "Clearing pending messages by destroying and recreating consumer group..."
    docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY "$STREAM_NAME" "$GROUP_NAME"
    echo "Consumer group destroyed. Restart strategy to recreate it."
    echo ""
    echo "To restart strategy, run:"
    echo "  docker-compose -f docker-compose.local.yml restart strategy"
    ;;
  clear-all)
    echo "Clearing all pending messages for all streams..."
    docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:ticker "$GROUP_NAME" || true
    docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:orderbook "$GROUP_NAME" || true
    docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:trade "$GROUP_NAME" || true
    echo "All consumer groups destroyed. Restart strategy to recreate them."
    echo ""
    echo "To restart strategy, run:"
    echo "  docker-compose -f docker-compose.local.yml restart strategy"
    ;;
  ack-all)
    echo "ACKing all pending messages for stream: $STREAM_NAME, group: $GROUP_NAME"
    echo "This will acknowledge all pending messages without processing them."
    echo ""

    # ack_all_pending.py スクリプトを直接呼び出す
    # strategy コンテナ内で実行（redis パッケージがインストールされている場合）
    if docker-compose -f docker-compose.local.yml exec -T strategy python3 -c "import redis" 2>/dev/null; then
      docker-compose -f docker-compose.local.yml exec -T strategy python3 /app/scripts/ack_all_pending.py "$STREAM_NAME" "$GROUP_NAME"
    else
      echo "Error: redis package is not available. Please install it or use the Python script directly."
      echo "  python3 scripts/ack_all_pending.py $STREAM_NAME $GROUP_NAME"
      exit 1
    fi
    ;;
  ack-all-streams)
    echo "ACKing all pending messages for all streams..."
    for stream in md:ticker md:orderbook md:trade; do
      echo ""
      echo "Processing stream: $stream"
      if docker-compose -f docker-compose.local.yml exec -T strategy python3 -c "import redis" 2>/dev/null; then
        docker-compose -f docker-compose.local.yml exec -T strategy python3 /app/scripts/ack_all_pending.py "$stream" "$GROUP_NAME"
      else
        echo "  Error: redis package is not available. Skipping $stream"
      fi
    done
    ;;
  *)
    echo "Usage: $0 [STREAM_NAME] [GROUP_NAME] [ACTION]"
    echo ""
    echo "Arguments:"
    echo "  STREAM_NAME  Stream name (default: md:ticker)"
    echo "  GROUP_NAME   Consumer group name (default: strategy)"
    echo "  ACTION       Action to perform:"
    echo "               - check         : Check pending messages (default)"
    echo "               - clear         : Clear pending messages by destroying consumer group"
    echo "               - clear-all     : Clear all streams by destroying consumer groups"
    echo "               - ack-all       : ACK all pending messages for specified stream (recommended)"
    echo "               - ack-all-streams: ACK all pending messages for all streams (recommended)"
    echo ""
    echo "Examples:"
    echo "  $0                                         # Check pending messages for md:ticker"
    echo "  $0 md:trade strategy check         # Check pending messages for md:trade"
    echo "  $0 md:ticker strategy ack-all      # ACK all pending messages for md:ticker (recommended)"
    echo "  $0 '' '' ack-all-streams                  # ACK all pending messages for all streams (recommended)"
    echo "  $0 md:ticker strategy clear        # Clear by destroying consumer group"
    echo "  $0 '' '' clear-all                        # Clear all streams by destroying consumer groups"
    exit 1
    ;;
esac
