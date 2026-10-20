import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertEntry } from "../app/domain/types";
import { useNotificationSounds } from "../app/features/farm/use-notification-sounds";
import { render } from "./render";

const audio = vi.hoisted(() => ({ play: vi.fn(), dispose: vi.fn() }));
vi.mock("../app/features/farm/notification-sound", () => ({
  createNotificationSound: () => audio,
}));

const alert = (id: string, acknowledged = false): AlertEntry => ({
  id, acknowledged, title: "Temperature alert", unit: "Chamber",
  severity: "warning", message: "Check temperature", timestamp: new Date().toISOString(),
});

function Probe({ owner = "owner", farm = [], ready = true, local = [] }: {
  owner?: string | null; farm?: AlertEntry[]; ready?: boolean; local?: AlertEntry[];
}) {
  useNotificationSounds(owner, farm, ready, local);
  return null;
}

beforeEach(() => vi.clearAllMocks());

describe("notification sounds", () => {
  it("keeps initial history quiet and chimes once per new unread notification", async () => {
    const view = await render(<Probe farm={[alert("old")]} />);
    expect(audio.play).not.toHaveBeenCalled();
    await view.rerender(<Probe farm={[alert("old"), alert("new"), alert("read", true)]} local={[alert("local")]} />);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await view.rerender(<Probe farm={[alert("new", true)]} local={[alert("local", true)]} />);
    await view.rerender(<Probe farm={[alert("old"), alert("new")]} />);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await view.unmount();
    expect(audio.dispose).toHaveBeenCalledOnce();
  });

  it("waits for the initial farm fetch while announcing local failures", async () => {
    const view = await render(<Probe ready={false} />);
    await view.rerender(<Probe ready={false} local={[alert("failure")]} />);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await view.rerender(<Probe farm={[alert("history")]} local={[alert("failure")]} />);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await view.rerender(<Probe farm={[alert("history"), alert("fresh")]} />);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it("does not replay an episode after recovery or reconnect, and sounds a new recurrence once", async () => {
    const episode = alert("episode-1");
    const recovered = { ...episode, conditionState: "resolved" as const };
    const view = await render(<Probe ready={false} />);

    await view.rerender(<Probe farm={[episode]} ready={true} />);
    expect(audio.play).not.toHaveBeenCalled();

    await view.rerender(<Probe farm={[recovered]} ready={true} />);
    await view.rerender(<Probe farm={[recovered]} ready={false} />);
    await view.rerender(<Probe farm={[recovered]} ready={true} />);
    expect(audio.play).not.toHaveBeenCalled();

    const recurrence = {
      ...alert("episode-2"),
      conditionState: "active" as const,
    };
    await view.rerender(
      <Probe farm={[recovered, recurrence, recurrence]} ready={true} />,
    );
    expect(audio.play).toHaveBeenCalledTimes(1);

    await view.rerender(<Probe farm={[recovered, recurrence]} ready={true} />);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("resets history and disposes audio on account changes and sign-out", async () => {
    const view = await render(<Probe farm={[alert("a")]} />);
    await view.rerender(<Probe owner="other" farm={[alert("b")]} />);
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.dispose).toHaveBeenCalledTimes(1);
    await view.rerender(<Probe owner={null} local={[alert("ignored")]} />);
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.dispose).toHaveBeenCalledTimes(2);
    await view.unmount();
  });
});
