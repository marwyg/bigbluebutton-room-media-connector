import {MeetingRoomProvider} from './MeetingRoomProvider';
import type {Config, Meeting} from '../ConfigManager';
import { ProviderMeetingInfo } from './ProviderMeetingInfo';

interface PilosMeetingInfo extends ProviderMeetingInfo {
  token: string;
}

export class PilosMeetingRoomProvider implements MeetingRoomProvider {

  async requestMeetingRooms(meeting: Meeting): Promise<ProviderMeetingInfo> {

    const link = meeting.link;
    const pilos_url = link.split("/rooms/")[0];
    const parts = link.split('/');
    const token = parts.pop();
    const id = parts.pop();

    // console.log('Loaded pilos url and meetings from config:', pilos_url, meeting_id_token_dict);
    // console.log('Requesting meetings information from Pilos...');

    const pilos_room_url = `${pilos_url}/api/v1/rooms/${id}`;
    // console.log(pilos_room_url);
    const response = await fetch(pilos_room_url);
    if (response.status == 403) {
      throw new Error(`Pilos returned status 403 while trying to get room information, maybe you have to configure 'allow guests' in the room settings, but please check the following message from pilos: ${await response.text()}`);
    }
    // console.log(response);
    const json = await response.json();
    // console.log("Reponse json: ", json);
    const data = json.data;
    // console.log('Meeting information retrieved successfully:', data);

    if (id === undefined || token === undefined) {
      throw new Error("Id or Token was undefined");
    }

    const providerMeeting: PilosMeetingInfo = {
      id: id,
      name: data.name,
      url: pilos_url,
      provider: "pilos",
      description: data.short_description,
      type: data.type.name,
      token: token,
    };

    return providerMeeting;
  }

  async getJoinUrl(meeting: any, config: Config): Promise<string> {
    meeting = meeting as Meeting;
    //const base_url = config.meeting_provider_url + '/api/v1/rooms/' + meeting.id;
    const base_url = meeting.url + '/api/v1/rooms/' + meeting.id;
    const pilos_start_url = base_url + '/start';
    const pilos_join_url = base_url + '/join'; // its the pilos join url not the bbb join url

    let bbb_join_url: string = '';
    try {
      // console.log('Requesting BBB join URL with Pilos /start API call: ' + pilos_start_url);
      bbb_join_url = await this.requestBBBJoinUrl(pilos_start_url, meeting.token);
    } catch (error) {
      // console.log('Error requesting BBB join URL, maybe the room was already started', error);
      // console.log('Trying to request BBB join URL with Pilos /join API call: ' + pilos_join_url);
      try {
        bbb_join_url = await this.requestBBBJoinUrl(pilos_join_url, meeting.token);
      } catch (error) {
        console.error('Error requesting BBB join URL with Pilos /join API call:', error);
        throw error;
      }
    }
    // console.log('Received BBB join URL from Pilos: ', bbb_join_url);
    return bbb_join_url;
  }

  async requestBBBJoinUrl(url: string, token: string): Promise<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': token,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get BBB join URL: ${response.statusText}`);
    }
    const data = await response.json();
    // console.log('BBB join URL retrieved successfully: ', data);
    return data.url;
  }

}
