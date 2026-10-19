#include "../Eggcelerate/ClimateControl.h"
#include <cassert>
#include <limits>
#include <iostream>
using namespace egg_climate;
constexpr float bad = std::numeric_limits<float>::quiet_NaN();
struct Trial {
  Controller c;
  uint32_t now;
  Trial(uint8_t mode=0,uint32_t start=10000):now(start) {
    c.sample(now-2500,35,58);c.sample(now,35,58);
    c.command(now,Command{Action::Prepare,mode});c.tick(now);
    sample(2500,35,58);sample(2500,35,58);assert(c.state.out.heater);
  }
  void sample(uint32_t delta,float t,float h) { now+=delta;c.sample(now,t,h);c.tick(now); }
  void safe() { assert(!c.state.out.heater&&!c.state.out.mist); }
};
int main() {
 for (uint8_t mode=0;mode<3;++mode) {
  Trial t(mode);const auto goodAt=t.c.state.lastGoodAt;
  t.sample(2500,bad,58);t.safe();assert(t.c.state.fault==Fault::None&&t.c.state.running);
  assert(!t.c.state.valid&&t.c.state.lastGoodAt==goodAt&&t.c.state.lastGoodTemperature==35);
  t.sample(2500,35,58);t.safe();assert(t.c.state.consecutiveGood==1);
  t.sample(2500,35,58);assert(t.c.state.running&&t.c.state.fault==Fault::None&&t.c.state.consecutiveGood==2);
  // Eventually resumes heating with all original fan/relay lead constraints.
  bool heated=false;for(int i=0;i<16;++i){t.sample(2500,35,58);heated|=t.c.state.out.heater;}assert(heated);
 }
 {Trial t;t.sample(2500,bad,58);t.sample(2500,bad,58);t.sample(2500,bad,58);t.safe();assert(t.c.state.fault==Fault::None);
  t.now+=1000;t.c.tick(t.now);assert(t.c.state.fault==Fault::Sensor&&!t.c.state.running);t.safe();
  t.sample(2500,35,58);t.sample(2500,35,58);assert(t.c.state.fault==Fault::Sensor&&!t.c.state.running);t.safe();
  t.c.command(t.now,Command{Action::Reset});t.c.tick(t.now);assert(t.c.state.fault==Fault::None&&!t.c.state.running);t.safe();}
 {Trial t;t.sample(2500,bad,58);t.sample(2500,35,58);t.sample(2500,bad,58);
  t.sample(1000,35,58);assert(t.c.state.fault==Fault::Sensor);t.safe();} // partial recovery never extends deadline
 {Trial t;t.now+=kStaleMs+1;t.c.tick(t.now);assert(t.c.state.fault==Fault::Stale);t.safe();}
 {Trial t;t.sample(kStaleMs+1,35,58);assert(t.c.state.fault==Fault::Stale);t.safe();} // late sample cannot hide stale gap
 {Trial t;t.sample(2500,bad,58);t.sample(kSensorRecoveryMs,35,58);assert(t.c.state.fault==Fault::Sensor);t.safe();}
 {Trial t;t.sample(2500,bad,58);t.c.command(t.now,Command{Action::Stop});
  t.sample(2500,35,58);t.sample(2500,35,58);assert(!t.c.state.running&&!t.c.state.out.upper&&!t.c.state.out.exhaust);t.safe();}
 {Trial t;t.sample(2500,bad,58);t.sample(2500,39,58);assert(t.c.state.fault==Fault::Overheat);t.safe();
  t.sample(2500,35,58);t.sample(2500,35,58);assert(t.c.state.fault==Fault::Overheat&&!t.c.state.running);}
 {Trial t;t.sample(2500,bad,58);t.c.fanOutputFailed();t.sample(2500,35,58);t.sample(2500,35,58);
  assert(t.c.state.fault==Fault::FanOutput&&!t.c.state.running);t.safe();}
 {Trial t(0,UINT32_MAX-6000);t.sample(2500,bad,58);t.sample(2500,35,58);t.safe();t.sample(2500,35,58);
  assert(t.c.state.fault==Fault::None&&t.c.state.running);}
 {Trial t;t.sample(2500,35,101);assert(!t.c.state.valid);t.safe();t.sample(2500,35,58);t.safe();}
 for (Fault fault : {Fault::ControllerReset,Fault::Storage,Fault::HeaterTimeout}) {
  Trial t;t.c.state.fault=fault;t.c.state.running=false;
  t.sample(2500,35,58);t.sample(2500,35,58);
  assert(t.c.state.fault==fault&&!t.c.state.running);t.safe();
 }
 {Trial t;t.c.command(t.now,Command{Action::Stop});t.sample(2500,37.7,45);t.sample(2500,37.7,45);
  t.c.command(t.now,Command{Action::Prepare,0});t.c.tick(t.now);
  bool misted=false;for(int i=0;i<80;++i){t.sample(500,37.7,45);if(t.c.state.out.mist){misted=true;break;}}
  assert(misted);t.sample(0,bad,45);t.safe();t.sample(2500,37.7,45);t.safe();
 }
 {Controller c;c.sample(2500,bad,58);c.sample(5000,35,58);c.command(5000,Command{Action::Prepare,0});
  assert(!c.accepted&&!c.state.running);c.tick(5000);assert(!c.state.out.heater&&!c.state.out.mist);}
 std::cout<<"sensor recovery: all modes, deadlines, stale gaps, stop, serious faults and millis rollover passed\n";
}
