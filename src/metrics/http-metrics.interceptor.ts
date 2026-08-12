import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

const METRICS_PATH = '/api/metrics';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    if (request.path === METRICS_PATH) {
      return next.handle();
    }

    const stopTimer = this.metrics.httpDuration.startTimer();

    const observe = (status: number) =>
      stopTimer({ method: request.method, route: this.routeOf(request), status });

    return next.handle().pipe(
      tap({
        next: () => observe(http.getResponse<Response>().statusCode),
        error: (error: { status?: number }) => observe(error?.status ?? 500),
      }),
    );
  }

  private routeOf(request: Request): string {
    const template = (request.route as { path?: string } | undefined)?.path;
    return template ? `${request.baseUrl ?? ''}${template}` : 'unmatched';
  }
}
