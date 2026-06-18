"use strict";

/**
 * Constructor for emulator instances.
 *
 * Usage: `var emulator = new V86Starter(options);`
 *
 * Options are listed in [docs/options.md](docs/options.md).
 *
 * @param {Object} options
 * @constructor
 */
function V86Starter(options)
{
    this.cpu_exception_hook = options["cpu_exception_hook"];

    /** @type {Object} */
    var settings = {};

    this.screen_adapter = null;
    this.serial_adapter = null;

    var emulator = this;

    var screen_container = options["screen_container"];

    if(screen_container)
    {
        var screen_adapter_config = {
            screen_container: screen_container,
        };
        this.screen_adapter = new ScreenAdapter(this.bus, screen_adapter_config);
    }
    else if(options["screen"])
    {
        this.screen_adapter = new ScreenAdapter(this.bus, {
            screen: options["screen"],
            container: options["screen_container"],
        });
    }
    else
    {
        this.screen_adapter = new DummyScreenAdapter(this.bus);
    }

    if(options["serial_container"])
    {
        this.serial_adapter = new SerialAdapter(options["serial_container"], this.bus);
    }
    else if(options["serial_container_xtermjs"])
    {
        this.serial_adapter = new SerialAdapterXtermJS(options["serial_container_xtermjs"], this.bus);
    }

    // ---- Common Initialization ----

    this.bus = WorkerBus.get_bus(settings, this);

    var bios = options["bios"];
    var vga_bios = options["vga_bios"];
    var cdrom = options["cdrom"];
    var hda = options["hda"];
    var hdb = options["hdb"];
    var fda = options["fda"];
    var fdb = options["fdb"];
    var multiboot = options["multiboot"];
    var bzimage = options["bzimage"];
    var initrd = options["initrd"];
    var bzimage_initrd = options["bzimage_and_initrd"];

    var initial_state = options["initial_state"];

    var fs9p = null;
    var fs9p_url = null;

    if(options["filesystem"])
    {
        var filesystem = options["filesystem"];

        if(filesystem["baseurl"])
        {
            fs9p_url = filesystem["baseurl"];
        }
        else if(filesystem["basefs"])
        {
            var fs9p_json = filesystem["basefs"];
        }
    }

    var boot_order = options["boot_order"] || 0x213;

    if(options["network_relay_url"])
    {
        this.network_adapter = new NetworkAdapter(this.bus, options["network_relay_url"]);
        this.network_adapter.connect();
    }

    // Starting the emulator

    var settings_dict = {
        "bios": bios,
        "vga_bios": vga_bios,
        "cdrom": cdrom,
        "hda": hda,
        "hdb": hdb,
        "fda": fda,
        "fdb": fdb,
        "multiboot": multiboot,
        "bzimage": bzimage,
        "initrd": initrd,
        "bzimage_and_initrd": bzimage_initrd,
        "initial_state": initial_state,
        "fs9p_url": fs9p_url,
        "fs9p_json": fs9p_json,
        "memory_size": options["memory_size"],
        "vga_memory_size": options["vga_memory_size"],
        "boot_order": boot_order,
        "autostart": options["autostart"],
        "uart1": options["uart1"],
        "uart2": options["uart2"],
        "uart3": options["uart3"],
        "acpi": options["acpi"],
        "cpuid_level": options["cpuid_level"],
    };

    // ---- Event listeners ----
    this.listeners = Object.create(null);

    /**
     * @param {string} event
     * @param {function(*)} listener
     */
    V86Starter.prototype.add_listener = function(event, listener)
    {
        if(!this.listeners[event])
        {
            this.listeners[event] = [];
        }

        this.listeners[event].push(listener);
        this.bus.register(event, listener, this);
    };

    /**
     * @param {string} event
     * @param {function(*)} listener
     */
    V86Starter.prototype.remove_listener = function(event, listener)
    {
        var listeners = this.listeners[event];

        if(!listeners)
        {
            return;
        }

        for(var i = 0; i < listeners.length; i++)
        {
            if(listeners[i] === listener)
            {
                listeners.splice(i, 1);
                break;
            }
        }

        this.bus.unregister(event, listener);
    };

    /**
     * @param {string} message
     */
    V86Starter.prototype.serial0_send = function(message)
    {
        for(var i = 0; i < message.length; i++)
        {
            this.bus.send("serial0-input", message.charCodeAt(i));
        }
    };

    /**
     * Run the emulator
     */
    V86Starter.prototype.run = function()
    {
        this.bus.send("cpu-run");
    };

    /**
     * Stop the emulator
     */
    V86Starter.prototype.stop = function()
    {
        this.bus.send("cpu-stop");
    };

    /**
     * Restart the emulator
     */
    V86Starter.prototype.restart = function()
    {
        this.bus.send("cpu-restart");
    };

    /**
     * @param {function(Object, ArrayBuffer)} callback
     */
    V86Starter.prototype.save_state = function(callback)
    {
        this.bus.send("cpu-save-state");
        this.bus.register("cpu-state-saved", function on_state_saved(state)
        {
            this.bus.unregister("cpu-state-saved", on_state_saved);
            callback(null, state);
        }, this);
    };

    /**
     * @param {ArrayBuffer} state
     */
    V86Starter.prototype.restore_state = function(state)
    {
        this.bus.send("cpu-restore-state", state);
    };

    /**
     * @param {Array.<number>} codes
     */
    V86Starter.prototype.keyboard_send_scancodes = function(codes)
    {
        for(var i = 0; i < codes.length; i++)
        {
            this.bus.send("keyboard-code", codes[i]);
        }
    };

    /**
     * @param {string} text
     */
    V86Starter.prototype.keyboard_send_text = function(text)
    {
        this.keyboard_adapter.simulate_press(text);
    };

    /**
     * @param {number} x
     * @param {number} y
     */
    V86Starter.prototype.screen_set_scale = function(x, y)
    {
        if(this.screen_adapter)
        {
            this.screen_adapter.set_scale(x, y);
        }
    };

    V86Starter.prototype.screen_go_fullscreen = function()
    {
        if(!this.screen_adapter)
        {
            return;
        }

        var elem = document.getElementById("screen_container");

        if(!elem)
        {
            return;
        }

        // Chrome 15+
        if(elem.webkitRequestFullscreen)
        {
            elem.webkitRequestFullscreen();
        }
        else if(elem.mozRequestFullScreen)
        {
            elem.mozRequestFullScreen();
        }
        else if(elem.requestFullscreen)
        {
            elem.requestFullscreen();
        }
    };

    V86Starter.prototype.screen_make_screenshot = function()
    {
        if(this.screen_adapter)
        {
            this.screen_adapter.make_screenshot();
        }
    };

    /**
     * Takes a screenshot of the screen and passes it to the callback as a blob.
     * @param {function(Blob)} callback
     */
    V86Starter.prototype.screen_make_screenshot_blob = function(callback)
    {
        if(!this.screen_adapter)
        {
            return;
        }

        this.screen_adapter.make_screenshot_blob(callback);
    };

    V86Starter.prototype.get_statistics = function()
    {
        var stats = {
            cpu: {},
        };

        return stats;
    };

    V86Starter.prototype.is_running = function()
    {
        return this.v86 && this.v86.cpu.running;
    };

    V86Starter.prototype.get_bus = function()
    {
        return this.bus;
    };

    /**
     * @param {ArrayBuffer} ab
     * @return {Promise}
     */
    V86Starter.prototype.create_file = function(path, ab)
    {
        return this.fs9p.create_file(path, ab);
    };

    /**
     * @param {string} path
     * @return {Promise<ArrayBuffer>}
     */
    V86Starter.prototype.read_file = function(path)
    {
        return this.fs9p.read_file(path);
    };

    /**
     * @param {string} path
     * @return {Promise<Array<string>>}
     */
    V86Starter.prototype.list_directory = function(path)
    {
        return this.fs9p.list_directory(path);
    };

    /**
     * @param {function(Object)} callback
     */
    V86Starter.prototype.read_memory = function(addr, length)
    {
        var result;

        if(this.v86)
        {
            result = this.v86.cpu.read_blob(addr, length);
        }
        else
        {
            result = new Uint8Array(length);
        }

        return result;
    };

    /**
     * @param {Uint8Array} blob
     * @param {number} addr
     */
    V86Starter.prototype.write_memory = function(blob, addr)
    {
        if(this.v86)
        {
            this.v86.cpu.write_blob(blob, addr);
        }
    };

    /**
     * @param {string} key
     * @return {*}
     */
    V86Starter.prototype.get_setting = function(key)
    {
        return settings_dict[key];
    };

    // ---- Boot up ----
    this.bus.send("cpu-init", settings_dict);

    this.keyboard_adapter = new KeyboardAdapter(this.bus);

    if(mouse_adapter)
    {
        this.mouse_adapter = mouse_adapter;
    }
    else
    {
        this.mouse_adapter = new MouseAdapter(this.bus);
    }
}
