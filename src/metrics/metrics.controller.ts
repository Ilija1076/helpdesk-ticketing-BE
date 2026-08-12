import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  async scrape(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.metricsService.registry.contentType);
    response.send(await this.metricsService.render());
  }
}
