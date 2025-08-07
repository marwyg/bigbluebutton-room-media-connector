import {contextBridge, ipcRenderer} from 'electron';
import type {ipcAPI} from '../../common/ipc';
import type {Config} from '../../main/src/ConfigManager';

const api: ipcAPI = {
  getSettings: () => ipcRenderer.invoke('getConfig'),
  saveSettings: (config: Config) => ipcRenderer.invoke('saveConfig', config),
  close: () => ipcRenderer.send('close'),

  requireVerification: () => ipcRenderer.send('requireVerification'),
  verificationAccepted: () => ipcRenderer.send('verificationAccepted'),
  verificationRejected: () => ipcRenderer.send('verificationRejected'),
  // @TODO: Remove, old implementation where the plugin generated the join URLs
  // joinMeeting: urls => ipcRenderer.send('joinMeeting', urls),
  // joinMeeting: (url: string, layoutIndex: number) => ipcRenderer.send('joinMeeting', url, layoutIndex),
  joinMeeting: (meeting: any, layoutIndex: number) => ipcRenderer.send('joinMeeting', meeting, layoutIndex),
  requestMeetingRooms: () => ipcRenderer.invoke('requestMeetingRooms'),
  requestAvailableDisplays: () => ipcRenderer.invoke('requestAvailableDisplays'),
  pluginDisconnected: () => ipcRenderer.send('pluginDisconnected'),

  handleLeftMeeting: callback => ipcRenderer.on('leftMeeting', callback),
  handleVerificationAccepted: callback => ipcRenderer.on('acceptVerification', callback),
  handleVerificationRejected: callback => ipcRenderer.on('rejectVerification', callback),
};
contextBridge.exposeInMainWorld('electronAPI', api);
