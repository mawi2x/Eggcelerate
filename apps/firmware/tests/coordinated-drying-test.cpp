#include "../Eggcelerate/ClimateControl.h"
#include <cassert>
#include <iostream>
using namespace egg_climate;
struct Rig {
 Controller c;uint32_t now=5000;
 Rig(float t=37.7,float h=65,uint8_t mode=0){c.sample(2500,t,h);c.sample(now,t,h);c.command(now,Command{Action::Prepare,mode});c.tick(now);}
 void advance(uint32_t ms,float t,float h){for(uint32_t e=0;e<ms;e+=50){now+=50;if(now%2500==0)c.sample(now,t,h);c.tick(now);
  assert(!c.state.out.heater||(c.state.valid&&c.state.out.upper&&c.state.temperature<kModes[c.state.mode].tempMax));
  assert(!c.state.out.mist||(!c.state.out.exhaust&&!c.state.diagnostics.dryDemand));}}
 bool test(uint8_t duty){Command x;x.action=Action::VentTest;x.testDuty=duty;c.command(now,x);c.tick(now);return c.accepted;}
};
int main(){
 {Rig r(33.1,77.6);r.advance(600000,33.1,77.6);const auto &d=r.c.state.diagnostics.adaptive;
  assert(!isfinite(d.dryBaseline)&&d.reviewCount==0&&!d.dryLimited&&d.eligibleMs==0);}
 {Rig r;r.advance(kDryStableMs-50,37.7,65);assert(!isfinite(r.c.state.diagnostics.adaptive.dryBaseline));
  r.advance(100,37.7,65);assert(isfinite(r.c.state.diagnostics.adaptive.dryBaseline));
  r.advance(kDryReviewMs+5000,37.7,65);auto d=r.c.state.diagnostics.adaptive;
  assert(d.reviewCount==1&&d.reviewResult==3&&d.dryLimited&&d.lastReviewEligibleMs>=kDryReviewMs&&d.lastReviewExhaustMs>=kDryObserveOnMs);
  r.advance(kDryBackoffMs+50,37.7,65);assert(!r.c.state.diagnostics.adaptive.dryLimited);}
 {Rig r;r.advance(60000,37.7,67);assert(isfinite(r.c.state.diagnostics.adaptive.dryBaseline));
  r.advance(2500,37.3,67);assert(!isfinite(r.c.state.diagnostics.adaptive.dryBaseline)&&r.c.state.diagnostics.adaptive.eligibleMs==0);}
 {Rig r(38,65);r.advance(600000,38,65);assert(r.c.state.diagnostics.adaptive.reviewCount==0);}
 {Rig r(37.65,65);bool overlap=false,feed=false;
  for(int i=0;i<1200;++i){r.advance(50,37.65,65);overlap|=r.c.state.out.heater&&r.c.state.out.exhaust;feed|=r.c.state.diagnostics.adaptive.heatFeedForward>0;}
  assert(overlap&&feed);}
 for(uint8_t duty:{60,100}){Rig r;assert(r.test(duty));r.advance(5000,37.7,65);
  assert(r.c.state.diagnostics.adaptive.testDuty==duty&&r.c.state.out.exhaustRequestedDuty==duty);
  r.advance(kVentTestMs,37.7,65);assert(r.c.state.diagnostics.adaptive.testDuty==0);}
 {Rig r;assert(!r.test(59));assert(r.test(60));r.advance(2500,37.4,65);assert(r.c.state.diagnostics.adaptive.testDuty==0);}
 {Rig r;assert(r.test(100));r.c.sample(r.now,NAN,65);r.c.tick(r.now);assert(!r.c.state.out.heater&&!r.c.state.out.mist&&r.c.state.diagnostics.adaptive.testDuty==0);}
 {Rig r;assert(r.test(60));r.advance(2500,39,65);assert(r.c.state.fault==Fault::Overheat&&!r.c.state.out.heater);}
 {Rig r;assert(r.test(60));r.c.command(r.now,Command{Action::Stop});r.c.tick(r.now);assert(!r.c.state.out.exhaust&&!r.c.state.out.upper);}
 {Rig r;r.c.command(r.now,Command{Action::Incubate,0});assert(!r.test(60));}
 for(uint8_t mode:{1,2}){Rig r(37.5,65,mode);assert(!r.test(60));}
 std::cout<<"coordinated drying: qualified baseline, review exposure, backoff, disturbance reset, heat/exhaust overlap, timed comparison and safety guards passed\n";
}
