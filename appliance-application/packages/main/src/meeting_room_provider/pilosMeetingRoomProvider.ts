import {IMeetingRoomProvider} from './IMeetingRoomProvider';
import type {Config} from '../ConfigManager';

interface Meeting {
  id: string;
  name: string;
  description: string;
  type: string;
  token: string;
}

export class PilosMeetingRoomProvider implements IMeetingRoomProvider {

  async requestMeetingRooms(config: Config): Promise<Record<string, string>[]> {
    const pilos_url = config.meeting_provider_url;
    const meeting_id_token_dict: Record<string, string> = Object.fromEntries(
      config.meetings
        .map(({link}) => {
          const parts = link.split('/');
          const token = parts.pop();
          const id = parts.pop();
          return id && token ? [id, token] : [];
        })
        .filter(entry => entry.length > 0),
    );

    //console.log('Loaded pilos url and meetings from config:', pilos_url, Object.keys(meeting_id_token_dict));

    let meeting_list: Meeting[] = [];

    //console.log('Requesting meetings information from Pilos...');

    for (const [id, token] of Object.entries(meeting_id_token_dict)) {
      const response = await fetch(`${pilos_url}/api/v1/rooms/${id}`);
      const json = await response.json();
      const data = json.data;
      //console.log('Meeting information retrieved successfully:', data);
      meeting_list.push({
        id: id,
        name: data.name,
        description: data.short_description,
        type: data.type.name,
        token: token,
      });
    }
    return meeting_list as unknown as Record<string, string>[];
  }

  async getJoinUrl(meeting: any, config: Config): Promise<string> {
    meeting = meeting as Meeting;
    const base_url = config.meeting_provider_url + '/api/v1/rooms/' + meeting.id;
    const pilos_start_url = base_url + '/start';
    const pilos_join_url = base_url + '/join'; // its the pilos join url not the bbb join url
    
    let bbb_join_url: string = '';
    try {
      console.log('Requesting BBB join URL with /start API call: ' + pilos_start_url);
      bbb_join_url = await this.requestBBBJoinUrl(pilos_start_url, meeting.token);
    } catch (error) {
      console.log('Error requesting BBB join URL', error);
      console.log('Trying to request BBB join URL with Pilos /join API call: ' + pilos_join_url);
      try {
        bbb_join_url = await this.requestBBBJoinUrl(pilos_join_url, meeting.token);
      } catch (error) {
        console.error('Error requesting BBB join URL with Pilos /join API call:', error);
        throw error;
      }
    }
    //console.log('Received BBB join URL from Pilos: ', bbb_join_url);
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
    console.log('BBB join URL retrieved successfully: ', data);
    return data.url;
  }
}
