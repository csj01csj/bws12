"use strict";

// http://wiki.osdev.org/PCI

var
/** @const */ PCI_CONFIG_ADDRESS = 0xCF8,
/** @const */ PCI_CONFIG_DATA = 0xCFC;

/**
 * @constructor
 * @param {CPU} cpu
 */
function PCI(cpu)
{
    this.pci_addr = new Uint8Array(4);
    this.pci_value = new Uint8Array(4);
    this.pci_response = new Uint8Array(4);
    this.pci_status = new Uint8Array(4);

    this.pci_addr32 = new Int32Array(this.pci_addr.buffer);
    this.pci_value32 = new Int32Array(this.pci_value.buffer);
    this.pci_response32 = new Int32Array(this.pci_response.buffer);
    this.pci_status32 = new Int32Array(this.pci_status.buffer);

    this.device_spaces = [];
    this.devices = [];

    /** @const @type {CPU} */
    this.cpu = cpu;

    for(var i = 0; i < 256; i++)
    {
        this.device_spaces[i] = undefined;
        this.devices[i] = undefined;
    }

    this.io = cpu.io;

    cpu.io.register_write(PCI_CONFIG_DATA, this,
        function(value) { this.pci_write8(this.pci_addr32[0], value); },
        function(value) { this.pci_write16(this.pci_addr32[0], value); },
        function(value) { this.pci_write32(this.pci_addr32[0], value); });

    cpu.io.register_write(PCI_CONFIG_DATA + 1, this,
        function(value) { this.pci_write8(this.pci_addr32[0] + 1 | 0, value); });

    cpu.io.register_write(PCI_CONFIG_DATA + 2, this,
        function(value) { this.pci_write8(this.pci_addr32[0] + 2 | 0, value); },
        function(value) { this.pci_write16(this.pci_addr32[0] + 2 | 0, value); });

    cpu.io.register_write(PCI_CONFIG_DATA + 3, this,
        function(value) { this.pci_write8(this.pci_addr32[0] + 3 | 0, value); });

    cpu.io.register_read_consecutive(PCI_CONFIG_DATA, this,
        function() { return this.pci_response[0]; },
        function() { return this.pci_response[1]; },
        function() { return this.pci_response[2]; },
        function() { return this.pci_response[3]; }
    );

    cpu.io.register_read_consecutive(PCI_CONFIG_ADDRESS, this,
        function() { return this.pci_status[0]; },
        function() { return this.pci_status[1]; },
        function() { return this.pci_status[2]; },
        function() { return this.pci_status[3]; }
    );

    cpu.io.register_write_consecutive(PCI_CONFIG_ADDRESS, this,
        function(out_byte) { this.pci_addr[0] = out_byte & 0xFC; },
        function(out_byte) {
            if((this.pci_addr[1] & 0x06) === 0x02 && (out_byte & 0x06) === 0x06) { dbg_log("CPU reboot via PCI"); cpu.reboot_internal(); return; }
            this.pci_addr[1] = out_byte;
        },
        function(out_byte) { this.pci_addr[2] = out_byte; },
        function(out_byte) { this.pci_addr[3] = out_byte; this.pci_query(); }
    );

    const PAM0 = 0x10;

    var host_bridge = {
        pci_id: 0,
        pci_space: [
            0x86, 0x80, 0x37, 0x12, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, PAM0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ],
        pci_bars: [],
        name: "82441FX PMC",
    };
    this.register_device(host_bridge);

    this.isa_bridge = {
        pci_id: 1 << 3,
        pci_space: [
            0x86, 0x80, 0x00, 0x70, 0x07, 0x00, 0x00, 0x02, 0x00, 0x00, 0x01, 0x06, 0x00, 0x00, 0x80, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ],
        pci_bars: [],
        name: "82371SB PIIX3 ISA",
    };
    this.isa_bridge_space = this.register_device(this.isa_bridge);
    this.isa_bridge_space8 = new Uint8Array(this.isa_bridge_space.buffer);
}

PCI.prototype.get_state = function()
{
    var state = [];
    for(var i = 0; i < 256; i++) state[i] = this.device_spaces[i];
    state[256] = this.pci_addr;
    state[257] = this.pci_value;
    state[258] = this.pci_response;
    state[259] = this.pci_status;
    return state;
};

PCI.prototype.set_state = function(state)
{
    for(var i = 0; i < 256; i++)
    {
        var device = this.devices[i];
        var space = state[i];
        if(!device || !space) { continue; }
        for(var bar_nr = 0; bar_nr < device.pci_bars.length; bar_nr++)
        {
            var value = space[(0x10 >> 2) + bar_nr];
            if(value & 1)
            {
                var bar = device.pci_bars[bar_nr];
                var from = bar.original_bar & ~1 & 0xFFFF;
                var to = value & ~1 & 0xFFFF;
                this.set_io_bars(bar, from, to);
            }
        }
        this.device_spaces[i].set(space);
    }
    this.pci_addr.set(state[256]);
    this.pci_value.set(state[257]);
    this.pci_response.set(state[258]);
    this.pci_status.set(state[259]);
};

PCI.prototype.pci_query = function()
{
    var bdf = this.pci_addr[2] << 8 | this.pci_addr[1],
        addr = this.pci_addr[0] & 0xFC,
        dev = bdf >> 3 & 0x1F,
        enabled = this.pci_addr[3] >> 7;

    var device = this.device_spaces[bdf];

    if(device !== undefined)
    {
        this.pci_status32[0] = 0x80000000 | 0;
        this.pci_response32[0] = addr < device.byteLength ? device[addr >> 2] : 0;
        dbg_log("pci query bdf=" + h(bdf, 4) + " addr=" + h(addr, 2) + " -> " + h(this.pci_response32[0] >>> 0, 8) + " (" + this.devices[bdf].name + ")", LOG_PCI);
    }
    else
    {
        this.pci_response32[0] = -1;
        this.pci_status32[0] = 0;
    }
};

PCI.prototype.pci_write8 = function(address, written)
{
    var bdf = address >> 8 & 0xFFFF;
    var addr = address & 0xFF;
    var space = new Uint8Array(this.device_spaces[bdf].buffer);
    if(!space) return;
    dbg_log("PCI write8 dev=" + h(bdf >> 3, 2) + " addr=" + h(addr, 4) + " value=" + h(written, 2), LOG_PCI);
    space[addr] = written;
};

PCI.prototype.pci_write16 = function(address, written)
{
    dbg_assert((address & 1) === 0);
    var bdf = address >> 8 & 0xFFFF;
    var addr = address & 0xFF;
    var space = new Uint16Array(this.device_spaces[bdf].buffer);
    if(!space) return;
    if(addr >= 0x10 && addr < 0x2C) { dbg_log("Warning: PCI: Expected 32-bit write, got 16-bit"); return; }
    space[addr >>> 1] = written;
};

PCI.prototype.pci_write32 = function(address, written)
{
    dbg_assert((address & 3) === 0);
    var bdf = address >> 8 & 0xFFFF;
    var addr = address & 0xFF;
    var space = this.device_spaces[bdf];
    var device = this.devices[bdf];
    if(!space) return;

    if(addr >= 0x10 && addr < 0x28)
    {
        var bar_nr = addr - 0x10 >> 2;
        var bar = device.pci_bars[bar_nr];
        if(bar)
        {
            var space_addr = addr >> 2;
            var type = space[space_addr] & 1;
            if((written | 3 | bar.size - 1) === -1)
            {
                written = ~(bar.size - 1) | type;
                if(type === 0) space[space_addr] = written;
            }
            else
            {
                if(type === 0) space[space_addr] = bar.original_bar;
            }
            if(type === 1)
            {
                var from = space[space_addr] & ~1 & 0xFFFF;
                var to = written & ~1 & 0xFFFF;
                this.set_io_bars(bar, from, to);
                space[space_addr] = written | 1;
            }
        }
        else { space[addr >> 2] = 0; }
    }
    else if(addr === 0x30)
    {
        if(device.pci_rom_size)
        {
            if((written | 0x7FF) === (0xFFFFFFFF|0)) space[addr >> 2] = -device.pci_rom_size | 0;
            else space[addr >> 2] = device.pci_rom_address | 0;
        }
        else space[addr >> 2] = 0;
    }
    else { space[addr >>> 2] = written; }
};

PCI.prototype.register_device = function(device)
{
    dbg_assert(device.pci_id !== undefined);
    dbg_assert(device.pci_space !== undefined);
    dbg_assert(device.pci_bars !== undefined);

    var device_id = device.pci_id;
    dbg_log("PCI register bdf=" + h(device_id) + " (" + device.name + ")", LOG_PCI);
    dbg_assert(!this.devices[device_id]);
    dbg_assert(device.pci_space.length >= 64);
    dbg_assert(device_id < this.devices.length);

    var space = new Int32Array(64);
    space.set(new Int32Array(new Uint8Array(device.pci_space).buffer));
    this.device_spaces[device_id] = space;
    this.devices[device_id] = device;

    var bar_space = space.slice(4, 10);
    for(var i = 0; i < device.pci_bars.length; i++)
    {
        var bar = device.pci_bars[i];
        if(!bar) continue;
        var bar_base = bar_space[i];
        var type = bar_base & 1;
        bar.original_bar = bar_base;
        bar.entries = [];
        if(type === 1)
        {
            var port = bar_base & ~1;
            for(var j = 0; j < bar.size; j++) bar.entries[j] = this.io.ports[port + j];
        }
    }
    return space;
};

PCI.prototype.set_io_bars = function(bar, from, to)
{
    var count = bar.size;
    var ports = this.io.ports;
    for(var i = 0; i < count; i++)
    {
        var old_entry = ports[from + i];
        if(from + i >= 0x1000) ports[from + i] = this.io.create_empty_entry();
        var entry = bar.entries[i];
        var empty_entry = ports[to + i];
        dbg_assert(entry && empty_entry);
        if(to + i >= 0x1000) ports[to + i] = entry;
    }
};

PCI.prototype.raise_irq = function(pci_id)
{
    var space = this.device_spaces[pci_id];
    dbg_assert(space);
    var pin = (space[0x3C >>> 2] >> 8 & 0xFF) - 1;
    var device = (pci_id >> 3) - 1 & 0xFF;
    var parent_pin = pin + device & 3;
    var irq = this.isa_bridge_space8[0x60 + parent_pin];
    this.cpu.device_raise_irq(irq);
};

PCI.prototype.lower_irq = function(pci_id)
{
    var space = this.device_spaces[pci_id];
    dbg_assert(space);
    var pin = space[0x3C >>> 2] >> 8 & 0xFF;
    var device = pci_id >> 3 & 0xFF;
    var parent_pin = pin + device - 2 & 3;
    var irq = this.isa_bridge_space8[0x60 + parent_pin];
    this.cpu.device_lower_irq(irq);
};
