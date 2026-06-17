"use strict";

/** @const */
var SHIFT_SCAN_CODE = 0x2A;

/** @const */
var SCAN_CODE_RELEASE = 0x80;

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function KeyboardAdapter(bus)
{
    /** @type {boolean} */
    var in_focus = false;

    var keyboard = this;

    bus.register("keyboard-listen", function() {
        in_focus = true;
    }, this);

    bus.register("keyboard-unlisten", function() {
        in_focus = false;
    }, this);

    this.destroy = function() {
        if(typeof window !== "undefined") {
            window.removeEventListener("keydown", keydown_handler, true);
            window.removeEventListener("keyup", keyup_handler, true);
        }
    };

    if(typeof window !== "undefined") {
        window.addEventListener("keydown", keydown_handler, true);
        window.addEventListener("keyup", keyup_handler, true);
    }

    function keydown_handler(e)
    {
        if(in_focus)
        {
            var ret = keyboard.key_down(e);

            if(!ret)
            {
                if(e.stopPropagation) e.stopPropagation();
                e.preventDefault();
                return false;
            }
        }
    }

    function keyup_handler(e)
    {
        if(in_focus)
        {
            var ret = keyboard.key_up(e);

            if(!ret)
            {
                if(e.stopPropagation) e.stopPropagation();
                e.preventDefault();
                return false;
            }
        }
    }

    this.bus = bus;
}

var keyboard_code_table = new Uint16Array(256);

keyboard_code_table[8] = 0xE;
keyboard_code_table[9] = 0xF;
keyboard_code_table[13] = 0x1C;
keyboard_code_table[16] = 0x2A;
keyboard_code_table[17] = 0x1D;
keyboard_code_table[18] = 0x38;
keyboard_code_table[19] = 0x45;
keyboard_code_table[20] = 0x3A;
keyboard_code_table[27] = 0x1;
keyboard_code_table[32] = 0x39;
keyboard_code_table[33] = 0xE049;
keyboard_code_table[34] = 0xE051;
keyboard_code_table[35] = 0xE04F;
keyboard_code_table[36] = 0xE047;
keyboard_code_table[37] = 0xE04B;
keyboard_code_table[38] = 0xE048;
keyboard_code_table[39] = 0xE04D;
keyboard_code_table[40] = 0xE050;
keyboard_code_table[45] = 0xE052;
keyboard_code_table[46] = 0xE053;
keyboard_code_table[48] = 0xB;
keyboard_code_table[49] = 0x2;
keyboard_code_table[50] = 0x3;
keyboard_code_table[51] = 0x4;
keyboard_code_table[52] = 0x5;
keyboard_code_table[53] = 0x6;
keyboard_code_table[54] = 0x7;
keyboard_code_table[55] = 0x8;
keyboard_code_table[56] = 0x9;
keyboard_code_table[57] = 0xA;
keyboard_code_table[65] = 0x1E;
keyboard_code_table[66] = 0x30;
keyboard_code_table[67] = 0x2E;
keyboard_code_table[68] = 0x20;
keyboard_code_table[69] = 0x12;
keyboard_code_table[70] = 0x21;
keyboard_code_table[71] = 0x22;
keyboard_code_table[72] = 0x23;
keyboard_code_table[73] = 0x17;
keyboard_code_table[74] = 0x24;
keyboard_code_table[75] = 0x25;
keyboard_code_table[76] = 0x26;
keyboard_code_table[77] = 0x32;
keyboard_code_table[78] = 0x31;
keyboard_code_table[79] = 0x18;
keyboard_code_table[80] = 0x19;
keyboard_code_table[81] = 0x10;
keyboard_code_table[82] = 0x13;
keyboard_code_table[83] = 0x1F;
keyboard_code_table[84] = 0x14;
keyboard_code_table[85] = 0x16;
keyboard_code_table[86] = 0x2F;
keyboard_code_table[87] = 0x11;
keyboard_code_table[88] = 0x2D;
keyboard_code_table[89] = 0x15;
keyboard_code_table[90] = 0x2C;
keyboard_code_table[91] = 0xE05B;
keyboard_code_table[93] = 0xE05D;
keyboard_code_table[96] = 0x52;
keyboard_code_table[97] = 0x4F;
keyboard_code_table[98] = 0x50;
keyboard_code_table[99] = 0x51;
keyboard_code_table[100] = 0x4B;
keyboard_code_table[101] = 0x4C;
keyboard_code_table[102] = 0x4D;
keyboard_code_table[103] = 0x47;
keyboard_code_table[104] = 0x48;
keyboard_code_table[105] = 0x49;
keyboard_code_table[106] = 0x37;
keyboard_code_table[107] = 0x4E;
keyboard_code_table[109] = 0x4A;
keyboard_code_table[110] = 0x53;
keyboard_code_table[111] = 0xE035;
keyboard_code_table[112] = 0x3B;
keyboard_code_table[113] = 0x3C;
keyboard_code_table[114] = 0x3D;
keyboard_code_table[115] = 0x3E;
keyboard_code_table[116] = 0x3F;
keyboard_code_table[117] = 0x40;
keyboard_code_table[118] = 0x41;
keyboard_code_table[119] = 0x42;
keyboard_code_table[120] = 0x43;
keyboard_code_table[121] = 0x44;
keyboard_code_table[122] = 0x57;
keyboard_code_table[123] = 0x58;
keyboard_code_table[124] = 0x37 | 0x100;  // snapshot / print screen
keyboard_code_table[144] = 0x45;
keyboard_code_table[145] = 0x46;
keyboard_code_table[186] = 0x27;
keyboard_code_table[187] = 0xD;
keyboard_code_table[188] = 0x33;
keyboard_code_table[189] = 0xC;
keyboard_code_table[190] = 0x34;
keyboard_code_table[191] = 0x35;
keyboard_code_table[192] = 0x29;
keyboard_code_table[219] = 0x1A;
keyboard_code_table[220] = 0x2B;
keyboard_code_table[221] = 0x1B;
keyboard_code_table[222] = 0x28;

// Added mappings for Firefox on Mac, which uses 224 instead of 91
// for the left command key
keyboard_code_table[224] = 0xE05B;

var keyboard_key_table = new Uint16Array(256);

keyboard_key_table["ShiftLeft".charCodeAt(0)] = 0x2A;
keyboard_key_table["ShiftRight".charCodeAt(0)] = 0x36;
keyboard_key_table["ControlLeft".charCodeAt(0)] = 0x1D;
keyboard_key_table["ControlRight".charCodeAt(0)] = 0xE01D;
keyboard_key_table["AltLeft".charCodeAt(0)] = 0x38;
keyboard_key_table["AltRight".charCodeAt(0)] = 0xE038;
keyboard_key_table["MetaLeft".charCodeAt(0)] = 0xE05B;
keyboard_key_table["MetaRight".charCodeAt(0)] = 0xE05C;

/**
 * @param {KeyboardEvent} e
 */
KeyboardAdapter.prototype.key_down = function(e)
{
    var code = this.get_scan_code(e);

    if(code)
    {
        this.bus.send("keyboard-code", code);
        return false;
    }
    else
    {
        return true;
    }
};

/**
 * @param {KeyboardEvent} e
 */
KeyboardAdapter.prototype.key_up = function(e)
{
    var code = this.get_scan_code(e);

    if(code)
    {
        if(code > 0xFF)
        {
            this.bus.send("keyboard-code", code >> 8 | SCAN_CODE_RELEASE << 8);
        }

        this.bus.send("keyboard-code", (code & 0xFF) | SCAN_CODE_RELEASE);
        return false;
    }
    else
    {
        return true;
    }
};

/**
 * @param {KeyboardEvent} e
 * @return {number}
 */
KeyboardAdapter.prototype.get_scan_code = function(e)
{
    var key = e["code"];
    var code;

    // Try to identify by key code
    if(key)
    {
        // Try the specific left/right keys first
        if(key === "ShiftLeft") return keyboard_key_table["ShiftLeft".charCodeAt(0)];
        if(key === "ShiftRight") return keyboard_key_table["ShiftRight".charCodeAt(0)];
        if(key === "ControlLeft") return keyboard_key_table["ControlLeft".charCodeAt(0)];
        if(key === "ControlRight") return keyboard_key_table["ControlRight".charCodeAt(0)];
        if(key === "AltLeft") return keyboard_key_table["AltLeft".charCodeAt(0)];
        if(key === "AltRight") return keyboard_key_table["AltRight".charCodeAt(0)];
        if(key === "MetaLeft") return keyboard_key_table["MetaLeft".charCodeAt(0)];
        if(key === "MetaRight") return keyboard_key_table["MetaRight".charCodeAt(0)];
    }

    code = keyboard_code_table[e.keyCode];

    if(code)
    {
        return code;
    }
    else
    {
        dbg_log("Missing scan code for keyCode=" + e.keyCode + " key=" + e.key);
        return 0;
    }
};

/**
 * Sends a sequence of scan codes corresponding to the given character sequence.
 * @param {string} sequence
 */
KeyboardAdapter.prototype.simulate_press = function(sequence)
{
    var i = 0;

    var do_key = function()
    {
        if(i < sequence.length)
        {
            var chr = sequence.charCodeAt(i++);
            var code = keyboard_code_table[chr];

            if(code)
            {
                var needs_shift = sequence[i - 1] !== sequence[i - 1].toLowerCase();

                if(needs_shift)
                {
                    this.bus.send("keyboard-code", SHIFT_SCAN_CODE);
                }

                this.bus.send("keyboard-code", code);

                if(code > 0xFF)
                {
                    this.bus.send("keyboard-code", (code >> 8) | SCAN_CODE_RELEASE);
                }

                this.bus.send("keyboard-code", (code & 0xFF) | SCAN_CODE_RELEASE);

                if(needs_shift)
                {
                    this.bus.send("keyboard-code", SHIFT_SCAN_CODE | SCAN_CODE_RELEASE);
                }
            }

            setTimeout(do_key, 10);
        }
    }.bind(this);

    do_key();
};
