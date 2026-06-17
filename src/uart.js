"use strict";

/*
 * Serial ports
 * http://wiki.osdev.org/UART
 */

/** @const */
var DLAB = 0x80;

/** @const */ var UART_IER_MSI  = 0x08;
/** @const */ var UART_IER_THRI = 0x02;
/** @const */ var UART_IER_RDI = 0x01;

/** @const */var UART_IIR_MSI = 0x00;
/** @const */var UART_IIR_NO_INT = 0x01;
/** @const */var UART_IIR_THRI = 0x02;
/** @const */var UART_IIR_RDI = 0x04;
/** @const */var UART_IIR_RLSI = 0x06;
/** @const */var UART_IIR_CTI = 0x0c;

/** @const */ var UART_LSR_DATA_READY        = 0x1;
/** @const */ var UART_LSR_TX_EMPTY        = 0x20;
/** @const */ var UART_LSR_TRANSMITTER_EMPTY = 0x40;


/**
 * @constructor
 * @param {CPU} cpu
 * @param {number} port
 * @param {BusConnector} bus
 */
function UART(cpu, port, bus)
{
    /** @const @type {BusConnector} */
    this.bus = bus;

    /** @const @type {CPU} */
    this.cpu = cpu;

    this.ints = 1 << UART_IIR_THRI;
    this.baud_rate = 0;
    this.line_control = 0;
    this.lsr = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY;
    this.fifo_control = 0;
    this.ier = 0;
    this.iir = UART_IIR_NO_INT;
    this.modem_control = 0;
    this.modem_status = 0;
    this.scratch_register = 0;
    this.irq = 0;
    this.input = new ByteQueue(4096);
    this.current_line = [];

    switch(port)
    {
        case 0x3F8: this.com = 0; this.irq = 4; break;
        case 0x2F8: this.com = 1; this.irq = 3; break;
        case 0x3E8: this.com = 2; this.irq = 4; break;
        case 0x2E8: this.com = 3; this.irq = 3; break;
        default:
            dbg_log("Invalid serial port: " + h(port), LOG_SERIAL);
            this.com = 0; this.irq = 4;
    }

    this.bus.register("serial" + this.com + "-input", function(data) { this.data_received(data); }, this);

    var io = cpu.io;

    io.register_write(port, this, function(out_byte) { this.write_data(out_byte); },
        function(out_word) { this.write_data(out_word & 0xFF); this.write_data(out_word >> 8); });

    io.register_write(port | 1, this, function(out_byte) {
        if(this.line_control & DLAB) { this.baud_rate = this.baud_rate & 0xFF | out_byte << 8; }
        else {
            if((this.ier & UART_IIR_THRI) === 0 && (out_byte & UART_IIR_THRI)) this.ThrowInterrupt(UART_IIR_THRI);
            this.ier = out_byte & 0xF;
            this.CheckInterrupt();
        }
    });

    io.register_read(port, this, function() {
        if(this.line_control & DLAB) return this.baud_rate & 0xFF;
        var data = this.input.shift();
        if(this.input.length === 0) { this.lsr &= ~UART_LSR_DATA_READY; this.ClearInterrupt(UART_IIR_CTI); this.ClearInterrupt(UART_IIR_RDI); }
        return data;
    });

    io.register_read(port | 1, this, function() {
        if(this.line_control & DLAB) return this.baud_rate >> 8;
        return this.ier & 0xF;
    });

    io.register_read(port | 2, this, function() {
        var ret = this.iir & 0xF;
        if(this.iir == UART_IIR_THRI) this.ClearInterrupt(UART_IIR_THRI);
        if(this.fifo_control & 1) ret |= 0xC0;
        return ret;
    });
    io.register_write(port | 2, this, function(out_byte) { this.fifo_control = out_byte; });

    io.register_read(port | 3, this, function() { return this.line_control; });
    io.register_write(port | 3, this, function(out_byte) { this.line_control = out_byte; });

    io.register_read(port | 4, this, function() { return this.modem_control; });
    io.register_write(port | 4, this, function(out_byte) { this.modem_control = out_byte; });

    io.register_read(port | 5, this, function() { return this.lsr; });
    io.register_write(port | 5, this, function(out_byte) {});

    io.register_read(port | 6, this, function() { return this.modem_status; });
    io.register_write(port | 6, this, function(out_byte) {});

    io.register_read(port | 7, this, function() { return this.scratch_register; });
    io.register_write(port | 7, this, function(out_byte) { this.scratch_register = out_byte; });
}

UART.prototype.get_state = function()
{
    var state = [];
    state[0] = this.ints; state[1] = this.baud_rate; state[2] = this.line_control;
    state[3] = this.lsr; state[4] = this.fifo_control; state[5] = this.ier;
    state[6] = this.iir; state[7] = this.modem_control; state[8] = this.modem_status;
    state[9] = this.scratch_register; state[10] = this.irq;
    return state;
};

UART.prototype.set_state = function(state)
{
    this.ints = state[0]; this.baud_rate = state[1]; this.line_control = state[2];
    this.lsr = state[3]; this.fifo_control = state[4]; this.ier = state[5];
    this.iir = state[6]; this.modem_control = state[7]; this.modem_status = state[8];
    this.scratch_register = state[9]; this.irq = state[10];
};

UART.prototype.CheckInterrupt = function() {
    if((this.ints & (1 << UART_IIR_CTI)) && (this.ier & UART_IER_RDI)) { this.iir = UART_IIR_CTI; this.cpu.device_raise_irq(this.irq); }
    else if((this.ints & (1 << UART_IIR_RDI)) && (this.ier & UART_IER_RDI)) { this.iir = UART_IIR_RDI; this.cpu.device_raise_irq(this.irq); }
    else if((this.ints & (1 << UART_IIR_THRI)) && (this.ier & UART_IER_THRI)) { this.iir = UART_IIR_THRI; this.cpu.device_raise_irq(this.irq); }
    else if((this.ints & (1 << UART_IIR_MSI)) && (this.ier & UART_IER_MSI)) { this.iir = UART_IIR_MSI; this.cpu.device_raise_irq(this.irq); }
    else { this.iir = UART_IIR_NO_INT; this.cpu.device_lower_irq(this.irq); }
};

UART.prototype.ThrowInterrupt = function(line) { this.ints |= (1 << line); this.CheckInterrupt(); };
UART.prototype.ClearInterrupt = function(line) { this.ints &= ~(1 << line); this.CheckInterrupt(); };

UART.prototype.data_received = function(data)
{
    this.input.push(data);
    this.lsr |= UART_LSR_DATA_READY;
    if(this.fifo_control & 1) this.ThrowInterrupt(UART_IIR_CTI);
    else this.ThrowInterrupt(UART_IIR_RDI);
};

UART.prototype.write_data = function(out_byte)
{
    if(this.line_control & DLAB) { this.baud_rate = this.baud_rate & ~0xFF | out_byte; return; }

    this.ThrowInterrupt(UART_IIR_THRI);
    if(out_byte === 0xFF) return;

    var char = String.fromCharCode(out_byte);
    this.bus.send("serial" + this.com + "-output-char", char);
    this.current_line.push(out_byte);

    if(char === "\n")
    {
        const line = String.fromCharCode.apply("", this.current_line).trimRight().replace(/[\x00-\x08\x0b-\x1f\x7f\x80-\xff]/g, "");
        dbg_log("SERIAL: " + line);
        this.bus.send("serial" + this.com + "-output-line", String.fromCharCode.apply("", this.current_line));
        this.current_line = [];
    }
};
