#include <cassert>
#include <cmath>
#include "../firmware/benchwatch/features.h"
int main(){
 DynamicRms empty; assert(empty.value()==0);
 DynamicRms still; for(int i=0;i<256;i++)still.add(0,0,9.81); assert(still.value()<0.00001);
 DynamicRms wave; for(int i=0;i<256;i++)wave.add(i%2?2:-2,0,9.81); assert(std::abs(wave.value()-2)<0.00001);
 DynamicRms axes; axes.add(-1,-2,8.81); axes.add(1,2,10.81); assert(std::abs(axes.value()-std::sqrt(6.0))<0.00001);
}
