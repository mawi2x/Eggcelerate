#pragma once
// Persistent environmental readings. This task never writes actuator GPIOs.
// No auto-format: first installation requires the explicit Serial initialization.
#ifdef EGG_OFFLINE_HOST_TEST
#include "../tests/OfflineStorageHost.h"
#else
#include <Arduino.h>
#include <PubSubClient.h>
#include <LittleFS.h>
#include <esp_partition.h>
#include <esp_timer.h>
#include <esp_random.h>
#include <mbedtls/sha256.h>
#include <sys/time.h>
#include <unistd.h>
#include "ClimateRuntime.h"
#include "DiagnosticJournal.h"
#endif

namespace egg_offline {
constexpr uint32_t kMagic = 0x45474f31;
constexpr uint32_t kCaptureMs = 15000, kFlushMs = 60000;
constexpr uint16_t kRecordsPerSegment = 124, kMaxSegments = 96;
constexpr size_t kQueueBudget = 1024 * 1024;
struct __attribute__((packed)) Record {
  uint64_t sequence, session, monotonicMs;
  int64_t utcMs;
  uint8_t assignment[16];
  uint32_t ageMs;
  int16_t temperature, humidity;
  uint16_t valid, version;
  uint32_t crc;
};
static_assert(sizeof(Record) == 64, "Storage capacity assumes 64 byte records");
struct __attribute__((packed)) Header {
  uint32_t magic, version;
  uint64_t session;
  uint32_t crc;
  int64_t anchor;
  uint32_t anchorCrc;
};
struct __attribute__((packed)) Metadata {
  uint32_t magic = kMagic, version = 1;
  uint64_t revision = 0, reservedThrough = 0, acknowledged = 0;
  uint64_t dropped = 0, corrupt = 0, lostFirst = 0, lostLast = 0;
  uint32_t head = 1, nextSegment = 1;
  uint8_t generation[16] = {}, assignment[16] = {};
  uint32_t crc = 0;
};
struct Segment { uint32_t id, count, bad; Header header; uint32_t queued=0, untimed=0; int64_t oldestMs=0; };
struct Status {
  const char *state = "unavailable";
  char error[65] = "storage task not started";
  uint32_t queued = 0, bytes = 0, pending = 0, untimed = 0;
  uint64_t dropped = 0, corrupt = 0, lostFirst = 0, lostLast = 0;
  int64_t oldestMs = 0;
};
struct Packet { char payload[2048]; };
struct Receipt { char queue[33], digest[65]; };
struct Assignment { uint8_t bytes[16]; };
QueueHandle_t outgoing = nullptr, receipts = nullptr, assignments = nullptr;
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
Status published;
bool initRequested = false;
Metadata meta;
Segment segments[kMaxSegments];
uint16_t segmentCount = 0;
uint64_t nextSequence = 1, sessionId = 0;
int64_t bootAnchor = 0;
Record pending[4];
uint8_t pendingCount = 0;
bool mounted = false, ready = false, inFlight = false;
char deviceId[129] = {}, queueHex[33] = {}, flightDigest[65] = {};
Packet flight;
uint64_t flightLast = 0;
uint32_t flightSegment = 0, retryAt = 0, retryMs = 5000;
uint64_t captureAt = 0, flushAt = 0;
int64_t publishedAnchor = 0;

uint32_t checksum(const void *data, size_t length) {
  const uint8_t *p = static_cast<const uint8_t *>(data);
  uint32_t crc = ~0U;
  for (size_t i=0;i<length;++i) {
    crc ^= p[i];
    for (uint8_t b=0;b<8;++b) crc = (crc>>1) ^ (0xedb88320U & (0U-(crc&1)));
  }
  return ~crc;
}
void hex(const uint8_t *bytes, size_t length, char *out) {
  const char *alphabet = "0123456789abcdef";
  for (size_t i=0;i<length;++i) { out[i*2]=alphabet[bytes[i]>>4]; out[i*2+1]=alphabet[bytes[i]&15]; }
  out[length*2]=0;
}
bool unhex(const char *s, uint8_t *out, size_t length) {
  if (strlen(s)!=length*2) return false;
  for (size_t i=0;i<length;++i) {
    uint8_t value=0;
    for (uint8_t j=0;j<2;++j) {
      char c=s[i*2+j];
      if (c>='0'&&c<='9') value=(value<<4)|(c-'0');
      else if(c>='a'&&c<='f') value=(value<<4)|(c-'a'+10);
      else return false;
    }
    out[i]=value;
  }
  return true;
}
void path(uint32_t id, char *out) { snprintf(out,40,"/egg-offline/s%08lx.bin",(unsigned long)id); }
Status snapshot() { portENTER_CRITICAL(&mux); Status s=published; portEXIT_CRITICAL(&mux); return s; }
void error(const char *reason, const char *state="unavailable") {
  ready=false;
  portENTER_CRITICAL(&mux);
  published.state=state; strlcpy(published.error,reason,sizeof(published.error));
  portEXIT_CRITICAL(&mux);
  Serial.printf("Local recording: %s (%s). Climate control continues.\n",state,reason);
}
bool checkpoint() {
  ++meta.revision;
  meta.crc=checksum(&meta,offsetof(Metadata,crc));
  const char *name=(meta.revision&1)?"/egg-offline/meta1":"/egg-offline/meta0";
  File f=LittleFS.open(name,FILE_WRITE);
  if(!f) { error("metadata open failed"); return false; }
  bool ok=f.write(reinterpret_cast<const uint8_t *>(&meta),sizeof(meta))==sizeof(meta);
  f.flush(); f.close();
  Metadata check;
  f=LittleFS.open(name,FILE_READ);
  ok=f && f.read(reinterpret_cast<uint8_t *>(&check),sizeof(check))==sizeof(check) && !memcmp(&check,&meta,sizeof(meta)) && ok;
  f.close();
  if(!ok) error("metadata commit failed");
  return ok;
}
bool readMeta(const char *name, Metadata &value) {
  File f=LittleFS.open(name,FILE_READ);
  return f && f.size()==sizeof(value) && f.read(reinterpret_cast<uint8_t *>(&value),sizeof(value))==sizeof(value)
    && value.magic==kMagic && value.version==1 && value.head>0 && value.head<=value.nextSegment
    && value.crc==checksum(&value,offsetof(Metadata,crc));
}
bool validRecord(const Record &r) { return r.version==1 && r.sequence && r.crc==checksum(&r,offsetof(Record,crc)); }
int64_t observed(const Segment &segment, const Record &r) {
  if(r.utcMs) return r.utcMs;
  if(segment.header.anchor && segment.header.anchorCrc==checksum(&segment.header.anchor,sizeof(int64_t)))
    return segment.header.anchor+int64_t(r.monotonicMs);
  return 0;
}
bool readRecord(const Segment &segment,uint32_t at, Record &r) {
  char name[40]; path(segment.id,name); File f=LittleFS.open(name,FILE_READ);
  return f && f.seek(sizeof(Header)+at*sizeof(Record)) && f.read(reinterpret_cast<uint8_t *>(&r),sizeof(r))==sizeof(r);
}
void refresh(Segment &s) {
  s.queued=s.untimed=0;s.oldestMs=0;
  char name[40];path(s.id,name);File f=LittleFS.open(name,FILE_READ);
  if(!f||!f.seek(sizeof(Header))) { error("segment read failed");return; }
  for(uint32_t i=0;i<s.count;++i) {
    Record r;
    if(f.read(reinterpret_cast<uint8_t *>(&r),sizeof(r))!=sizeof(r)) { error("segment read failed");return; }
    if(!validRecord(r)||r.sequence<=meta.acknowledged)continue;
    ++s.queued;const int64_t t=observed(s,r);
    if(!t)++s.untimed;else if(!s.oldestMs||t<s.oldestMs)s.oldestMs=t;
  }
}
void publishStatus() {
  Status s;
  const Status previous=snapshot();
  s.state=ready?"ready":previous.state;
  strlcpy(s.error,ready?"":previous.error,sizeof(s.error));
  s.pending=pendingCount;s.bytes=segmentCount*sizeof(Header);
  s.dropped=meta.dropped;s.corrupt=meta.corrupt;s.lostFirst=meta.lostFirst;s.lostLast=meta.lostLast;
  for(uint16_t n=0;n<segmentCount;++n) {
    const auto &segment=segments[n];
    s.bytes+=segment.count*sizeof(Record);s.corrupt+=segment.bad;
    s.queued+=segment.queued;s.untimed+=segment.untimed;
    if(segment.oldestMs&&(!s.oldestMs||segment.oldestMs<s.oldestMs))s.oldestMs=segment.oldestMs;
  }
  portENTER_CRITICAL(&mux);published=s;portEXIT_CRITICAL(&mux);
}
bool recover(bool initialize) {
  const esp_partition_t *partition=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,ESP_PARTITION_SUBTYPE_ANY,"spiffs");
  if(!partition || partition->size<kQueueBudget+131072) { error("data partition too small or missing"); return false; }
  mounted=LittleFS.begin(false,"/littlefs",10,"spiffs");
  if(!mounted) {
    if(!initialize) { error("filesystem needs explicit initialization","needs_init"); return false; }
    if(!LittleFS.format() || !LittleFS.begin(false,"/littlefs",10,"spiffs")) { error("explicit initialization failed"); return false; }
    mounted=true;
  }
  Metadata a,b;
  const bool va=readMeta("/egg-offline/meta0",a), vb=readMeta("/egg-offline/meta1",b);
  if(!va&&!vb) {
    if(!initialize) { error("queue metadata absent or damaged","needs_init"); return false; }
    if(LittleFS.exists("/egg-offline")) {
      File dir=LittleFS.open("/egg-offline");
      for(File entry=dir.openNextFile();entry;entry=dir.openNextFile()) {
        String name=entry.name();const int slash=name.lastIndexOf('/');if(slash>=0)name=name.substring(slash+1);
        if(name!="meta0"&&name!="meta1") { error("damaged metadata with saved data; recover manually");return false; }
      }
    } else if(!LittleFS.mkdir("/egg-offline")) { error("queue directory failed"); return false; }
    meta=Metadata{}; esp_fill_random(meta.generation,sizeof(meta.generation));
    if(!checkpoint() || !checkpoint()) return false;
  } else meta=va&&(!vb||a.revision>b.revision)?a:b;
  hex(meta.generation,16,queueHex);
  segmentCount=0;
  File directory=LittleFS.open("/egg-offline");
  for(File f=directory.openNextFile();f;f=directory.openNextFile()) {
    String base=f.name(); const int slash=base.lastIndexOf('/'); if(slash>=0) base=base.substring(slash+1);
    unsigned long id=0; char extra=0;
    if(base.length()!=13 || !base.endsWith(".bin") || sscanf(base.c_str(),"s%8lx.bin%c",&id,&extra)!=1) continue;
    bool validName=true;for(uint8_t n=1;n<9;++n)validName&=(base[n]>='0'&&base[n]<='9')||(base[n]>='a'&&base[n]<='f');
    if(!validName)continue;
    const uint32_t size=f.size();
    if(id<meta.head) { f.close(); char name[40]; path(id,name); LittleFS.remove(name); continue; }
    if(id>=meta.nextSegment || segmentCount>=kMaxSegments) { error("unexpected queue segment"); return false; }
    if(size<sizeof(Header)&&id==meta.nextSegment-1) {
      // Power failed during a new header write. No complete record can exist.
      f.close();char name[40];path(id,name);
      ++meta.corrupt;if(!checkpoint()||!LittleFS.remove(name)) { error("partial header recovery failed");return false; }
      continue;
    }
    Segment s={uint32_t(id),size>=sizeof(Header)?uint32_t((size-sizeof(Header))/sizeof(Record)):0,0,{}};
    if(f.read(reinterpret_cast<uint8_t *>(&s.header),sizeof(Header))!=sizeof(Header) || s.header.magic!=kMagic
      || s.header.version!=1 || s.header.crc!=checksum(&s.header,offsetof(Header,crc)) || s.count>kRecordsPerSegment) {
      error("segment header damaged; preserve for recovery"); return false;
    }
    for(uint32_t i=0;i<s.count;++i) { Record r; if(f.read(reinterpret_cast<uint8_t *>(&r),sizeof(r))!=sizeof(r)||!validRecord(r)) ++s.bad; }
    if((size-sizeof(Header))%sizeof(Record)) ++s.bad;
    segments[segmentCount++]=s;
  }
  directory.close();
  for(uint16_t i=1;i<segmentCount;++i) for(uint16_t j=i;j&&segments[j].id<segments[j-1].id;--j) { auto tmp=segments[j];segments[j]=segments[j-1];segments[j-1]=tmp; }
  nextSequence=meta.reservedThrough+1;
  if(!nextSequence) { error("record sequence exhausted"); return false; }
  ready=true; for(uint16_t i=0;i<segmentCount&&ready;++i)refresh(segments[i]); publishStatus();
  return ready;
}
bool removeHead(bool overflow) {
  if(!segmentCount) return false;
  const bool evictsFlight=inFlight&&segments[0].id==flightSegment;
  if(evictsFlight&&!overflow)return false;
  const Segment s=segments[0];
  if(overflow) for(uint32_t i=0;i<s.count;++i) { Record r;
    if(readRecord(s,i,r)&&validRecord(r)&&r.sequence>meta.acknowledged) {
      ++meta.dropped; if(!meta.lostFirst) meta.lostFirst=r.sequence; meta.lostLast=r.sequence;
    }
  }
  meta.corrupt+=s.bad; meta.head=s.id+1;
  if(!checkpoint()) return false; // Durable removal decision precedes unlink.
  if(evictsFlight) { inFlight=false; xQueueReset(outgoing); }
  char name[40];path(s.id,name);
  if(!LittleFS.remove(name)) { error("segment cleanup failed"); return false; }
  for(uint16_t n=1;n<segmentCount;++n) segments[n-1]=segments[n];
  --segmentCount;
  return true;
}
bool newSegment() {
  if(segmentCount>=kMaxSegments && !removeHead(true)) return false;
  if(LittleFS.totalBytes()-LittleFS.usedBytes()<32768) { error("filesystem reserve exhausted"); return false; }
  Segment s={meta.nextSegment++,0,0,{}};
  if(!meta.nextSegment || !checkpoint()) return false;
  s.header.magic=kMagic; s.header.version=1;s.header.session=sessionId;
  s.header.crc=checksum(&s.header,offsetof(Header,crc));s.header.anchor=bootAnchor;
  s.header.anchorCrc=checksum(&s.header.anchor,sizeof(int64_t));
  char name[40];path(s.id,name);File f=LittleFS.open(name,FILE_WRITE);
  bool ok=f&&f.write(reinterpret_cast<uint8_t *>(&s.header),sizeof(Header))==sizeof(Header); f.flush();f.close();
  if(!ok) { error("segment creation failed");return false; }
  segments[segmentCount++]=s;return true;
}
void flush() {
  if(!ready||!pendingCount) return;
  if(!segmentCount || segments[segmentCount-1].header.session!=sessionId ||
      segments[segmentCount-1].count+pendingCount>kRecordsPerSegment) {
    if(!newSegment()) {
      if(ready) { meta.dropped+=pendingCount; if(!meta.lostFirst) meta.lostFirst=pending[0].sequence;
        meta.lostLast=pending[pendingCount-1].sequence; pendingCount=0; checkpoint(); }
      return;
    }
  }
  Segment &s=segments[segmentCount-1];char name[40];path(s.id,name);
  File f=LittleFS.open(name,FILE_APPEND);
  const size_t bytes=pendingCount*sizeof(Record);
  bool ok=f&&f.write(reinterpret_cast<uint8_t *>(pending),bytes)==bytes;f.flush();f.close();
  // Read back complete flushed records before reporting them as persisted.
  for(uint8_t i=0;ok&&i<pendingCount;++i) { Record check;
    ok=readRecord(s,s.count+i,check)&&!memcmp(&check,&pending[i],sizeof(check)); }
  if(!ok) { error("record flush failed");return; }
  s.count+=pendingCount;pendingCount=0;refresh(s);flushAt=esp_timer_get_time()/1000;
}
int64_t clockAnchor() {
  portENTER_CRITICAL(&mux);int64_t anchor=publishedAnchor;portEXIT_CRITICAL(&mux);
  if(anchor||time(nullptr)<1704067200)return anchor;
  timeval utc;gettimeofday(&utc,nullptr);
  const int64_t candidate=int64_t(utc.tv_sec)*1000+utc.tv_usec/1000-esp_timer_get_time()/1000;
  portENTER_CRITICAL(&mux);
  if(!publishedAnchor)publishedAnchor=candidate;
  anchor=publishedAnchor;
  portEXIT_CRITICAL(&mux);
  return anchor;
}
void anchorClock() {
  if(!bootAnchor)bootAnchor=clockAnchor();
  if(!bootAnchor||!ready)return;
  // Persist a once-only boot anchor before replaying formerly untimed records.
  for(uint16_t i=0;i<segmentCount;++i) if(segments[i].header.session==sessionId&&segments[i].header.anchor!=bootAnchor) {
    auto &s=segments[i]; s.header.anchor=bootAnchor;
    s.header.anchorCrc=checksum(&s.header.anchor,sizeof(int64_t));
    char name[40];path(s.id,name);File f=LittleFS.open(name,"r+");
    if(!f || !f.seek(offsetof(Header,anchor)) || f.write(reinterpret_cast<uint8_t *>(&s.header.anchor),12)!=12) {
      error("clock anchor save failed");return;
    }
    f.flush();f.close();
    Header check;f=LittleFS.open(name,FILE_READ);
    if(!f||f.read(reinterpret_cast<uint8_t *>(&check),sizeof(check))!=sizeof(check)||memcmp(&check,&s.header,sizeof(check))) { error("clock anchor verification failed");return; }
    f.close();refresh(s);
  }
}
void capture() {
  if(!ready) return;
  if(pendingCount==4) flush();
  if(!ready||pendingCount==4) return;
  if(nextSequence>meta.reservedThrough) {
    if(nextSequence>UINT64_MAX-1024) { error("record sequence exhausted");return; }
    meta.reservedThrough=nextSequence+1023;
    if(!checkpoint())return;
  }
  const auto climate=egg_climate::snapshot();
  Record r={};r.sequence=nextSequence++;r.session=sessionId;r.monotonicMs=esp_timer_get_time()/1000;
  r.ageMs=uint32_t(r.monotonicMs)-climate.sampledAt; r.valid=climate.valid&&r.ageMs<=5000;
  // Timestamp the sensor observation, not its later capture/upload.
  if(r.valid&&r.ageMs<=r.monotonicMs)r.monotonicMs-=r.ageMs;
  if(bootAnchor)r.utcMs=bootAnchor+int64_t(r.monotonicMs);
  memcpy(r.assignment,meta.assignment,16);
  if(r.valid) { r.temperature=lroundf(climate.temperature*100);r.humidity=lroundf(climate.humidity*100); }
  r.version=1;r.crc=checksum(&r,offsetof(Record,crc));pending[pendingCount++]=r;
}
void buildBatch() {
  if(inFlight||!segmentCount||time(nullptr)<1704067200)return;
  char records[1536]="[";size_t used=1;uint8_t count=0;
  const Segment &s=segments[0];
  for(uint32_t i=0;i<s.count&&count<8;++i) {
    Record r;if(!readRecord(s,i,r)||!validRecord(r)||r.sequence<=meta.acknowledged)continue;
    char assignmentHex[33], sessionHex[17], part[320], t[32],g[36],c[12],h[12];
    hex(r.assignment,16,assignmentHex);
    snprintf(sessionHex,sizeof(sessionHex),"%016llx",(unsigned long long)r.session);
    const int64_t utc=observed(s,r);
    if(utc)snprintf(t,sizeof(t),"%lld",(long long)utc);else strlcpy(t,"null",sizeof(t));
    bool hasAssignment=false;for(uint8_t byte:r.assignment)hasAssignment|=byte!=0;
    if(hasAssignment)snprintf(g,sizeof(g),"\"%s\"",assignmentHex);else strlcpy(g,"null",sizeof(g));
    if(r.valid) { snprintf(c,sizeof(c),"%d",r.temperature);snprintf(h,sizeof(h),"%d",r.humidity); }
    else { strlcpy(c,"null",sizeof(c));strlcpy(h,"null",sizeof(h)); }
    int n=snprintf(part,sizeof(part),"%s{\"n\":\"%llu\",\"s\":\"%s\",\"m\":%llu,\"t\":%s,\"g\":%s,\"a\":%lu,\"c\":%s,\"h\":%s,\"v\":%s}",
      count?",":"",(unsigned long long)r.sequence,sessionHex,(unsigned long long)r.monotonicMs,t,g,(unsigned long)r.ageMs,c,h,r.valid?"true":"false");
    if(n<=0||size_t(n)>=sizeof(part)||used+size_t(n)+2>=sizeof(records))break;
    memcpy(records+used,part,n);used+=n;records[used]=0;++count;flightLast=r.sequence;
  }
  if(!count) { removeHead(false);return; }
  records[used++]=']';records[used]=0;
  uint8_t digest[32];mbedtls_sha256(reinterpret_cast<const uint8_t *>(records),used,digest,0);
  hex(digest,32,flightDigest);
  const int length=snprintf(flight.payload,sizeof(flight.payload),"{\"schema_v\":1,\"kind\":\"offline_batch\",\"device_id\":\"%s\",\"queue\":\"%s\",\"batch\":\"%s\",\"records\":%s}",deviceId,queueHex,flightDigest,records);
  if(length<=0||size_t(length)>=sizeof(flight.payload)) { error("batch serialization too large");return; }
  flightSegment=s.id;inFlight=true;retryAt=0;retryMs=5000;
}
void processReceipt() {
  Receipt receipt;
  if(xQueueReceive(receipts,&receipt,0)==pdTRUE && inFlight && !strcmp(receipt.queue,queueHex)&&!strcmp(receipt.digest,flightDigest)) {
    meta.acknowledged=flightLast;
    if(checkpoint()) { inFlight=false;xQueueReset(outgoing);if(segmentCount)refresh(segments[0]); }
  }
}
void task(void *) {
  esp_fill_random(&sessionId,sizeof(sessionId));
  recover(false);
  captureAt=flushAt=esp_timer_get_time()/1000;
  uint64_t statusAt=0;
  for(;;) {
    bool initialize=false;portENTER_CRITICAL(&mux);initialize=initRequested;initRequested=false;portEXIT_CRITICAL(&mux);
    if(initialize&&!ready)recover(true);
    anchorClock();
    if(ready) {
      Assignment a;
      if(xQueueReceive(assignments,&a,0)==pdTRUE && memcmp(meta.assignment,a.bytes,16)) {
        memcpy(meta.assignment,a.bytes,16);checkpoint();
      }
      processReceipt();
      const uint64_t now=esp_timer_get_time()/1000;
      if(now-captureAt>=kCaptureMs) { captureAt=now;capture(); }
      if(pendingCount==4 || now-flushAt>=kFlushMs)flush();
      buildBatch();
      if(inFlight && (!retryAt || uint32_t(millis()-retryAt)>=retryMs)) {
        xQueueOverwrite(outgoing,&flight);retryAt=millis();
        retryMs=min(uint32_t(60000),retryMs*2+esp_random()%500);
      }
      if(now-statusAt>=1000) { statusAt=now;publishStatus(); }
    }
#ifndef EGG_OFFLINE_HOST_TEST
    egg_diagnostics::journalTick(ready, bootAnchor);
#endif
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
bool begin(const char *id) {
  strlcpy(deviceId,id,sizeof(deviceId));
  outgoing=xQueueCreate(1,sizeof(Packet));receipts=xQueueCreate(1,sizeof(Receipt));assignments=xQueueCreate(1,sizeof(Assignment));
  return outgoing&&receipts&&assignments&&xTaskCreate(task,"egg-storage",10240,nullptr,1,nullptr)==pdPASS;
}
int64_t utcForSample(uint32_t sampledAt) {
  const int64_t anchor=clockAnchor();
  const uint64_t now=esp_timer_get_time()/1000;
  return anchor?anchor+int64_t(now-uint32_t(uint32_t(now)-sampledAt)):0;
}
void publish(PubSubClient &mqtt,const char *topic) {
  static uint32_t lastSent=0;
  if(!mqtt.connected() || millis()-lastSent<1000 || !outgoing)return;
  static Packet packet; // Only the network/main loop calls publish().
  if(xQueueReceive(outgoing,&packet,0)==pdTRUE) { lastSent=millis();mqtt.publish(topic,packet.payload,false); }
}
bool receipt(const byte *body,size_t length) {
  if(length!=8+32+1+64 || memcmp(body,"offline|",8))return false;
  Receipt r={};memcpy(r.queue,body+8,32);memcpy(r.digest,body+41,64);
  uint8_t bytes[32];if(body[40]!='|'||!unhex(r.queue,bytes,16)||!unhex(r.digest,bytes,32))return true;
  if(receipts)xQueueOverwrite(receipts,&r);return true;
}
void setAssignment(const char *value) { Assignment a;if(assignments&&unhex(value,a.bytes,16))xQueueOverwrite(assignments,&a); }
void statusJson(char *out,size_t capacity) {
  const Status s=snapshot();char oldest[32];
  if(s.oldestMs)snprintf(oldest,sizeof(oldest),"%lld",(long long)s.oldestMs);else strlcpy(oldest,"null",sizeof(oldest));
  snprintf(out,capacity,"{\"state\":\"%s\",\"queued\":%lu,\"bytes\":%lu,\"pending\":%lu,\"untimed\":%lu,\"dropped\":%llu,\"corrupt\":%llu,\"lost_first\":\"%llu\",\"lost_last\":\"%llu\",\"oldest_ms\":%s,\"error\":\"%s\"}",
    s.state,(unsigned long)s.queued,(unsigned long)s.bytes,(unsigned long)s.pending,(unsigned long)s.untimed,
    (unsigned long long)s.dropped,(unsigned long long)s.corrupt,(unsigned long long)s.lostFirst,(unsigned long long)s.lostLast,oldest,s.error);
}
bool serialCommand(const String &command) {
  if(command=="storage init ERASE-DATA") {
    portENTER_CRITICAL(&mux);initRequested=true;portEXIT_CRITICAL(&mux);
    Serial.println("Explicit initialization requested for data filesystem only. NVS and application slots are preserved.");return true;
  }
  if(command=="storage status") {
    char status[512];statusJson(status,sizeof(status));Serial.println(status);return true;
  }
  return false;
}
} // namespace egg_offline
