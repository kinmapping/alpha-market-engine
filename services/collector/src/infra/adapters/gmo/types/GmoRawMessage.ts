/**
 * GMO コイン WebSocket API から受信するメッセージの型定義。
 * GMO API は ticker、orderbooks、trades の3種類のチャンネルを提供する。
 * エラーメッセージも含む。
 */
export type GmoRawMessage =
  | {
      channel: 'ticker';
      symbol: string;
      timestamp: string;
      last: number; // 最新約定価格
      bid: number; // 最良売り価格
      ask: number; // 最良買い価格
      volume: number; // 24時間出来高
    }
  | {
      channel: 'orderbooks';
      symbol: string;
      timestamp: string;
      bids: [number, number][]; // [価格, 数量] の配列（買い板）
      asks: [number, number][]; // [価格, 数量] の配列（売り板）
      side?: never; // ticker と区別するための never 型
    }
  | {
      channel: 'trades';
      symbol: string;
      timestamp: string;
      price: number; // 約定価格
      size: number; // 約定数量
      side: 'BUY' | 'SELL'; // 約定方向
    }
  | {
      error: string; // エラーメッセージ（例: "ERR-5003 Request too many."）
      channel?: never; // エラーの場合は channel がない
    };
