#!/usr/bin/env python3
"""ACK all pending messages for a Redis Stream Consumer Group.

This script acknowledges all pending messages for a given stream and consumer group
without processing them. This is useful for clearing old pending messages that
are no longer needed.

Usage:
    python3 scripts/ack_all_pending.py [STREAM_NAME] [GROUP_NAME]

Examples:
    python3 scripts/ack_all_pending.py md:ticker strategy-module
    python3 scripts/ack_all_pending.py md:trade strategy-module
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis
from typing import Optional


def ack_all_pending(stream: str, group: str, redis_url: Optional[str] = None) -> int:
    """ACK all pending messages for a stream and consumer group.

    Args:
        stream: Stream name (e.g., "md:ticker")
        group: Consumer group name (e.g., "strategy-module")
        redis_url: Redis connection URL (default: from REDIS_URL env var or redis://redis:6379/0)

    Returns:
        Number of messages ACKed
    """
    if redis_url is None:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Parse Redis URL
    if redis_url.startswith("redis://"):
        # Extract host and port from URL
        url_parts = redis_url.replace("redis://", "").split("/")
        host_port = url_parts[0].split(":")
        host = host_port[0] if len(host_port) > 0 else "localhost"
        port = int(host_port[1]) if len(host_port) > 1 else 6379
        db = int(url_parts[1]) if len(url_parts) > 1 else 0
    else:
        host = "localhost"
        port = 6379
        db = 0

    # Connect to Redis
    r = redis.Redis(host=host, port=port, db=db, decode_responses=True)

    try:
        # Get all pending messages
        pending = r.xpending_range(stream, group, min="-", max="+", count=100000)

        if not pending:
            print(f"No pending messages found for stream: {stream}, group: {group}")
            return 0

        print(f"Found {len(pending)} pending messages. ACKing all...")

        # ACK all pending messages
        acked = 0
        for msg in pending:
            message_id = msg["message_id"]
            try:
                r.xack(stream, group, message_id)
                acked += 1
                if acked % 1000 == 0:
                    print(f"  ACKed {acked}/{len(pending)} messages...")
            except Exception as e:
                print(f"  Error ACKing {message_id}: {e}", file=sys.stderr)

        print(f"Successfully ACKed {acked} out of {len(pending)} pending messages.")
        return acked

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 0


def main():
    """Main entry point."""
    # Get arguments
    if len(sys.argv) > 1 and sys.argv[1] in ["-h", "--help"]:
        print(__doc__)
        sys.exit(0)

    stream = sys.argv[1] if len(sys.argv) > 1 else "md:ticker"
    group = sys.argv[2] if len(sys.argv) > 2 else "strategy-module"
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")

    print(f"Stream: {stream}")
    print(f"Group: {group}")
    print(f"Redis URL: {redis_url}")
    print()

    acked = ack_all_pending(stream, group, redis_url)
    sys.exit(0 if acked >= 0 else 1)


if __name__ == "__main__":
    main()

