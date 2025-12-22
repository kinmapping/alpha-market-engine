import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StandardWebSocketConnection } from '@/infrastructure/websocket/StandardWebSocketConnection';

/**
 * 単体テスト: WebSocketConnection
 *
 * 優先度: 中
 * - イベントリスナーの管理
 * - コールバックの登録と実行
 * - WebSocket メソッドの呼び出し
 */
describe('StandardWebSocketConnection', () => {
  let mockSocket: {
    addEventListener: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
  };
  let connection: StandardWebSocketConnection;

  beforeEach(() => {
    // WebSocket のモック
    mockSocket = {
      addEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    };

    // WebSocket コンストラクタをモック
    class MockWebSocket {
      addEventListener = mockSocket.addEventListener;
      send = mockSocket.send;
      close = mockSocket.close;
      readyState = mockSocket.readyState;
    }
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    connection = new StandardWebSocketConnection(new WebSocket('wss://example.com'));
  });

  describe('コンストラクタ', () => {
    it('WebSocket のイベントリスナーを設定する', () => {
      expect(mockSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('onOpen()', () => {
    it('コールバックを登録できる', () => {
      const callback = vi.fn();
      connection.onOpen(callback);

      // イベントを発火
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const openCall = addEventListenerCalls.find((call) => call[0] === 'open');
      const openHandler = openCall?.[1] as () => void;

      if (openHandler) {
        openHandler();
      }

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('複数のコールバックを登録できる', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      connection.onOpen(callback1);
      connection.onOpen(callback2);

      // イベントを発火
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const openCall = addEventListenerCalls.find((call) => call[0] === 'open');
      const openHandler = openCall?.[1] as () => void;

      if (openHandler) {
        openHandler();
      }

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('onMessage()', () => {
    it('string 形式のメッセージでコールバックを呼び出す', () => {
      const callback = vi.fn();
      connection.onMessage(callback);

      // イベントを発火
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const messageCall = addEventListenerCalls.find((call) => call[0] === 'message');
      const messageHandler = messageCall?.[1] as (event: { data: string }) => void;
      if (messageHandler) {
        messageHandler({ data: 'test message' });
      }

      expect(callback).toHaveBeenCalledWith('test message');
    });

    it('ArrayBuffer 形式のメッセージでコールバックを呼び出す', () => {
      const callback = vi.fn();
      connection.onMessage(callback);

      const arrayBuffer = new ArrayBuffer(8);
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const messageCall = addEventListenerCalls.find((call) => call[0] === 'message');
      const messageHandler = messageCall?.[1] as (event: { data: ArrayBuffer }) => void;
      if (messageHandler) {
        messageHandler({ data: arrayBuffer });
      }

      expect(callback).toHaveBeenCalledWith(arrayBuffer);
    });

    it('Blob 形式のメッセージでコールバックを呼び出す', () => {
      const callback = vi.fn();
      connection.onMessage(callback);

      const blob = new Blob(['test'], { type: 'text/plain' });
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const messageCall = addEventListenerCalls.find((call) => call[0] === 'message');
      const messageHandler = messageCall?.[1] as (event: { data: Blob }) => void;
      if (messageHandler) {
        messageHandler({ data: blob });
      }

      expect(callback).toHaveBeenCalledWith(blob);
    });

    it('複数のコールバックを登録できる', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      connection.onMessage(callback1);
      connection.onMessage(callback2);

      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const messageHandler = addEventListenerCalls.find((call) => call[0] === 'message')?.[1] as (event: {
        data: string;
      }) => void;
      if (messageHandler) {
        messageHandler({ data: 'test' });
      }

      expect(callback1).toHaveBeenCalledWith('test');
      expect(callback2).toHaveBeenCalledWith('test');
    });
  });

  describe('onClose()', () => {
    it('コールバックを登録できる', () => {
      const callback = vi.fn();
      connection.onClose(callback);

      // イベントを発火
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const closeCall = addEventListenerCalls.find((call) => call[0] === 'close');
      const closeHandler = closeCall?.[1] as () => void;
      if (closeHandler) {
        closeHandler();
      }

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('複数のコールバックを登録できる', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      connection.onClose(callback1);
      connection.onClose(callback2);

      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const closeHandler = addEventListenerCalls.find((call) => call[0] === 'close')?.[1] as () => void;
      if (closeHandler) {
        closeHandler();
      }

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('onError()', () => {
    it('コールバックを登録できる', () => {
      const callback = vi.fn();
      connection.onError(callback);

      // イベントを発火
      const errorEvent = new Event('error');

      // 'error' イベントのハンドラを取得
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const errorCall = addEventListenerCalls.find((call) => call[0] === 'error');
      const errorHandler = errorCall?.[1] as (event: Event) => void;

      if (errorHandler) {
        errorHandler(errorEvent);
      }

      expect(callback).toHaveBeenCalledWith(errorEvent);
    });

    it('複数のコールバックを登録できる', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      connection.onError(callback1);
      connection.onError(callback2);

      const errorEvent = new Event('error');

      // 'error' イベントのハンドラを取得
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const errorCall = addEventListenerCalls.find((call) => call[0] === 'error');
      const errorHandler = errorCall?.[1] as (event: Event) => void;

      if (errorHandler) {
        errorHandler(errorEvent);
      }

      expect(callback1).toHaveBeenCalledWith(errorEvent);
      expect(callback2).toHaveBeenCalledWith(errorEvent);
    });
  });

  describe('send()', () => {
    it('WebSocket の send メソッドを呼び出す', () => {
      const data = 'test message';
      connection.send(data);

      expect(mockSocket.send).toHaveBeenCalledWith(data);
    });
  });

  describe('close()', () => {
    it('WebSocket の close メソッドを呼び出す', () => {
      connection.close();

      expect(mockSocket.close).toHaveBeenCalled();
    });
  });

  describe('removeAllListeners()', () => {
    it('すべてのコールバックをクリアする', () => {
      const openCallback = vi.fn();
      const messageCallback = vi.fn();
      const closeCallback = vi.fn();
      const errorCallback = vi.fn();

      connection.onOpen(openCallback);
      connection.onMessage(messageCallback);
      connection.onClose(closeCallback);
      connection.onError(errorCallback);

      connection.removeAllListeners();

      // イベントを発火してもコールバックが呼ばれない
      const addEventListenerCalls = mockSocket.addEventListener.mock.calls;
      const openHandler = addEventListenerCalls.find((call) => call[0] === 'open')?.[1] as () => void;
      if (openHandler) {
        openHandler();
      }

      expect(openCallback).not.toHaveBeenCalled();
      expect(messageCallback).not.toHaveBeenCalled();
      expect(closeCallback).not.toHaveBeenCalled();
      expect(errorCallback).not.toHaveBeenCalled();
    });
  });

  describe('terminate()', () => {
    it('WebSocket の close メソッドを呼び出す', () => {
      connection.terminate();

      expect(mockSocket.close).toHaveBeenCalled();
    });
  });
});
