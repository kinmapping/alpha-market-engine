import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageHandler } from '@/application/handlers/MessageHandler';
import { GmoAdapter } from '@/infrastructure/adapters/gmo/GmoAdapter';
import type { GmoRawMessage } from '@/infrastructure/adapters/gmo/messages/GmoRawMessage';
import type { WebSocketConnection } from '@/infrastructure/websocket/WebSocketConnection';

// GmoWebSocketClient をモック
const mockConnect = vi.fn();
const mockSubscribe = vi.fn();
const mockDisconnect = vi.fn();
const mockParseMessage = vi.fn();

vi.mock('@/infrastructure/adapters/gmo/GmoWebSocketClient', () => {
  class MockGmoWebSocketClient {
    async connect(wsUrl: string): Promise<WebSocketConnection> {
      return mockConnect(wsUrl);
    }

    async subscribe(connection: WebSocketConnection, symbol: string): Promise<void> {
      return mockSubscribe(connection, symbol);
    }

    disconnect(): void {
      mockDisconnect();
    }

    parseMessage(data: string | ArrayBuffer | Blob): GmoRawMessage | null {
      return mockParseMessage(data);
    }
  }

  return {
    GmoWebSocketClient: MockGmoWebSocketClient,
  };
});

// ReconnectManager をモック
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockScheduleReconnect = vi.fn();

vi.mock('@/infrastructure/reconnect/ReconnectManager', () => {
  class MockReconnectManager {
    async start(): Promise<void> {
      return mockStart();
    }

    stop(): void {
      mockStop();
    }

    scheduleReconnect(): void {
      mockScheduleReconnect();
    }
  }

  return {
    ReconnectManager: MockReconnectManager,
  };
});

/**
 * 単体テスト: GmoAdapter
 *
 * 優先度: 中
 * - コンストラクタ、start(), connect(), disconnect() の動作確認
 * - handleMessage() のエラーハンドリング
 * - 再接続ロジックとの連携
 */
describe('GmoAdapter', () => {
  let mockMessageHandler: MessageHandler;
  let mockConnection: WebSocketConnection;
  let adapter: GmoAdapter;
  const symbol = 'BTC_JPY';
  const wsUrl = 'wss://api.coin.z.com/ws/public/v1';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // MessageHandler のモック
    mockMessageHandler = {
      handle: vi.fn().mockResolvedValue(undefined),
    };

    // WebSocketConnection のモック
    mockConnection = {
      onOpen: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      removeAllListeners: vi.fn(),
      terminate: vi.fn(),
    } as unknown as WebSocketConnection;

    // モックをリセット
    mockConnect.mockClear();
    mockSubscribe.mockClear();
    mockDisconnect.mockClear();
    mockParseMessage.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();
    mockScheduleReconnect.mockClear();

    // デフォルトの動作を設定
    mockConnect.mockResolvedValue(mockConnection);
    mockStart.mockResolvedValue(undefined);

    adapter = new GmoAdapter(symbol, wsUrl, mockMessageHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('コンストラクタ', () => {
    it('依存関係を正しく注入する', () => {
      expect(adapter).toBeInstanceOf(GmoAdapter);
    });
  });

  describe('start()', () => {
    it('ReconnectManager.start() を呼び出す', async () => {
      await adapter.start();

      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('connect()', () => {
    it('既存接続がある場合、クリーンアップしてから新規接続を確立する', async () => {
      // 最初の接続
      const connectPromise1 = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise1;
      expect(mockConnect).toHaveBeenCalledTimes(1);

      // 2回目の接続（既存接続のクリーンアップ）
      const connectPromise2 = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise2;

      expect(mockConnection.removeAllListeners).toHaveBeenCalled();
      expect(mockConnection.terminate).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('WebSocket接続を確立し、イベントハンドラを設定する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      expect(mockConnect).toHaveBeenCalledWith(wsUrl);
      expect(mockConnection.onMessage).toHaveBeenCalled();
      expect(mockConnection.onClose).toHaveBeenCalled();
      expect(mockConnection.onError).toHaveBeenCalled();
    });

    it('CONNECTION_DELAY (500ms) 後に購読リクエストを送信する', async () => {
      const connectPromise = adapter.connect();

      // 接続直後は購読リクエストが送信されていない
      expect(mockSubscribe).not.toHaveBeenCalled();

      // 500ms 経過
      await vi.advanceTimersByTimeAsync(500);

      await connectPromise;

      expect(mockSubscribe).toHaveBeenCalledWith(mockConnection, symbol);
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it('接続が閉じられた場合、再接続をスケジュールする', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      // onClose コールバックを取得して実行
      const onCloseCallback = vi.mocked(mockConnection.onClose).mock.calls[0]?.[0] as (() => void) | undefined;
      if (onCloseCallback) {
        onCloseCallback();
      }

      expect(mockScheduleReconnect).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[GmoAdapter] socket closed'));
    });

    it('エラーが発生した場合、ログに記録する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      // onError コールバックを取得して実行
      const errorEvent = new Event('error');
      const onErrorCallback = vi.mocked(mockConnection.onError).mock.calls[0]?.[0] as
        | ((event: Event) => void)
        | undefined;
      if (onErrorCallback) {
        onErrorCallback(errorEvent);
      }

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[GmoAdapter] socket error'), errorEvent);
    });
  });

  describe('disconnect()', () => {
    it('ReconnectManager.stop() を呼び出す', () => {
      adapter.disconnect();

      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('接続が存在する場合、接続を切断する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      adapter.disconnect();

      expect(mockConnection.close).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('接続が null の場合、エラーを投げない', () => {
      expect(() => adapter.disconnect()).not.toThrow();
      expect(mockStop).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('handleMessage()', () => {
    it('正常なメッセージを処理する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      const rawMessage: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      mockParseMessage.mockReturnValue(rawMessage);

      // onMessage コールバックを取得して実行
      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback(JSON.stringify(rawMessage));
      }

      expect(mockParseMessage).toHaveBeenCalled();
      expect(mockMessageHandler.handle).toHaveBeenCalledWith(rawMessage);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[GmoAdapter] received message: channel=ticker')
      );
    });

    it('パースに失敗した場合、メッセージを無視する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      mockParseMessage.mockReturnValue(null);

      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback('invalid message');
      }

      expect(mockParseMessage).toHaveBeenCalled();
      expect(mockMessageHandler.handle).not.toHaveBeenCalled();
    });

    it('エラーメッセージ（ERR-5003）の場合、ログに記録して処理を中断する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      const errorMessage: GmoRawMessage = {
        error: 'ERR-5003 Request too many.',
      };

      mockParseMessage.mockReturnValue(errorMessage);

      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback(JSON.stringify(errorMessage));
      }

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[GmoAdapter] API error: ERR-5003'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[GmoAdapter] Rate limit error detected'));
      expect(mockMessageHandler.handle).not.toHaveBeenCalled();
    });

    it('channel がないメッセージの場合、無視する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(500);
      await connectPromise;

      // channel プロパティが undefined のメッセージ
      const invalidMessage = {
        symbol: 'BTC_JPY',
        channel: undefined,
      } as unknown as GmoRawMessage;

      mockParseMessage.mockReturnValue(invalidMessage);

      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback(JSON.stringify(invalidMessage));
      }

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[GmoAdapter] message missing channel'),
        invalidMessage
      );
      expect(mockMessageHandler.handle).not.toHaveBeenCalled();
    });
  });
});
