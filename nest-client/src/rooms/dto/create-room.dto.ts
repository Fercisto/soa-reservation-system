import { RoomStatus } from './room-status.js';

export class CreateRoomDto {
  number: string;
  type: string;
  description?: string;
  price: number;
  capacity: number;
  features?: string[];
  status?: RoomStatus;
}