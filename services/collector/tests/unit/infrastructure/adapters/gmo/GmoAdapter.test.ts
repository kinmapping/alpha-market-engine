import { LoggerMock } from '@test/unit/helpers/mocks/LoggerMock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmoAdapter } from '@/infra/adapters/gmo/GmoAdapter';
import type { GmoRawMessage } from '@/infra/adapters/gmo/types/GmoRawMessage';
import type { WebSocketConnection } from '@/infra/websocket/interfaces/WebSocketConnection';

// GmoWebSocketClient をモック
const mockConnect = vi.fn();
const mockSubscribe = vi.fn();
const mockDisconnect = vi.fn();
const mockParseMessage = vi.fn();

vi.mock('@/infra/adapters/gmo/GmoWebSocketClient', () => {
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

/**
 * 単体テスト: GmoAdapter
 *
 * 優先度: 中
 * - コンストラクタ、connect(), disconnect() の動作確認
 * - メッセージコールバックの動作確認
 */
describe('GmoAdapter', () => {
  let mockOnMessage: (data: string | ArrayBuffer | Blob) => Promise<void>;
  let mockOnClose: () => void;
  let mockOnError: (event: Event) => void;
  let mockConnection: WebSocketConnection;
  let adapter: GmoAdapter;
  let loggerMock: LoggerMock;
  const symbol = 'BTC_JPY';
  const wsUrl = 'wss://api.coin.z.com/ws/public/v1';

  beforeEach(() => {
    vi.useFakeTimers();
    loggerMock = new LoggerMock();

    // コールバックのモック
    mockOnMessage = vi.fn().mockResolvedValue(undefined);
    mockOnClose = vi.fn();
    mockOnError = vi.fn();

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

    // デフォルトの動作を設定
    mockConnect.mockResolvedValue(mockConnection);

    adapter = new GmoAdapter(symbol, wsUrl, {
      logger: loggerMock,
      onMessage: mockOnMessage,
      onClose: mockOnClose,
      onError: mockOnError,
    });
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

  describe('connect()', () => {
    it('既存接続がある場合、クリーンアップしてから新規接続を確立する', async () => {
      // 最初の接続
      const connectPromise1 = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise1;
      expect(mockConnect).toHaveBeenCalledTimes(1);

      // 2回目の接続（既存接続のクリーンアップ）
      const connectPromise2 = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise2;

      expect(mockConnection.removeAllListeners).toHaveBeenCalled();
      expect(mockConnection.terminate).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('WebSocket接続を確立し、イベントハンドラを設定する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
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
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);

      await connectPromise;

      expect(mockSubscribe).toHaveBeenCalledWith(mockConnection, symbol);
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it('接続が閉じられた場合、再接続をスケジュールする', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise;

      // onClose コールバックを取得して実行
      const onCloseCallback = vi.mocked(mockConnection.onClose).mock.calls[0]?.[0] as (() => void) | undefined;
      if (onCloseCallback) {
        onCloseCallback();
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(loggerMock.warn).toHaveBeenCalledWith('socket closed', { symbol });
    });

    it('エラーが発生した場合、ログに記録する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise;

      // onError コールバックを取得して実行
      const errorEvent = new Event('error');
      const onErrorCallback = vi.mocked(mockConnection.onError).mock.calls[0]?.[0] as
        | ((event: Event) => void)
        | undefined;
      if (onErrorCallback) {
        onErrorCallback(errorEvent);
      }

      expect(loggerMock.error).toHaveBeenCalledWith('socket error', { symbol, event: errorEvent });
      expect(mockOnError).toHaveBeenCalledWith(errorEvent);
    });
  });

  describe('disconnect()', () => {
    it('接続が存在する場合、接続を切断する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise;

      adapter.disconnect();

      expect(mockConnection.close).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('接続が null の場合、エラーを投げない', () => {
      expect(() => adapter.disconnect()).not.toThrow();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('メッセージ処理', () => {
    it('正常なメッセージを処理する', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise;

      const messageData = '{"channel":"ticker","symbol":"BTC_JPY"}';

      // onMessage コールバックを取得して実行
      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback(messageData);
      }

      expect(mockOnMessage).toHaveBeenCalledWith(messageData);
    });

    it('メッセージを受信した場合、onMessage コールバックを呼び出す', async () => {
      const connectPromise = adapter.connect();
      await vi.advanceTimersByTimeAsync(adapter.CONNECTION_DELAY);
      await connectPromise;

      const messageData = 'invalid message';

      const onMessageCallback = vi.mocked(mockConnection.onMessage).mock.calls[0]?.[0] as
        | ((data: string | ArrayBuffer | Blob) => void)
        | undefined;
      if (onMessageCallback) {
        await onMessageCallback(messageData);
      }

      expect(mockOnMessage).toHaveBeenCalledWith(messageData);
    });
  });
});
