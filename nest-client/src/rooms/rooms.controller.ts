import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get('available')
  findAvailable() {
    return this.roomsService.findAvailable();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Post()
  create(
    @Body() createRoomDto: CreateRoomDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.roomsService.create(
      createRoomDto,
      this.requireAuthorization(authorization),
    );
  }

  @UseGuards(AuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateRoomStatusDto: UpdateRoomStatusDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.roomsService.updateStatus(
      id,
      updateRoomStatusDto,
      this.requireAuthorization(authorization),
    );
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() room: CreateRoomDto,
    @Headers('authorization') authorization: string,
  ) {
    return this.roomsService.update(id, room, this.requireAuthorization(authorization));
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Headers('authorization') authorization: string) {
    return this.roomsService.remove(id, this.requireAuthorization(authorization));
  }

  private requireAuthorization(authorization: string): string {
    if (!authorization) {
      throw new UnauthorizedException('Authorization token is required');
    }

    return authorization;
  }
}