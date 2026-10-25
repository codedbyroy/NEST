"""Synthetic PIR slot model shared by the simulation suite and the room twin.
ALL events produced here are synthetic; the dataset has no PIR channel."""
import numpy as np

SLOTS_PER_MIN = 6
DEFAULT_PIR = dict(p_move=0.6, f_still=0.3, bout_min=10.0, p_still=0.02, p_fa=0.0005)


def synth_pir(occ_min, seed, p_move, f_still, bout_min, p_still, p_fa):
    """Slot activity from minute labels. Occupied time alternates between 'moving'
    and 'still' bouts (geometric, mean bout_min minutes; long-run still fraction
    f_still). Slot active prob: p_move (moving), p_still (still), p_fa (vacant).
    The HC-SR501 hold time is assumed shorter than one 10 s slot."""
    rng = np.random.default_rng(seed)
    n = len(occ_min)
    still = np.zeros(n, dtype=bool)
    if f_still > 0:
        p_leave_still = 1.0 / bout_min
        p_enter_still = p_leave_still * f_still / max(1e-9, 1.0 - f_still)
        s = rng.random() < f_still
        for i in range(n):
            if occ_min[i]:
                s = (rng.random() >= p_leave_still) if s else (rng.random() < p_enter_still)
            else:
                s = False
            still[i] = s
    occ_s = np.repeat(occ_min, SLOTS_PER_MIN).astype(bool)
    still_s = np.repeat(still, SLOTS_PER_MIN)
    p = np.where(occ_s, np.where(still_s, p_still, p_move), p_fa)
    return (rng.random(len(p)) < p).astype(int)
