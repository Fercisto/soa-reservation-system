import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../../auth/models/user.model.js';
import { PaymentReservation } from '../../payments/models/payment.model.js';

@ObjectType({ description: 'CFDI 4.0 stamped through the Profact PAC' })
export class Invoice {
  @Field(() => ID)
  id: number | string;

  @Field(() => Int)
  reservation_id: number;

  @Field(() => Int)
  payment_id: number;

  @Field(() => Int)
  user_id: number;

  @Field({ description: 'issued | cancelled' })
  status: string;

  @Field({ description: 'profact | fake' })
  provider: string;

  @Field({ nullable: true, description: 'Folio fiscal assigned by the SAT' })
  uuid?: string;

  @Field()
  series: string;

  @Field()
  folio: string;

  @Field({ description: 'Customer RFC' })
  rfc: string;

  @Field({ description: 'Customer name or company name' })
  name: string;

  @Field()
  postal_code: string;

  @Field({ description: 'SAT c_RegimenFiscal' })
  tax_regime: string;

  @Field({ description: 'SAT c_UsoCFDI' })
  cfdi_use: string;

  @Field({ description: 'SAT c_FormaPago' })
  payment_form: string;

  @Field(() => Float)
  subtotal: number;

  @Field(() => Float)
  tax: number;

  @Field(() => Float)
  total: number;

  @Field({
    nullable: true,
    description: 'Stamped XML. Only returned by the invoice(id) query',
  })
  xml?: string;

  @Field({
    nullable: true,
    description: 'Base64 JPEG of the SAT verification QR. Only returned by the invoice(id) query',
  })
  qr_code?: string;

  @Field({ nullable: true })
  issued_at?: string;

  @Field({ nullable: true })
  cancelled_at?: string;

  @Field({ nullable: true })
  created_at?: string;

  @Field(() => PaymentReservation, { nullable: true })
  reservation?: PaymentReservation;

  @Field(() => User, { nullable: true })
  user?: User;
}
