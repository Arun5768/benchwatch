#pragma once
#include <math.h>
struct DynamicRms {
  double sum[3] = {0,0,0};
  double square[3] = {0,0,0};
  unsigned int count = 0;
  void add(double x, double y, double z) {
    const double v[3] = {x,y,z};
    for (int i=0;i<3;i++) { sum[i]+=v[i]; square[i]+=v[i]*v[i]; }
    count++;
  }
  double value() const {
    if (!count) return 0;
    double variance=0;
    for(int i=0;i<3;i++){ double mean=sum[i]/count; double v=square[i]/count-mean*mean; variance+=v>0?v:0; }
    return sqrt(variance);
  }
};
