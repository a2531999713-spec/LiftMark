import { describe, expect, it } from '@jest/globals';

import { ApiClientError, toApiClientError } from '@/services/httpClient';

describe('api client error mapping', () => {
  it('maps fetch connection failures to a friendly server message', () => {
    const error = toApiClientError(
      new TypeError('fetch failed: java.net.ConnectException: Failed to connect to /47.100.239.29:80'),
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('无法连接服务器，请检查网络后重试。');
  });

  it('maps generic React Native network failures to a Chinese retry message', () => {
    const error = toApiClientError(new TypeError('Network request failed'));

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('网络连接失败，请稍后重试。');
  });

  it('maps aborted requests to timeout copy', () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    const error = toApiClientError(abortError);

    expect(error.code).toBe('REQUEST_TIMEOUT');
    expect(error.message).toBe('请求超时，请稍后重试。');
  });
});
