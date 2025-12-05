import {BrowserWindow} from 'electron';
import type {ApolloClient, NormalizedCacheObject} from '@apollo/client/core';
import {gql} from '@apollo/client/core';
import {BBBGraphQl} from './BBBGraphQl';
import type {DisplayManager} from './displayManager';
import type { Layout } from './ConfigManager';
import {v7 as uuid} from 'uuid';
import fs from 'fs';
import { ca } from 'zod/v4/locales';

export async function createBBBMeeting(control: string, displayManager: DisplayManager, leftCallback: () => void) {

  console.log('Creating BBBGraphQL instance');
  const bbbGraphQl = new BBBGraphQl(control);
  console.log('Connecting to BBB GraphQl');
  const connected = await bbbGraphQl.connect(leftCallback);
  if (!connected) return false;

  console.log('connected to graphql');

  return new BBBMeeting(displayManager, leftCallback, bbbGraphQl);
}

class BBBMeeting {
  private screens!: {[key: string]: string};
  private displayManager: DisplayManager;

  private windows: {[key: string]: BrowserWindow};
  private apolloClient: ApolloClient<NormalizedCacheObject> | undefined;
  private bbbGraphQl: BBBGraphQl;
  private mediaScreen: {url: string; window: BrowserWindow} | undefined;

  constructor(displayManager: DisplayManager, leftCallback: () => void, bbbGraphQl: BBBGraphQl) {
    this.displayManager = displayManager;
    this.windows = {};
    this.bbbGraphQl = bbbGraphQl;

    this.apolloClient = this.bbbGraphQl.getApolloClient();

    this.onUsersLeft(async () => {
      console.log('all users left');
      await this.leave();
      leftCallback();
    });
  }

  private onUsersLeft(callback: () => void) {
    const getMeetingEndData = gql`
      subscription getUserCurrent {
        user_current {
          isModerator
          logoutUrl
          currentlyInMeeting
          meeting {
            ended
            endedAt
            endedBy
            endedByUserName
            endedReasonCode
          }
        }
      }
    `;

    if (this.apolloClient == undefined) {
      console.error('Error: apolloClient is undefined');
      return;
    }

    console.log("subscribing with apollo client..");

    this.apolloClient
      .subscribe({
        query: getMeetingEndData,
      })
      .subscribe({
        next(data) {
          console.log('getMeetingEndData', JSON.stringify(data, null, 2));
          const our_user = data.data.user_current[0];
          if (our_user.meeting.ended === true // when we click the "end meeting for all" button
            || our_user.currentlyInMeeting === false) { // when we click "leave meeting" button
            console.log('Meeting ended');
            callback();
          }
        },
        error(err) {
          console.error('err meeting ended', err);
        },
      });

    const USER_SESSIONS = gql`
      subscription {
        user_session(where: {connectionsAlive: {_gt: "0"}}) {
          connectionsAlive
          enforceLayout
          sessionName
          sessionToken
        }
      }
    `;

    // this.apolloClient
    //   .subscribe({
    //     query: USER_SESSIONS,
    //   })
    //   .subscribe({
    //     next(data) {
    //       const userSessions = data.data.user_session;
    //       console.log('userSessions', JSON.stringify(userSessions, null, 2));

    //       // Is the original user still in the meeting?
    //       // @ts-ignore
    //       const isOwnerPresent = userSessions.some(session => session.sessionName == null);

    //       if (!isOwnerPresent) {
    //         //callback();
    //       }
    //     },
    //     error(err) {
    //       console.error('err', err);
    //     },
    //   });
  }

  public async openScreens(layout: Layout) {

    console.log('Switching Layout to: ', layout.label);

    // if (this.windows.length > 0) {
    //   console.log('Windows already exist. Amount of Current windows: ' + this.windows.length);
    //   for (var window of this.windows) {
    //     console.log('Closing window: ' + window.id);
    //     window.close();
    //     window.destroy();
    //   }
    // }

    this.mediaScreen = undefined;
    this.screens = {};

    //for (const [key, value] of Object.entries(layout.screens)) {
    for (const screen of layout.screens) {
      console.log("\nProcessing screen: " + screen.name);
      console.log("With join parameters: " + JSON.stringify(screen.bbb_join_parameters, null, 2) + "\n");

      // convert the join parameters to a dictionary
      const joinParameters: {[key: string]: string} = {};
      for (const joinParameter of screen.bbb_join_parameters) {
        joinParameters[joinParameter.key] = joinParameter.value as string;;
      }

      const joinUrl = await this.bbbGraphQl.getJoinURL({
        sessionName: screen.name,
        duplicateSession: false,
        ...joinParameters,
      });
      this.screens[screen.name] = joinUrl.data.response.url;
    }

    let newWindows: {[key: string]: BrowserWindow} = {};

    // todo: currently we only can open up one screen with webcams
    // it has to be the last screen that we open up or it will break
    const screensAsList = Object.entries(this.screens);
    const cameraScreenIndex = screensAsList.findIndex(([key, value]) => value.includes("CAMERAS_ONLY"));
    if (cameraScreenIndex !== -1) {
      const [camera_display] = screensAsList.splice(cameraScreenIndex, 1);
      screensAsList.push(camera_display);
    }

    for (const [screen, url] of screensAsList) {
      const screenDisplay = this.displayManager.getDisplay(screen);

      if (screenDisplay == null) {
        console.log('screen ' + screen + ' not found');
        continue;
      }

      console.log('Processing screen ' + screen);

      const partition = 'persist:windows-' + uuid();

      // Get old window if exists
      let screenWindow = this.windows[screenDisplay.label];
      delete this.windows[screenDisplay.label];

      if (screenWindow == undefined) {
        console.log('Creating new window');
        screenWindow = new BrowserWindow({
          show: true,
          width: screenDisplay.size.width,
          height: screenDisplay.size.height,
          x: screenDisplay.bounds.x,
          y: screenDisplay.bounds.y,
          fullscreen: true,
          webPreferences: {
            partition: partition,
            contextIsolation: true,
          },
          autoHideMenuBar: true,
        });
      } else {
        console.log('Using existing window');
      }

      // When leaving the BBB meeting (by visiting another website), BBB will show a confirmation dialog (are you sure blabla)
      // This dialog will prevent the loading of a new URL, so we handle this problem here in this event listener
      screenWindow.webContents.on('will-prevent-unload', (event) => {
        console.log("Prevented unload detected, forcing unload...");
        event.preventDefault(); // This stops the confirmation dialog
        if(screenWindow) {
          console.log(screenDisplay.label + ": Loading URL again: " + url);
          screenWindow.loadURL(url);
        }
      });
      console.log('\n' + screenDisplay.label + ': Loading URL: ' + url);
      await screenWindow.loadURL(url);
      // todo: do we need this timeout?
      await new Promise(r => setTimeout(r, 2000));
      console.log(screenDisplay.label + ': Loading of URL finished.\n');
      newWindows[screenDisplay.label] = screenWindow;

      if (url.includes('userdata-bbb_auto_join_audio=true')) {
        this.mediaScreen = {url: url, window: screenWindow};
      }
    }

    // Close all unused windows
    Object.values(this.windows).forEach(window => {
      console.log('closing window ' + window.id);
      window.close();
      window.destroy();
    });

    this.windows = newWindows;
  }

  public toggleMute() {
    return this.bbbGraphQl.toggleMute();
  }

  public becomePresenter() {
    this.bbbGraphQl.becomePresenter();
  }

  public toggleRaiseHand() {
    return this.bbbGraphQl.toggleRaiseHand();
  }

  // public mute() {
  //   this.bbbGraphQl.becomePresenter();
  //   // this.executeJavaScriptInMediaScreen(
  //   //   'document.querySelectorAll(\'button[data-test="muteMicButton"]\')[0].click()',
  //   // ).then(r => console.log(r));
  // }

  // public unmute() {
  //   this.bbbGraphQl.becomePresenter();
  //   // this.executeJavaScriptInMediaScreen(
  //   //   'document.querySelectorAll(\'button[data-test="unmuteMicButton"]\')[0].click()',
  //   // ).then(r => console.log(r));
  // }

  public async getMediaDevices() {
    const command = `
      new Promise((resolve) => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          const videoDevices = devices
            .filter(device => device.kind == 'videoinput')
            .map(device => {
              return {
                label: device.label,
                deviceId: device.deviceId,
              };
            });
          resolve(videoDevices)
        });
      });
    `;

    return await this.executeJavaScriptInMediaScreen(command);
  }

  private async executeJavaScriptInMediaScreen(command: string) {
    if (this.mediaScreen) {
      return await this.mediaScreen.window.webContents.executeJavaScript(command);
    }
  }

  private closeScreens() {
    console.log('Closing all windows');
    Object.values(this.windows).forEach(window => {
      window.close();
      window.destroy();
    });
  }

  public async leave() {
    console.log('leaving meeting');
    this.closeScreens();
    console.log('leaving bbbGraphQl');
    await this.bbbGraphQl.leaveMeeting();
  }
}
