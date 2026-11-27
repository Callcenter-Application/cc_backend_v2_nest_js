import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor.js';

const contextWithStatus = (statusCode: number) =>
  ({
    switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
  }) as unknown as ExecutionContext;

const handlerReturning = <T>(data: T): CallHandler<T> => ({
  handle: () => of(data),
});

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor<unknown>();

  it('wraps the handler result in the success envelope', async () => {
    const data = { id: 1, email: 'a@b.com' };

    const result = await firstValueFrom(
      interceptor.intercept(contextWithStatus(200), handlerReturning(data)),
    );

    expect(result).toEqual({
      success: true,
      statusCode: 200,
      data,
      timestamp: expect.any(String),
    });
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('reports the status code set on the response', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(contextWithStatus(201), handlerReturning([])),
    );

    expect(result.statusCode).toBe(201);
    expect(result.data).toEqual([]);
  });
});
