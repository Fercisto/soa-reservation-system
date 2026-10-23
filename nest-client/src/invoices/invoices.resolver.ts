import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { InvoicesService } from './invoices.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { Invoice } from './models/invoice.model.js';
import { AdminSummary } from './models/admin-summary.model.js';
import { CreateInvoiceInput } from './dto/invoice.inputs.js';

@UseGuards(AuthGuard)
@Resolver(() => Invoice)
export class InvoicesResolver {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Query(() => [Invoice], {
    name: 'invoices',
    description: 'Own invoices (admin: all invoices)',
  })
  async getInvoices(
    @Args('status', { nullable: true }) status?: string,
    @Args('reservationId', { type: () => Int, nullable: true })
    reservationId?: number,
    @CurrentAuthToken() token?: string,
  ): Promise<Invoice[]> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.invoicesService.findAll(
      { status, reservation_id: reservationId },
      token,
    );
  }

  @Query(() => Invoice, {
    name: 'invoice',
    nullable: true,
    description: 'Invoice with its stamped XML and QR code',
  })
  async getInvoice(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Invoice> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.invoicesService.findOne(id, token);
  }

  @Mutation(() => Invoice, {
    description: 'Stamps the CFDI of a paid reservation with the customer fiscal data',
  })
  async requestInvoice(
    @Args('input') input: CreateInvoiceInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Invoice> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.invoicesService.create(input, token);
  }

  @Mutation(() => Invoice, {
    description:
      'Cancels the CFDI with the SAT (reason 02). The reservation stays paid and can be invoiced again',
  })
  async cancelInvoice(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Invoice> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.invoicesService.cancel(id, token);
  }

  @Query(() => AdminSummary, {
    name: 'adminSummary',
    description: 'Admin dashboard KPIs (admin only)',
  })
  async getAdminSummary(
    @CurrentAuthToken() token?: string,
  ): Promise<AdminSummary> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.invoicesService.adminSummary(token);
  }
}
