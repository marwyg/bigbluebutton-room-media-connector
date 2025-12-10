
import {MeetingRoomProvider} from './MeetingRoomProvider';
import type {Config, Meeting} from '../ConfigManager';
import { ProviderMeetingInfo } from './ProviderMeetingInfo';
import { v4 as UUID } from 'uuid';

export class StudIPMeetingRoomProvider implements MeetingRoomProvider {

  async requestMeetingRooms(meeting: Meeting): Promise<ProviderMeetingInfo> {

    // studip keeps it simple for now, we simply define the name and stuff in the json settings file
    const studIpMeetingInfo: ProviderMeetingInfo = {
        id: UUID(),
        name: meeting.name || "StudIP Meeting",
        url: meeting.link,
        provider: "studip",
        description: "test description",
        type: "test type",
    };
    return studIpMeetingInfo;
  }


  async getJoinUrl(meeting: ProviderMeetingInfo, config: Config): Promise<string> {
    const studIpJoinUrl = meeting.url;
    let bbb_join_url: string = '';
    bbb_join_url = await this.requestBBBJoinUrl(studIpJoinUrl);
    console.log('Received BBB join URL from StudIP: ', bbb_join_url);
    return bbb_join_url;
  }

  async requestBBBJoinUrl(studipUrl: string): Promise<string> {
    let response;
    let joinUrl = '';

    do {
      console.log("Requesting BBB join URL from studip: " + studipUrl);
      response = await fetch(studipUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        redirect: 'manual'
      });
      const location = response.headers.get('Location')
      if (location) {
        studipUrl = location;
        if (location.includes('/bigbluebutton/api/join')) {
          joinUrl = location; // this could be overwritten several times, we want the last join url in the redirect chain
        }
      }
    } while (response.status === 302 || response.status === 301);

    if (response === undefined) {
      throw new Error("No response received from studip when requesting BBB join URL");
    }
    if (!response.ok) {
      throw new Error(`Failed to get BBB join URL: ${response.statusText}`);
    }
    console.log('BBB join URL retrieved successfully: ', joinUrl);
    return joinUrl;
  }

}
