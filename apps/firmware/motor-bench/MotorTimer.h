#pragma once
#include <stdint.h>

// Independent of HTTP. All callers serialize access using the sketch's mutex.
struct MotorTimer {
  static constexpr uint32_t kMaxSeconds = 120;
  static constexpr uint32_t kHeartbeatMs = 5000;
  bool running = false;
  uint32_t started = 0, duration = 0, heartbeat = 0, elapsed = 0, stopped = 0;
  enum Reason { Idle, Running, Finished, ManualStop, LostBrowser } reason = Idle;

  bool start(uint32_t now, uint32_t seconds) {
    if (running || seconds < 1 || seconds > kMaxSeconds ||
        (reason != Idle && uint32_t(now - stopped) < 1000)) return false;
    started = heartbeat = now;
    duration = seconds * 1000;
    elapsed = 0;
    running = true;
    reason = Running;
    return true;
  }
  void stop(uint32_t now, Reason why) {
    if (!running) return;
    elapsed = uint32_t(now - started);
    running = false;
    stopped = now;
    reason = why;
  }
  void tick(uint32_t now) {
    if (!running) return;
    if (uint32_t(now - started) >= duration) stop(now, Finished);
    else if (uint32_t(now - heartbeat) >= kHeartbeatMs) stop(now, LostBrowser);
  }
};
