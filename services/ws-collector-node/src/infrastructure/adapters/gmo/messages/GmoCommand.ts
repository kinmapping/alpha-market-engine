/**
 * GMO コイン WebSocket API に送信するコマンドの型定義。
 */
export interface GmoSubscribeCommand {
  command: 'subscribe';
  channel: 'ticker' | 'orderbooks' | 'trades';
  symbol: string;
}

export interface GmoUnsubscribeCommand {
  command: 'unsubscribe';
  channel: 'ticker' | 'orderbooks' | 'trades';
  symbol: string;
}

export type GmoCommand = GmoSubscribeCommand | GmoUnsubscribeCommand;
