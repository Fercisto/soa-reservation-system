import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { RoomsModule } from './rooms/rooms.module.js';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      introspection: true,
      formatError: (error) => {
        const originalError = error.extensions?.originalError as any;
        const message =
          originalError?.message ||
          (typeof originalError === 'string' ? originalError : null) ||
          error.message;

        return {
          message: Array.isArray(message) ? message[0] : message,
          code: error.extensions?.code,
        };
      },
      context: ({ req }: { req: any }) => ({ req }),
    }),
    AuthModule,
    RoomsModule,
    ReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}