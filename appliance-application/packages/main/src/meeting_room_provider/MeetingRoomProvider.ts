
import type {Config, Meeting} from '../ConfigManager';
import { ProviderMeetingInfo } from './ProviderMeetingInfo';

export interface MeetingRoomProvider {
  getJoinUrl(meeting: any, config: Config): Promise<string>;
  requestMeetingRooms(meeting: Meeting): Promise<ProviderMeetingInfo>
}