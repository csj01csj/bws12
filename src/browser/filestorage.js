"use strict";

/** @interface */
function FileStorageInterface() {}

/**
 * Read a portion of a file.
 * @param {number} offset
 * @param {number} count
 * @return {!Promise<Uint8Array>} null if file does not exist
 */
FileStorageInterface.prototype.read = function(offset, count) {};

/**
 * Add a read-only file to the filestorage.
 * @param {string} name
 * @param {!Uint8Array} data
 */
FileStorageInterface.prototype.set = function(name, data) {};

/**
 * Call this when all files have been added
 */
FileStorageInterface.prototype.load = function() {};

/**
 * @constructor
 * @implements {FileStorageInterface}
 */
function MemoryFileStorage()
{
    /**
     * @type {Map<string,Uint8Array>}
     */
    this.filedata = new Map();
}

/**
 * @param {string} name
 * @param {number} offset
 * @param {number} count
 * @return {!Promise<Uint8Array>} null if file does not exist
 */
MemoryFileStorage.prototype.read = async function(name, offset, count)
{
    dbg_assert(offset >= 0 && (!count || count >= 0));

    const data = this.filedata.get(name);

    if(!data)
    {
        return null;
    }

    if(count === undefined)
    {
        return data.subarray(offset);
    }
    else
    {
        return data.subarray(offset, offset + count);
    }
};

/**
 * @param {string} name
 * @param {!Uint8Array} data
 */
MemoryFileStorage.prototype.set = function(name, data)
{
    dbg_assert(!this.filedata.has(name), "File already set: " + name);
    this.filedata.set(name, data);
};

MemoryFileStorage.prototype.load = function()
{
};

/**
 * @constructor
 * @implements {FileStorageInterface}
 */
function ServerFileStorage(baseurl)
{
    this.baseurl = baseurl;
}

/**
 * @param {string} name
 * @param {number} offset
 * @param {number} count
 * @return {!Promise<Uint8Array>}
 */
ServerFileStorage.prototype.read = async function(name, offset, count)
{
    dbg_assert(offset >= 0 && (!count || count >= 0));

    const url = this.baseurl + name;
    const headers = {};

    if(offset || count)
    {
        const end = count ? offset + count - 1 : "";
        headers["range"] = `bytes=${offset}-${end}`;
    }

    const response = await fetch(url, { headers });

    if(!response.ok)
    {
        dbg_assert(false, "Failed to read file: " + url + " status=" + response.status);
        return null;
    }

    return new Uint8Array(await response.arrayBuffer());
};

ServerFileStorage.prototype.set = function(name, data)
{
};

ServerFileStorage.prototype.load = function()
{
};
