#include "../Eggcelerate/ClimateControl.h"
#include <cassert>
#include <iostream>
using namespace egg_climate;
const char *id="12345678-1234-1234-1234-123456789abc";
struct Rig {
 Controller c;uint32_t now=5000;
 Rig(float t=33,float h=75){c.sample(2500,t,h);c.sample(now,t,h);}
 bool start(Action a){Command cmd;cmd.action=a;snprintf(cmd.id,sizeof(cmd.id),"%s",id);c.command(now,cmd);c.tick(now);return c.accepted;}
 void step(uint32_t duration,float t,float h){for(uint32_t e=0;e<duration;e+=50){now+=50;if(now%2500==0)c.sample(now,t,h);c.tick(now);assert(!c.state.out.mist);assert(!c.state.out.heater||c.state.out.upper);}}
};
int main(){
 {Rig r;assert(r.start(Action::HTM));assert(r.c.state.mode==0&&r.c.state.phase==0);r.step(5000,33,75);assert(r.c.state.out.heater&&r.c.state.out.upper&&!r.c.state.out.exhaust);r.step(2500,38.5,60);assert(!r.c.state.running&&!r.c.state.out.heater);assert(r.c.benchmark.state.outcome==egg_benchmark::Ceiling);}
 {Rig r;assert(r.start(Action::LTM));r.step(310000,30,70);assert(r.c.benchmark.state.outcome==egg_benchmark::Completed);assert(r.c.benchmark.state.results[0].windows>0);assert(!r.c.state.out.heater);}
 {Rig r(37.6,65);assert(r.start(Action::LHM));r.step(65000,37.6,65);assert(r.c.benchmark.state.stage==1);r.step(600000,37.6,65);assert(r.c.benchmark.state.stage==2);r.step(600000,37.6,64);assert(!r.c.state.running);assert(r.c.benchmark.state.outcome==egg_benchmark::Completed);assert(r.c.benchmark.state.results[1].windows&&r.c.benchmark.state.results[2].windows);}
 {Rig r(37.6,65);assert(r.start(Action::LHM));r.step(65000,37.6,65);r.step(2500,37.3,66);assert(!r.c.state.out.exhaust);assert(r.c.benchmark.state.invalidated);r.c.command(r.now,Command{Action::Stop});r.c.tick(r.now);assert(r.c.benchmark.state.outcome==egg_benchmark::Cancelled);assert(!r.c.state.out.upper&&!r.c.state.out.exhaust);}
 {Rig r;assert(r.start(Action::HTM));r.c.sample(r.now+2500,NAN,NAN);r.c.tick(r.now+2500);assert(!r.c.state.running&&!r.c.state.out.heater);assert(r.c.benchmark.state.outcome==egg_benchmark::Faulted);}
 {Rig r;assert(r.start(Action::HTM));r.step(2500,39,60);assert(r.c.state.fault==Fault::Overheat);assert(!r.c.state.out.heater);assert(r.c.benchmark.state.outcome==egg_benchmark::Faulted);}
 {Rig r;assert(r.start(Action::LTM));r.c.tick(r.now+3600000);assert(!r.c.state.running&&!r.c.state.out.heater);}
 {Rig r;r.c.command(r.now,Command{Action::Prepare,0});assert(!r.start(Action::HTM));}
 {egg_benchmark::Controller b;b.start(0,egg_benchmark::HTM,id);b.tick(3600000,true,1,33,70,true);assert(b.state.outcome==egg_benchmark::TimedOut);char out[1536];assert(egg_benchmark::json(b.state,out,sizeof(out)));assert(strstr(out,"\"outcome\":4"));char small[32];assert(!egg_benchmark::json(b.state,small,sizeof(small)));}
 std::cout<<"Benchmark local behavior and guards passed\n";
}
