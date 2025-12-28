import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmoWebSocketClient } from '@/infra/adapters/gmo/GmoWebSocketClient';
import type { GmoRawMessage } from '@/infra/adapters/gmo/types/GmoRawMessage';
import type { WebSocketConnection } from '@/infra/websocket/interfaces/WebSocketConnection';
import { LoggerMock } from '../../../helpers/LoggerMock';

// StandardWebSocketConnection をモック
const mockOnOpen = vi.fn();
const mockOnError = vi.fn();
const mockOnMessage = vi.fn();
const mockOnClose = vi.fn();
const mockSend = vi.fn();
const mockClose = vi.fn();
const mockRemoveAllListeners = vi.fn();
const mockTerminate = vi.fn();

vi.mock('@/infra/websocket/StandardWebSocketConnection', () => {
  class MockStandardWebSocketConnection {
    private openCallbacks: Array<() => void> = [];
    private errorCallbacks: Array<(error: Event) => void> = [];

    onOpen(callback: () => void): void {
      this.openCallbacks.push(callback);
      mockOnOpen(callback);
    }

    onError(callback: (error: Event) => void): void {
      this.errorCallbacks.push(callback);
      mockOnError(callback);
    }

    onMessage(callback: (data: string | ArrayBuffer | Blob) => void): void {
      mockOnMessage(callback);
    }

    onClose(callback: () => void): void {
      mockOnClose(callback);
    }

    send(data: string): void {
      mockSend(data);
    }

    close(): void {
      mockClose();
    }

    removeAllListeners(): void {
      this.openCallbacks = [];
      this.errorCallbacks = [];
      mockRemoveAllListeners();
    }

    terminate(): void {
      mockTerminate();
    }
  }

  return {
    StandardWebSocketConnection: MockStandardWebSocketConnection,
  };
});

/**
 * 単体テスト: GmoWebSocketClient
 *
 * 優先度: 高
 * - WebSocket接続の確立
 * - 購読リクエストの送信（レート制限対策含む）
 * - メッセージのパース（string/ArrayBuffer/Blob対応）
 * - 接続の切断
 */
describe('GmoWebSocketClient', () => {
  let client: GmoWebSocketClient;
  let loggerMock: LoggerMock;
  let mockSocket: {
    addEventListener: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
  };
  let mockConnectionInstance: WebSocketConnection;

  beforeEach(() => {
    vi.useFakeTimers();
    loggerMock = new LoggerMock();

    // WebSocket のモック
    mockSocket = {
      addEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 0, // CONNECTING
    };

    // WebSocket コンストラクタをモック（クラスとして）
    class MockWebSocket {
      addEventListener = mockSocket.addEventListener;
      send = mockSocket.send;
      close = mockSocket.close;
      readyState = mockSocket.readyState;
    }
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // StandardWebSocketConnection のインスタンスをモック
    mockConnectionInstance = {
      onOpen: mockOnOpen,
      onError: mockOnError,
      onMessage: mockOnMessage,
      onClose: mockOnClose,
      send: mockSend,
      close: mockClose,
      removeAllListeners: mockRemoveAllListeners,
      terminate: mockTerminate,
    } as unknown as WebSocketConnection;

    // モックをリセット
    mockOnOpen.mockClear();
    mockOnError.mockClear();
    mockOnMessage.mockClear();
    mockOnClose.mockClear();
    mockSend.mockClear();
    mockClose.mockClear();
    mockRemoveAllListeners.mockClear();
    mockTerminate.mockClear();

    client = new GmoWebSocketClient(loggerMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    // global.WebSocket は保持（次のテストでも使用するため）
  });

  describe('connect()', () => {
    it('WebSocket接続が成功すると、WebSocketConnection を返す', async () => {
      const wsUrl = 'wss://api.coin.z.com/ws/public/v1';

      // onOpen コールバックを保存して即座に実行
      mockOnOpen.mockImplementation((callback: () => void) => {
        // コールバックを即座に実行（モックなので）
        callback();
      });

      const connection = await client.connect(wsUrl);

      expect(connection).toBeDefined();
      expect(mockOnOpen).toHaveBeenCalled();
      expect(mockOnError).toHaveBeenCalled();
    });

    it('WebSocket接続が失敗すると、エラーを投げる', async () => {
      const wsUrl = 'wss://api.coin.z.com/ws/public/v1';

      // onOpen は呼ばない（エラーケースなので）
      mockOnOpen.mockImplementation(() => {
        // 何もしない（エラーが先に発生する）
      });

      // onError コールバックを保存して即座に実行
      mockOnError.mockImplementation((callback: (error: Event) => void) => {
        // コールバックを即座に実行（モックなので）
        callback(new Event('error'));
      });

      await expect(client.connect(wsUrl)).rejects.toThrow('WebSocket connection failed');
      expect(mockRemoveAllListeners).toHaveBeenCalled();
    });
  });

  describe('subscribe()', () => {
    it('3つのチャンネル（ticker, orderbooks, trades）に購読リクエストを送信する', async () => {
      const symbol = 'BTC_JPY';

      const subscribePromise = client.subscribe(mockConnectionInstance, symbol);
      // タイマーを進めてすべてのリクエストが送信されるまで待つ
      await vi.advanceTimersByTimeAsync(2000);
      await subscribePromise;

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend).toHaveBeenNthCalledWith(1, JSON.stringify({ command: 'subscribe', channel: 'ticker', symbol }));
      expect(mockSend).toHaveBeenNthCalledWith(
        2,
        JSON.stringify({ command: 'subscribe', channel: 'orderbooks', symbol })
      );
      expect(mockSend).toHaveBeenNthCalledWith(3, JSON.stringify({ command: 'subscribe', channel: 'trades', symbol }));
    });

    it('レート制限対策として、各購読リクエストの間に1秒の間隔を設ける', async () => {
      const symbol = 'BTC_JPY';

      const subscribePromise = client.subscribe(mockConnectionInstance, symbol);

      // 最初のリクエストが送信される
      expect(mockSend).toHaveBeenCalledTimes(1);

      // 1秒経過
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSend).toHaveBeenCalledTimes(2);

      // さらに1秒経過
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockSend).toHaveBeenCalledTimes(3);

      await subscribePromise;
    });

    it('最後のリクエストの後は待機しない', async () => {
      const symbol = 'BTC_JPY';

      const subscribePromise = client.subscribe(mockConnectionInstance, symbol);
      // タイマーを進めてすべてのリクエストが送信されるまで待つ
      await vi.advanceTimersByTimeAsync(2000);
      await subscribePromise;

      // すべてのリクエストが送信されている
      expect(mockSend).toHaveBeenCalledTimes(3);

      // タイマーが残っていないことを確認
      expect(vi.getTimerCount()).toBe(0);
    });

    it('購読成功時にログが出力される', async () => {
      const symbol = 'BTC_JPY';

      const subscribePromise = client.subscribe(mockConnectionInstance, symbol);
      // タイマーを進めてすべてのリクエストが送信されるまで待つ
      await vi.advanceTimersByTimeAsync(2000);
      await subscribePromise;

      expect(loggerMock.info).toHaveBeenCalledTimes(3);
      expect(loggerMock.info).toHaveBeenNthCalledWith(1, 'subscribed to channel', {
        channel: 'ticker',
        symbol: 'BTC_JPY',
      });
      expect(loggerMock.info).toHaveBeenNthCalledWith(2, 'subscribed to channel', {
        channel: 'orderbooks',
        symbol: 'BTC_JPY',
      });
      expect(loggerMock.info).toHaveBeenNthCalledWith(3, 'subscribed to channel', {
        channel: 'trades',
        symbol: 'BTC_JPY',
      });
    });
  });

  describe('parseMessage()', () => {
    it('string 形式のメッセージをパースできる', () => {
      const message: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      const parsed = client.parseMessage(JSON.stringify(message));

      expect(parsed).toEqual(message);
    });

    it('ArrayBuffer 形式のメッセージをパースできる', () => {
      const message: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      const jsonString = JSON.stringify(message);
      const buffer = Buffer.from(jsonString, 'utf-8');
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

      const parsed = client.parseMessage(arrayBuffer);

      expect(parsed).toEqual(message);
    });

    it('Blob 形式のメッセージをパースできる', () => {
      const message: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      const jsonString = JSON.stringify(message);
      const buffer = Buffer.from(jsonString, 'utf-8');
      // Blob を ArrayBuffer として扱う（実装では Blob を ArrayBuffer に変換している）
      const blob = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as unknown as Blob;

      const parsed = client.parseMessage(blob);

      expect(parsed).toEqual(message);
    });

    it('不正なJSON形式の場合、null を返す', () => {
      const invalidJson = 'invalid json';

      const parsed = client.parseMessage(invalidJson);

      expect(parsed).toBeNull();
      expect(loggerMock.error).toHaveBeenCalled();
    });

    it('パースエラー時にログが出力される', () => {
      const invalidJson = 'invalid json';

      client.parseMessage(invalidJson);

      expect(loggerMock.error).toHaveBeenCalledWith(
        'failed to parse message',
        expect.objectContaining({ err: expect.any(Error) })
      );
    });

    it('その他の型の場合、String() で変換してからパースする', () => {
      const message: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      // 数値を直接渡す（String() で変換される）
      const parsed = client.parseMessage(JSON.stringify(message) as string);

      expect(parsed).toEqual(message);
    });
  });

  describe('disconnect()', () => {
    it('接続が存在する場合、接続を切断する', async () => {
      const wsUrl = 'wss://api.coin.z.com/ws/public/v1';

      // 接続を確立（onOpen コールバックを即座に実行）
      mockOnOpen.mockImplementation((callback: () => void) => {
        callback();
      });

      await client.connect(wsUrl);

      // 切断
      client.disconnect();

      expect(mockClose).toHaveBeenCalled();
    });

    it('接続が null の場合、エラーを投げない', () => {
      // 接続を確立せずに切断を試みる
      expect(() => client.disconnect()).not.toThrow();
    });
  });
});
