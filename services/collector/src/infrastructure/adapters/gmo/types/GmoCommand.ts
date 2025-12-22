/**
 * GMO コイン WebSocket API に送信するコマンドの型定義。
 */
export type GmoCommand =
  | {
      command: 'subscribe';
      channel: 'ticker' | 'orderbooks' | 'trades';
      symbol: string;
    }
  | {
      command: 'unsubscribe';
      channel: 'ticker' | 'orderbooks' | 'trades';
      symbol: string;
    };
