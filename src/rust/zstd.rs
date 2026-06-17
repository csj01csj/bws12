// Bindings for the zstd streaming decompressor
// See https://facebook.github.io/zstd/zstd_manual.html

extern "C" {
    // Create a decompression context. Must be freed with ZSTD_freeDCtx.
    fn ZSTD_createDCtx() -> usize;
    // Free a decompression context.
    fn ZSTD_freeDCtx(ctx: usize);

    // Initialize streaming decompression
    fn ZSTD_decompressStream(
        ctx: usize,
        output_buffer: *mut u8,
        output_size: usize,
        output_pos: *mut usize,
        input_buffer: *const u8,
        input_size: usize,
        input_pos: *mut usize,
    ) -> usize;

    fn ZSTD_isError(code: usize) -> bool;
    fn ZSTD_getErrorName(code: usize) -> *const u8;
}

pub struct ZstdContext {
    ctx: usize,
}
impl ZstdContext {
    pub fn new() -> ZstdContext {
        ZstdContext {
            ctx: unsafe { ZSTD_createDCtx() },
        }
    }

    pub fn decompress_into(
        &mut self,
        output_buffer: &mut [u8],
        input_buffer: &[u8],
    ) -> Result<(usize, usize), String> {
        let mut output_pos = 0usize;
        let mut input_pos = 0usize;
        let result = unsafe {
            ZSTD_decompressStream(
                self.ctx,
                output_buffer.as_mut_ptr(),
                output_buffer.len(),
                &mut output_pos,
                input_buffer.as_ptr(),
                input_buffer.len(),
                &mut input_pos,
            )
        };

        if unsafe { ZSTD_isError(result) } {
            let msg_ptr = unsafe { ZSTD_getErrorName(result) };
            let mut msg_len = 0;
            while unsafe { *msg_ptr.add(msg_len) } != 0 {
                msg_len += 1;
            }
            let msg_bytes = unsafe { std::slice::from_raw_parts(msg_ptr, msg_len) };
            let msg = std::str::from_utf8(msg_bytes)
                .unwrap_or("zstd error")
                .to_string();
            Err(msg)
        }
        else {
            Ok((output_pos, input_pos))
        }
    }
}
impl Drop for ZstdContext {
    fn drop(&mut self) { unsafe { ZSTD_freeDCtx(self.ctx) } }
}
