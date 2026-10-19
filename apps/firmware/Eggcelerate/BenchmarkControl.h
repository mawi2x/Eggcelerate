#pragma once
#include <stdint.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

namespace egg_benchmark {
constexpr uint32_t kLimitMs=3600000, kWindowMs=300000, kStageMs=600000;
constexpr float kCeilingC=40.0f;
constexpr float kHtmOvertempC=40.5f;
enum Kind:uint8_t { None, HTM, LTM, LHM };
enum Outcome:uint8_t { Idle, Running, Completed, Cancelled, TimedOut, Ceiling, Faulted, Restarted, TemperatureLimited };
struct Result {
  uint32_t windows=0, samples=0;
  float meanT=0,meanRH=0,minT=0,maxT=0,minRH=0,maxRH=0,dewPoint=0;
};
struct Snapshot {
  char id[37]={};
  uint8_t kind=0,outcome=0,stage=0;
  uint32_t elapsed=0,stageElapsed=0,invalidated=0,samples=0;
  float minT=0,maxT=0,minRH=0,maxRH=0;
  Result results[3];
  bool active()const{return outcome==Running;}
};
class Controller {
  struct Point {uint32_t at;float t,h;};
  Point points[128]; uint16_t count=0,head=0;
  uint32_t started=0,stageAt=0,lastSample=0,lastAt=0,stableAt=0,pausedAt=0;
  bool stable=false,paused=false;
public:
  Snapshot state;
  void resetWindow(){count=head=0;stable=false;}
  void start(uint32_t now,Kind kind,const char *id){
    state=Snapshot{};state.kind=kind;state.outcome=Running;snprintf(state.id,sizeof(state.id),"%s",id);
    started=stageAt=now;lastSample=lastAt=0;paused=false;pausedAt=0;resetWindow();
  }
  void finish(uint32_t now,Outcome result){if(!state.active())return;state.elapsed=now-started;state.stageElapsed=(paused?pausedAt:now)-stageAt;state.outcome=result;resetWindow();}
  // A recoverable sensor hold is not a terminal fault. Keep the wall-clock
  // limit, but exclude the hold from stage time and discard its plateau window.
  void pause(uint32_t now){
    if(!state.active())return;
    state.elapsed=now-started;
    if(!paused){paused=true;pausedAt=now;resetWindow();lastAt=0;++state.invalidated;}
    state.stageElapsed=pausedAt-stageAt;
    if(state.elapsed>=kLimitMs)finish(now,TimedOut);
  }
  uint8_t duty()const{return state.kind==LTM?100:state.kind==LHM&&state.stage?(state.stage==1?60:100):0;}
  void tick(uint32_t now,bool healthy,uint32_t sample,float t,float h,bool qualified){
    if(!state.active())return;
    if(!healthy){finish(now,Faulted);return;}
    if(paused){stageAt+=now-pausedAt;paused=false;}
    state.elapsed=now-started;state.stageElapsed=now-stageAt;
    const bool fresh=sample!=lastSample;
    if(fresh&&isfinite(t)&&isfinite(h)&&t>=0&&t<=60&&h>=1&&h<=100){
      if(!state.samples){state.minT=state.maxT=t;state.minRH=state.maxRH=h;}
      ++state.samples;state.minT=fminf(state.minT,t);state.maxT=fmaxf(state.maxT,t);
      state.minRH=fminf(state.minRH,h);state.maxRH=fmaxf(state.maxRH,h);
    }
    if(state.elapsed>=kLimitMs){finish(now,TimedOut);return;}
    if(state.kind==HTM&&t>=kCeilingC){finish(now,Ceiling);return;}
    if(!fresh)return;
    lastSample=sample;
    if(lastAt&&now-lastAt>6000){resetWindow();++state.invalidated;}
    lastAt=now;
    if(state.kind==LHM&&!state.stage){
      if(t>=37.5f&&t<=37.8f){if(!stable){stable=true;stableAt=now;}if(now-stableAt>=60000){state.stage=1;stageAt=now;state.stageElapsed=0;resetWindow();}}
      else resetWindow();
      return;
    }
    if(!qualified){resetWindow();++state.invalidated;}
    else{
      points[head]={now,t,h};head=(head+1)%128;if(count<128)++count;
      // Drop old samples, retaining the first at/before the five-minute boundary.
      while(count>1&&now-points[(head+128-count+1)%128].at>=kWindowMs)--count;
      const auto &old=points[(head+128-count)%128];
      if(count>1&&now-old.at>=kWindowMs){
        float loT=t,hiT=t,loH=h,hiH=h,sumT=0,sumH=0;
        for(uint16_t n=0;n<count;++n){const auto &p=points[(head+128-count+n)%128];loT=fminf(loT,p.t);hiT=fmaxf(hiT,p.t);loH=fminf(loH,p.h);hiH=fmaxf(hiH,p.h);sumT+=p.t;sumH+=p.h;}
        float minutes=float(now-old.at)/60000.0f;
        bool plateau=hiT-loT<=0.201f&&fabsf(t-old.t)/minutes<=0.05f;
        if(state.kind==LHM)plateau=plateau&&hiH-loH<=1.001f&&fabsf(h-old.h)/minutes<=0.1f;
        if(plateau){
          auto &r=state.results[state.stage];float meanT=sumT/count,meanH=sumH/count;
          bool better=!r.windows||(state.kind==HTM?meanT>r.meanT:state.kind==LTM?meanT<r.meanT:meanH<r.meanRH);
          ++r.windows;
          if(better){r.samples=count;r.meanT=meanT;r.meanRH=meanH;r.minT=loT;r.maxT=hiT;r.minRH=loH;r.maxRH=hiH;float a=logf(meanH/100.0f)+17.67f*meanT/(243.5f+meanT);r.dewPoint=243.5f*a/(17.67f-a);}
          if(state.kind==LTM){finish(now,Completed);return;}
        }
      }
    }
    if(state.kind==LHM&&state.stageElapsed>=kStageMs){
      if(state.stage==1){state.stage=2;stageAt=now;state.stageElapsed=0;resetWindow();}
      else finish(now,state.results[1].windows&&state.results[2].windows?Completed:TemperatureLimited);
    }
  }
};
inline bool json(const Snapshot &s,char *out,size_t cap){
  int n=snprintf(out,cap,"{\"version\":1,\"run_id\":\"%s\",\"kind\":%u,\"outcome\":%u,\"stage\":%u,\"elapsed_ms\":%lu,\"stage_elapsed_ms\":%lu,\"invalidated\":%lu,\"samples\":%lu,\"min_t\":%.3f,\"max_t\":%.3f,\"min_rh\":%.3f,\"max_rh\":%.3f,\"ceiling_c\":%.1f,\"htm_overtemp_c\":%.1f,\"limit_ms\":3600000,\"results\":[",s.id,s.kind,s.outcome,s.stage,(unsigned long)s.elapsed,(unsigned long)s.stageElapsed,(unsigned long)s.invalidated,(unsigned long)s.samples,s.minT,s.maxT,s.minRH,s.maxRH,kCeilingC,kHtmOvertempC);
  if(n<0||size_t(n)>=cap)return false;
  size_t used=n;
  for(uint8_t i=0;i<3;++i){const auto &r=s.results[i];n=snprintf(out+used,cap-used,"%s{\"windows\":%lu,\"samples\":%lu,\"mean_t\":%.3f,\"mean_rh\":%.3f,\"min_t\":%.3f,\"max_t\":%.3f,\"min_rh\":%.3f,\"max_rh\":%.3f,\"dew_point\":%.3f}",i?",":"",(unsigned long)r.windows,(unsigned long)r.samples,r.meanT,r.meanRH,r.minT,r.maxT,r.minRH,r.maxRH,r.dewPoint);if(n<0||size_t(n)>=cap-used)return false;used+=n;}
  return snprintf(out+used,cap-used,"]}")>0&&used+2<cap;
}
}
