import { vi } from 'vitest';
import type { WebSocketConnection } from '@/infra/websocket/interfaces/WebSocketConnection';

/**
 * StandardWebSocketConnection のモック
 *
 * 他の取引所（Binance, Coinbase など）の WebSocket クライアントテストでも
 * 再利用できるように、共通のモックとして提供する。
 *
 * 使用方法:
 * ```typescript
 * import {
 *   mockOnOpen,
 *   mockSend,
 *   createMockWebSocketConnection,
 *   resetStandardWebSocketConnectionMocks,
 * } from '@test/unit/helpers/mocks/StandardWebSocketConnectionMock';
 *
 * vi.mock('@/infra/websocket/StandardWebSocketConnection', async () => {
 *   const { createMockStandardWebSocketConnectionClass } = await import(
 *     '@test/unit/helpers/mocks/StandardWebSocketConnectionMock'
 *   );
 *
 *   return {
 *     StandardWebSocketConnection: createMockStandardWebSocketConnectionClass(),
 *   };
 * });
 *
 * beforeEach(() => {
 *   resetStandardWebSocketConnectionMocks();
 *   const mockConnection = createMockWebSocketConnection();
 * });
 * ```
 */

/**
 * StandardWebSocketConnection のモック関数
 * テストから呼び出し回数や引数を検証できるようにする
 */
export const mockOnOpen = vi.fn();
export const mockOnError = vi.fn();
export const mockOnMessage = vi.fn();
export const mockOnClose = vi.fn();
export const mockSend = vi.fn();
export const mockClose = vi.fn();
export const mockRemoveAllListeners = vi.fn();
export const mockTerminate = vi.fn();

/**
 * StandardWebSocketConnection のモッククラス
 */
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

/**
 * vi.mock() 内で使用するための factory 関数
 * vi.mock() は hoisting されるため、動的 import でこの関数を呼び出す必要がある
 */
export function createMockStandardWebSocketConnectionClass() {
  return MockStandardWebSocketConnection;
}

/**
 * すべてのモック関数をリセットする
 */
export function resetStandardWebSocketConnectionMocks(): void {
  mockOnOpen.mockClear();
  mockOnError.mockClear();
  mockOnMessage.mockClear();
  mockOnClose.mockClear();
  mockSend.mockClear();
  mockClose.mockClear();
  mockRemoveAllListeners.mockClear();
  mockTerminate.mockClear();
}

/**
 * WebSocketConnection インターフェースを満たすモックインスタンスを作成する
 * テストで直接使用する場合に便利
 */
export function createMockWebSocketConnection(): WebSocketConnection {
  return {
    onOpen: mockOnOpen,
    onError: mockOnError,
    onMessage: mockOnMessage,
    onClose: mockOnClose,
    send: mockSend,
    close: mockClose,
    removeAllListeners: mockRemoveAllListeners,
    terminate: mockTerminate,
  } as unknown as WebSocketConnection;
}
