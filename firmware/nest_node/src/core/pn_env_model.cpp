#include "pn_env_model.h"
#include <math.h>
#include "pn_env_weights.h"

namespace pn {

float env_model_predict(const EnvFeatures& f) {
  const float x[3] = {(f.T_C - PN_ENV_MU[0]) / PN_ENV_SD[0],
                      (f.RH_pct - PN_ENV_MU[1]) / PN_ENV_SD[1],
                      (f.d5_T_K - PN_ENV_MU[2]) / PN_ENV_SD[2]};
  float h1[32], h2[16], o[2];
  for (int j = 0; j < 32; ++j) {
    float s = PN_ENV_B0[j];
    for (int i = 0; i < 3; ++i) s += PN_ENV_W0[j * 3 + i] * x[i];
    h1[j] = s > 0 ? s : 0;
  }
  for (int j = 0; j < 16; ++j) {
    float s = PN_ENV_B1[j];
    for (int i = 0; i < 32; ++i) s += PN_ENV_W1[j * 32 + i] * h1[i];
    h2[j] = s > 0 ? s : 0;
  }
  for (int j = 0; j < 2; ++j) {
    float s = PN_ENV_B2[j];
    for (int i = 0; i < 16; ++i) s += PN_ENV_W2[j * 16 + i] * h2[i];
    o[j] = s;
  }
  const float m = o[0] > o[1] ? o[0] : o[1];
  const float e0 = expf(o[0] - m), e1 = expf(o[1] - m);
  return e1 / (e0 + e1);
}

void EnvHistory::push_minute(float T_C) {
  buf_[head_] = T_C; head_ = (head_ + 1) % 6; if (n_ < 6) ++n_;
}

float EnvHistory::d5() const {
  if (n_ < 6) return 0.0f;
  const float now = buf_[(head_ + 5) % 6];   // most recent
  const float old = buf_[head_];             // 5 minutes earlier
  return now - old;
}

}  // namespace pn
