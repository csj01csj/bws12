"use strict";

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function DummyScreenAdapter(bus)
{
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

    bus.register("screen-tell-color", function(data) {
        var offset = data[0],
            bg_color = data[1],
            fg_color = data[2];
    }, this);

    bus.register("screen-tell-cursor", function(data) {
        cursor_row = data[0];
        cursor_col = data[1];
    }, this);

    bus.register("screen-put-char", function(data) {
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
    }, this);

    bus.register("screen-text-mode", function(data) {
        is_graphical = false;
    }, this);

    bus.register("screen-set-size-graphical", function(data) {
        graphical_mode_width = data[0];
        graphical_mode_height = data[1];

        is_graphical = true;
    }, this);

    bus.register("screen-set-size-text", function(data) {
        num_cols = data[0];
        num_rows = data[1];
    }, this);

    bus.register("screen-set-mode", function(data) {
    }, this);

    bus.register("screen-copy-region", function(data) {
    }, this);

    bus.register("screen-fill-rect", function(data) {
    }, this);

    bus.register("screen-blit-text", function(data) {
    }, this);

    bus.register("screen-blit-bitmap", function(data) {
    }, this);

    bus.register("screen-update-cursor-scanline", function(data) {
    }, this);

    bus.register("screen-get-optimized-pb", function(data) {
        return 0;
    }, this);

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
    };
}
