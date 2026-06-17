#![allow(non_upper_case_globals)]

extern "C" {
    fn cpu_exception_hook(interrupt: i32) -> bool;
    fn microtick() -> f64;
    fn call_indirect1(f: i32, x: u16);
    fn pic_acknowledge();

    pub fn io_port_read8(port: i32) -> i32;
    pub fn io_port_read16(port: i32) -> i32;
    pub fn io_port_read32(port: i32) -> i32;

    pub fn io_port_write8(port: i32, value: i32);
    pub fn io_port_write16(port: i32, value: i32);
    pub fn io_port_write32(port: i32, value: i32);
}