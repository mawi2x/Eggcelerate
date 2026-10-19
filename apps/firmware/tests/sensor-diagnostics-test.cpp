#include "../Eggcelerate/SensorDiagnostics.h"
#include <cassert>
#include <cstring>
#include <iostream>
using namespace egg_climate;
int main(){
 Controller c;char out[640];
 assert(egg_diagnostics::sensorJson(c.state,5000,out,sizeof(out)));
 assert(strstr(out,"\"last_good_age_ms\":null")&&strstr(out,"\"last_good_temperature_c\":null"));
 c.sample(2500,35,65);c.sample(5000,35,65);c.command(5000,Command{Action::Prepare,0});c.tick(5000);
 c.sample(7500,NAN,65);c.tick(7500);
 assert(c.state.sensor.consecutiveFailures==1&&c.state.sensor.recovering&&c.state.sensor.lastFailureAt==7500);
 c.sample(10000,35,65);c.tick(10000);assert(c.state.sensor.recoveries==0&&c.state.sensor.recovering);
 c.sample(12500,35,65);c.tick(12500);assert(c.state.sensor.recoveries==1&&!c.state.sensor.recovering&&c.state.sensor.lastRecoveryAt==12500);
 assert(egg_diagnostics::sensorJson(c.state,13000,out,sizeof(out)));
 assert(strstr(out,"\"last_good_age_ms\":500"));
 c.sample(15000,NAN,NAN);c.tick(15000);c.tick(21000);
 assert(c.state.fault==Fault::Sensor&&c.state.sensor.faultAt==21000);
 c.sample(22500,35,65);c.tick(22500);c.sample(25000,35,65);c.tick(25000);
 assert(c.state.sensor.recoveries==2&&c.state.sensor.faultAt==21000&&c.state.fault==Fault::Sensor);
 const auto sequence=c.state.controlSequence;assert(egg_diagnostics::sensorJson(c.state,25000,out,sizeof(out)));assert(sequence==c.state.controlSequence);
 c.state.successes=c.state.failures=c.state.sensor.recoveries=c.state.sensor.consecutiveFailures=UINT32_MAX;
 c.state.sensor.lastFailureAt=c.state.sensor.lastRecoveryAt=c.state.sensor.faultAt=UINT32_MAX;
 c.state.sensor.resetReason=255;c.state.lastGoodAt=UINT32_MAX-5;
 assert(egg_diagnostics::sensorJson(c.state,4,out,sizeof(out)));assert(strstr(out,"\"last_good_age_ms\":10"));
 assert(!egg_diagnostics::sensorJson(c.state,4,out,16));
 std::cout<<"sensor diagnostics: counters, stream recovery, timestamps, nulls, rollover and buffer limits passed\n";
}
