// Optional environmental occupancy model (FP32 MLP 3-32-16-2, plain C++).
// Disabled by default (Config::beta = 0). It was trained on a public office dataset,
// not on this node's room; enable only after retraining on room data.
#pragma once
#include <stdint.h>

namespace pn {

struct EnvFeatures {
  float T_C;     // zone temperature, degC
  float RH_pct;  // relative humidity, %
  float d5_T_K;  // T(now) - T(5 min ago), K
};

// Returns p_env in [0, 1] (softmax probability of "occupied").
float env_model_predict(const EnvFeatures& x);

// 5-minute temperature history at 1-minute cadence for the d5_T feature.
class EnvHistory {
 public:
  void push_minute(float T_C);
  bool ready() const { return n_ >= 6; }
  float d5() const;
 private:
  float buf_[6] = {0};
  int n_ = 0, head_ = 0;
};

}  // namespace pn
