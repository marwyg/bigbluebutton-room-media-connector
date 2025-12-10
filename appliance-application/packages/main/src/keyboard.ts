import type {HID, HIDActions} from './HID';
import { globalShortcut } from 'electron';

export class KeyboardHID implements HID {

  private hasVerificationPending = false;

  private acceptCallback: () => void = () => {};
  private rejectCallback: () => void = () => {};

  private leaveCallback: () => void = () => {};
  private toggleMuteCallback: () => void = () => {};
  private toggleRaiseHandCallback: () => void = () => {}
  private becomePresenterBallback: () => void = () => {};
  private layout1Callback: () => void = () => {};
  private layout2Callback: () => void = () => {};
  private layout3Callback: () => void = () => {};
  private isConnected: boolean = false;

  constructor() {
    globalShortcut.register('CommandOrControl+Alt+M', () => {
      if (this.isConnected) {
        this.toggleMuteCallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+H', () => {
      if (this.isConnected) {
        this.toggleRaiseHandCallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+P', () => {
      if (this.isConnected) {
        this.becomePresenterBallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+L', () => {
      if (this.isConnected) {
        this.leaveCallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+A', () => {
      if (this.hasVerificationPending) {
        this.acceptCallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+R', () => {
      if (this.hasVerificationPending) {
        this.rejectCallback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+1', () => {
      if (this.isConnected) {
        this.layout1Callback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+2', () => {
      if (this.isConnected) {
        this.layout2Callback();
      }
    });
    globalShortcut.register('CommandOrControl+Alt+3', () => {
      if (this.isConnected) {
        this.layout3Callback();
      }
    });
  }

  requireVerification(accept: () => void, reject: () => void): void {
    this.hasVerificationPending = true;
    this.acceptCallback = accept;
    this.rejectCallback = reject;
  }

  verificationAccepted(): void {
    this.hasVerificationPending = false;
  }

  verificationRejected(): void {
    this.hasVerificationPending = false;
  }

  async close(): Promise<void> {

  }

  connected(actions: HIDActions): void {

    this.isConnected = true;
    this.becomePresenterBallback = actions.becomePresenter
    this.toggleMuteCallback =  actions.toggleMute
    this.toggleRaiseHandCallback = actions.toggleRaiseHand
    this.layout1Callback = actions.layout1
    this.layout2Callback = actions.layout2
    this.layout3Callback = actions.layout3
    this.leaveCallback = actions.leave;
  }

  disconnected(): void {
    this.isConnected = false;
  }
}
