#pragma once
#include <algorithm>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <map>
#include <memory>
#include <string>
#include <vector>
using String=std::string;
using portMUX_TYPE=int;
#define portMUX_INITIALIZER_UNLOCKED 0
inline void portENTER_CRITICAL(int*){}
inline void portEXIT_CRITICAL(int*){}
inline uint32_t hostNow=1000;
inline uint32_t millis(){return hostNow;}
inline int64_t esp_timer_get_time(){return int64_t(hostNow)*1000;}
inline void esp_fill_random(void*p,size_t n){memset(p,42,n);}
constexpr int pdTRUE=1;
struct HostQueue{size_t length,size;std::deque<std::vector<uint8_t>> records;};
using QueueHandle_t=HostQueue*;
inline QueueHandle_t xQueueCreate(size_t n,size_t s){return new HostQueue{n,s,{}};}
inline int xQueueSend(QueueHandle_t q,const void*p,int){if(q->records.size()>=q->length)return 0;q->records.emplace_back((const uint8_t*)p,(const uint8_t*)p+q->size);return 1;}
inline int xQueueReceive(QueueHandle_t q,void*p,int){if(q->records.empty())return 0;memcpy(p,q->records.front().data(),q->size);q->records.pop_front();return 1;}
struct HostSerial {
 std::vector<std::string> lines;
 void println(const char*s){lines.emplace_back(s);}
 void printf(const char*f,...){char s[2048];va_list a;va_start(a,f);vsnprintf(s,sizeof(s),f,a);va_end(a);lines.emplace_back(s);}
};
inline HostSerial Serial;
using Bytes=std::vector<uint8_t>;
struct File {
 std::shared_ptr<Bytes> data;size_t cursor=0;bool writable=false;
 explicit operator bool()const{return bool(data);}
 size_t size()const{return data?data->size():0;}
 size_t read(uint8_t*p,size_t n){if(!data)return 0;n=std::min(n,data->size()-cursor);memcpy(p,data->data()+cursor,n);cursor+=n;return n;}
 size_t write(const uint8_t*p,size_t n){if(!data||!writable)return 0;data->insert(data->end(),p,p+n);return n;}
 void close(){data.reset();}void flush(){}
};
constexpr const char* FILE_READ="r";constexpr const char* FILE_APPEND="a";
struct HostFS {
 std::map<std::string,std::shared_ptr<Bytes>> files;
 bool exists(const char*p){return files.count(p);}
 bool mkdir(const char*){return true;}
 bool remove(const char*p){return files.erase(p);}
 bool rename(const char*a,const char*b){auto it=files.find(a);if(it==files.end())return false;files[b]=it->second;files.erase(it);return true;}
 size_t totalBytes(){return 1024*1024;}size_t usedBytes(){size_t n=0;for(auto&p:files)n+=p.second->size();return n;}
 File open(const char*p,const char*mode){if(!strcmp(mode,FILE_APPEND)){if(!files.count(p))files[p]=std::make_shared<Bytes>();return File{files[p],0,true};}
  auto it=files.find(p);return it==files.end()?File{}:File{it->second,0,false};}
};
inline HostFS LittleFS;
