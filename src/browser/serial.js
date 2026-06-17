"use strict";

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function SerialAdapter(element, bus)
{
    var that = this;
    this.element = element;
    this.bus = bus;
    this.enabled = false;

    if(!element)
    {
        return;
    }

    bus.register("serial0-output-char", function(chr)
    {
        this.show_char(chr);
    }, this);

    bus.register("serial0-output-line", function(line)
    {
        this.show_char(line);
    }, this);

    element.addEventListener("keydown", function(e)
    {
        if(e.key.length === 1)
        {
            e.preventDefault();
            bus.send("serial0-input", e.key.charCodeAt(0));
        }
        else
        {
            switch(e.key)
            {
                case "Enter":
                    e.preventDefault();
                    bus.send("serial0-input", 13);
                    break;

                case "Backspace":
                    e.preventDefault();
                    bus.send("serial0-input", 8);
                    break;

                case "Tab":
                    e.preventDefault();
                    bus.send("serial0-input", 9);
                    break;

                case "Delete":
                    e.preventDefault();
                    bus.send("serial0-input", 127);
                    break;

                case "Escape":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    break;

                case "ArrowUp":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 65);
                    break;

                case "ArrowDown":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 66);
                    break;

                case "ArrowLeft":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 68);
                    break;

                case "ArrowRight":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 67);
                    break;

                case "Home":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 72);
                    break;

                case "End":
                    e.preventDefault();
                    bus.send("serial0-input", 27);
                    bus.send("serial0-input", 91);
                    bus.send("serial0-input", 70);
                    break;
            }
        }
    });
}

SerialAdapter.prototype.show_char = function(chr)
{
    if(this.element)
    {
        this.element.value += chr;
        this.element.scrollTop = this.element.scrollHeight;
    }
};

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function SerialAdapterXtermJS(element, bus)
{
    if(!element || !window.Terminal)
    {
        return;
    }

    var term = new window.Terminal({
        convertEol: false,
        rows: 30,
        fontFamily: "monospace",
    });

    term.open(element);

    bus.register("serial0-output-char", function(chr)
    {
        term.write(chr);
    }, this);

    bus.register("serial0-output-line", function(line)
    {
        term.write(line);
    }, this);

    term.onData(function(data)
    {
        for(var i = 0; i < data.length; i++)
        {
            bus.send("serial0-input", data.charCodeAt(i));
        }
    });
}
