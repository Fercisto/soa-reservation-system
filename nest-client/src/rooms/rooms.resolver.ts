import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { RoomsService } from './rooms.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { Room } from './models/room.model.js';
import { CreateRoomInput } from './dto/room.inputs.js';

@Resolver(() => Room)
export class RoomsResolver {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(AuthGuard)
  @Query(() => [Room], { name: 'rooms', description: "Rooms of the admin's hotel" })
  async getRooms(@CurrentAuthToken() token?: string): Promise<Room[]> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.roomsService.findAll(token);
  }

  @Query(() => [Room], {
    name: 'availableRooms',
    description: "A hotel's rooms free for the dates (all available rooms without dates)",
  })
  async getAvailableRooms(
    @Args('hotelSlug') hotelSlug: string,
    @Args('checkIn', { nullable: true }) checkIn?: string,
    @Args('checkOut', { nullable: true }) checkOut?: string,
  ): Promise<Room[]> {
    return this.roomsService.findAvailable(hotelSlug, checkIn, checkOut);
  }

  @Query(() => Room, { name: 'room', nullable: true })
  async getRoom(@Args('id', { type: () => ID }) id: string): Promise<Room> {
    return this.roomsService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Room)
  async createRoom(
    @Args('input') input: CreateRoomInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Room> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.roomsService.create(input as any, token);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Room)
  async updateRoom(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateRoomInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Room> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.roomsService.update(id, input as any, token);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Room)
  async updateRoomStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status') status: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Room> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.roomsService.updateStatus(id, { status } as any, token);
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Boolean)
  async deleteRoom(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<boolean> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    await this.roomsService.remove(id, token);
    return true;
  }
}

