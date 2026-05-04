use anyhow::{bail, Context, Result};
use midir::{Ignore, MidiInput, MidiOutput};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

mod listen;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() <= 1 {
        print_help();
        return Ok(());
    }

    match args[1].as_str() {
        "list" => cmd_list(),
        "loopback" => {
            let out_contains = args.get(2).map(|s| s.as_str()).unwrap_or("loopMIDI");
            let in_contains = args.get(3).map(|s| s.as_str()).unwrap_or(out_contains);
            cmd_loopback(out_contains, in_contains)
        }
        "listen" => {
            let in_contains = args.get(2).map(|s| s.as_str()).unwrap_or("loopMIDI");
            let ms = args
                .get(3)
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(1500);
            listen::listen(in_contains, ms)
        }
        _ => {
            print_help();
            Ok(())
        }
    }
}

fn print_help() {
    println!("midi-smoketest");
    println!("");
    println!("Usage:");
    println!("  midi-smoketest list");
    println!("  midi-smoketest loopback <out_name_contains> <in_name_contains>");
    println!("  midi-smoketest listen <in_name_contains> <ms>");
    println!("");
    println!("Example:");
    println!("  midi-smoketest loopback loopMIDI loopMIDI");
}

fn cmd_list() -> Result<()> {
    let out = MidiOutput::new("cellsymphony-smoketest-out").context("create MidiOutput")?;
    let out_ports = out.ports();
    println!("MIDI outputs:");
    for (i, p) in out_ports.iter().enumerate() {
        let name = out.port_name(p).unwrap_or_else(|_| "<unknown>".to_string());
        println!("  [{i}] {name}");
    }

    let mut input = MidiInput::new("cellsymphony-smoketest-in").context("create MidiInput")?;
    input.ignore(Ignore::None);
    let in_ports = input.ports();
    println!("MIDI inputs:");
    for (i, p) in in_ports.iter().enumerate() {
        let name = input
            .port_name(p)
            .unwrap_or_else(|_| "<unknown>".to_string());
        println!("  [{i}] {name}");
    }
    Ok(())
}

fn find_port_by_name_contains<T, F>(ports: &[T], mut name_of: F, needle: &str) -> Result<usize>
where
    F: FnMut(&T) -> Result<String>,
{
    let needle_lc = needle.to_lowercase();
    for (i, p) in ports.iter().enumerate() {
        let name = name_of(p)?;
        if name.to_lowercase().contains(&needle_lc) {
            return Ok(i);
        }
    }
    bail!("no port name contains '{needle}'")
}

fn cmd_loopback(out_contains: &str, in_contains: &str) -> Result<()> {
    let out = MidiOutput::new("cellsymphony-smoketest-out").context("create MidiOutput")?;
    let out_ports = out.ports();
    let out_idx = find_port_by_name_contains(
        &out_ports,
        |p| out.port_name(p).map_err(Into::into),
        out_contains,
    )?;
    let out_port = &out_ports[out_idx];
    let out_name = out.port_name(out_port).context("out port_name")?;

    let mut input = MidiInput::new("cellsymphony-smoketest-in").context("create MidiInput")?;
    input.ignore(Ignore::None);
    let in_ports = input.ports();
    let in_idx = find_port_by_name_contains(
        &in_ports,
        |p| input.port_name(p).map_err(Into::into),
        in_contains,
    )?;
    let in_port = &in_ports[in_idx];
    let in_name = input.port_name(in_port).context("in port_name")?;

    println!("Using out: {out_name}");
    println!("Using in : {in_name}");

    let received: Arc<Mutex<Vec<Vec<u8>>>> = Arc::new(Mutex::new(Vec::new()));
    let received_in = received.clone();

    let _conn_in = input
        .connect(
            in_port,
            "cellsymphony-smoketest-in-conn",
            move |_stamp, msg, _| {
                received_in.lock().unwrap().push(msg.to_vec());
            },
            (),
        )
        .context("connect input")?;

    let mut conn_out = out
        .connect(out_port, "cellsymphony-smoketest-out-conn")
        .context("connect output")?;

    // Send a short sequence and wait for loopback.
    let seq: &[&[u8]] = &[
        &[0xFA], // Start
        &[0xF8],
        &[0xF8],
        &[0xF8],          // 3 clocks
        &[0xFC],          // Stop
        &[0xFB],          // Continue
        &[0x90, 60, 100], // Note on
        &[0x80, 60, 0],   // Note off
    ];

    for msg in seq {
        conn_out.send(msg).context("send")?;
        std::thread::sleep(Duration::from_millis(2));
    }

    let start = Instant::now();
    while start.elapsed() < Duration::from_millis(250) {
        let got = received.lock().unwrap().len();
        if got >= seq.len() {
            break;
        }
        std::thread::sleep(Duration::from_millis(5));
    }

    let msgs = received.lock().unwrap().clone();
    println!("Received {} messages", msgs.len());
    for (i, m) in msgs.iter().enumerate() {
        println!("  {i:02}: {:02X?}", m);
    }

    // Basic assertion: we should receive at least the system realtime bytes.
    if msgs.is_empty() {
        bail!("no messages received; loopback not working");
    }
    Ok(())
}
