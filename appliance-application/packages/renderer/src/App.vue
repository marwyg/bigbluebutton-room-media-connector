<script lang="ts" setup>
import PairingCode from './components/PairingCode.vue';
import { inject, onMounted, onBeforeUnmount, ref, toRaw, computed } from 'vue';
import BBBWebSocket from './websocket';
import LoadingSpinner from './components/LoadingSpinner.vue';
import ConnectionError from './components/ConnectionError.vue';
import VerifyConnection from './components/VerifyConnection.vue';
import ConfigMissing from './components/ConfigMissing.vue';
import { XMarkIcon } from '@heroicons/vue/24/solid';
//import type { Config } from '../../common/config.ts';
import type { Config, JoinParameter, Layout } from '../../main/src/ConfigManager';
import MeetingComponent from './components/MeetingComponent.vue';
import { join } from 'path';


let availableDisplays = ref<String[]>([]);
let meetings = ref<Record<string, any>[]>([]);
let showSettingsScreen = ref(false);

const config = inject<Config>('config')!;
const originalConfig = ref<Config | null>(null); // used for resetting the config

const handleSettingsKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'k') {
    event.preventDefault();
    showSettingsScreen.value = !showSettingsScreen.value;
    if (showSettingsScreen.value && originalConfig.value === null) {
      originalConfig.value = JSON.parse(JSON.stringify(toRaw(config)));
    }
  }
};

const pin = ref<string | null>(null);
const verificationCode = ref<string | null>(null);
const ws_connection_failed = ref(false);

const onConnectionChanged = (status: boolean) => {
  ws_connection_failed.value = !status;
};

const onPairingPin = (newPin: string) => {
  pin.value = newPin;
};

const onVerification = (newVerificationCode: string) => {
  pin.value = null;
  verificationCode.value = newVerificationCode;
  window.electronAPI.requireVerification();
};

/*
const onJoinUrl = (url: string, layoutIndex: number) => {
  window.electronAPI.joinMeeting(url, layoutIndex);
};
*/

const onJoin = (meeting: any, layoutIndex: number) => {
  console.log(toRaw(meeting)); // toRaw removes the whole vue stuff from the object
  window.electronAPI.joinMeeting(toRaw(meeting), layoutIndex);
};

/*
@TODO: Remove, old implementation where plugin created multiple urls
const onJoinUrls = urls => {
  window.electronAPI.joinMeeting(urls);
};
*/

window.electronAPI.handleLeftMeeting(() => {
  ws.disconnectFromPlugin();
});

window.electronAPI.handleVerificationAccepted(() => {
  ws.acceptVerification();
  verificationCode.value = null;
});

window.electronAPI.handleVerificationRejected(() => {
  ws.rejectVerification();
  verificationCode.value = null;
});

let ws: BBBWebSocket;

function connect() {
  ws = new BBBWebSocket(
    config.room,
    config.control_server.ws,
    config.control_server.reconnect_interval,
    config.control_server.ping_interval,
  );
  ws.setConnectionStatusCallback(onConnectionChanged);
  ws.setPairingPinCallback(onPairingPin);
  ws.setVerificationCallback(onVerification);
  //ws.setJoinUrlCallback(onJoinUrl);
  // @TODO: Remove, old implementation where plugin created multiple urls
  // ws.setJoinUrlsCallback(onJoinUrls);
  ws.setPluginDisconnectedCallback(onPluginDisconnected);

  ws.connect();
}

async function loadMeetingList() {
  console.log('Loading meeting list...');
  meetings.value = await window.electronAPI.requestMeetingRooms();
}

async function requestAvailableDisplays() {
  console.log('Loading available displays...');
  availableDisplays.value = await window.electronAPI.requestAvailableDisplays();
  console.log('Available displays: ' + availableDisplays.value);
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSettingsKeyDown);
});

onMounted(() => {
  window.addEventListener('keydown', handleSettingsKeyDown);
  if (config) {
    requestAvailableDisplays();
    loadMeetingList();
    connect();
  }
});

function addMeeting() {
  config.meetings.push({
    link: ''
  })
}

function removeMeeting(index: number) {
  console.log(index);
  config.meetings.splice(index, 1);
}

function onVerificationAccepted() {
  window.electronAPI.verificationAccepted();
  ws.acceptVerification();
  verificationCode.value = null;
}

function onPluginDisconnected() {
  window.electronAPI.pluginDisconnected();
  if (verificationCode.value) {
    window.electronAPI.verificationRejected();
    verificationCode.value = null;
  }
}

function onVerificationRejected() {
  window.electronAPI.verificationRejected();
  ws.rejectVerification();
  verificationCode.value = null;
}

const closeApp = () => {
  window.electronAPI.close();
};

const checkInputForBoolean = (event: Event, param: JoinParameter) => {
  if (event.target === null) {
    return;
  }
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (value.toLowerCase() === 'true') {
    param.value = true;
  } else if (value.toLowerCase() === 'false') {
    param.value = false;
  } else {
    param.value = value;
  }
};

const toggle = (param: JoinParameter) => {
  console.log(param);
  param.value = !param.value;
}

const addLayout = (layouts: Layout[]) => {
  layouts.push({
    label: '',
    screens: []
  });
}

const addScreen = (layout: Layout) => {
  layout.screens.push({
    name: '',
    bbb_join_parameters: []
  });
}

const saveConfig = () => {
  console.log('Saving config');  
  window.electronAPI.saveSettings(toRaw(config));
  showSettingsScreen.value = false;
  originalConfig.value = null;
};

const discardConfigChanges = () => {
  if (originalConfig.value) {
    Object.assign(config, originalConfig.value);
  }
  showSettingsScreen.value = false;
  originalConfig.value = null; // Clear the backup to allow a new one on next open
};


</script>

<template>
  <main>

    <button v-if="!config.hide_close_button" class="absolute top-5 right-5 rounded-full bg-red-500 p-2 hover:bg-red-600"
      @click="closeApp">
      <XMarkIcon class="h-5 w-5 text-white" aria-hidden="true" />
    </button>

    <div class="flex-wrapper">

      <div class="headline">
        <div>
          <!-- Camera Symbol -->
          <svg width="50" height="50" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="30" fill="#005AB4" />
            <rect x="20" y="25" width="18" height="14" rx="2" ry="2" stroke="white" stroke-width="2.3" fill="none" />
            <polygon points="40,30 46,26 46,38 40,34" stroke="white" stroke-width="2.3" fill="none"
              stroke-linejoin="round" />
          </svg>
        </div>
        <div class="headline-title">BigBlueButton</div>
        <div class="headline-subtitle">
          <span>Hybrid meetings made simple. This app connects camera, audio, and screen with your online
            meeting.</span>
        </div>
      </div>

      <div class="box-wrapper">

        <!-- Left Box: PIN Display -->
        <div v-if="config.show_pin_display && !showSettingsScreen">
          <div class="box-header">Connect by Code</div>
          <div class="box">
            <h3>Temporary Room Code</h3>

            <div class="temporary-code">

              {{ pin || '------' }}

              <div class="temporary-code-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" style="vertical-align: middle; margin-right: 8px;"
                  fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" stroke="#0057a3" stroke-width="2" />
                  <path d="M10 5V10L13 12" stroke="#0057a3" stroke-width="2" stroke-linecap="round" />
                </svg>
              </div>
            </div>

            <div class="box-description">
              Enter the code above in your BigBlueButton meeting. The devices of this room will connect to your online
              meeting automatically.

              <details class="read-more">
                <summary>Read more</summary>
                Open up a BigBlueButton Meeting on your Laptop, Smartphone, etc.
                Press on the + symbol and enter the "Temporary Room Code"
                to connect the room's devices with your online meeting.
              </details>
            </div>
          </div>
        </div>

        <!-- Right Box: Meeting List -->
        <div v-if="config.show_meeting_list && !showSettingsScreen">
          <div class="box-header">Connect to existing Meeting</div>
          <div class="box">
            <h3>Available Meeting Rooms</h3>

            <div class="meeting-list-scrollable">

              <div class="meeting-list-item" v-for="meeting in meetings" :key="meeting.name">
                <div>{{ meeting.name }}</div>
                <!--<button @click="onJoinUrl(meeting.link, 123)">Join</button>-->
                <button @click="onJoin(meeting, 0)">Join</button>
              </div>

            </div>

            <div class="right-box-description">
              Click on 'Join'. This will start the BigBlueButton meeting. All devices will be connected automatically.
            </div>

          </div>
        </div>

        <!-- Settings Screen -->
        <div v-if="showSettingsScreen">
          <div class="box-header">Settings</div>
          <div class="box box--no-bottom-styling" style="width: 732px;">

            <div class="settings-content scrollable">

              <div class="setting-title">General</div>

              <!-- Prefered Screen for Appliance App -->
              <div class="setting-name">Prefered Screen for Appliance App</div>
              <div class="setting-description">The BigBlueButton Appliance Application will be displayed on this screen.
              </div>
              <select name="displays" id="displays" v-model="config.preferred_pin_screen">
                <option v-for="display in availableDisplays" :key="String(display)" :value="display">
                  {{ display }}
                </option>
              </select>

              <!-- Show Meeting List (Right Box)-->
              <div class="checkbox-setting-container">
                <div>
                  <div class="setting-name">Show Meeting List</div>
                  <div class="setting-description">
                    Display the right box that includes a list of predefined online meetings.</div>
                </div>
                <div>
                  <div class="toggle-container">
                    <input type="checkbox" class="toggle-checkbox" id="show_meeting_list"
                      v-model="config.show_meeting_list">
                    <label class="toggle-label" for="show_meeting_list"></label>
                  </div>
                </div>
              </div>

              <!-- Show Pin Display (Left Box) -->
              <div class="checkbox-setting-container">
                <div>
                  <div class="setting-name">Show Pin Display</div>
                  <div class="setting-description">Display the left box with the pin screen in it.</div>
                </div>
                <div>
                  <div class="toggle-container">
                    <input type="checkbox" class="toggle-checkbox" id="show_pin_display"
                      v-model="config.show_pin_display">
                    <label class="toggle-label" for="show_pin_display"></label>
                  </div>
                </div>
              </div>

              <!-- Debug Mode (Show Dev Tools) -->
              <div class="checkbox-setting-container">
                <div>
                  <div class="setting-name">Show Dev Tools</div>
                  <div class="setting-description">Opens the frontend Dev Tools on Startup.</div>
                </div>
                <div>
                  <div class="toggle-container">
                    <input type="checkbox" class="toggle-checkbox" id="debug" v-model="config.debug">
                    <label class="toggle-label" for="debug"></label>
                  </div>
                </div>
              </div>

              <!-- Keyboard HID -->
              <div class="checkbox-setting-container">
                <div>
                  <div class="setting-name">Keyboard HID</div>
                  <div class="setting-description">??? TODO</div>
                </div>
                <div>
                  <div class="toggle-container">
                    <input type="checkbox" class="toggle-checkbox" id="keyboard_hid" v-model="config.keyboard_hid">
                    <label class="toggle-label" for="keyboard_hid"></label>
                  </div>
                </div>
              </div>

              <!-- Auto Reject Time -->
              <div class="setting-name">Auto reject time</div>
              <div class="setting-description">??? TODO.</div>
              <input type="number" class="general-input" placeholder="10" v-model="config.auto_reject_time" />

              <div class="settings-divider"></div> <!-- ------- Divider ------- -->



              <div class="setting-title">Control Server</div>

              <!-- WebSocket for Pairing Server -->
              <div class="setting-name">Websocket</div>
              <div class="setting-description">Configure the websocket url of the room-connector Server.</div>
              <input type="text" class="general-input" placeholder="wss://localhost:8080/ws_room"
                v-model="config.control_server.ws" />

              <!-- Reconnect Interval -->
              <div class="setting-name">Reconnect Interval</div>
              <div class="setting-description">Define the interval of the connection retry mechanism.
                Intervals
                are defined in milliseconds.</div>
              <input type="number" class="general-input" placeholder="5000"
                v-model="config.control_server.reconnect_interval" />

              <!-- Ping Interval -->
              <div class="setting-name">Ping Interval</div>
              <div class="setting-description">The apppliance will ping the room-connector in regular intervals.
                Intervals are defined in milliseconds.</div>
              <input type="number" class="general-input" placeholder="10000"
                v-model="config.control_server.ping_interval" />

              <div class="settings-divider"></div> <!-- ------- Divider ------- -->



              <div class="setting-title">Meetings</div>

              <!-- Meeting Provider -->
              <div class="setting-name">Meeting Provider Name</div>
              <div class="setting-description">Name of the Meeting Provider. Like 'pilos' or 'greenlight'. (Currently
                only 'pilos' available).</div>
              <input type="text" class="general-input" placeholder="pilos" v-model="config.meeting_provider" />

              <!-- Meeting Provider URL -->
              <div class="setting-name">Meeting Provider URL</div>
              <div class="setting-description">URL of the Meeting Provider.</div>
              <input type="text" class="general-input" placeholder="https://bbb-community.uni-osnabrueck.de"
                v-model="config.meeting_provider_url" />

              <!-- Meeting List (Where the meetings are configured) -->
              <div class="setting-name">Predefined Meetings</div>
              <div class="setting-description">Here you can configure predefined meetings.Add the static URLs of the
                meetings.</div>
              <div class="simple-side-by-side" v-for="(meeting, index) in config.meetings" :key="index">
                <MeetingComponent :meeting="meeting" />
                <div class="button-wrapper">
                  <button class="settings-button settings-button-delete" @click="removeMeeting(index)">x</button>
                </div>
              </div>

              <!-- Add Button -->
              <div class="button-wrapper">
                <button class="settings-button settings-button-add" @click="addMeeting">+</button>
              </div>

              <div class="settings-divider"></div> <!-- ------- Divider ------- -->

              <div class="setting-title">Room</div>

              <!-- BBB Username -->
              <div class="setting-name">BBB Username</div>
              <div class="setting-description">Username of the BBB User.</div>
              <input type="text" class="general-input" placeholder="RoomMedia" v-model="config.room.bbb_user_name" />

              <!-- BBB User ID -->
              <div class="setting-name">BBB User ID</div>
              <div class="setting-description">ID of the BBB User.</div>
              <input type="text" class="general-input" placeholder="bbb-room-media" v-model="config.room.bbb_user_id" />


              <div class="settings-divider"></div> <!-- ------- Divider ------- -->


              <!-- Layouts -->
              <div class="setting-title">Layouts</div>
              <div class="setting-description">Here you can add, edit and delete screen layouts.</div>
              <div v-for="(layout, i) in config.room.layouts" :key="i">

                <div class="layout-title">Layout {{ i + 1 }}</div>
                <!-- layout name -->
                <div class="setting-name">Name</div>
                <div class="setting-description">Choose a name so you can easily identify the layout.</div>
                <input type="text" class="general-input" placeholder="Layout Name" v-model="layout.label" />

                <div v-for="(screen, j) in layout.screens" :key="j">

                  <!-- screen name -->
                  <div class="setting-name">Select Screen {{ j + 1 }}</div>
                  <div class="setting-description">Select the screen you want to use. The following join parameters will
                    be used for this screen.</div>

                  <select name="displays" id="displays" v-model="screen.name">
                    <option v-for="display in availableDisplays" :key="String(display)" :value="display">
                      {{ display }}
                    </option>
                  </select>

                  <!-- bbb join parameters -->
                  <div class="setting-name">BBB Join Parameters</div>
                  <div class="setting-description">BBB Join Parameters for the selected screen. For new parameters of
                    type boolean, use 'true' or 'false'.</div>
                  <div class="simple-side-by-side" v-for="(join_param, k) in screen.bbb_join_parameters"
                    :key="join_param.key">
                    <input type="text" class="join-param-key" v-model="join_param.key" placeholder="Key" />

                    <!-- Auto-detect boolean -->
                    <template v-if="typeof join_param.value === 'boolean'">
                      <div class="join-param-value-toggle">
                        <div class="toggle-container">
                          <input type="checkbox" class="toggle-checkbox" v-model="join_param.value">
                          <label class="toggle-label" @click="toggle(join_param)"></label>
                        </div>
                      </div>
                    </template>

                    <!-- Fallback for everything else -->
                    <template v-else>
                      <input type="text" class="join-param-value" @input="checkInputForBoolean($event, join_param)"
                        :value="join_param.value" placeholder="Value" />
                    </template>

                    <!-- Remove Button -->
                    <div class="button-wrapper">
                      <button class="settings-button settings-button-delete"
                        @click="screen.bbb_join_parameters.splice(k, 1)">x</button>
                    </div>

                  </div>

                  <div class="simple-side-by-side" style="flex-flow: row-reverse; margin-top: 0.4rem;">
                    <div class="button-wrapper">
                      <button class="settings-button settings-button-add"
                        @click="screen.bbb_join_parameters.push({ key: '', value: '' })">+</button>
                    </div>
                  </div>

                  <!-- Remove Screen Button -->
                  <div class="button-wrapper" style="margin-bottom: 1.5rem;">
                    <button class="settings-button settings-button-delete" @click="layout.screens.splice(j, 1)">
                      Remove Screen {{ j + 1 }}
                    </button>
                  </div>

                </div>

                <!-- new screen button -->
                <div class="button-wrapper">
                  <button class="settings-button settings-button-add" @click="addScreen(layout)">New Screen</button>
                </div>

                <!-- Remove Layout Button -->
                <div class="button-wrapper" style="margin-bottom: 1.5rem;">
                  <button class="settings-button settings-button-delete" @click="config.room.layouts.splice(i, 1)">
                    Remove Layout {{ i + 1 }}
                  </button>
                </div>

                <div class="layout-divider"></div>

              </div>

              <!-- new layout button -->
              <div class="button-wrapper">
                <button class="settings-button settings-button-add" @click="addLayout(config.room.layouts)">New
                  Layout</button>
              </div>

            </div>

          </div>
          <div class="settings-footer">
            <button class="settings-button settings-button-discard"
              @click="discardConfigChanges()">Discard</button>
            <button class="settings-button settings-button-save" @click="saveConfig()">Save</button>
          </div>
        </div>
      </div>
    </div>

    <!-- <button
      v-if="!config.hide_close_button"
      class="absolute top-5 right-5 rounded-full bg-red-500 p-2 hover:bg-red-600"
      @click="closeApp"
    >
      <XMarkIcon
        class="h-5 w-5 text-white"
        aria-hidden="true"
      />
    </button>

    <div class="text-center max-w-lg">
      <img
        src="/assets/BigBlueButton_icon.svg.png"
        alt="Vite Logo"
        class="mx-auto h-12 w-auto"
      />
      <h1 class="mt-4 text-3xl font-bold text-white sm:text-5xl">BigBlueButton</h1>

      <div class="block mt-4 w-full">
        <div
          v-if="config"
          class="flex items-center flex-col justify-center px-10"
        >
          <loading-spinner
            v-if="!pin"
            class="my-10"
          />

          <connection-error v-if="ws_connection_failed" />

          <pairing-code
            v-if="pin && !verificationCode"
            :pin="pin"
          />

          <verify-connection
            v-if="verificationCode"
            :auto-reject-time="config.auto_reject_time"
            :verification-code="verificationCode"
            @accept="onVerificationAccepted"
            @reject="onVerificationRejected"
          />
        </div>
        <config-missing
          v-else
          :config-path="configPath"
        />
      </div>
    </div> -->
  </main>
</template>
