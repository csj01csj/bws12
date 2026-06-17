"use strict";

/** @const */
var DAC_QUEUE_RESERVE = 0.2;

/** @const */
var AUDIOBUFFER_MINIMUM_SAMPLE_SIZE = 4096;

/**
 * @constructor
 *
 * @param {BusConnector} bus
 */
function SpeakerAdapter(bus)
{
    if(typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined")
    {
        console.warn("Web Audio API is not supported in this browser. Sound is disabled.");
        return;
    }

    /** @type {AudioContext} */
    var audio_context = new (AudioContext || webkitAudioContext)();

    /** @type {boolean} */
    var audio_context_running = audio_context.state === "running";

    audio_context.addEventListener("statechange", function()
    {
        audio_context_running = audio_context.state === "running";
    });

    var speaker = this;

    var pcm_buffered_time = 0;

    // Nodes
    /** @type {GainNode} */
    var master_gain = audio_context.createGain();
    master_gain.gain.setValueAtTime(1, audio_context.currentTime);
    master_gain.connect(audio_context.destination);

    var beep_gain = audio_context.createGain();
    beep_gain.gain.setValueAtTime(0, audio_context.currentTime);
    beep_gain.connect(master_gain);

    var dac_gain = audio_context.createGain();
    dac_gain.gain.setValueAtTime(1, audio_context.currentTime);
    dac_gain.connect(master_gain);

    bus.register("speaker-update-gain", function(data) {
        master_gain.gain.setValueAtTime(data / 100, audio_context.currentTime);
    }, this);

    // ---- Beeper ----

    /** @type {OscillatorNode} */
    var beep_oscillator = audio_context.createOscillator();
    beep_oscillator.type = "square";
    beep_oscillator.frequency.setValueAtTime(440, audio_context.currentTime);
    beep_oscillator.connect(beep_gain);
    beep_oscillator.start();

    bus.register("speaker-beep-enable", function(data)
    {
        beep_gain.gain.setValueAtTime(1, audio_context.currentTime);
    }, this);

    bus.register("speaker-beep-disable", function(data)
    {
        beep_gain.gain.setValueAtTime(0, audio_context.currentTime);
    }, this);

    bus.register("speaker-beep-frequency", function(frequency)
    {
        beep_oscillator.frequency.setValueAtTime(frequency, audio_context.currentTime);
    }, this);

    // ---- DAC ----

    /**
     * Queue of PCM audio buffers to be played
     * @type {Array<{buffer: AudioBuffer, time: number}>}
     */
    this.dac_queue = [];

    bus.register("speaker-process", function(data)
    {
        speaker.dac_process(data);
    }, this);

    /**
     * Process samples from the emulated hardware. Called at emulation time.
     * @param {{sample_rate: number, stereo: boolean, data: [Float32Array, Float32Array]}} data
     */
    this.dac_process = function(data)
    {
        if(!audio_context_running) return;

        var sample_rate = data["sample_rate"];
        var stereo = data["stereo"];
        var channels = data["data"];

        var num_samples = channels[0].length;
        if(num_samples === 0) return;

        // Create audio buffer
        var num_channels = stereo ? 2 : 1;
        var buffer = audio_context.createBuffer(num_channels, num_samples, sample_rate);

        for(var i = 0; i < num_channels; i++)
        {
            buffer.copyToChannel(channels[i], i);
        }

        // Schedule the buffer
        var current_time = audio_context.currentTime;
        var buffer_duration = num_samples / sample_rate;

        if(pcm_buffered_time < current_time)
        {
            pcm_buffered_time = current_time + DAC_QUEUE_RESERVE;
        }

        var source = audio_context.createBufferSource();
        source.buffer = buffer;
        source.connect(dac_gain);
        source.start(pcm_buffered_time);

        pcm_buffered_time += buffer_duration;
    };

    // ---- Midi ----

    var midi_samplerate = 11025;
    var midi_WaveTable = {};

    var num_midi_channels = 16;
    var midi_channels = new Array(num_midi_channels);
    var midi_channel_programs = new Uint8Array(num_midi_channels);
    var midi_master_volume = 1;

    for(var i = 0; i < num_midi_channels; i++)
    {
        midi_channels[i] = {
            volume: 127,
            expression: 127,
            pitchbend: 0,
            notes: [],
        };
    }

    bus.register("midi-send-data", function(data)
    {
        speaker.midi_send(data);
    }, this);

    this.midi_send = function(data)
    {
        var status = data[0];
        var type = status >> 4;
        var channel = status & 0xF;

        if(type === 0x9 || type === 0x8) // Note on / off
        {
            var note = data[1];
            var velocity = data[2];

            if(type === 0x9 && velocity > 0)
            {
                this.midi_note_on(channel, note, velocity);
            }
            else
            {
                this.midi_note_off(channel, note);
            }
        }
        else if(type === 0xB) // Control change
        {
            var controller = data[1];
            var value = data[2];

            if(controller === 7) // Channel volume
            {
                midi_channels[channel].volume = value;
            }
            else if(controller === 11) // Expression
            {
                midi_channels[channel].expression = value;
            }
        }
        else if(type === 0xC) // Program change
        {
            midi_channel_programs[channel] = data[1];
        }
        else if(type === 0xE) // Pitch bend
        {
            midi_channels[channel].pitchbend = ((data[2] << 7) | data[1]) - 8192;
        }
    };

    this.midi_note_on = function(channel, note, velocity)
    {
        if(!audio_context_running) return;

        var program = midi_channel_programs[channel];
        var sample = midi_WaveTable[program] && midi_WaveTable[program][note];

        if(!sample) return;

        var buffer = audio_context.createBuffer(1, sample.length, midi_samplerate);
        buffer.copyToChannel(sample, 0);

        var gain = audio_context.createGain();
        var chan = midi_channels[channel];
        var gain_value = (velocity / 127) * (chan.volume / 127) * (chan.expression / 127) * midi_master_volume;
        gain.gain.setValueAtTime(gain_value, audio_context.currentTime);
        gain.connect(master_gain);

        var source = audio_context.createBufferSource();
        source.buffer = buffer;

        if(midi_channels[channel].pitchbend !== 0)
        {
            var pitch_ratio = Math.pow(2, midi_channels[channel].pitchbend / 8192 * 2 / 12);
            source.playbackRate.setValueAtTime(pitch_ratio, audio_context.currentTime);
        }

        source.connect(gain);
        source.start();
        source.onended = function()
        {
            gain.disconnect();
        };

        midi_channels[channel].notes.push({ source: source, gain: gain });
    };

    this.midi_note_off = function(channel, note)
    {
        var notes = midi_channels[channel].notes;

        for(var i = 0; i < notes.length; i++)
        {
            var n = notes[i];
            n.gain.gain.setTargetAtTime(0, audio_context.currentTime, 0.1);
            n.source.stop(audio_context.currentTime + 0.5);
        }

        midi_channels[channel].notes = [];
    };

    bus.register("midi-set-wavetable", function(data)
    {
        speaker.set_wavetable(data);
    }, this);

    this.set_wavetable = function(data)
    {
        midi_WaveTable = {};

        for(var program = 0; program < data.length; program++)
        {
            if(!data[program]) continue;

            midi_WaveTable[program] = {};

            for(var note = 0; note < data[program].length; note++)
            {
                if(!data[program][note]) continue;

                midi_WaveTable[program][note] = data[program][note];
            }
        }
    };

    bus.register("speaker-set-master-volume", function(data)
    {
        midi_master_volume = data;
        master_gain.gain.setValueAtTime(data, audio_context.currentTime);
    }, this);
}
