"use strict";

var WorkerBus = {};

/** @constructor */
WorkerBus.Connector = function(pair)
{
    this.other = pair;
};

WorkerBus.get_bus = function(settings, emulator)
{
    var bus = BusConnector();
    return bus;
};
