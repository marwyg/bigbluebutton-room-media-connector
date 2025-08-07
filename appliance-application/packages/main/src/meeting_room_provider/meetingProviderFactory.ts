import { IMeetingRoomProvider } from './IMeetingRoomProvider';
import { PilosMeetingRoomProvider } from './pilosMeetingRoomProvider';

const providerMap: { [key: string]: new () => IMeetingRoomProvider } = {
  pilos: PilosMeetingRoomProvider,
};

export function createMeetingRoomProvider(providerName: string): IMeetingRoomProvider {
  const ProviderClass = providerMap[providerName];

  if (!ProviderClass) {
    throw new Error('Unknown meeting room provider: ${providerName}');
  }

  return new ProviderClass();
}