import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { MessagingService } from './messaging.service.js';
import { ServiceLogInterceptor } from './service-log.interceptor.js';

@Global()
@Module({
  providers: [
    MessagingService,
    { provide: APP_INTERCEPTOR, useClass: ServiceLogInterceptor },
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
