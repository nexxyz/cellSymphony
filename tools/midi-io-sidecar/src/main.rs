use anyhow::{Context, Result};
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};
use std::sync::{Arc, Mutex};

#[derive(Debug, Deserialize)]
#[serde(tag = "cmd")]
enum Cmd {
    #[serde(rename = "list")]
    List,
    #[serde(rename = "select_out")]
    SelectOut { name_contains: String },
    #[serde(rename = "select_in")]
    SelectIn { name_contains: String },
    #[serde(rename = "send")]
    Send { bytes: Vec<u8> },
    #[serde(rename = "close_in")]
    CloseIn,
    #[serde(rename = "close_out")]
    CloseOut,
    #[serde(rename = "quit")]
    Quit,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum Event {
    #[serde(rename = "ports")]
    Ports {
        inputs: Vec<Port>,
        outputs: Vec<Port>,
    },
    #[serde(rename = "selected")]
    Selected {
        input: Option<String>,
        output: Option<String>,
    },
    #[serde(rename = "recv")]
    Recv { bytes: Vec<u8> },
    #[serde(rename = "status")]
    Status { ok: bool, message: String },
}

#[derive(Debug, Serialize)]
struct Port {
    name: String,
}

fn list_ports() -> Result<(Vec<String>, Vec<String>)> {
    let out = MidiOutput::new("cellsymphony-sidecar-out")?;
    let outs = out
        .ports()
        .iter()
        .map(|p| out.port_name(p).unwrap_or_else(|_| "<unknown>".to_string()))
        .collect::<Vec<_>>();

    let mut input = MidiInput::new("cellsymphony-sidecar-in")?;
    input.ignore(Ignore::None);
    let ins = input
        .ports()
        .iter()
        .map(|p| {
            input
                .port_name(p)
                .unwrap_or_else(|_| "<unknown>".to_string())
        })
        .collect::<Vec<_>>();

    Ok((ins, outs))
}

fn find_idx(names: &[String], needle: &str) -> Option<usize> {
    let n = needle.to_lowercase();
    names
        .iter()
        .enumerate()
        .find(|(_, name)| name.to_lowercase().contains(&n))
        .map(|(i, _)| i)
}

fn main() -> Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    let mut out_conn: Option<MidiOutputConnection> = None;
    let mut _in_conn: Option<MidiInputConnection<()>> = None;
    let selected_out: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let selected_in: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    for line in stdin.lock().lines() {
        let line = line.context("read stdin")?;
        if line.trim().is_empty() {
            continue;
        }
        let cmd: Cmd = serde_json::from_str(&line).context("parse cmd json")?;
        match cmd {
            Cmd::List => {
                let (ins, outs) = list_ports().context("list ports")?;
                let evt = Event::Ports {
                    inputs: ins.into_iter().map(|name| Port { name }).collect(),
                    outputs: outs.into_iter().map(|name| Port { name }).collect(),
                };
                writeln!(stdout, "{}", serde_json::to_string(&evt)?)?;
                stdout.flush()?;
            }
            Cmd::SelectOut { name_contains } => {
                drop(out_conn.take());
                *selected_out.lock().unwrap() = None;

                let out = MidiOutput::new("cellsymphony-sidecar-out")?;
                let ports = out.ports();
                let names = ports
                    .iter()
                    .map(|p| out.port_name(p).unwrap_or_else(|_| "<unknown>".to_string()))
                    .collect::<Vec<_>>();
                let idx = find_idx(&names, &name_contains)
                    .ok_or_else(|| anyhow::anyhow!("no output matches"))?;
                let port = ports.get(idx).context("port idx")?;
                let conn = out.connect(port, "cellsymphony-sidecar-out-conn")?;
                let name = names[idx].clone();
                *selected_out.lock().unwrap() = Some(name.clone());
                out_conn = Some(conn);
                let evt = Event::Selected {
                    input: selected_in.lock().unwrap().clone(),
                    output: Some(name),
                };
                writeln!(stdout, "{}", serde_json::to_string(&evt)?)?;
                stdout.flush()?;
            }
            Cmd::SelectIn { name_contains } => {
                _in_conn = None;
                *selected_in.lock().unwrap() = None;

                let mut input = MidiInput::new("cellsymphony-sidecar-in")?;
                input.ignore(Ignore::None);
                let ports = input.ports();
                let names = ports
                    .iter()
                    .map(|p| {
                        input
                            .port_name(p)
                            .unwrap_or_else(|_| "<unknown>".to_string())
                    })
                    .collect::<Vec<_>>();
                let idx = find_idx(&names, &name_contains)
                    .ok_or_else(|| anyhow::anyhow!("no input matches"))?;
                let port = ports.get(idx).context("port idx")?;
                let name = names[idx].clone();

                let mut out_stdout = io::stdout();
                let conn = input.connect(
                    port,
                    "cellsymphony-sidecar-in-conn",
                    move |_stamp, msg, _| {
                        let evt = Event::Recv {
                            bytes: msg.to_vec(),
                        };
                        let _ = writeln!(out_stdout, "{}", serde_json::to_string(&evt).unwrap());
                        let _ = out_stdout.flush();
                    },
                    (),
                )?;
                *selected_in.lock().unwrap() = Some(name.clone());
                _in_conn = Some(conn);

                let evt = Event::Selected {
                    input: Some(name),
                    output: selected_out.lock().unwrap().clone(),
                };
                writeln!(stdout, "{}", serde_json::to_string(&evt)?)?;
                stdout.flush()?;
            }
            Cmd::Send { bytes } => {
                if let Some(conn) = out_conn.as_mut() {
                    conn.send(&bytes).map_err(|e| anyhow::anyhow!(e))?;
                }
                let evt = Event::Status {
                    ok: true,
                    message: "sent".to_string(),
                };
                writeln!(stdout, "{}", serde_json::to_string(&evt)?)?;
                stdout.flush()?;
            }
            Cmd::CloseIn => {
                _in_conn = None;
                *selected_in.lock().unwrap() = None;
                writeln!(
                    stdout,
                    "{}",
                    serde_json::to_string(&Event::Status {
                        ok: true,
                        message: "in closed".to_string()
                    })?
                )?;
                stdout.flush()?;
            }
            Cmd::CloseOut => {
                drop(out_conn.take());
                *selected_out.lock().unwrap() = None;
                writeln!(
                    stdout,
                    "{}",
                    serde_json::to_string(&Event::Status {
                        ok: true,
                        message: "out closed".to_string()
                    })?
                )?;
                stdout.flush()?;
            }
            Cmd::Quit => {
                break;
            }
        }
    }
    Ok(())
}
