// Synthetic sensitivity analysis. Parameters are hypotheses, not chamber measurements.
#ifndef CLIMATE_HEADER
#define CLIMATE_HEADER "../Eggcelerate/ClimateControl.h"
#endif
#include CLIMATE_HEADER
#include <cmath>
#include <iostream>
#include <algorithm>
using namespace egg_climate;
struct Plant {
  const char *name;
  double heaterGain, heaterLag, roomHumidity, exchange, passive, mistGain;
  double sensorLag=8;
  double temperature=31, moisture=68, heat=0, sensedT=31, sensedH=80;
};
int main() {
  Plant plants[]={
    {"nominal",.035,8,42,.004,.008,1.2},
    {"heater-inertia",.040,18,42,.004,.008,1.2},
    {"strong-exhaust",.035,8,42,.010,.008,1.2},
    {"dry-room",.035,8,30,.006,.002,2.5},
    {"strong-mist",.035,8,42,.004,.008,5.0},
    {"moist-room",.035,8,56,.004,.008,1.2},
    {"humid-intake",.035,8,64,.004,.008,1.2},
    {"slow-sensor-stress",.035,8,42,.004,.008,1.2,15},
    {"low-heater-stress",.025,20,50,.004,.008,1.2},
    {"powerful-heater-stress",.060,8,42,.004,.008,1.2}
  };
  for(auto p:plants) {
    p.moisture=80*std::exp(.055*(p.temperature-37.65));
    if (std::string(p.name)=="dry-room" || std::string(p.name)=="strong-mist") {
      p.moisture=42; p.sensedH=p.moisture*std::exp(-.055*(p.temperature-37.65));
    }
    Controller c;
    c.sample(2500,float(p.sensedT),float(p.sensedH));c.sample(5000,float(p.sensedT),float(p.sensedH));
    c.command(5000,Command{Action::Prepare,0});
    double tMin=100,tMax=-100,hMin=100,hMax=0;unsigned counted=0,joint=0,heatChanges=0,fanStarts=0,mistPulses=0;
    bool previousHeat=false,previousFan=false,previousMist=false;
    // 3 h, 50 ms control, 2.5 s quantized sensor with 8 s response lag.
    for(uint32_t now=5050;now<=10805000;now+=50) {
      if(now%2500==0)c.sample(now,std::round(p.sensedT*10)/10,std::round(p.sensedH*10)/10);
      c.tick(now);const auto &o=c.state.out;
      const double dt=.05,fan=o.exhaustDuty/100.0;
      p.heat+=(double(o.heater)-p.heat)*dt/p.heaterLag;
      p.temperature+=dt*(p.heaterGain*p.heat-(p.temperature-31)/1000-fan*.0035*(p.temperature-31));
      p.moisture+=dt*(fan*p.exchange*(p.roomHumidity-p.moisture)+p.passive+(o.mist?p.mistGain:0));
      // Explicitly approximate RH/T coupling for sensitivity analysis only.
      const double humidity=std::clamp(p.moisture*std::exp(-.055*(p.temperature-37.65)),1.0,99.0);
      p.sensedT+=(p.temperature-p.sensedT)*dt/p.sensorLag;
      p.sensedH+=(humidity-p.sensedH)*dt/p.sensorLag;
      if(now>3605000) {
        tMin=std::min(tMin,p.temperature);tMax=std::max(tMax,p.temperature);
        hMin=std::min(hMin,humidity);hMax=std::max(hMax,humidity);
        ++counted;if(p.temperature>=37.5&&p.temperature<=37.8&&humidity>=55&&humidity<=60)++joint;
        if(o.heater!=previousHeat)++heatChanges;
        if(o.exhaust&&!previousFan)++fanStarts;
      }
      if(o.mist&&!previousMist)++mistPulses;
      previousMist=o.mist;
      previousHeat=o.heater;previousFan=o.exhaust;
    }
    std::cout<<p.name<<","<<tMin<<","<<tMax<<","<<hMin<<","<<hMax<<","<<100.0*joint/counted<<","<<heatChanges<<","<<fanStarts<<","<<int(c.state.fault)<<","<<mistPulses<<"\n";
  }
}
