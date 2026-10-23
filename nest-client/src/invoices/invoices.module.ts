import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { InvoicesService } from './invoices.service.js';
import { InvoicesResolver } from './invoices.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [InvoicesService, InvoicesResolver],
})
export class InvoicesModule {}
