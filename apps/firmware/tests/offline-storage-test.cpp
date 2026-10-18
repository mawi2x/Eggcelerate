#define EGG_OFFLINE_HOST_TEST
#include "../Eggcelerate/OfflineStorage.h"
#include <iostream>
using namespace egg_offline;

void reboot(uint64_t id) {
  ready=false;meta=Metadata{};segmentCount=0;pendingCount=0;
  inFlight=false;bootAnchor=publishedAnchor=0;sessionId=id;
  xQueueReset(outgoing);xQueueReset(receipts);
  assert(recover(false));
}
void sample() {
  hostNow+=15000;egg_climate::state.sampledAt=millis()-100;
  capture();
}
void ackCurrent() {
  Receipt r={};strlcpy(r.queue,queueHex,sizeof(r.queue));strlcpy(r.digest,flightDigest,sizeof(r.digest));
  xQueueOverwrite(receipts,&r);processReceipt();
}
int main(int argc,char **argv) {
  char directory[]="/tmp/egg-offline-host-XXXXXX";
  hostRoot=mkdtemp(directory);
  assert(begin("EGG-HOST"));sessionId=1;
  assert(!recover(false));assert(hostFormatCount==0);
  assert(utcForSample(millis()-100)>0); // Live timestamps never depend on storage readiness.
  assert(recover(true));assert(hostFormatCount==1);
  uint8_t assignmentBytes[16];memset(assignmentBytes,0x12,sizeof(assignmentBytes));
  memcpy(meta.assignment,assignmentBytes,16);assert(checkpoint());
  bootAnchor=1760000000000;publishedAnchor=bootAnchor;
  for(int i=0;i<4;++i)sample();
  assert(pendingCount==4);flush();assert(ready&&pendingCount==0);
  publishStatus();assert(snapshot().queued==4);
  Record first;assert(readRecord(segments[0],0,first));assert(validRecord(first));
  assert(first.monotonicMs==hostNow-45000-100);
  assert(first.utcMs==bootAnchor+int64_t(first.monotonicMs));
  const uint64_t reserved=meta.reservedThrough;
  buildBatch();assert(inFlight);std::string payload=flight.payload;
  Receipt wrong={};strlcpy(wrong.queue,queueHex,sizeof(wrong.queue));memset(wrong.digest,'0',64);
  xQueueOverwrite(receipts,&wrong);processReceipt();assert(meta.acknowledged==0&&inFlight);
  reboot(2);assert(nextSequence>reserved);assert(snapshot().queued==4);
  buildBatch();assert(std::string(flight.payload)==payload); // Lost receipt => identical replay.
  if(argc>1){FILE *f=fopen(argv[1],"w");assert(f);fputs(flight.payload,f);fclose(f);}
  ackCurrent();assert(!inFlight);publishStatus();assert(snapshot().queued==0);
  reboot(3);publishStatus();assert(snapshot().queued==0); // ACK durable before cleanup.
  buildBatch();assert(segmentCount==0);

  // Unknown UTC survives a restart without being fabricated.
  sample();flush();assert(segmentCount==1);
  Record untimed;assert(readRecord(segments[0],0,untimed));assert(!observed(segments[0],untimed));
  reboot(4);assert(!observed(segments[0],untimed));assert(snapshot().untimed==1);

  // A partial flash append leaves earlier committed records recoverable.
  sample();flush(); // New session gets its own segment.
  sample();hostNextWrite=20;flush();assert(!ready);
  reboot(5);assert(snapshot().queued==2);assert(snapshot().corrupt==1);
  const auto before=meta.reservedThrough;
  sample();assert(pending[0].sequence>before-1024); // Reserved high water survives restart.
  flush();assert(ready&&snapshot().queued>=2);

  // Timer reconstruction remains correct beyond the 32-bit millis wrap.
  hostNow=uint64_t(UINT32_MAX)+50000;bootAnchor=1760000000000;publishedAnchor=bootAnchor;
  sample();assert(pending[0].monotonicMs==hostNow-100);
  assert(utcForSample(egg_climate::state.sampledAt)==pending[0].utcMs);
  flush();

  // Fill the bounded segment directory. Even a pinned unacknowledged batch
  // cannot turn overflow into an unbounded wait or delete a newer batch via ACK.
  reboot(6);bootAnchor=1760000000000;
  while(segmentCount<kMaxSegments) { assert(newSegment());sample();flush(); }
  buildBatch();assert(inFlight);const uint32_t evicted=flightSegment;
  Receipt old={};strlcpy(old.queue,queueHex,sizeof(old.queue));strlcpy(old.digest,flightDigest,sizeof(old.digest));
  assert(newSegment());assert(segmentCount==kMaxSegments);assert(!inFlight);
  assert(meta.dropped>0);assert(segments[0].id!=evicted);
  const uint64_t accepted=meta.acknowledged;
  xQueueOverwrite(receipts,&old);processReceipt();assert(meta.acknowledged==accepted);
  reboot(7);assert(segmentCount==kMaxSegments);assert(meta.dropped>0);

  // A torn metadata update never causes the previous valid checkpoint to vanish.
  const uint64_t revision=meta.revision;
  hostNextWrite=8;assert(!checkpoint());assert(!ready);
  reboot(8);assert(meta.revision==revision);
  std::filesystem::remove_all(hostRoot);
  delete outgoing;delete receipts;delete assignments;
  std::cout<<"offline storage: initialization, replay, committed ACK, restart, partial append, clock, overflow, stale ACK and torn metadata passed\n";
}
