import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateInvoiceInput {
  @Field(() => Int, { description: 'Paid reservation to invoice' })
  reservation_id: number;

  @Field({ description: 'Customer RFC (12 characters for companies, 13 for individuals)' })
  rfc: string;

  @Field({ description: 'Name exactly as in the Constancia de Situación Fiscal' })
  name: string;

  @Field({ description: 'Postal code of the fiscal address' })
  postal_code: string;

  @Field({ description: 'SAT c_RegimenFiscal, e.g. 601, 612, 626' })
  tax_regime: string;

  @Field({ description: 'G03 (gastos en general) | S01 (sin efectos fiscales)' })
  cfdi_use: string;
}
