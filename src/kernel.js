"use strict";

// https://www.kernel.org/doc/Documentation/x86/boot.txt

const LINUX_BOOT_HDR_SETUP_SECTS = 0x1F1;
const LINUX_BOOT_HDR_SYSSIZE = 0x1F4;
const LINUX_BOOT_HDR_VIDMODE = 0x1FA;
const LINUX_BOOT_HDR_BOOT_FLAG = 0x1FE;
const LINUX_BOOT_HDR_HEADER = 0x202;
const LINUX_BOOT_HDR_VERSION = 0x206;
const LINUX_BOOT_HDR_TYPE_OF_LOADER = 0x210;
const LINUX_BOOT_HDR_LOADFLAGS = 0x211;
const LINUX_BOOT_HDR_CODE32_START = 0x214;
const LINUX_BOOT_HDR_RAMDISK_IMAGE = 0x218;
const LINUX_BOOT_HDR_RAMDISK_SIZE = 0x21C;
const LINUX_BOOT_HDR_HEAP_END_PTR = 0x224;
const LINUX_BOOT_HDR_CMD_LINE_PTR = 0x228;
const LINUX_BOOT_HDR_INITRD_ADDR_MAX = 0x22C;
const LINUX_BOOT_HDR_KERNEL_ALIGNMENT = 0x230;
const LINUX_BOOT_HDR_RELOCATABLE_KERNEL = 0x234;
const LINUX_BOOT_HDR_MIN_ALIGNMENT = 0x235;
const LINUX_BOOT_HDR_XLOADFLAGS = 0x236;
const LINUX_BOOT_HDR_CMDLINE_SIZE = 0x238;
const LINUX_BOOT_HDR_PAYLOAD_OFFSET = 0x248;
const LINUX_BOOT_HDR_PAYLOAD_LENGTH = 0x24C;
const LINUX_BOOT_HDR_PREF_ADDRESS = 0x258;
const LINUX_BOOT_HDR_INIT_SIZE = 0x260;

const LINUX_BOOT_HDR_CHECKSUM1 = 0xAA55;
const LINUX_BOOT_HDR_CHECKSUM2 = 0x53726448;

const LINUX_BOOT_HDR_TYPE_OF_LOADER_NOT_ASSIGNED = 0xFF;

const LINUX_BOOT_HDR_LOADFLAGS_LOADED_HIGH = 1 << 0;
const LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG = 1 << 5;
const LINUX_BOOT_HDR_LOADFLAGS_KEEP_SEGMENTS = 1 << 6;
const LINUX_BOOT_HDR_LOADFLAGS_CAN_USE_HEAPS = 1 << 7;


function load_kernel(mem8, bzimage, initrd, cmdline)
{
    dbg_log("Trying to load kernel of size " + bzimage.byteLength);

    const KERNEL_HIGH_ADDRESS = 0x100000;
    const INITRD_ADDRESS = 64 << 20;
    const quiet = false;

    const bzimage8 = new Uint8Array(bzimage);
    const bzimage16 = new Uint16Array(bzimage);
    const bzimage32 = new Uint32Array(bzimage);

    const setup_sects = bzimage8[LINUX_BOOT_HDR_SETUP_SECTS] || 4;
    const syssize = bzimage32[LINUX_BOOT_HDR_SYSSIZE >> 2] << 4;
    const vidmode = bzimage16[LINUX_BOOT_HDR_VIDMODE >> 1];

    const checksum1 = bzimage16[LINUX_BOOT_HDR_BOOT_FLAG >> 1];
    if(checksum1 !== LINUX_BOOT_HDR_CHECKSUM1) { dbg_log("Bad checksum1: " + h(checksum1)); return; }

    const checksum2 = bzimage16[LINUX_BOOT_HDR_HEADER >> 1] | bzimage16[LINUX_BOOT_HDR_HEADER + 2 >> 1] << 16;
    if(checksum2 !== LINUX_BOOT_HDR_CHECKSUM2) { dbg_log("Bad checksum2: " + h(checksum2)); return; }

    const protocol = bzimage16[LINUX_BOOT_HDR_VERSION >> 1];
    dbg_assert(protocol >= 0x202);

    const flags = bzimage8[LINUX_BOOT_HDR_LOADFLAGS];
    dbg_assert(flags & LINUX_BOOT_HDR_LOADFLAGS_LOADED_HIGH);

    const flags2 = bzimage16[LINUX_BOOT_HDR_XLOADFLAGS >> 1];
    const initrd_addr_max = bzimage32[LINUX_BOOT_HDR_INITRD_ADDR_MAX >> 2];
    const kernel_alignment = bzimage32[LINUX_BOOT_HDR_KERNEL_ALIGNMENT >> 2];
    const relocatable_kernel = bzimage8[LINUX_BOOT_HDR_RELOCATABLE_KERNEL];
    const min_alignment = bzimage8[LINUX_BOOT_HDR_MIN_ALIGNMENT];
    const cmdline_size = bzimage32[LINUX_BOOT_HDR_CMDLINE_SIZE >> 2];
    const payload_offset = bzimage32[LINUX_BOOT_HDR_PAYLOAD_OFFSET >> 2];
    const payload_length = bzimage32[LINUX_BOOT_HDR_PAYLOAD_LENGTH >> 2];
    const pref_address = bzimage32[LINUX_BOOT_HDR_PREF_ADDRESS >> 2];
    const pref_address_high = bzimage32[LINUX_BOOT_HDR_PREF_ADDRESS + 4 >> 2];
    const init_size = bzimage32[LINUX_BOOT_HDR_INIT_SIZE >> 2];

    const real_mode_segment = 0x8000;
    const base_ptr = real_mode_segment << 4;
    const heap_end = 0xE000;
    const heap_end_ptr = heap_end - 0x200;

    bzimage8[LINUX_BOOT_HDR_TYPE_OF_LOADER] = LINUX_BOOT_HDR_TYPE_OF_LOADER_NOT_ASSIGNED;

    const new_flags =
        (quiet ? flags | LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG : flags & ~LINUX_BOOT_HDR_LOADFLAGS_QUIET_FLAG)
        & ~LINUX_BOOT_HDR_LOADFLAGS_KEEP_SEGMENTS
        | LINUX_BOOT_HDR_LOADFLAGS_CAN_USE_HEAPS;
    bzimage8[LINUX_BOOT_HDR_LOADFLAGS] = new_flags;

    bzimage16[LINUX_BOOT_HDR_HEAP_END_PTR >> 1] = heap_end_ptr;
    bzimage16[LINUX_BOOT_HDR_VIDMODE >> 1] = 0xFFFF;

    cmdline += "\x00";
    dbg_assert(cmdline.length < cmdline_size);

    const cmd_line_ptr = base_ptr + heap_end;
    bzimage32[LINUX_BOOT_HDR_CMD_LINE_PTR >> 2] = cmd_line_ptr;
    for(let i = 0; i < cmdline.length; i++)
    {
        mem8[cmd_line_ptr + i] = cmdline.charCodeAt(i);
    }

    const prot_mode_kernel_start = (setup_sects + 1) * 512;
    const real_mode_kernel = new Uint8Array(bzimage, 0, prot_mode_kernel_start);
    const protected_mode_kernel = new Uint8Array(bzimage, prot_mode_kernel_start);

    let ramdisk_address = 0;
    let ramdisk_size = 0;

    if(initrd)
    {
        ramdisk_address = INITRD_ADDRESS;
        ramdisk_size = initrd.byteLength;
        dbg_assert(KERNEL_HIGH_ADDRESS + protected_mode_kernel.length < ramdisk_address);
        mem8.set(new Uint8Array(initrd), ramdisk_address);
    }

    bzimage32[LINUX_BOOT_HDR_RAMDISK_IMAGE >> 2] = ramdisk_address;
    bzimage32[LINUX_BOOT_HDR_RAMDISK_SIZE >> 2] = ramdisk_size;

    dbg_assert(base_ptr + real_mode_kernel.length < 0xA0000);

    mem8.set(real_mode_kernel, base_ptr);
    mem8.set(protected_mode_kernel, KERNEL_HIGH_ADDRESS);

    return {
        option_rom:
        {
            name: "genroms/kernel.bin",
            data: make_linux_boot_rom(real_mode_segment, heap_end),
        }
    };
}

function make_linux_boot_rom(real_mode_segment, heap_end)
{
    const SIZE = 0x200;
    const data8 = new Uint8Array(0x100);
    const data16 = new Uint16Array(data8.buffer);

    data16[0] = 0xAA55;
    data8[2] = SIZE / 0x200;

    let i = 3;
    data8[i++] = 0xFA; // cli
    data8[i++] = 0xB8; // mov ax, real_mode_segment
    data8[i++] = real_mode_segment >> 0;
    data8[i++] = real_mode_segment >> 8;
    data8[i++] = 0x8E; data8[i++] = 0xC0; // mov es, ax
    data8[i++] = 0x8E; data8[i++] = 0xD8; // mov ds, ax
    data8[i++] = 0x8E; data8[i++] = 0xE0; // mov fs, ax
    data8[i++] = 0x8E; data8[i++] = 0xE8; // mov gs, ax
    data8[i++] = 0x8E; data8[i++] = 0xD0; // mov ss, ax
    data8[i++] = 0xBC; // mov sp, heap_end
    data8[i++] = heap_end >> 0;
    data8[i++] = heap_end >> 8;
    data8[i++] = 0xEA; // jmp (real_mode_segment+0x20):0x0
    data8[i++] = 0x00;
    data8[i++] = 0x00;
    data8[i++] = real_mode_segment + 0x20 >> 0;
    data8[i++] = real_mode_segment + 0x20 >> 8;

    dbg_assert(i < SIZE);

    const checksum_index = i;
    data8[checksum_index] = 0;

    let checksum = 0;
    for(let i = 0; i < data8.length; i++) checksum += data8[i];
    data8[checksum_index] = -checksum;

    return data8;
}
