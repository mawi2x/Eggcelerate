#include "../Eggcelerate/ClimateControl.h"
#include <cassert>
#include <cmath>
#include <iostream>
using namespace egg_climate;
struct Trial {
 Controller c;uint32_t now;
 Trial(uint8_t mode=0,float t=37.6f,uint32_t start=10000):now(start) {
  c.sample(now-2500,t,65);c.sample(now,t,65);c.command(now,Command{Action::Prepare,mode});c.tick(now);
 }
 void sample(float t,float h=65){now+=2500;c.sample(now,t,h);c.tick(now);safe();}
 void safe(){if(c.state.fault!=Fault::None)assert(!c.state.running&&!c.state.out.heater&&!c.state.out.mist);}
 void latch(Fault f){c.state.fault=f;c.state.running=false;c.tick(now);safe();}
 void sensorFault(){sample(NAN);sample(NAN);sample(NAN);now+=1000;c.tick(now);safe();assert(c.state.fault==Fault::Sensor);}
};
int main(){
 for(uint8_t mode=0;mode<3;++mode){
  const auto &m=kModes[mode];const float mid=(m.tempMin+m.tempMax)*.5f;
  Trial cold(mode,35);cold.sensorFault();assert(cold.c.state.out.upper&&!cold.c.state.out.exhaust);
  cold.sample(35);assert(!cold.c.state.out.exhaust);cold.sample(35);assert(!cold.c.state.out.exhaust&&cold.c.state.fault==Fault::Sensor);
  Trial hot(mode,m.tempMax+.2f);hot.sensorFault();assert(hot.c.state.out.exhaustDuty==100);
  hot.sample(mid);assert(hot.c.state.out.exhaustDuty==100); // one good is insufficient
  hot.sample(mid);assert(!hot.c.state.out.exhaust&&hot.c.state.out.upper);
  hot.sample(m.tempMax);assert(hot.c.state.out.exhaustDuty==100);
  hot.sample(mid+.03f);assert(hot.c.state.out.exhaustDuty==100); // hysteresis
  hot.sample(mid);assert(!hot.c.state.out.exhaust);
  hot.c.command(hot.now,Command{Action::Stop});hot.sample(39);assert(!hot.c.state.out.upper&&!hot.c.state.out.exhaust);hot.safe();
 }
 {Trial t(0,38);t.sensorFault();const auto good=t.c.state.lastGoodAt;
  t.now=good+kFaultBlindVentMs;t.c.tick(t.now);assert(t.c.state.out.exhaustDuty==100);
  ++t.now;t.c.tick(t.now);assert(!t.c.state.out.exhaust&&t.c.state.out.upper);t.safe();}
 {Trial t(0,38);t.now+=kStaleMs+1;t.c.tick(t.now);assert(t.c.state.fault==Fault::Stale&&t.c.state.out.exhaustDuty==100);
  t.now+=kFaultBlindVentMs;t.c.tick(t.now);assert(!t.c.state.out.exhaust);t.safe();}
 {Trial t;t.sample(39);assert(t.c.state.fault==Fault::Overheat&&t.c.state.out.exhaustDuty==100);
  t.now+=kFaultBlindVentMs+1;t.c.sample(t.now,NAN,NAN);t.c.tick(t.now);assert(t.c.state.out.exhaustDuty==100);t.safe();
  t.sample(35);assert(t.c.state.out.exhaustDuty==100);t.sample(35);assert(!t.c.state.out.exhaust&&t.c.state.fault==Fault::Overheat);
  t.now+=kFaultBlindVentMs+1;t.c.tick(t.now);assert(!t.c.state.out.exhaust);}
 {Trial t;t.sensorFault();t.sample(39);assert(t.c.state.fault==Fault::Sensor&&t.c.state.out.exhaustDuty==100);
  t.now+=kFaultBlindVentMs+1;t.c.tick(t.now);assert(t.c.state.out.exhaustDuty==100);t.safe();}
 for(auto f:{Fault::Storage,Fault::HeaterTimeout,Fault::ControllerReset}){
  Trial t(0,35);t.latch(f);assert(t.c.state.out.upper&&!t.c.state.out.exhaust);
  t.sample(38);t.sample(38);assert(t.c.state.out.exhaustDuty==100);
  t.sample(35);assert(!t.c.state.out.exhaust&&t.c.state.fault==f);t.safe();
 }
 {Trial t(0,38);t.c.fanOutputFailed();t.c.tick(t.now);assert(t.c.state.fault==Fault::FanOutput&&!t.c.state.out.exhaust&&t.c.state.out.upper);t.safe();}
 {Trial t(0,38,UINT32_MAX-5000);t.sensorFault();assert(t.c.state.out.exhaustDuty==100);
  t.now=t.c.state.lastGoodAt+kFaultBlindVentMs+1;t.c.tick(t.now);assert(!t.c.state.out.exhaust);t.safe();}
 {Trial t(0,35);t.sensorFault();t.sample(35);t.sample(35);t.c.command(t.now,Command{Action::Reset});t.c.tick(t.now);
  assert(t.c.state.fault==Fault::None&&!t.c.state.running&&!t.c.state.out.heater&&!t.c.state.out.mist);}
 {Controller c;c.state.fault=Fault::Overheat;c.sample(2500,39,65);c.sample(5000,39,65);c.tick(5000);
  assert(!c.state.out.upper&&!c.state.out.exhaust&&!c.state.out.heater&&!c.state.out.mist); // boot/Stop authorization preserved
 }
 std::cout<<"fault ventilation: all modes, cold/hot, hysteresis, blind timeout, overheat precedence, Stop, PWM failure and rollover passed\n";
}
