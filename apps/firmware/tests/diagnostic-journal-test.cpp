#define EGG_DIAGNOSTICS_HOST_TEST
#include "../Eggcelerate/DiagnosticJournal.h"
#include <cassert>
#include <iostream>
#include <fstream>
using namespace egg_diagnostics;
int main(){
 begin();egg_climate::Controller c;c.sample(0,35,65);c.sample(1000,35,65);c.tick(1000);
 // Seed a valid pre-upgrade v1 record. Production export must still read it.
 auto old=std::make_shared<Bytes>(112,0);uint32_t magic=kMagic;uint16_t version=1,size=112;
 memcpy(old->data(),&magic,4);memcpy(old->data()+4,&version,2);memcpy(old->data()+6,&size,2);
 uint32_t crc=checksumBytes(old->data(),108);memcpy(old->data()+108,&crc,4);
 LittleFS.files[kCurrent]=old;
 capture(c.state);journalTick(true,1760000000000LL);
 assert(LittleFS.files[kPrevious]->size()==112&&LittleFS.files[kCurrent]->size()==256);
 assert(written==1&&rotations==1&&dropped==0&&writeFailures==0);
 Record saved;memcpy(&saved,LittleFS.files[kCurrent]->data(),sizeof(saved));assert(saved.version==3&&saved.crc==checksum(saved)&&saved.successes==2);
 {std::ofstream file("/tmp/egg-v6-production-record.bin",std::ios::binary);file.write(reinterpret_cast<const char*>(&saved),sizeof(saved));}
 dumpRequested=1;journalTick(true,0);journalTick(true,0);journalTick(true,0);
 bool v1=false,v2=false;for(auto &s:Serial.lines){v1|=s.rfind("DIAG ",0)==0&&s.size()==229;v2|=s.rfind("DIAG ",0)==0&&s.size()==517;}assert(v1&&v2);
 // Partial tails are rotated, not appended after; old current is retained.
 LittleFS.files[kCurrent]->push_back(0);hostNow+=1000;c.sample(hostNow,NAN,65);c.tick(hostNow);capture(c.state);journalTick(true,0);
 assert(rotations==2&&LittleFS.files[kPrevious]->size()==257&&LittleFS.files[kCurrent]->size()==256);
 // Production v2 exports must survive the second format upgrade too.
 auto legacyV2=std::make_shared<Bytes>(156,0);version=2;size=156;
 memcpy(legacyV2->data(),&magic,4);memcpy(legacyV2->data()+4,&version,2);memcpy(legacyV2->data()+6,&size,2);
 crc=checksumBytes(legacyV2->data(),152);memcpy(legacyV2->data()+152,&crc,4);LittleFS.files[kPrevious]=legacyV2;
 dumpRequested=1;journalTick(true,0);journalTick(true,0);journalTick(true,0);
 bool exportedV2=false;for(auto &s:Serial.lines)exportedV2|=s.rfind("DIAG ",0)==0&&s.size()==317;assert(exportedV2);
 // Real report formatter fits its network buffer, parses downstream, refuses truncation.
 char report[3328];assert(reportJson(c.state,report,sizeof(report)));char small[16];assert(!reportJson(c.state,small,sizeof(small)));
 std::cout<<report<<"\n";
 std::cerr<<"journal: version migration, legacy export, partial-tail rotation, CRC and report buffer checks passed\n";
 c.state.successes=c.state.failures=c.state.sampleNumber=UINT32_MAX;
 c.state.sensor.consecutiveFailures=c.state.sensor.recoveries=UINT32_MAX;
 c.state.sensor.lastFailureAt=c.state.sensor.lastRecoveryAt=c.state.sensor.faultAt=UINT32_MAX;
 c.state.sensor.resetReason=255;c.state.lastGoodTemperature=60;c.state.lastGoodHumidity=100;
 c.state.diagnostics.trendValid=true;c.state.diagnostics.temperatureRate=3;c.state.diagnostics.humidityRate=30;
 c.state.diagnostics.evaluatedAt=c.state.diagnostics.heaterElapsedMs=c.state.diagnostics.mistElapsedMs=c.state.diagnostics.ventElapsedMs=UINT32_MAX;
 written=dropped=writeFailures=rotations=UINT32_MAX;
 assert(reportJson(c.state,report,sizeof(report)));
 delete events;events=nullptr;
}
