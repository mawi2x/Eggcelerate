#include <cassert>
#include "../MotorTimer.h"

int main() {
  MotorTimer timer;
  assert(!timer.start(0, 0));
  assert(!timer.start(0, 121));
  assert(timer.start(100, 2));
  assert(!timer.start(200, 120)); // A second start cannot extend the deadline.
  timer.tick(2099);
  assert(timer.running);
  timer.tick(2100);
  assert(!timer.running && timer.reason == MotorTimer::Finished);
  assert(timer.elapsed == 2000);
  assert(!timer.start(2101, 2)); // Off interval.
  assert(timer.start(3100, 120));
  timer.tick(8100); // No heartbeat, even when the selected duration is long.
  assert(!timer.running && timer.reason == MotorTimer::LostBrowser);
  assert(timer.start(9100, 120));
  timer.stop(9250, MotorTimer::ManualStop);
  timer.tick(130000);
  assert(!timer.running && timer.elapsed == 150);
  assert(timer.reason == MotorTimer::ManualStop);

  MotorTimer wrapped;
  assert(wrapped.start(UINT32_MAX - 999, 2));
  wrapped.tick(999);
  assert(wrapped.running);
  wrapped.tick(1000);
  assert(!wrapped.running && wrapped.reason == MotorTimer::Finished);

  MotorTimer longRun;
  assert(longRun.start(0, 120));
  for (uint32_t now = 1000; now < 120000; now += 1000) {
    longRun.tick(now);
    assert(longRun.running);
    longRun.heartbeat = now;
  }
  longRun.tick(120000);
  assert(!longRun.running && longRun.reason == MotorTimer::Finished);
}
