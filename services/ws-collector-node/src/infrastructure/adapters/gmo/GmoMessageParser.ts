import type { MessageParser } from '@/application/handlers/MessageHandler';
import type { NormalizedEvent } from '@/domain/types';
import type { GmoRawMessage } from './messages/GmoRawMessage';

/**
 * インフラ層: GMO メッセージ形式のパース処理（実装の詳細を担当）
 *
 * 責務: GmoRawMessage → NormalizedEvent への変換（ドキュメントの正規化例どおり）。
 */
export class GmoMessageParser implements MessageParser {
  /**
   * GMO 固有のメッセージ形式を共通の NormalizedEvent 形式に変換する。
   * @param rawMessage GMO API から受信したメッセージ
   * @returns 正規化されたイベント。変換できない場合は null
   */
  parse(rawMessage: unknown): NormalizedEvent | null {
    try {
      const message = rawMessage as GmoRawMessage;
      if (!message?.channel) {
        console.warn(
          '[GmoMessageParser] message missing channel field:',
          JSON.stringify(rawMessage)
        );
        return null;
      }

      // GMO API の timestamp 文字列をエポックミリ秒に変換
      const ts = Date.parse(message.timestamp);

      switch (message.channel) {
        case 'ticker':
          // ticker データ: 最新レート情報
          return {
            type: 'ticker',
            exchange: 'gmo',
            symbol: message.symbol,
            ts,
            data: {
              last: message.last, // 最新約定価格
              bid: message.bid, // 最良売り価格
              ask: message.ask, // 最良買い価格
              volume: message.volume, // 24時間出来高
            },
          };

        case 'orderbooks':
          // orderbooks データ: 板情報（買い板と売り板）
          return {
            type: 'orderbook',
            exchange: 'gmo',
            symbol: message.symbol,
            ts,
            data: {
              is_snapshot: true, // GMO API は常にスナップショット形式
              bids: message.bids, // 買い板: [価格, 数量] の配列
              asks: message.asks, // 売り板: [価格, 数量] の配列
            },
          };

        case 'trades':
          // trades データ: 約定情報
          return {
            type: 'trade',
            exchange: 'gmo',
            symbol: message.symbol,
            ts,
            data: {
              price: message.price, // 約定価格
              size: message.size, // 約定数量
              side: message.side.toLowerCase(), // 'BUY' または 'SELL' を小文字に変換
            },
          };

        default:
          // 未知のチャンネルは null を返して無視
          return null;
      }
    } catch (error) {
      console.error('[GmoMessageParser] failed to parse message:', error);
      return null;
    }
  }
}
