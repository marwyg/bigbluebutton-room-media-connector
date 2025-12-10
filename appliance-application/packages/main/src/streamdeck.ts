import * as path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import type {StreamDeck} from '@elgato-stream-deck/node';
import {fileURLToPath} from 'url';
import type {HID, HIDActions} from './HID';
import type {StreamDeckButtonControlDefinitionLcdFeedback} from '@elgato-stream-deck/core/dist/controlDefinition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StreamDeckHID implements HID {
  static BBB_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;
  static ACCEPT_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;
  static REJECT_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;
  static LEAVE_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;

  static TOGGLE_MUTE_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback
  static TOGGLE_RAISEHAND_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback
  static BECOME_PRESENTER_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback

  static LAYOUT1_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;
  static LAYOUT2_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;
  static LAYOUT3_BUTTON: StreamDeckButtonControlDefinitionLcdFeedback;

  private streamDeck: StreamDeck;

  private BBB_IMG!: Buffer;
  private BBB_IMG_LG!: Buffer;
  private ACCEPT_IMG!: Buffer;
  private REJECT_IMG!: Buffer;
  private LEAVE_IMG!: Buffer;
  private MUTE_IMG!: Buffer;
  private HAND_IMG!: Buffer;
  private UNMUTE_IMG!: Buffer;

  private PRESENTER_IMG!: Buffer;

  private LAYOUT1_IMG!: Buffer;
  private LAYOUT2_IMG!: Buffer;
  private LAYOUT3_IMG!: Buffer;

  private LAYOUT1_REVERSE_IMG!: Buffer;
  private LAYOUT2_REVERSE_IMG!: Buffer;
  private LAYOUT3_REVERSE_IMG!: Buffer;

  private hasVerificationPending = false;

  private acceptCallback!: () => void;
  private rejectCallback!: () => void;
  private leaveCallback!: () => void;
  private toggleMuteCallback!: () => void;
  private becomePresenterCallback!: () => void;
  private raiseHandCallback!: () => void;
  private layout1Callback!: () => void;
  private layout2Callback!: () => void;
  private layout3Callback!: () => void;

  private isConnected!: boolean;
  private layout_buttons_lock: boolean = false;

  constructor(streamDeck: StreamDeck) {
    console.log('StreamDeck constructor');
    this.streamDeck = streamDeck;
    this.streamDeck.clearPanel();
    this.streamDeck.setBrightness(100);
    this.initIcons().then(() => {
      this.showBBBScreen();
    });

    console.log('Initializing button listeners');

    this.streamDeck.on('up', button => {
      console.log('key %d up', button.index);

      if (this.hasVerificationPending) {
        if (button.index === StreamDeckHID.ACCEPT_BUTTON.index) {
          this.acceptCallback();
        }
        if (button.index === StreamDeckHID.REJECT_BUTTON.index) {
          this.rejectCallback();
        }
      }
      if (this.isConnected) {

        if (button.index === StreamDeckHID.TOGGLE_MUTE_BUTTON.index) {
          this.toggleMuteCallback();
        }
        if (button.index === StreamDeckHID.BECOME_PRESENTER_BUTTON.index) {
          this.becomePresenterCallback();
        }
        if (button.index === StreamDeckHID.TOGGLE_RAISEHAND_BUTTON.index) {
          this.raiseHandCallback();
        }
        if (button.index === StreamDeckHID.LEAVE_BUTTON.index) {
          this.leaveCallback();
        }
        if (!this.layout_buttons_lock) {
          if (button.index === StreamDeckHID.LAYOUT1_BUTTON.index) {
            this.layout_buttons_lock = true;
            this.layout1Callback();
          }
          if (button.index === StreamDeckHID.LAYOUT2_BUTTON.index) {
            this.layout_buttons_lock = true;
            this.layout2Callback();
          }
          if (button.index === StreamDeckHID.LAYOUT3_BUTTON.index) {
            this.layout_buttons_lock = true;
            this.layout3Callback();
          }
        }
      }

      console.log("key press finished")
    });

    this.streamDeck.on('error', error => {
      console.error(error);
    });

    console.log('StreamDeck initialized');
  }

  async initIcons() {
    console.log('Initializing button icons');
    const controls = this.streamDeck.CONTROLS;
    let rows = 0;
    let columns = 0;

    controls.forEach(control => {
      if (control.type === 'button' && control.feedbackType == 'lcd') {
        rows = Math.max(rows, control.row);
        columns = Math.max(columns, control.column);
      }
    });

    controls.forEach(control => {
      if (control.type === 'button' && control.feedbackType == 'lcd') {
        if (control.row == 0 && control.column == columns) {
          StreamDeckHID.LEAVE_BUTTON = control;
        }
        if (control.row == 1 && control.column == 0) {
          StreamDeckHID.ACCEPT_BUTTON = control;
        }
        if (control.row == 1 && control.column == 1) {
          StreamDeckHID.REJECT_BUTTON = control;
        }
        if (control.row == 2 && control.column == 0) {
          StreamDeckHID.TOGGLE_RAISEHAND_BUTTON = control;
        }
        if (control.row == 2 && control.column == 1) {
          StreamDeckHID.TOGGLE_MUTE_BUTTON = control;
        }
        if (control.row == 2 && control.column == 2) {
          StreamDeckHID.BECOME_PRESENTER_BUTTON = control;
        }
        if (control.row == 0 && control.column == 0) {
          StreamDeckHID.BBB_BUTTON = control;
          StreamDeckHID.LAYOUT1_BUTTON = control;
        }
        if (control.row == 0 && control.column == 1) {
          StreamDeckHID.LAYOUT2_BUTTON = control;
        }
        if (control.row == 0 && control.column == 2) {
          StreamDeckHID.LAYOUT3_BUTTON = control;
        }
      }
    });

    console.log('Loading button images...');

    this.BBB_IMG = await this.getButtonImageBuffer(StreamDeckHID.BBB_BUTTON, 'bbb.png');
    this.ACCEPT_IMG = await this.getButtonImageBuffer(StreamDeckHID.ACCEPT_BUTTON, 'accept.png');
    this.REJECT_IMG = await this.getButtonImageBuffer(StreamDeckHID.REJECT_BUTTON, 'reject.png');
    this.LEAVE_IMG = await this.getButtonImageBuffer(StreamDeckHID.LEAVE_BUTTON, 'leave.png');

    this.HAND_IMG = await this.getButtonImageBuffer(StreamDeckHID.TOGGLE_RAISEHAND_BUTTON, 'hand.png');
    this.MUTE_IMG = await this.getButtonImageBuffer(StreamDeckHID.TOGGLE_MUTE_BUTTON, 'mute.png');
    this.UNMUTE_IMG = await this.getButtonImageBuffer(StreamDeckHID.TOGGLE_MUTE_BUTTON, 'unmute.png');
    this.PRESENTER_IMG = await this.getButtonImageBuffer(StreamDeckHID.BECOME_PRESENTER_BUTTON, 'presentation.png')

    this.LAYOUT1_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT1_BUTTON, 'L1.png');
    this.LAYOUT2_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT2_BUTTON, 'L2.png');
    this.LAYOUT3_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT3_BUTTON, 'L3.png');

    this.LAYOUT1_REVERSE_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT1_BUTTON, 'L1_reverse.png',);
    this.LAYOUT2_REVERSE_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT2_BUTTON, 'L2_reverse.png',);
    this.LAYOUT3_REVERSE_IMG = await this.getButtonImageBuffer(StreamDeckHID.LAYOUT3_BUTTON, 'L3_reverse.png',);

    const imagePath = path.resolve(__dirname, '../assets/bbb.png');

    if (fs.existsSync(imagePath)) {
      this.BBB_IMG_LG = await sharp(imagePath)
        .flatten()
        .resize(
          StreamDeckHID.BBB_BUTTON.pixelSize.width * (columns + 1),
          StreamDeckHID.BBB_BUTTON.pixelSize.height * (rows + 1),
          {
            fit: 'contain',
            background: {r: 0, g: 0, b: 0},
          },
        )
        .raw()
        .toBuffer();
    } else {
      console.error(`Error: The image file was not found at ${imagePath}`);
    }

    console.log('Button icons initialized');
  }

  async getButtonImageBuffer(button: StreamDeckButtonControlDefinitionLcdFeedback, image: string): Promise<Buffer> {
    // console.log('Loading ' + image);

    const imagePath = path.resolve(__dirname, '../assets/' + image);
    //console.log('Resolved image path: ' + imagePath);

    if (fs.existsSync(imagePath)) {
      //console.log('Image exists in path: ' + imagePath);
      return await sharp(imagePath)
      .flatten()
      .resize(button.pixelSize.width, button.pixelSize.height)
      .raw()
      .toBuffer();
    } else {
      console.error(`Error: The image file was not found at ${imagePath}`);
      throw new Error(`Image file not found: ${imagePath}`);
    }
  }

  requireVerification(accept: () => void, reject: () => void): void {
    this.hasVerificationPending = true;
    this.acceptCallback = accept;
    this.rejectCallback = reject;
    this.showVerificationButtons();
  }

  verificationAccepted(): void {
    this.hasVerificationPending = false;
    this.hideVerificationButtons();
  }

  verificationRejected(): void {
    this.hasVerificationPending = false;
    this.hideVerificationButtons();
  }

  showVerificationButtons(): void {
    this.streamDeck.clearPanel();
    this.streamDeck.fillKeyBuffer(StreamDeckHID.BBB_BUTTON.index, this.BBB_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.ACCEPT_BUTTON.index, this.ACCEPT_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.REJECT_BUTTON.index, this.REJECT_IMG);
  }

  showBBBScreen(): void {
    this.streamDeck.clearPanel();
    this.streamDeck.fillPanelBuffer(this.BBB_IMG_LG);
  }

  hideVerificationButtons(): void {
    this.streamDeck.clearKey(StreamDeckHID.ACCEPT_BUTTON.index);
    this.streamDeck.clearKey(StreamDeckHID.REJECT_BUTTON.index);
  }

  switchMuteIcon (muted: Boolean): void {
    this.streamDeck.fillKeyBuffer(StreamDeckHID.TOGGLE_MUTE_BUTTON.index, muted ? this.MUTE_IMG : this.UNMUTE_IMG);
  }

  switchRaiseHandIcon (handRaised: Boolean): void {
    // todo.. show raised hand and lowered hand
    // todo.. implement callback if somebody else loweres the hand.. the icon has to change in this case
    this.streamDeck.fillKeyBuffer(StreamDeckHID.TOGGLE_RAISEHAND_BUTTON.index, handRaised ? this.HAND_IMG : this.HAND_IMG);
  }

  async selectLayout(layout: number): Promise<void> {
    if (layout < 0 || layout > 2) {
      throw new Error('Invalid layout index');
    }
    if (layout == 0) {
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT1_BUTTON.index, this.LAYOUT1_REVERSE_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT2_BUTTON.index, this.LAYOUT2_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT3_BUTTON.index, this.LAYOUT3_IMG);
    }
    if (layout == 1) {
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT1_BUTTON.index, this.LAYOUT1_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT2_BUTTON.index, this.LAYOUT2_REVERSE_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT3_BUTTON.index, this.LAYOUT3_IMG);
    }
    if (layout == 2) {
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT1_BUTTON.index, this.LAYOUT1_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT2_BUTTON.index, this.LAYOUT2_IMG);
      this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT3_BUTTON.index, this.LAYOUT3_REVERSE_IMG);
    }
  }

  unlockLayoutKeys() {
    this.layout_buttons_lock = false;
  }

  async close(): Promise<void> {
    this.streamDeck.removeAllListeners();
    await this.streamDeck.close();
  }

  connected(actions: HIDActions): void {
    console.log('StreamDeck connected');
    this.streamDeck.clearPanel();

    this.streamDeck.fillKeyBuffer(StreamDeckHID.BBB_BUTTON.index, this.BBB_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.LEAVE_BUTTON.index, this.LEAVE_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT1_BUTTON.index, this.LAYOUT1_REVERSE_IMG); // TODO: currently always layout 1 is selected at start
    this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT2_BUTTON.index, this.LAYOUT2_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.LAYOUT3_BUTTON.index, this.LAYOUT3_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.TOGGLE_MUTE_BUTTON.index, this.MUTE_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.BECOME_PRESENTER_BUTTON.index, this.PRESENTER_IMG);
    this.streamDeck.fillKeyBuffer(StreamDeckHID.TOGGLE_RAISEHAND_BUTTON.index, this.HAND_IMG);

    this.isConnected = true;
    this.leaveCallback = actions.leave;
    this.toggleMuteCallback = actions.toggleMute;
    this.becomePresenterCallback = actions.becomePresenter;
    this.raiseHandCallback = actions.toggleRaiseHand;
    this.layout1Callback = actions.layout1;
    this.layout2Callback = actions.layout2;
    this.layout3Callback = actions.layout3;
  }

  disconnected(): void {
    this.isConnected = false;
    this.showBBBScreen();
  }
}
