#pragma once
#include <stdint.h>

namespace egg_tray {
enum class Move : uint8_t { Opposite, Level, Tilt };
enum class Status : uint8_t { Unknown, PlusConfirmed, Moving, AwaitingObservation, Interrupted, StorageFault };
struct State {
  Status status = Status::Unknown;
  Move move = Move::Opposite;
  bool running = false;
  uint32_t started = 0, duration = 0, elapsed = 0, id = 0, highestId = 0;
  uint8_t position = 0; // 0 unknown, 1 +45, 2 -45, 3 level; timed results estimated.
  uint32_t ackId = 0;
  bool accepted = false;
};
class Controller {
public:
  State state;
  uint32_t confirmedAt = 0, stoppedAt = 0;
  bool hasStopped = false;
  bool confirmPlus(uint32_t now) {
    if (state.running) return false;
    state.status = Status::PlusConfirmed;
    state.position = 1;
    confirmedAt = now;
    return true;
  }
  bool canStart(uint32_t now, uint32_t id, bool estimated = false) const {
    const bool origin = (state.status == Status::PlusConfirmed && uint32_t(now - confirmedAt) <= 30000) ||
      (estimated && state.status == Status::AwaitingObservation);
    return !state.running && origin && (state.position == 1 || state.position == 2 || (estimated && state.position == 3)) && id > state.highestId &&
      (!hasStopped || uint32_t(now - stoppedAt) >= 1000);
  }
  bool start(uint32_t now, Move move, uint32_t id, bool estimated = false) {
    if (!canStart(now, id, estimated) || (state.position == 3) != (move == Move::Tilt)) return false;
    state.running = true;
    state.status = Status::Moving;
    state.move = move;
    state.id = state.highestId = id;
    state.started = now;
    state.elapsed = 0;
    state.duration = move == Move::Opposite ? 10000 : 5000;
    return true;
  }
  void stop(uint32_t now) {
    if (state.running) state.elapsed = uint32_t(now - state.started);
    state.running = false;
    state.position = 0;
    state.status = Status::Interrupted;
    stoppedAt = now;
    hasStopped = true;
  }
  void tick(uint32_t now) {
    if (state.status == Status::PlusConfirmed && uint32_t(now - confirmedAt) > 30000) {
      state.status = Status::Unknown; state.position = 0;
    }
    if (!state.running) return;
    state.elapsed = uint32_t(now - state.started);
    if (state.elapsed >= state.duration) {
      state.running = false;
      state.status = Status::AwaitingObservation;
      state.position = state.move == Move::Level ? 3 : state.move == Move::Tilt ? 1 : state.position == 1 ? 2 : 1;
      stoppedAt = now;
      hasStopped = true;
    }
  }
};
inline const char* statusName(Status status) {
  switch (status) {
    case Status::PlusConfirmed: return "+45 confirmed by operator (30-second window)";
    case Status::Moving: return "Moving on bounded timer; position unmeasured";
    case Status::AwaitingObservation: return "Timer ended; check actual position";
    case Status::Interrupted: return "Interrupted; position unknown";
    case Status::StorageFault: return "Tray storage failed; movement disabled";
    default: return "Position unknown";
  }
}
}
