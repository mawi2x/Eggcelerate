#include "../Eggcelerate/ClimateControl.h"
#include <cassert>
#include <iostream>
#include <limits>
#include <algorithm>
using namespace egg_climate;
struct Rig {
  Controller c;
  uint32_t now = 5000, sampled = 5000;
  Rig(float t=37.5f, float h=58.0f, uint8_t mode=0) {
    c.sample(2500,t,h); c.sample(now,t,h);
    c.command(now,Command{Action::Prepare,mode}); c.tick(now);
    assert(c.state.running && c.state.out.upper && !c.state.out.heater);
  }
  void advance(uint32_t ms, float t, float h) {
    for (uint32_t elapsed=0;elapsed<ms;elapsed+=50) {
      now+=50;
      if(now-sampled>=kSampleMs) { sampled=now; c.sample(now,t,h); }
      c.tick(now);
      const auto &s=c.state;
      assert(s.out.exhaustDuty<=100);
      assert(s.out.exhaustDuty==0 || s.out.exhaustDuty>=kExhaustMinDuty);
      assert(!s.out.heater || (s.out.upper && s.valid && s.temperature<kModes[s.mode].tempMax));
      assert(!s.out.mist || (!s.out.exhaust && !s.diagnostics.dryDemand && !s.diagnostics.temperatureCooling));
    }
  }
};
int main() {
  { Rig r(35,58); r.advance(kAdaptiveHeatMinOffMs-50,35,58);assert(!r.c.state.out.heater);r.advance(50,35,58);assert(r.c.state.out.heater); }
  { Rig r; r.advance(10000,37.5,58); assert(r.c.state.out.heater); r.advance(2500,37.7,58);assert(!r.c.state.out.heater);assert(r.c.state.temperature<37.8); }
  { Rig r(37.7,65);r.advance(30000,37.7,65);uint8_t early=0,late=0;
    for(int i=0;i<600;++i){r.advance(1000,37.7,65);auto duty=r.c.state.out.exhaustRequestedDuty;
      if(i<30)early=std::max(early,duty);
      if(i>540)late=std::max(late,duty);}
    assert(early>=50 && late>=50 && late<=kExhaustMinDuty+kHumidityThermalDutySpan);
    r.advance(10000,37.4,65);assert(!r.c.state.out.exhaust);
    bool reheated=false;for(int i=0;i<400;++i){r.advance(50,37.4,65);assert(!r.c.state.out.exhaust);reheated|=r.c.state.out.heater;}assert(reheated);
  }
  { Rig r(37.7,80);r.advance(20000,37.7,80);assert(r.c.state.out.exhaust);assert(r.c.state.out.exhaustRequestedDuty>=50 && r.c.state.out.exhaustRequestedDuty<=kExhaustMinDuty+kHumidityThermalDutySpan); }
  { Rig r(37.7,45);uint32_t onAt=0,lastOff=0;bool was=false;int pulses=0;
    for(int i=0;i<2400;++i){r.advance(50,37.7,45);bool on=r.c.state.out.mist;
      if(on&&!was){if(lastOff)assert(r.now-lastOff>=20000);onAt=r.now;++pulses;}
      if(!on&&was){assert(r.now-onAt<=3000);lastOff=r.now;}was=on;}
    assert(pulses>=2);
    r.advance(2500,37.7,65);assert(!r.c.state.out.mist);
  }
  { Rig r(37.7,45);r.advance(70000,37.7,45);r.c.sample(r.now,39,45);r.c.tick(r.now);assert(r.c.state.fault==Fault::Overheat);assert(!r.c.state.out.heater&&!r.c.state.out.mist&&r.c.state.out.exhaustDuty==100);
    r.c.command(r.now,Command{Action::Stop});r.c.tick(r.now);assert(!r.c.state.out.upper&&!r.c.state.out.exhaust); }
  { Rig r; r.advance(5000,37.5,58);r.c.sample(r.now,std::numeric_limits<float>::quiet_NaN(),58);r.c.tick(r.now);assert(r.c.state.fault==Fault::None && r.c.state.running);assert(!r.c.state.out.heater&&!r.c.state.out.mist); }
  { Rig r; r.now+=kStaleMs+1;r.c.tick(r.now);assert(r.c.state.fault==Fault::Stale); }
  { Rig r(30,58);r.advance(30UL*60*1000+10000,30,58);assert(r.c.state.fault==Fault::HeaterTimeout); }
  { Rig r; r.c.fanOutputFailed();r.c.tick(r.now);assert(r.c.state.fault==Fault::FanOutput);assert(!r.c.state.out.heater&&!r.c.state.out.mist); }
  { Rig r; r.advance(10000,37.5,58);r.c.command(r.now,Command{Action::Stop});r.advance(30000,37.5,45);assert(!r.c.state.running&&!r.c.state.out.heater&&!r.c.state.out.mist&&!r.c.state.out.upper&&!r.c.state.out.exhaust);
    r.c.command(r.now,Command{Action::Prepare,0});r.c.tick(r.now);assert(r.c.state.running&&!r.c.state.out.heater); }
  { Rig r(37.7,65);r.advance(20000,37.7,65);auto duty=r.c.state.out.exhaustRequestedDuty;r.c.command(r.now,Command{Action::Incubate,0});r.c.tick(r.now);assert(r.c.state.phase==2&&r.c.state.out.upper&&r.c.state.out.exhaustRequestedDuty==duty); }
  { Rig r; r.c.sample(r.now,std::numeric_limits<float>::quiet_NaN(),58);r.c.tick(r.now);
    r.now+=kSensorRecoveryMs;r.c.tick(r.now);
    r.advance(5000,37.5,58);assert(r.c.state.fault==Fault::Sensor&&!r.c.state.running);
    r.c.command(r.now,Command{Action::Reset});r.c.tick(r.now);assert(r.c.state.fault==Fault::None&&!r.c.state.running&&!r.c.state.out.heater); }
  { Rig r;bool previous=false;uint32_t offAt=r.now;
    for(int i=0;i<100;++i){const float t=i%2?37.7f:37.5f;
      for(int j=0;j<50;++j){r.advance(50,t,58);const bool on=r.c.state.out.heater;
        if(!on&&previous)offAt=r.now;
        if(on&&!previous)assert(r.now-offAt>=kAdaptiveHeatMinOffMs);
        previous=on;}} }
  { Rig r; r.advance(5000,37.5,58);r.advance(5000,37.7,58);assert(!r.c.state.out.heater); }
  { Rig r(31,80);r.advance(15000,31,80);assert(!r.c.state.diagnostics.dryDemand&&!r.c.state.out.exhaust); }
  { Rig r(37.7,65);r.advance(360000,37.7,65);assert(!r.c.state.out.mist);
    bool limited=false;for(int i=0;i<120;++i){r.advance(500,37.7,65);if(r.c.state.exhaustReason[0]=='d')limited=true;}assert(limited); }
  { Rig r;bool previous=false;uint32_t window=0;unsigned starts=0;
    for(int i=0;i<4000;++i){r.advance(50,(i/50)%2?37.7f:37.5f,58);
      const uint32_t current=(r.now-5000)/kHeatWindowMs;if(current!=window){window=current;starts=0;}
      if(r.c.state.out.heater&&!previous){++starts;assert(starts<=1);}previous=r.c.state.out.heater;}}
  { Rig r(37.6,58);bool previous=false;uint32_t onAt=0;
    for(int i=0;i<6000;++i){r.advance(50,37.6,58);const bool on=r.c.state.out.heater;
      if(on&&!previous)onAt=r.now;
      if(!on&&previous)assert(r.now-onAt>=kAdaptiveHeatMinOnMs);
      previous=on;}}
  for(uint8_t mode=1;mode<=2;++mode){Rig r(38,75,mode);r.advance(5000,38,75);assert(r.c.state.out.exhaustDuty==100);}
  std::cout<<"adaptive control: 21 scenarios passed (decisions only; no physical plant model)\n";
}
