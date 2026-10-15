#include <cassert>
#include "../../Eggcelerate/TrayMotion.h"

int main() {
  using namespace egg_tray;
  Controller tray;
  assert(!tray.start(0, Move::Opposite, 1)); // Unknown start must not move.
  assert(tray.confirmPlus(100));
  assert(tray.start(101, Move::Opposite, 1));
  assert(tray.state.duration == 10000);
  assert(!tray.confirmPlus(200));
  assert(!tray.start(200, Move::Level, 2));
  tray.tick(10100);
  assert(tray.state.running);
  tray.tick(10101);
  assert(!tray.state.running);
  assert(tray.state.status == Status::AwaitingObservation);
  assert(!tray.start(12000, Move::Level, 2)); // No inferred endpoint.
  assert(tray.confirmPlus(12000));
  assert(!tray.start(12001, Move::Level, 1)); // Replay rejected.
  assert(tray.start(12001, Move::Level, 2));
  assert(tray.state.duration == 5000);
  tray.stop(12200);
  assert(tray.state.status == Status::Interrupted && !tray.state.running);
  tray.confirmPlus(12201);
  assert(!tray.start(12202, Move::Level, 3)); // Off interval.
  tray.tick(42202);
  assert(!tray.start(42202, Move::Level, 3)); // Confirmation expired.

  Controller reboot;
  reboot.state.highestId = 2; // Runtime restores only persisted high-water mark.
  assert(!reboot.state.running && reboot.state.status == Status::Unknown);
  reboot.confirmPlus(100);
  assert(!reboot.start(101, Move::Opposite, 2));
  assert(reboot.start(101, Move::Level, 3));
  reboot.tick(5101);
  assert(reboot.state.status == Status::AwaitingObservation);

  Controller wrapped;
  wrapped.confirmPlus(UINT32_MAX - 100);
  assert(wrapped.start(UINT32_MAX - 99, Move::Level, 1));
  wrapped.tick(4900);
  assert(!wrapped.state.running && wrapped.state.status == Status::AwaitingObservation);
}
