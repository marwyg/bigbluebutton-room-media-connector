import {app} from 'electron';
import fs from 'fs';
import {z} from 'zod';

export type Config = z.infer<typeof ConfigSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
export type JoinParameter = z.infer<typeof JoinParameterSchema>;
export type ControlServer = z.infer<typeof ControlServerSchema>;

export const configPath = app.getPath('userData') + '/settings.json'; // path of settings file
export let config: Config;

export function saveConfig(config: Config) {
  console.log('Saving config to ' + configPath);
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config to ' + configPath, error);
    throw error;
  }
}

export function loadConfig() {
  // First we simply load the settings file
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Config loaded from ' + configPath);
  } catch (error) {
    console.log('Error reading config from ' + configPath, error);
  }

  // Second we validate the settings file
  try {
    console.log('Validating config...');
    ConfigSchema.parse(config);
    console.log('Config is valid. Checking for unrecognized keys...');
    const parsedKeys = Object.keys(config);
    const schemaKeys = Object.keys(ConfigSchema.shape);
    const extraKeys = parsedKeys.filter(key => !schemaKeys.includes(key));
    if (extraKeys.length > 0) {
      console.warn(
        `Warning: The following keys in settings.json are not recognized and will be ignored: \n${extraKeys.join(
          ', ',
        )}`,
      );
    } else {
      console.log('Config has no unrecognized keys.');
    }
  } catch (error) {
    console.error('Config is invalid', error);
  }
}

// This zod schema describes the Settings file structure
// With zod we also can validate the settings file

// Basic join parameters (used in each screen)
export const JoinParameterSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.boolean(), z.number(), z.undefined()]),
});

// Screen structure (contains join parameters)
export const ScreenSchema = z.object({
  name: z.string(),
  bbb_join_parameters: z.array(JoinParameterSchema),
});

// Layout structure (contains screens)
export const LayoutSchema = z.object({
  label: z.string(),
  screens: z.array(ScreenSchema),
});

// Room structure (contains layouts)
export const RoomSchema = z.object({
  bbb_user_name: z.string(),
  bbb_user_id: z.string(),
  layouts: z.array(LayoutSchema),
});

// Meeting structure
export const MeetingSchema = z.object({
  link: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

// Control server structure
export const ControlServerSchema = z.object({
  ws: z.string(),
  reconnect_interval: z.number(),
  ping_interval: z.number(),
});

// Final config schema
export const ConfigSchema = z.object({
  show_pin_display: z.boolean(),
  show_meeting_list: z.boolean(),
  control_server: ControlServerSchema,
  meeting_provider: z.string(),
  meeting_provider_url: z.string(),
  auto_reject_time: z.number(),
  hide_close_button: z.boolean(),
  keyboard_hid: z.boolean(),
  preferred_pin_screen: z.string(),
  debug: z.boolean(),
  room: RoomSchema,
  meetings: z.array(MeetingSchema),
});
