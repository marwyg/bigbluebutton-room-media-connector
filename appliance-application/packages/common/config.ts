export type Config = {

  show_pin_display: boolean;
  show_meeting_list: boolean;

  control_server: {
    ws: string;
    reconnect_interval: number;
    ping_interval: number;
  };
  auto_reject_time: number;
  preferred_pin_screen: string;
  hide_close_button: boolean;
  debug: boolean;
  keyboard_hid: boolean;
  room: RoomConfig;
  // Array of MeetingConfigs 
  meetings: MeetingConfig[];
  meeting_provider: string;
  meeting_provider_url: string;
};

export type MeetingConfig = {
  link: string;
  name?: string;
  description?: string;
}

export type RoomConfig = {
  bbb_user_name: string;
  layouts: Layout[]
};

export type Layout = {
  label: string;
  screens: {
    [key: string]: {
      bbb_join_parameters: {
        [key: string]: string | boolean | number | undefined;
      };
    };
  };
};
