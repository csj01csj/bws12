"use strict";


var HPET_ADDR = 0xFED00000,
    HPET_PERIOD = 0x05F5E100, // in nano seconds
    HPET_FREQ_MS = 1e12 / HPET_PERIOD, // in kHZ
    HPET_SUPPORT_64 = 0,
    HPET_COUNTER_CONFIG = 1 << 4 | HPET_SUPPORT_64 << 5,
    HPET_COUNTER_CONFIG_MASK = 1 << 4 | 1 << 5 | 1 << 15,
    HPET_NUM_COUNTERS = 4;
