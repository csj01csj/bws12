"use strict";

/**
 * Adapter to use visual screen in browsers (in contrast to node)
 * @constructor
 *
 * @param {BusConnector} bus
 * @param {Object=} config
 */
function ScreenAdapter(bus, config)
{
    config = config || {};

    var
        graphic_image_data,

        /** @type {number} */
        cursor_row,

        /** @type {number} */
        cursor_col,

        graphical_mode_width,
        graphical_mode_height,

        // are we in graphical mode now?
        is_graphical = false,

        // Index 0: ASCII code
        // Index 1: Background color
        // Index 2: Foreground color
        text_mode_data = [],

        // number of columns
        num_cols,

        // number of rows
        num_rows,

        // the current font
        font;

    /** @type {HTMLCanvasElement} */
    var screen = config["screen"];
    /** @type {HTMLElement} */
    var container = config["container"];

    if(!screen)
    {
        var screen_container = config["screen_container"];
        if(screen_container)
        {
            screen = screen_container.querySelector("canvas");
            container = screen_container;
        }
    }

    dbg_assert(screen, "No screen given");

    var bus_prefix = config["bus_prefix"] || "";

    var ctx = screen.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    var
        // Where (in the browser canvas) the image starts
        image_offset_x = 0,
        image_offset_y = 0;

    var character_map = {};

    bus.register(bus_prefix + "screen-tell-color", function(data) {
        var offset = data[0],
            bg_color = data[1],
            fg_color = data[2];
    }, this);

    bus.register(bus_prefix + "screen-tell-cursor", function(data) {
        var row = data[0];
        var col = data[1];

        cursor_row = row;
        cursor_col = col;
    }, this);

    bus.register(bus_prefix + "screen-put-char", function(data) {
        var row = data[0],
            col = data[1],
            chr = data[2],
            bg = data[3],
            fg = data[4];

        if(!text_mode_data[row])
        {
            text_mode_data[row] = [];
        }

        text_mode_data[row][col] = [chr, bg, fg];

        do_character(row, col, chr, bg, fg);
    }, this);

    bus.register(bus_prefix + "screen-text-mode", function(data) {
        is_graphical = false;
        screen.style.display = "";
    }, this);

    bus.register(bus_prefix + "screen-set-size-graphical", function(data) {
        var width = data[0];
        var height = data[1];
        var bpp = data[2];

        graphical_mode_width = width;
        graphical_mode_height = height;
        is_graphical = true;

        screen.width = width;
        screen.height = height;
        screen.style.display = "block";

        // Ensure the canvas fills the container if defined
        if(container)
        {
            container.style.width = width + "px";
            container.style.height = height + "px";
        }
    }, this);

    bus.register(bus_prefix + "screen-set-size-text", function(data) {
        num_cols = data[0];
        num_rows = data[1];
    }, this);

    bus.register(bus_prefix + "screen-set-mode", function(data) {
        // TODO
    }, this);

    bus.register(bus_prefix + "screen-copy-region", function(data) {
        var dest_row = data[0];
        var src_row = data[1];
        var count = data[2];

        ctx.drawImage(screen,
            0, src_row * FONT_HEIGHT, screen.width, count * FONT_HEIGHT,
            0, dest_row * FONT_HEIGHT, screen.width, count * FONT_HEIGHT);
    }, this);

    bus.register(bus_prefix + "screen-fill-rect", function(data) {
        var col = data[0];
        var row = data[1];
        var width = data[2];
        var height = data[3];
        var color = data[4];

        ctx.fillStyle = number_to_color(color);
        ctx.fillRect(col * FONT_WIDTH, row * FONT_HEIGHT, width * FONT_WIDTH, height * FONT_HEIGHT);
    }, this);

    bus.register(bus_prefix + "screen-blit-text", function(data) {
        // TODO
    }, this);

    bus.register(bus_prefix + "screen-blit-bitmap", function(data) {
        var x = data[0];
        var y = data[1];
        var width = data[2];
        var height = data[3];
        var image_data = data[4];

        if(image_data instanceof Uint8ClampedArray)
        {
            var bitmap = ctx.createImageData(width, height);
            bitmap.data.set(image_data);
            ctx.putImageData(bitmap, x, y);
        }
        else if(image_data instanceof ImageBitmap)
        {
            ctx.drawImage(image_data, x, y, width, height);
        }
    }, this);

    bus.register(bus_prefix + "screen-update-cursor-scanline", function(data) {
    }, this);

    bus.register(bus_prefix + "screen-get-optimized-pb", function(data) {
        return 0;
    }, this);

    /** @const */
    var FONT_WIDTH = 8;

    /** @const */
    var FONT_HEIGHT = 16;

    function do_character(row, col, chr, bg, fg)
    {
        var c = character_map[chr + " " + bg + " " + fg];

        if(!c)
        {
            c = character_map[chr + " " + bg + " " + fg] = make_character(chr, bg, fg);
        }

        ctx.drawImage(c, col * FONT_WIDTH, row * FONT_HEIGHT);
    }

    function make_character(chr, bg, fg)
    {
        var bmp = document.createElement("canvas");
        bmp.width = FONT_WIDTH;
        bmp.height = FONT_HEIGHT;

        var c = bmp.getContext("2d");

        // Draw background
        c.fillStyle = number_to_color(bg);
        c.fillRect(0, 0, FONT_WIDTH, FONT_HEIGHT);

        // Draw character
        c.fillStyle = number_to_color(fg);

        if(font)
        {
            c.font = "16px " + font;
        }
        else
        {
            c.font = "16px monospace";
        }

        c.textBaseline = "top";
        c.fillText(String.fromCharCode(chr), 0, 0);

        return bmp;
    }

    function number_to_color(n)
    {
        return "rgb(" + (n >> 16 & 0xFF) + "," + (n >> 8 & 0xFF) + "," + (n & 0xFF) + ")";
    }

    this.make_screenshot = function()
    {
        var a = document.createElement("a");
        a.download = "v86screenshot.png";
        a.href = screen.toDataURL("image/png");
        a.click();
    };

    this.set_scale = function(s_x, s_y)
    {
        screen.style.transform = "scale(" + s_x + ", " + s_y + ")";
        screen.style["transform-origin"] = "0 0";
    };

    this.get_state = function()
    {
        return [
            text_mode_data,
            cursor_row,
            cursor_col,
            num_cols,
            num_rows,
        ];
    };

    this.set_state = function(state)
    {
        text_mode_data = state[0];
        cursor_row = state[1];
        cursor_col = state[2];
        num_cols = state[3];
        num_rows = state[4];

        for(var i = 0; i < text_mode_data.length; i++)
        {
            if(!text_mode_data[i])
            {
                continue;
            }

            for(var j = 0; j < text_mode_data[i].length; j++)
            {
                if(text_mode_data[i][j])
                {
                    var chr = text_mode_data[i][j][0],
                        bg = text_mode_data[i][j][1],
                        fg = text_mode_data[i][j][2];

                    do_character(i, j, chr, bg, fg);
                }
            }
        }
    };
}
