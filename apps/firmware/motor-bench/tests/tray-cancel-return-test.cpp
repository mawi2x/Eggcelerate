#include <cassert>
#include <initializer_list>
#include "../../Eggcelerate/TrayMotion.h"
using namespace egg_tray;
int main(){
 for(uint8_t side:{uint8_t(1),uint8_t(2)}){
  Controller t;CancelReturn r;t.state.position=side;t.state.status=Status::AwaitingObservation;
  r.request(t,100,true);assert(r.pending&&!t.state.running);assert(!r.due(1099));assert(r.due(1100));
  assert(r.start(t,1100,1));assert(t.state.running&&t.state.duration==5000);
  t.tick(6099);r.check(t,6099,true);assert(r.running);
  t.tick(6100);r.check(t,6100,true);assert(!r.active()&&!t.state.running&&t.state.position==3);
 }
 {Controller t;CancelReturn r;r.request(t,100,true);assert(!r.active()&&!t.state.running&&t.state.position==0);}
 {Controller t;CancelReturn r;t.confirmPlus(100);assert(t.start(101,Move::Opposite,1));r.request(t,1000,true);assert(!r.active()&&!t.state.running&&t.state.position==0);}
 {Controller t;CancelReturn r;t.state.position=3;t.state.status=Status::AwaitingObservation;r.request(t,100,true);assert(!r.active()&&t.state.position==3);}
 {Controller t;CancelReturn r;t.confirmPlus(100);r.request(t,30101,true);assert(!r.active());}
 {Controller t;CancelReturn r;t.confirmPlus(100);r.request(t,101,false);assert(!r.active());}
 {Controller t;CancelReturn r;t.confirmPlus(100);r.request(t,101,true);r.check(t,200,false);assert(!r.active()&&t.state.position==0);}
 {Controller t;CancelReturn r;t.confirmPlus(100);r.request(t,101,true);assert(r.start(t,1101,1));r.abort(t,1300);assert(!r.active()&&!t.state.running&&t.state.position==0);}
 {Controller t;CancelReturn r;t.confirmPlus(100);r.request(t,101,true);r.check(t,15102,true);assert(!r.active());}
 {Controller t;CancelReturn r;t.confirmPlus(UINT32_MAX-500);r.request(t,UINT32_MAX-400,true);assert(r.start(t,600,1));t.tick(5600);r.check(t,5600,true);assert(!r.active()&&t.state.position==3);}
}
