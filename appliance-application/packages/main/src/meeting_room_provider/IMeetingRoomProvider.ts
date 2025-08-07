
import type {Config} from '../ConfigManager';

export interface IMeetingRoomProvider {
  getJoinUrl(meeting: any, config: Config): Promise<string>;
  requestMeetingRooms(config: Config): Promise<Record<string, string>[]>
}