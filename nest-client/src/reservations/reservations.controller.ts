import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { UpdateReservationDatesDto } from './dto/update-reservation-dates.dto.js';
import { ReservationsService } from './reservations.service.js';

@UseGuards(AuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findAll(@Headers('authorization') authorization: string) {
    return this.reservationsService.findAll(
      this.requireAuthorization(authorization),
    );
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    return this.reservationsService.findOne(
      id,
      this.requireAuthorization(authorization),
    );
  }

  @Post()
  create(
    @Body() createReservationDto: CreateReservationDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.reservationsService.create(
      createReservationDto,
      this.requireAuthorization(authorization),
    );
  }

  @Patch(':id/dates')
  updateDates(
    @Param('id') id: string,
    @Body() updateReservationDatesDto: UpdateReservationDatesDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.reservationsService.updateDates(
      id,
      updateReservationDatesDto,
      this.requireAuthorization(authorization),
    );
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    return this.reservationsService.cancel(
      id,
      this.requireAuthorization(authorization),
    );
  }

  private requireAuthorization(authorization: string): string {
    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }

    return authorization;
  }
}