import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description: 'Menu category stored in the restaurant menu-service',
})
export class MenuCategory {
  @Field(() => ID)
  id: number;

  @Field()
  name: string;
}

@ObjectType({ description: 'Dish stored in the restaurant menu-service' })
export class Dish {
  @Field(() => ID)
  id: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  categoryId: number;

  @Field({ nullable: true })
  category?: string;

  @Field()
  available: boolean;
}

@InputType()
export class DishInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  categoryId: number;

  @Field({ defaultValue: true })
  available: boolean;
}

@ObjectType({
  description: 'Hotel employee stored in the restaurant employee-service',
})
export class Employee {
  @Field(() => ID)
  id: number;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  role: string;

  @Field()
  shift: string;

  @Field()
  active: boolean;

  @Field({ nullable: true })
  hireDate?: string;

  @Field({ nullable: true })
  createdAt?: string;
}

@InputType()
export class EmployeeInput {
  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ description: 'One of employeeRoles' })
  role: string;

  @Field({ description: 'One of employeeShifts' })
  shift: string;

  @Field({ nullable: true, description: 'yyyy-MM-dd' })
  hireDate?: string;

  @Field({ defaultValue: true })
  active: boolean;
}
