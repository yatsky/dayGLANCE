import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { DayGlanceState, onState } from "../client";
import { renderKey } from "../render";

@action({ UUID: "app.dayglance.streamdeck.agenda" })
export class AgendaAction extends SingletonAction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private actionRef: any = null;
  private unsubscribe: (() => void) | null = null;
  private lastState: DayGlanceState | null = null;

  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    this.actionRef = ev.action;
    this.unsubscribe?.();
    this.unsubscribe = onState((s) => { this.lastState = s; this.render(s).catch(e => console.error("[dayGLANCE] agenda render:", e)); });
    if (this.lastState) await this.render(this.lastState);
  }

  override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
    // reserved for future navigation
  }

  private async render(state: DayGlanceState): Promise<void> {
    if (!this.actionRef) return;
    const { completed, total } = state.today;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    await this.actionRef.setImage(renderKey({ value: `${completed}/${total}`, sub: `${pct}% done` }));
    await this.actionRef.setTitle("");
  }
}
