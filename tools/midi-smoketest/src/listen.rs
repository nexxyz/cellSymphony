use anyhow::{bail, Context, Result};
use midir::{Ignore, MidiInput};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub fn listen(name_contains: &str, ms: u64) -> Result<()> {
    let mut input = MidiInput::new("cellsymphony-smoketest-listen").context("create MidiInput")?;
    input.ignore(Ignore::None);
    let ports = input.ports();
    let needle = name_contains.to_lowercase();
    let mut found = None;
    for (i, p) in ports.iter().enumerate() {
        let name = input.port_name(p).unwrap_or_default();
        if name.to_lowercase().contains(&needle) {
            found = Some((i, p.clone(), name));
            break;
        }
    }
    let Some((idx, port, port_name)) = found else {
        bail!("no input port contains '{name_contains}'");
    };
    println!("Listening on [{idx}] {port_name} for {ms}ms");

    let received: Arc<Mutex<Vec<Vec<u8>>>> = Arc::new(Mutex::new(Vec::new()));
    let rx = received.clone();
    let _conn = input
        .connect(
            &port,
            "cellsymphony-smoketest-listen-conn",
            move |_stamp, msg, _| {
                rx.lock().unwrap().push(msg.to_vec());
            },
            (),
        )
        .context("connect input")?;

    let start = Instant::now();
    while start.elapsed() < Duration::from_millis(ms) {
        std::thread::sleep(Duration::from_millis(10));
    }

    let msgs = received.lock().unwrap();
    println!("Received {} messages", msgs.len());
    for (i, m) in msgs.iter().enumerate() {
        println!("  {i:04}: {:02X?}", m);
    }
    Ok(())
}
