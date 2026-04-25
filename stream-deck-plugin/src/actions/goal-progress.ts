import {
  action,
  DialRotateEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { DayGlanceState, onState } from "../client";
import { renderKey } from "../render";

@action({ UUID: "app.dayglance.streamdeck.goal-progress" })
export class GoalProgressAction extends SingletonAction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private actionRef: any = null;
  private unsubscribe: (() => void) | null = null;
  private lastState: DayGlanceState | null = null;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.actionRef = ev.action;
    this.unsubscribe?.();
    this.unsubscribe = onState((s) => { this.lastState = s; void this.render(s); });
    if (this.lastState) await this.render(this.lastState);
  }

  override async onDialRotate(_ev: DialRotateEvent): Promise<void> {
    // TODO: cycle through goals when goal data is added to state
  }

  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    // TODO: interact with goal when goal data is added to state
  }

  private async render(state: DayGlanceState): Promise<void> {
    if (!this.actionRef) return;
    const { completed, total } = state.today;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    await this.actionRef.setImage(renderKey({ value: `${pct}%`, sub: "Today" }));
    await this.actionRef.setTitle("");
  }
}
