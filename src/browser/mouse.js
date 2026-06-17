"use strict";

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function MouseAdapter(bus, screen_container)
{
    this.enabled = false;
    this.bus = bus;
    this.screen_container = screen_container || document.body;

    var mouse = this;
    var last_x = 0,
        last_y = 0;

    var left_down = false,
        right_down = false,
        middle_down = false;

    bus.register("mouse-enable", function(val)
    {
        mouse.enabled = val;
    }, this);

    this.destroy = function() {
        this.screen_container.removeEventListener("mousemove", mousemove_handler);
        this.screen_container.removeEventListener("mousedown", mousedown_handler);
        this.screen_container.removeEventListener("mouseup", mouseup_handler);
        this.screen_container.removeEventListener("wheel", wheel_handler);
        document.removeEventListener("pointerlockchange", pointerlockchange_handler);
    };

    this.screen_container.addEventListener("mousemove", mousemove_handler);
    this.screen_container.addEventListener("mousedown", mousedown_handler);
    this.screen_container.addEventListener("mouseup", mouseup_handler);
    this.screen_container.addEventListener("wheel", wheel_handler, { passive: false });
    document.addEventListener("pointerlockchange", pointerlockchange_handler);

    var clicks_in_row = 0;
    var last_click = Date.now();
    var pointer_is_locked = false;

    function pointerlockchange_handler()
    {
        pointer_is_locked = !!document.pointerLockElement;
    }

    function mousemove_handler(e)
    {
        var delta_x, delta_y;

        if(!mouse.enabled)
        {
            return;
        }

        if(pointer_is_locked)
        {
            delta_x = e.movementX;
            delta_y = e.movementY;
        }
        else
        {
            var rect = mouse.screen_container.getBoundingClientRect();

            var new_x = e.clientX - rect.left;
            var new_y = e.clientY - rect.top;

            delta_x = new_x - last_x;
            delta_y = new_y - last_y;

            last_x = new_x;
            last_y = new_y;
        }

        if(!delta_x && !delta_y)
        {
            return;
        }

        bus.send("mouse-delta", [delta_x, delta_y]);
    }

    function mousedown_handler(e)
    {
        if(!mouse.enabled)
        {
            return;
        }

        if(e.button === 0)
        {
            left_down = true;
        }
        else if(e.button === 2)
        {
            right_down = true;
        }
        else if(e.button === 1)
        {
            middle_down = true;
        }

        bus.send("mouse-button", [left_down, right_down, middle_down]);

        var now = Date.now();

        if(now - last_click < 500)
        {
            clicks_in_row++;
        }
        else
        {
            clicks_in_row = 1;
        }

        last_click = now;

        if(clicks_in_row >= 3)
        {
            if(!document.pointerLockElement && mouse.screen_container.requestPointerLock)
            {
                mouse.screen_container.requestPointerLock();
            }
        }
    }

    function mouseup_handler(e)
    {
        if(!mouse.enabled)
        {
            return;
        }

        if(e.button === 0)
        {
            left_down = false;
        }
        else if(e.button === 2)
        {
            right_down = false;
        }
        else if(e.button === 1)
        {
            middle_down = false;
        }

        bus.send("mouse-button", [left_down, right_down, middle_down]);
    }

    function wheel_handler(e)
    {
        if(!mouse.enabled)
        {
            return;
        }

        var delta_x = e.deltaX;
        var delta_y = e.deltaY;

        if(e.deltaMode === WheelEvent.DOM_DELTA_LINE)
        {
            delta_x *= 12;
            delta_y *= 12;
        }
        else if(e.deltaMode === WheelEvent.DOM_DELTA_PAGE)
        {
            delta_x *= 400;
            delta_y *= 400;
        }

        bus.send("mouse-wheel", [delta_x, delta_y]);

        e.preventDefault();
    }

    this.get_state = function()
    {
        return [];
    };

    this.set_state = function(state)
    {
    };
}
