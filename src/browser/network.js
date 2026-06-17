"use strict";

/**
 * An ethernet-through-websocket adapter, to be used with
 *     https://github.com/benjamincburns/websockproxy
 *
 * emulator's real network interface expects packets to arrive in this.bus.send("net0-receive", ...)
 * and should be sent by listening to bus.register("net0-send", ...)
 *
 * @constructor
 *
 * @param {BusConnector} bus
 * @param {string} url
 */
function NetworkAdapter(bus, url)
{
    this.bus = bus;
    this.url = url || "ws://localhost:8888";
    this.websocket = null;

    // rate-limit network interrupts
    this.throttle_timer = null;
    this.receive_buffer = [];

    bus.register("net0-send", function(data)
    {
        this.send(data);
    }, this);

    bus.register("net0-send-raw", function(data)
    {
        this.send_raw(data);
    }, this);
}

// Connect to the WebSocket server
NetworkAdapter.prototype.connect = function(url)
{
    if(url)
    {
        this.url = url;
    }

    this.websocket = new WebSocket(this.url);
    this.websocket.binaryType = "arraybuffer";

    var obj = this;

    this.websocket.onmessage = function(e)
    {
        obj.receive_buffer.push(new Uint8Array(e.data));

        if(!obj.throttle_timer)
        {
            obj.throttle_timer = setTimeout(function()
            {
                obj.throttle_timer = null;
                var data = obj.receive_buffer;
                obj.receive_buffer = [];
                for(var i = 0; i < data.length; i++)
                {
                    obj.bus.send("net0-receive", data[i]);
                }
            }, 0);
        }
    };

    this.websocket.onopen = function(e)
    {
        dbg_log("NetworkAdapter: Connection opened");
    };

    this.websocket.onclose = function(e)
    {
        dbg_log("NetworkAdapter: Connection closed, code=" + e.code);
    };

    this.websocket.onerror = function(e)
    {
        dbg_log("NetworkAdapter: Connection error");
    };
};

NetworkAdapter.prototype.send = function(data)
{
    if(this.websocket && this.websocket.readyState === WebSocket.OPEN)
    {
        this.websocket.send(data);
    }
};

NetworkAdapter.prototype.send_raw = function(data)
{
    if(this.websocket && this.websocket.readyState === WebSocket.OPEN)
    {
        this.websocket.send(data);
    }
};
