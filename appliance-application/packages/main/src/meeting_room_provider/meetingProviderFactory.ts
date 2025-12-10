import { MeetingRoomProvider } from './MeetingRoomProvider';
import { PilosMeetingRoomProvider } from './pilosMeetingRoomProvider';
import { StudIPMeetingRoomProvider } from './studipMeetingRoomProvider';

const providerMap: { [key: string]: new () => MeetingRoomProvider } = {
  pilos: PilosMeetingRoomProvider,
  studip: StudIPMeetingRoomProvider
};

export function createMeetingRoomProviders(): { [key: string]: MeetingRoomProvider } {

  const providerInstances: { [key: string]: MeetingRoomProvider } = {};

  for (const [providerId, ProviderClass] of Object.entries(providerMap)) {
    const providerInstance = new ProviderClass();
    providerInstances[providerId] = providerInstance;
  }

  return providerInstances;
}