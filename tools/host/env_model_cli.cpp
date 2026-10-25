// Host CLI: reads "T,RH,d5T" lines on stdin, prints p_env from the firmware's C model.
#include <cstdio>
#include "../../firmware/nest_node/src/core/pn_env_model.h"
int main() {
  float T, RH, d;
  while (std::scanf("%f,%f,%f", &T, &RH, &d) == 3)
    std::printf("%.9g\n", pn::env_model_predict({T, RH, d}));
  return 0;
}
