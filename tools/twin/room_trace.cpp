// Produces a per-slot decision trace with the firmware's NodeLogic and the room
// profile (CH1 lights, CH2 fans, CH3 AC). Used to (a) feed the room twin's Replay
// mode and (b) check that the twin's JavaScript port makes identical decisions.
// Input CSV (header skipped): t_s,slot_active,Tz,RH,occ_true,Tamb
// Output CSV: t_s,act,occ,n,O_milli,s0,s1,s2,W0_milli,W1_milli,W2_milli,tau0,tau1,tau2,e0,e1,e2
#include <cstdio>
#include "../../firmware/nest_node/src/core/pn_node.h"
using namespace pn;

int main(int argc, char** argv) {
  if (argc < 2) { fprintf(stderr, "usage: room_trace input.csv > trace.csv\n"); return 2; }
  FILE* f = fopen(argv[1], "r");
  if (!f) { perror("open"); return 2; }
  char line[256];
  if (!fgets(line, sizeof line, f)) { fclose(f); return 2; }
  Config c = room_profile_config();
  NodeLogic node(c);
  bool first = true;
  double t_s; int act, occ; float Tz, RH, Tamb;
  printf("t_s,act,occ,n,O_milli,s0,s1,s2,W0_milli,W1_milli,W2_milli,tau0,tau1,tau2,e0,e1,e2\n");
  while (fscanf(f, "%lf,%d,%f,%f,%d,%f", &t_s, &act, &Tz, &RH, &occ, &Tamb) == 6) {
    const uint64_t t = static_cast<uint64_t>(t_s * 1000.0);
    if (first) { node.reset(t - 10000); first = false; }
    SlotInputs in; in.t_ms = t; in.slot_active = act != 0;
    in.Tz = Reading(Tz, t, true); in.RH = Reading(RH, t, true);
    SlotOutputs o = node.step(in);
    printf("%.0f,%d,%d,%d,%d", t_s, act, occ, o.active_slots, static_cast<int>(o.O * 1000.0f + 0.5f));
    for (int i = 0; i < 3; ++i) printf(",%d", static_cast<int>(o.load[i].state));
    for (int i = 0; i < 3; ++i) printf(",%d", static_cast<int>(o.load[i].W * 1000.0f + 0.5f));
    for (int i = 0; i < 3; ++i) printf(",%.0f", o.load[i].tau_u_s);
    for (int i = 0; i < 3; ++i) printf(",%d", static_cast<int>(o.load[i].event));
    printf("\n");
  }
  fclose(f);
  return 0;
}
