"use strict";

(function()
{
    /** @const */
    var ON_LOCALHOST = !location.hostname.endsWith("copy.sh");

    /** @const */
    var HOST = ON_LOCALHOST ? "" : "//copy.sh";

    /**
     * @return {Object}
     */
    function get_query_arguments()
    {
        var o = {};
        var query = location.search.substr(1).split("&");

        for(var i = 0; i < query.length; i++)
        {
            var kv = query[i].split("=");
            o[kv[0]] = decodeURIComponent(kv.slice(1).join("="));
        }

        return o;
    }

    function format_timestamp(time)
    {
        if(time < 60)
        {
            return time + "s";
        }
        else if(time < 3600)
        {
            return (time / 60 | 0) + "m " + time % 60 + "s";
        }
        else
        {
            return (time / 3600 | 0) + "h " + (time % 3600 / 60 | 0) + "m " + time % 60 + "s";
        }
    }

    var progress_elements = {};

    function set_progress(id, args)
    {
        var el = progress_elements[id];

        if(!el)
        {
            el = progress_elements[id] = document.createElement("div");
            var cont = document.getElementById("loading");
            if(cont)
                cont.appendChild(el);
        }

        var line = args["name"];

        var has_progress = args["file_index"] !== undefined && args["file_count"];

        if(has_progress)
        {
            line += " [" + args["file_index"] + "/" + args["file_count"] + "]";
        }

        if(args["size"] !== undefined)
        {
            var percent = args["loaded"] / args["size"] * 100 | 0;
            var mb_loaded = (args["loaded"] / 1e6).toFixed(1);
            var mb_total = (args["size"] / 1e6).toFixed(1);
            line += " " + mb_loaded + " of " + mb_total + " MB";

            if(args["seconds_remaining"] !== undefined)
            {
                line += " " + format_timestamp(args["seconds_remaining"] | 0) + " remaining";
            }
        }
        else if(args["loaded"])
        {
            line += " " + (args["loaded"] / 1e6).toFixed(1) + " MB";
        }

        el.textContent = line;
    }

    window["V86Starter"] = V86Starter;
    window["V86"] = V86Starter;

    /**
     * @param {Object} args
     * @return {Object}
     */
    function create_v86(args)
    {
        args["wasm_fn"] = (param) => {
            return WebAssembly.instantiateStreaming(fetch(HOST + "/v86.wasm"), param);
        };
        var emulator = new V86Starter(args);
        return emulator;
    }

    function debug_start(emulator)
    {
        // called on window.load

        var debug_infos = "";

        emulator.add_listener("emulator-loaded", function()
        {
            setTimeout(function() {
                if(debug_panel)
                    debug_panel.style.display = "block";
            }, 100);
        });
    }

    function dom_content_loaded()
    {
        var args = get_query_arguments();

        var cpu_count_input = document.getElementById("cpu_count");

        if(!cpu_count_input)
        {
            // probably not the main page
            return;
        }

        var screen_container = document.getElementById("screen_container");
        var mouse_adapter;

        if(screen_container)
        {
            mouse_adapter = new MouseAdapter(screen_container, document.body);
        }

        var emulator = null;
        var start_emulation = false;

        var os_select = document.getElementById("os_select");

        /** @param {string} name */
        function set_title(name)
        {
            document.title = name + " - v86";

            var description = document.getElementById("description");

            if(description)
            {
                description.style.display = "none";
            }
        }

        function show_links(name)
        {
            var visible = document.querySelectorAll(".hidden_link");

            for(var i = 0; i < visible.length; i++)
            {
                visible[i].style.display = "none";
            }

            visible = document.querySelectorAll(".hidden_link[data-group=" + name + "]");

            for(var i = 0; i < visible.length; i++)
            {
                visible[i].style.display = "";
            }
        }

        var running = false;

        function start(profile)
        {
            if(emulator)
            {
                emulator.stop();
                emulator = null;
                document.getElementById("reset").value = "Reset";
            }

            var settings = {};

            settings["screen_container"] = document.getElementById("screen_container");
            settings["serial_container_xtermjs"] = document.getElementById("terminal");

            if(profile["hda"])
            {
                settings["hda"] = {
                    url: HOST + profile["hda"],
                    async: true,
                    size: profile["hda_size"],
                };
            }

            if(profile["cdrom"])
            {
                settings["cdrom"] = {
                    url: HOST + profile["cdrom"],
                    async: true,
                    size: profile["cdrom_size"],
                };
            }

            if(profile["hdb"])
            {
                settings["hdb"] = {
                    url: HOST + profile["hdb"],
                    async: true,
                    size: profile["hdb_size"],
                };
            }

            if(profile["fda"])
            {
                settings["fda"] = {
                    url: HOST + profile["fda"],
                    async: false,
                };
            }

            if(profile["multiboot"])
            {
                settings["multiboot"] = {
                    url: HOST + profile["multiboot"],
                    async: false,
                };
            }

            if(profile["bzimage"])
            {
                settings["bzimage"] = {
                    url: HOST + profile["bzimage"],
                    async: false,
                };
            }

            if(profile["initrd"])
            {
                settings["initrd"] = {
                    url: HOST + profile["initrd"],
                    async: false,
                };
            }

            settings["bios"] = { url: HOST + "/bios/seabios.bin" };
            settings["vga_bios"] = { url: HOST + "/bios/vgabios.bin" };
            settings["memory_size"] = profile["mem_size"] || 512 * 1024 * 1024;
            settings["vga_memory_size"] = 8 * 1024 * 1024;
            settings["network_relay_url"] = "wss://relay.widgetry.org/";
            //settings["network_relay_url"] = "ws://localhost:8888";

            if(profile["state"])
            {
                settings["initial_state"] = {
                    url: HOST + profile["state"],
                    async: false,
                };
            }

            settings["filesystem"] = {};

            if(profile["9p_image"])
            {
                settings["filesystem"] = {
                    baseurl: HOST + profile["9p_image"],
                };
            }

            settings["autostart"] = true;

            emulator = create_v86(settings);

            running = true;

            emulator.add_listener("emulator-ready", function()
            {
                init_ui(settings, emulator);
                debug_start(emulator);
            });

            emulator.add_listener("download-progress", function(e)
            {
                set_progress(e["name"], e);
            });

            emulator.add_listener("download-error", function(e)
            {
                var el = document.getElementById("loading");
                if(el)
                {
                    el.textContent = "Loading " + e["name"] + " failed. Check your connection and reload the page.";
                }
            });
        }

        function init_ui(settings, emulator)
        {
            document.getElementById("loading").style.display = "none";
            document.getElementById("runtime_options").style.display = "block";

            if(settings["serial_container_xtermjs"])
            {
                document.getElementById("terminal").style.display = "block";
            }
        }

        if(args["profile"] && typeof profile_storage !== "undefined")
        {
            if(profile_storage.has(args["profile"]))
            {
                var profile = profile_storage.get(args["profile"]);
                set_title(profile["name"]);
                show_links(profile["group"] || profile["name"]);
                start(profile);
            }
        }

        var do_not_start = args["debug"];

        document.getElementById("reset").onclick = function()
        {
            if(!running)
            {
                var sel = os_select.options[os_select.selectedIndex];
                start_emulation = true;

                if(sel.value)
                {
                    profile_storage && profile_storage.has(sel.value) && start(profile_storage.get(sel.value));
                }
            }
            else
            {
                if(emulator)
                {
                    emulator.restart();
                    document.getElementById("reset").value = "Reset";
                }
            }
        };

        document.getElementById("resume_execution").onclick = function()
        {
            if(emulator)
            {
                emulator.run();
                document.getElementById("resume_execution").disabled = true;
                document.getElementById("pause_execution").disabled = false;
            }
        };

        document.getElementById("pause_execution").onclick = function()
        {
            if(emulator)
            {
                emulator.stop();
                document.getElementById("pause_execution").disabled = true;
                document.getElementById("resume_execution").disabled = false;
            }
        };

        document.getElementById("create_save_state").onclick = function()
        {
            if(emulator)
            {
                var a = document.createElement("a");
                var title = document.title.replace(/ - v86$/, "").replace(/\//, "_");
                emulator["save_state"](function(err, buffer)
                {
                    if(err)
                    {
                        console.warn("Couldn't save state: ", err);
                        return;
                    }

                    a.href = window.URL.createObjectURL(new Blob([buffer]));
                    a.download = title + ".bin";
                    a.click();
                });
            }
        };

        document.getElementById("restore_save_state").onchange = function()
        {
            if(emulator)
            {
                var file = this.files[0];

                if(!file)
                {
                    return;
                }

                var fr = new FileReader();

                fr.onload = function(e)
                {
                    emulator["restore_state"](e.target.result);
                };

                fr.readAsArrayBuffer(file);
            }
        };

        document.getElementById("memory_dump").onclick = function()
        {
            if(emulator)
            {
                var title = document.title.replace(/ - v86$/, "").replace(/\//, "_");
                var a = document.createElement("a");
                a.href = window.URL.createObjectURL(new Blob([emulator.v86.cpu.mem8]));
                a.download = title + "_memory.bin";
                a.click();
            }
        };

        document.getElementById("screen_make_screenshot").onclick = function()
        {
            if(emulator)
            {
                emulator.screen_make_screenshot();
            }
        };

        document.getElementById("scale_screen").onchange = function()
        {
            if(emulator)
            {
                emulator.screen_set_scale(parseFloat(this.value), parseFloat(this.value));
            }
        };

        document.getElementById("fullscreen").onclick = function()
        {
            if(emulator)
            {
                emulator.screen_go_fullscreen();
            }
        };

        document.getElementById("load_state").onclick = function()
        {
            document.getElementById("restore_save_state").click();
        };

        document.getElementById("ctrlaltdel").onclick = function()
        {
            if(emulator)
            {
                emulator.keyboard_send_scancodes([
                    0x1D, // ctrl
                    0x38, // alt
                    0x53, // delete

                    0x1D | 0x80,
                    0x38 | 0x80,
                    0x53 | 0x80,
                ]);
            }
        };

        document.getElementById("alttab").onclick = function()
        {
            if(emulator)
            {
                emulator.keyboard_send_scancodes([
                    0x38, // alt
                    0x0F, // tab
                    0x0F | 0x80,
                    0x38 | 0x80,
                ]);
            }
        };

        document.getElementById("tilde").onclick = function()
        {
            if(emulator)
            {
                emulator.keyboard_send_scancodes([
                    0x29, // tilde
                    0x29 | 0x80,
                ]);
            }
        };

        var send_char = document.getElementById("send_string");
        if(send_char)
        {
            send_char.onkeypress = function(e)
            {
                if(e.which === 13)
                {
                    if(emulator)
                    {
                        emulator.keyboard_send_text(this.value);
                        this.value = "";
                        e.preventDefault();
                    }
                }
            };
        }

        var serial_send = document.getElementById("serial_send");
        if(serial_send)
        {
            serial_send.onkeypress = function(e)
            {
                if(e.which === 13)
                {
                    if(emulator)
                    {
                        var text = this.value;
                        emulator.serial0_send(text + "\n");
                        this.value = "";
                        e.preventDefault();
                    }
                }
            };
        }

        document.getElementById("cpu_count").oninput = function()
        {
        };

        document.addEventListener("keydown", function(e) {
            if(e.ctrlKey && e.keyCode === 77) // ctrl-m
            {
                document.querySelector(".right_panel").classList.toggle("hidden");
            }
        });
    }

    if(document.readyState === "loading")
    {
        document.addEventListener("DOMContentLoaded", dom_content_loaded);
    }
    else
    {
        dom_content_loaded();
    }


    var profiles = [];

    // XXX - Profiles are specific to copy.sh
    // !!!!!!!! EDIT THE PROFILE NAME AND IMAGE !!!!!!!!
    profiles.push({
        name: "FreeDOS",
        hda: "/images/freedos722.img",
        hda_size: 737280,
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "Windows 1.01",
        hda: "/images/windows101.img",
        hda_size: 1228800,
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "Linux 2.6.20",
        cdrom: "/images/linux.iso",
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "Buildroot Linux",
        bzimage: "/images/buildroot-bzimage.bin",
        state: "/images/bios.bin",
    });

    profiles.push({
        name: "Windows 98",
        hda: "/images/W98.img",
        hda_size: 300 * 1024 * 1024,
        state: "/images/bios.bin",
        mem_size: 128 * 1024 * 1024,
    });

    profiles.push({
        name: "Windows 2000",
        hda: "/images/W2k.img",
        hda_size: 2 * 1024 * 1024 * 1024,
        state: "/images/bios.bin",
        mem_size: 256 * 1024 * 1024,
    });

    profiles.push({
        name: "Damn Small Linux",
        cdrom: "/images/dsl-4.11.rc2.iso",
        hda_size: 2 * 1024 * 1024 * 1024,
        state: "/images/bios.bin",
    });

    profiles.push({
        name: "Oberon",
        hda: "/images/Oberon.dsk",
        hda_size: 2000 * 1024,
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "KolibriOS",
        fda: "/images/kolibri.img",
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "MS-DOS 6.22",
        hda: "/images/msdos622.img",
        hda_size: 8 * 1024 * 1024,
        state: "/images/bios.bin",
        mem_size: 32 * 1024 * 1024,
    });

    profiles.push({
        name: "ArchLinux",
        hda: "/images/archlinux.img",
        hda_size: 6 * 1024 * 1024 * 1024,
        state: "/images/bios.bin",
    });

    profiles.push({
        name: "Android-x86",
        hda: "/images/android_small.img",
        hda_size: 3 * 1024 * 1024 * 1024,
        state: "/images/bios.bin",
        mem_size: 512 * 1024 * 1024,
    });

    var profile_storage = new Map();

    for(var i = 0; i < profiles.length; i++)
    {
        profile_storage.set(profiles[i]["name"].toLowerCase().replace(/ /g, "-"), profiles[i]);
    }

    // Trying to keep backward compatibility
    profile_storage.set("winxp", profile_storage.get("windows-xp"));
    //profile_storage.set("win7", profile_storage.get("windows-7"));

    if(typeof os_select !== "undefined" && os_select)
    {
        for(var i = 0; i < profiles.length; i++)
        {
            var option = document.createElement("option");
            option.value = profiles[i]["name"].toLowerCase().replace(/ /g, "-");
            option.textContent = profiles[i]["name"];
            os_select.appendChild(option);
        }
    }

})();
