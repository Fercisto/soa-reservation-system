import { UnauthorizedException } from '@nestjs/common';

import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

describe('ReservationsController', () => {
  it('forwards an authenticated reservation request to Laravel', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const service = { create } as unknown as ReservationsService;
    const controller = new ReservationsController(service);
    const reservation: CreateReservationDto = {
      room_id: 1,
      check_in: '2026-10-10',
      check_out: '2026-10-12',
    };

    await expect(
      controller.create(reservation, 'Bearer customer-token'),
    ).resolves.toEqual({ id: 1 });

    expect(create).toHaveBeenCalledWith(reservation, 'Bearer customer-token');
  });

  it('rejects reservation requests without an authorization token', () => {
    const service = {} as ReservationsService;
    const controller = new ReservationsController(service);

    expect(() => controller.findAll('')).toThrow(UnauthorizedException);
  });
});