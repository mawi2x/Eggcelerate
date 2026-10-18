#pragma once
// Host adapter for storage fault injection. Production uses ESP32/LittleFS.
#include <algorithm>
#include <cassert>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <ctime>
#include <deque>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>
#include <sys/time.h>
#include <unistd.h>
#include <openssl/sha.h>
using byte=uint8_t;
using std::min;
inline size_t strlcpy(char *out,const char *in,size_t size) { size_t n=strlen(in);if(size){memcpy(out,in,min(n,size-1));out[min(n,size-1)]=0;}return n; }
class String : public std::string {
public:
  using std::string::string;
  String(const std::string &s):std::string(s){}
  int lastIndexOf(char c)const {auto at=rfind(c);return at==npos?-1:int(at);}
  String substring(size_t at)const{return substr(at);}
  bool endsWith(const char *s)const {return ends_with(s);}
};
inline uint64_t hostNow=1000000;
inline int64_t esp_timer_get_time(){return hostNow*1000;}
inline uint32_t millis(){return uint32_t(hostNow);}
inline uint32_t esp_random(){static uint32_t n=123;n=n*1664525+1013904223;return n;}
inline void esp_fill_random(void *out,size_t size){auto p=static_cast<uint8_t *>(out);while(size--)*p++=uint8_t(esp_random()>>24);}
inline int mbedtls_sha256(const uint8_t *data,size_t length,uint8_t *digest,int){return SHA256(data,length,digest)?0:-1;}
inline struct {template<class... T>void printf(const char *,T...){}void println(const char *){}}Serial;
using portMUX_TYPE=int;
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) ((void)(x))
#define portEXIT_CRITICAL(x) ((void)(x))
#define pdTRUE 1
#define pdPASS 1
#define pdMS_TO_TICKS(x) (x)
struct HostQueue{size_t width;std::deque<std::vector<uint8_t>>items;};
using QueueHandle_t=HostQueue *;
inline QueueHandle_t xQueueCreate(int,size_t width){return new HostQueue{width,{}};}
inline int xQueueOverwrite(QueueHandle_t q,const void *value){q->items.clear();auto p=static_cast<const uint8_t *>(value);q->items.emplace_back(p,p+q->width);return 1;}
inline int xQueueReceive(QueueHandle_t q,void *value,int){if(!q||q->items.empty())return 0;memcpy(value,q->items.front().data(),q->width);q->items.pop_front();return 1;}
inline void xQueueReset(QueueHandle_t q){if(q)q->items.clear();}
inline void vTaskDelay(int){}
inline int xTaskCreate(void (*)(void *),const char *,int,void *,int,void *){return 1;}
struct esp_partition_t{size_t size;};
constexpr int ESP_PARTITION_TYPE_DATA=1,ESP_PARTITION_SUBTYPE_ANY=255;
inline const esp_partition_t *esp_partition_find_first(int,int,const char *){static esp_partition_t p{0x160000};return &p;}
inline std::filesystem::path hostRoot;
inline bool hostFormatted=false;
inline int hostFormatCount=0;
inline int64_t hostNextWrite=-1;
#define FILE_READ "r"
#define FILE_WRITE "w"
#define FILE_APPEND "a"
class File{
  std::filesystem::path path_;
  std::shared_ptr<FILE>file_;
  std::vector<std::filesystem::path>entries_;
  size_t entry_=0;
  std::string name_;
public:
  File()=default;
  File(const std::filesystem::path &path,const char *mode):path_(path),name_(path.filename().string()){
    if(std::filesystem::is_directory(path)){for(auto &p:std::filesystem::directory_iterator(path))entries_.push_back(p.path());}
    else file_=std::shared_ptr<FILE>(fopen(path.c_str(),mode),[](FILE *f){if(f)fclose(f);});
  }
  explicit operator bool()const{return bool(file_)||std::filesystem::is_directory(path_);}
  File openNextFile(){return entry_<entries_.size()?File(entries_[entry_++],"r"):File();}
  const char *name()const{return name_.c_str();}
  size_t size()const{return std::filesystem::is_regular_file(path_)?std::filesystem::file_size(path_):0;}
  size_t read(uint8_t *out,size_t n){return file_?fread(out,1,n,file_.get()):0;}
  size_t write(const uint8_t *in,size_t n){if(!file_)return 0;if(hostNextWrite>=0){n=min(n,size_t(hostNextWrite));hostNextWrite=-1;}return fwrite(in,1,n,file_.get());}
  bool seek(size_t n){return file_&&fseek(file_.get(),n,SEEK_SET)==0;}
  void flush(){if(file_)fflush(file_.get());}
  void close(){file_.reset();}
};
inline struct HostFS{
  bool begin(bool,const char *,int,const char *){return hostFormatted;}
  bool format(){++hostFormatCount;std::filesystem::remove_all(hostRoot);std::filesystem::create_directories(hostRoot);return hostFormatted=true;}
  bool exists(const char *p){return std::filesystem::exists(hostRoot/(p+1));}
  bool mkdir(const char *p){return std::filesystem::create_directory(hostRoot/(p+1));}
  File open(const char *p,const char *mode="r"){return File(hostRoot/(p+1),mode);}
  bool remove(const char *p){return std::filesystem::remove(hostRoot/(p+1));}
  size_t totalBytes(){return 0x160000;}
  size_t usedBytes(){size_t n=0;for(auto &p:std::filesystem::recursive_directory_iterator(hostRoot))if(p.is_regular_file())n+=p.file_size();return n;}
}LittleFS;
class PubSubClient{public:bool connected(){return true;}bool publish(const char *,const char *,bool){return true;}};
namespace egg_climate{
struct Snapshot{bool valid=true;uint32_t sampledAt=0;float temperature=37.6,humidity=57;};
inline Snapshot state;
inline Snapshot snapshot(){return state;}
}
