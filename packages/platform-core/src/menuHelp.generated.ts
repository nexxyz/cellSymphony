export type MenuHelpEntry = {
  id: string;
  path: string;
  key: string;
  kind: string;
  title: string;
  line1: string;
  line2: string;
};

export const MENU_HELP_ENTRIES: MenuHelpEntry[] = [
  {
    "id": "default_group",
    "path": "*",
    "key": "",
    "kind": "group",
    "title": "Section",
    "line1": "Opens this submenu and shows related settings.",
    "line2": "Use Enter to open and Back to return."
  },
  {
    "id": "default_action",
    "path": "*",
    "key": "",
    "kind": "action",
    "title": "Action",
    "line1": "Runs this command.",
    "line2": "Use this when you want to execute the highlighted action."
  },
  {
    "id": "default_number",
    "path": "*",
    "key": "",
    "kind": "number",
    "title": "Number Setting",
    "line1": "Adjusts a numeric value.",
    "line2": "Enter edit mode, then turn encoder to change it."
  },
  {
    "id": "default_enum",
    "path": "*",
    "key": "",
    "kind": "enum",
    "title": "Option Setting",
    "line1": "Selects one option from a list.",
    "line2": "Enter edit mode, then turn encoder to choose."
  },
  {
    "id": "default_bool",
    "path": "*",
    "key": "",
    "kind": "bool",
    "title": "Toggle Setting",
    "line1": "Selects Off or On.",
    "line2": "Enter edit mode, then turn encoder to choose."
  },
  {
    "id": "default_text",
    "path": "*",
    "key": "",
    "kind": "text",
    "title": "Text Setting",
    "line1": "Edits text for this field.",
    "line2": "Use the encoder to move cursor and adjust characters."
  },
  {
    "id": "action_any",
    "path": "*",
    "key": "action:*",
    "kind": "action",
    "title": "Action",
    "line1": "Runs this command.",
    "line2": "Use this when you want to execute the highlighted action."
  },
  {
    "id": "number_any",
    "path": "*",
    "key": "key:*",
    "kind": "number",
    "title": "Number Setting",
    "line1": "Adjusts a numeric value.",
    "line2": "Enter edit mode, then turn encoder to change it."
  },
  {
    "id": "enum_any",
    "path": "*",
    "key": "key:*",
    "kind": "enum",
    "title": "Option Setting",
    "line1": "Selects one option from a list.",
    "line2": "Enter edit mode, then turn encoder to choose."
  },
  {
    "id": "bool_any",
    "path": "*",
    "key": "key:*",
    "kind": "bool",
    "title": "Toggle Setting",
    "line1": "Selects Off or On.",
    "line2": "Enter edit mode, then turn encoder to choose."
  },
  {
    "id": "text_any",
    "path": "*",
    "key": "key:*",
    "kind": "text",
    "title": "Text Setting",
    "line1": "Edits text for this field.",
    "line2": "Use the encoder to move cursor and adjust characters."
  },
  {
    "id": "life_spawn_shared",
    "path": "*",
    "key": "action:behavior_action:spawnRandom",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Spawns new cells or entities for the active Life behavior.",
    "line2": "This is mapped as a shared action across compatible behaviors."
  },
  {
    "id": "life_spawn_shared_brain",
    "path": "*",
    "key": "action:behavior_action:seedRandom",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Seeds random active cells for Brian's Brain.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_ant",
    "path": "*",
    "key": "action:behavior_action:spawnAnt",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Adds an ant to the current grid.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_bounce",
    "path": "*",
    "key": "action:behavior_action:addBall",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Adds a ball to the simulation.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_pulse",
    "path": "*",
    "key": "action:behavior_action:spawnPulse",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Spawns a pulse shape.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_rain",
    "path": "*",
    "key": "action:behavior_action:dropNow",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Drops a new raindrop immediately.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_dla",
    "path": "*",
    "key": "action:behavior_action:seedCluster",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Seeds a new DLA cluster.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "life_spawn_shared_glider",
    "path": "*",
    "key": "action:behavior_action:spawnGlider",
    "kind": "action",
    "title": "Spawn Now",
    "line1": "Spawns a glider pattern.",
    "line2": "This shares the same Spawn Now intent across behaviors."
  },
  {
    "id": "preset_save_current",
    "path": "System > Presets > Library > Save Current",
    "key": "action:preset_save_current",
    "kind": "action",
    "title": "Save Current",
    "line1": "Saves changes to the currently loaded preset file.",
    "line2": "If no preset is loaded, this action is unavailable."
  },
  {
    "id": "preset_refresh",
    "path": "System > Presets > Library > Refresh List",
    "key": "action:refresh_presets",
    "kind": "action",
    "title": "Refresh List",
    "line1": "Refreshes preset names from storage.",
    "line2": "Use this if files changed outside the app."
  },
  {
    "id": "preset_save",
    "path": "System > Presets > Library > Save As > Save",
    "key": "action:preset_save",
    "kind": "action",
    "title": "Save As",
    "line1": "Saves the current configuration to the name you entered.",
    "line2": "If the name exists, confirmation is required."
  },
  {
    "id": "preset_load_dynamic",
    "path": "System > Presets > Library > Load > *",
    "key": "action:preset_load:*",
    "kind": "action",
    "title": "Load Preset",
    "line1": "Loads the selected preset and replaces current runtime configuration.",
    "line2": "Use Save Current or Save As first if you want to keep edits."
  },
  {
    "id": "preset_delete_dynamic",
    "path": "System > Presets > Library > Delete > *",
    "key": "action:preset_delete:*",
    "kind": "action",
    "title": "Delete Preset",
    "line1": "Deletes the selected preset from storage.",
    "line2": "This action asks for confirmation."
  },
  {
    "id": "preset_rename_pick",
    "path": "System > Presets > Library > Rename > *",
    "key": "action:preset_rename_pick:*",
    "kind": "action",
    "title": "Rename Preset",
    "line1": "Chooses the preset that will be renamed.",
    "line2": "Then enter a new name and apply."
  },
  {
    "id": "midi_enabled",
    "path": "System > MIDI > Enabled",
    "key": "key:midi.enabled",
    "kind": "bool",
    "title": "MIDI Enabled",
    "line1": "Turns MIDI features on or off.",
    "line2": "Disable if you want the engine to run without MIDI I/O."
  },
  {
    "id": "midi_panic",
    "path": "System > MIDI > !Panic",
    "key": "action:midi_panic",
    "kind": "action",
    "title": "Panic",
    "line1": "Sends all-notes-off style panic to clear stuck notes.",
    "line2": "Use this if external devices hang notes."
  },
  {
    "id": "midi_out_disconnect",
    "path": "System > MIDI > MIDI Out > Disconnect",
    "key": "action:midi_select_output:null",
    "kind": "action",
    "title": "MIDI Out Disconnect",
    "line1": "Disconnects the current MIDI output target.",
    "line2": "No MIDI output port will be selected."
  },
  {
    "id": "midi_in_disconnect",
    "path": "System > MIDI > MIDI In > Disconnect",
    "key": "action:midi_select_input:null",
    "kind": "action",
    "title": "MIDI In Disconnect",
    "line1": "Disconnects the current MIDI input source.",
    "line2": "No MIDI input port will be selected."
  },
  {
    "id": "midi_out_dynamic",
    "path": "System > MIDI > MIDI Out > *",
    "key": "action:midi_select_output:*",
    "kind": "action",
    "title": "Select MIDI Output",
    "line1": "Selects this MIDI output device for note/event transmission.",
    "line2": "Use Disconnect to clear selection."
  },
  {
    "id": "midi_in_dynamic",
    "path": "System > MIDI > MIDI In > *",
    "key": "action:midi_select_input:*",
    "kind": "action",
    "title": "Select MIDI Input",
    "line1": "Selects this MIDI input device for transport/sync control.",
    "line2": "Use Disconnect to clear selection."
  },
  {
    "id": "midi_sync_mode",
    "path": "System > MIDI > Sync & Clock > Sync Mode",
    "key": "key:midi.syncMode",
    "kind": "enum",
    "title": "Sync Mode",
    "line1": "Chooses whether timing is internal or external MIDI clock.",
    "line2": "External mode follows incoming clock when enabled."
  },
  {
    "id": "midi_clock_out",
    "path": "System > MIDI > Sync & Clock > Clock Out",
    "key": "key:midi.clockOutEnabled",
    "kind": "bool",
    "title": "Clock Out",
    "line1": "Enables outgoing MIDI clock messages.",
    "line2": "Useful when other gear should follow this transport."
  },
  {
    "id": "midi_clock_in",
    "path": "System > MIDI > Sync & Clock > Clock In",
    "key": "key:midi.clockInEnabled",
    "kind": "bool",
    "title": "Clock In",
    "line1": "Enables incoming MIDI clock processing.",
    "line2": "Required to follow external timing."
  },
  {
    "id": "midi_respond_start_stop",
    "path": "System > MIDI > Sync & Clock > Respond Start/Stop",
    "key": "key:midi.respondToStartStop",
    "kind": "bool",
    "title": "Respond Start/Stop",
    "line1": "When enabled, external MIDI Start/Stop controls transport.",
    "line2": "When disabled, transport reacts only to local controls."
  },
  {
    "id": "life_section",
    "path": "Menu > L1: Life",
    "key": "",
    "kind": "group",
    "title": "Life Layer",
    "line1": "Configures the active Life behavior and how fast it advances.",
    "line2": "Use this area to shape the cellular process before sensing/audio mapping."
  },
  {
    "id": "life_step_rate",
    "path": "*",
    "key": "key:algorithmStepUnit",
    "kind": "enum",
    "title": "Step Rate",
    "line1": "Sets how often the Life algorithm advances per musical time unit.",
    "line2": "Faster rates evolve patterns quickly; slower rates make longer-form motion."
  },
  {
    "id": "life_behavior",
    "path": "*",
    "key": "key:activeBehavior",
    "kind": "enum",
    "title": "Behavior",
    "line1": "Options: life, brain, ant, bounce, pulse, raindrops, dla, glider, sequencer, shapes.",
    "line2": "Each option changes simulation logic and event density; switching reinitializes behavior state."
  },
  {
    "id": "sense_section",
    "path": "Menu > L2: Sense",
    "key": "",
    "kind": "group",
    "title": "Sense Layer",
    "line1": "Controls how grid activity is interpreted into trigger intents.",
    "line2": "This is where scan/event sources get routed toward instruments."
  },
  {
    "id": "scan_mode",
    "path": "*",
    "key": "key:scanMode",
    "kind": "enum",
    "title": "Scan Mode",
    "line1": "Options: no scan, scanning. no scan uses whole-grid interpretation without a scan cursor.",
    "line2": "scanning moves a cursor by scan unit/axis/direction and emits scanned/scanned-empty triggers."
  },
  {
    "id": "scan_axis",
    "path": "*",
    "key": "key:scanAxis",
    "kind": "enum",
    "title": "Scan Axis",
    "line1": "Sets whether scanning traverses rows or columns.",
    "line2": "Combine with Scan Direction to define scan movement."
  },
  {
    "id": "scan_unit",
    "path": "*",
    "key": "key:scanUnit",
    "kind": "enum",
    "title": "Scan Unit",
    "line1": "Sets scan cursor advance rate in musical units.",
    "line2": "Smaller units move faster; larger units move slower."
  },
  {
    "id": "scan_direction",
    "path": "*",
    "key": "key:scanDirection",
    "kind": "enum",
    "title": "Scan Direction",
    "line1": "Sets scan travel direction along the selected axis.",
    "line2": "Use reverse for back-and-forth style phrasing with manual resets."
  },
  {
    "id": "event_enabled",
    "path": "*",
    "key": "key:eventEnabled",
    "kind": "bool",
    "title": "Event Triggers",
    "line1": "Enables transition triggers such as activate/deactivate.",
    "line2": "Disable to ignore transition events and rely on state scanning only."
  },
  {
    "id": "state_enabled",
    "path": "*",
    "key": "key:stateEnabled",
    "kind": "bool",
    "title": "State Notes",
    "line1": "Enables state-based scan triggers from current cell occupancy.",
    "line2": "Disable to use only transition events from cell changes."
  },
  {
    "id": "targets_group",
    "path": "Menu > L2: Sense > Instrument Targets",
    "key": "",
    "kind": "group",
    "title": "Instrument Targets",
    "line1": "Maps each trigger kind to an action and destination instrument slot.",
    "line2": "Use note_off actions for release-style lifecycle behavior."
  },
  {
    "id": "map_activate_action",
    "path": "*",
    "key": "key:mapping.activate.action",
    "kind": "enum",
    "title": "Activate Action",
    "line1": "Defines what happens when a cell becomes active.",
    "line2": "Default note_on starts notes on birth/spawn transitions."
  },
  {
    "id": "map_activate_channel",
    "path": "*",
    "key": "key:mapping.activate.channel",
    "kind": "enum",
    "title": "Activate Instrument",
    "line1": "Selects which instrument slot receives activate events.",
    "line2": "Displayed as 1..16 in UI and stored as slots 0..15."
  },
  {
    "id": "map_stable_action",
    "path": "*",
    "key": "key:mapping.stable.action",
    "kind": "enum",
    "title": "Stable Action",
    "line1": "Defines behavior for cells that stay active across updates.",
    "line2": "Default none avoids constant retriggering from unchanged active cells."
  },
  {
    "id": "map_stable_channel",
    "path": "*",
    "key": "key:mapping.stable.channel",
    "kind": "enum",
    "title": "Stable Instrument",
    "line1": "Selects destination instrument slot for stable triggers.",
    "line2": "Use with stable action when you want sustained-state gestures."
  },
  {
    "id": "map_deactivate_action",
    "path": "*",
    "key": "key:mapping.deactivate.action",
    "kind": "enum",
    "title": "Deactivate Action",
    "line1": "Defines what happens when a cell turns inactive.",
    "line2": "Default note_off releases matching notes in lifecycle workflows."
  },
  {
    "id": "map_deactivate_channel",
    "path": "*",
    "key": "key:mapping.deactivate.channel",
    "kind": "enum",
    "title": "Deactivate Instrument",
    "line1": "Selects destination instrument slot for deactivate triggers.",
    "line2": "Typically points to the same slot used by activate note_on."
  },
  {
    "id": "map_scanned_action",
    "path": "*",
    "key": "key:mapping.scanned.action",
    "kind": "enum",
    "title": "Scanned Action",
    "line1": "Defines behavior when scan encounters a filled cell.",
    "line2": "Default note_on makes scanning immediately audible."
  },
  {
    "id": "map_scanned_channel",
    "path": "*",
    "key": "key:mapping.scanned.channel",
    "kind": "enum",
    "title": "Scanned Instrument",
    "line1": "Selects destination instrument slot for scanned-filled triggers.",
    "line2": "Use different slots for layered scan/event voicing."
  },
  {
    "id": "map_scanned_empty_action",
    "path": "*",
    "key": "key:mapping.scanned_empty.action",
    "kind": "enum",
    "title": "Scanned Empty Action",
    "line1": "Defines behavior when scan encounters an empty cell.",
    "line2": "Default note_off can release held scan notes."
  },
  {
    "id": "map_scanned_empty_channel",
    "path": "*",
    "key": "key:mapping.scanned_empty.channel",
    "kind": "enum",
    "title": "Scanned Empty Instrument",
    "line1": "Selects destination instrument slot for scanned-empty triggers.",
    "line2": "Pair with scanned slot for directional hold-and-release patterns."
  },
  {
    "id": "voice_section",
    "path": "Menu > L3: Voice",
    "key": "",
    "kind": "group",
    "title": "Voice Layer",
    "line1": "Defines pitch mapping and instrument slot sound engines.",
    "line2": "This layer controls how sensed events become audible voices."
  },
  {
    "id": "note_mapping_group",
    "path": "Menu > L3: Voice > Note Mapping",
    "key": "",
    "kind": "group",
    "title": "Note Mapping",
    "line1": "Sets pitch quantization, range, and root/scale behavior.",
    "line2": "Applied before per-instrument synth shaping."
  },
  {
    "id": "pitch_start",
    "path": "*",
    "key": "key:pitch.startingNote",
    "kind": "number",
    "title": "Starting Note",
    "line1": "Sets the reference note before X/Y pitch step offsets are applied.",
    "line2": "Use this as the tonal center anchor."
  },
  {
    "id": "pitch_low",
    "path": "*",
    "key": "key:pitch.lowestNote",
    "kind": "number",
    "title": "Lowest Note",
    "line1": "Sets the lower bound for generated notes.",
    "line2": "Notes outside range are handled by Out of Range mode."
  },
  {
    "id": "pitch_high",
    "path": "*",
    "key": "key:pitch.highestNote",
    "kind": "number",
    "title": "Highest Note",
    "line1": "Sets the upper bound for generated notes.",
    "line2": "Together with Lowest Note this defines playable range."
  },
  {
    "id": "pitch_oor",
    "path": "*",
    "key": "key:pitch.outOfRange",
    "kind": "enum",
    "title": "Out of Range",
    "line1": "Chooses how pitch indices beyond bounds are handled.",
    "line2": "Clamp pins to edges; wrap folds back through the range."
  },
  {
    "id": "pitch_scale",
    "path": "*",
    "key": "key:pitch.scale",
    "kind": "enum",
    "title": "Scale",
    "line1": "Selects scale intervals used for pitch quantization.",
    "line2": "Use this to set harmonic language globally."
  },
  {
    "id": "pitch_root",
    "path": "*",
    "key": "key:pitch.root",
    "kind": "enum",
    "title": "Root",
    "line1": "Sets the tonic/root for selected scale quantization.",
    "line2": "Changing root transposes quantized output harmonically."
  },
  {
    "id": "inst_group",
    "path": "Menu > L3: Voice > Instruments",
    "key": "",
    "kind": "group",
    "title": "Instruments",
    "line1": "Contains the 16 instrument slots used by Sense routing.",
    "line2": "Each slot has independent MIDI and synth parameters."
  },
  {
    "id": "inst_slot",
    "path": "Menu > L3: Voice > Instruments > Instrument *",
    "key": "",
    "kind": "group",
    "title": "Instrument Slot",
    "line1": "Configures one instrument destination slot.",
    "line2": "Sense trigger mappings target these slots."
  },
  {
    "id": "inst_type",
    "path": "Menu > L3: Voice > Instruments > Instrument * > Type",
    "key": "",
    "kind": "enum",
    "title": "Instrument Type",
    "line1": "Options: synth (current), future types may include sampler.",
    "line2": "synth uses the slot's osc/amp/filter sections; changing type will switch engine parameter set."
  },
  {
    "id": "inst_note_behavior",
    "path": "*",
    "key": "key:instruments.*.noteBehavior",
    "kind": "enum",
    "title": "Note Behavior",
    "line1": "Controls retrigger versus hold behavior for this instrument slot.",
    "line2": "Use hold for lifecycle note_off workflows and scanned-empty release."
  },
  {
    "id": "inst_midi_enabled",
    "path": "*",
    "key": "key:instruments.*.midi.enabled",
    "kind": "bool",
    "title": "MIDI Enabled",
    "line1": "Enables external MIDI output for this instrument slot.",
    "line2": "Global MIDI must also be enabled in System > MIDI."
  },
  {
    "id": "inst_midi_channel",
    "path": "*",
    "key": "key:instruments.*.midi.channel",
    "kind": "number",
    "title": "MIDI Channel",
    "line1": "Selects outgoing MIDI channel for this instrument slot.",
    "line2": "Shown as 1..16 while stored internally as 0..15."
  },
  {
    "id": "osc_wave",
    "path": "*",
    "key": "key:instruments.*.synth.osc*.waveform",
    "kind": "enum",
    "title": "Oscillator Wave",
    "line1": "Selects the oscillator waveform shape.",
    "line2": "Use different waves per osc for richer timbre blends."
  },
  {
    "id": "osc_level",
    "path": "*",
    "key": "key:instruments.*.synth.osc*.levelPct",
    "kind": "number",
    "title": "Oscillator Level",
    "line1": "Sets this oscillator's contribution to the voice mix.",
    "line2": "Balance osc1/osc2 levels to shape tone body."
  },
  {
    "id": "osc_octave",
    "path": "*",
    "key": "key:instruments.*.synth.osc*.octave",
    "kind": "number",
    "title": "Oscillator Octave",
    "line1": "Offsets oscillator pitch in octave steps.",
    "line2": "Useful for layered bass/body/air intervals."
  },
  {
    "id": "osc_detune",
    "path": "*",
    "key": "key:instruments.*.synth.osc*.detuneCents",
    "kind": "number",
    "title": "Oscillator Detune",
    "line1": "Offsets oscillator pitch by cents for beating/width.",
    "line2": "Small detune values create motion without changing harmony."
  },
  {
    "id": "osc_pw",
    "path": "*",
    "key": "key:instruments.*.synth.osc*.pulseWidthPct",
    "kind": "number",
    "title": "Pulse Width",
    "line1": "Sets pulse duty cycle when pulse waveform is used.",
    "line2": "Ignored for non-pulse waveforms."
  },
  {
    "id": "amp_gain",
    "path": "*",
    "key": "key:instruments.*.synth.amp.gainPct",
    "kind": "number",
    "title": "Amp Gain",
    "line1": "Sets base loudness for this instrument slot.",
    "line2": "Use with Master Vol to balance global versus per-slot level."
  },
  {
    "id": "amp_vel",
    "path": "*",
    "key": "key:instruments.*.synth.amp.velocitySensitivityPct",
    "kind": "number",
    "title": "Velocity Sensitivity",
    "line1": "Controls how strongly note velocity affects loudness.",
    "line2": "Lower values flatten dynamics; higher values increase response."
  },
  {
    "id": "amp_env_adsr",
    "path": "*",
    "key": "key:instruments.*.synth.ampEnv.*",
    "kind": "number",
    "title": "Amp Envelope",
    "line1": "Shapes loudness over time using ADSR stages.",
    "line2": "Attack/Decay/Release are in ms; Sustain is level percentage."
  },
  {
    "id": "filt_type",
    "path": "*",
    "key": "key:instruments.*.synth.filter.type",
    "kind": "enum",
    "title": "Filter Type",
    "line1": "Selects the filter response mode for this slot.",
    "line2": "Use alongside cutoff/resonance and filter envelope depth."
  },
  {
    "id": "filt_cutoff",
    "path": "*",
    "key": "key:instruments.*.synth.filter.cutoffHz",
    "kind": "number",
    "title": "Filter Cutoff",
    "line1": "Sets base cutoff frequency for tone brightness.",
    "line2": "Higher values pass more high content."
  },
  {
    "id": "filt_res",
    "path": "*",
    "key": "key:instruments.*.synth.filter.resonance",
    "kind": "number",
    "title": "Filter Resonance",
    "line1": "Boosts emphasis near cutoff frequency.",
    "line2": "High resonance can create pronounced tonal peaks."
  },
  {
    "id": "filt_env_amt",
    "path": "*",
    "key": "key:instruments.*.synth.filter.envAmountPct",
    "kind": "number",
    "title": "Filter Env Amount",
    "line1": "Sets how much filter envelope modulates cutoff.",
    "line2": "Positive values open with envelope; negative values invert."
  },
  {
    "id": "filt_keytrack",
    "path": "*",
    "key": "key:instruments.*.synth.filter.keyTrackingPct",
    "kind": "number",
    "title": "Filter Key Tracking",
    "line1": "Sets how cutoff follows played pitch across notes.",
    "line2": "Higher values keep timbre more consistent by pitch."
  },
  {
    "id": "filt_env_adsr",
    "path": "*",
    "key": "key:instruments.*.synth.filterEnv.*",
    "kind": "number",
    "title": "Filter Envelope",
    "line1": "Shapes filter movement over time using ADSR stages.",
    "line2": "Use with Env Amount for plucks, swells, and contour motion."
  },
  {
    "id": "playback_section",
    "path": "Menu > Playback",
    "key": "",
    "kind": "group",
    "title": "Playback",
    "line1": "Transport tempo and timing controls.",
    "line2": "These settings affect scheduler pacing and clock behavior."
  },
  {
    "id": "bpm_help",
    "path": "*",
    "key": "key:transport.bpm",
    "kind": "number",
    "title": "BPM",
    "line1": "Sets master tempo in beats per minute.",
    "line2": "Affects internal clock rate and algorithm pulse timing."
  },
  {
    "id": "sys_audio_group",
    "path": "Menu > System > Audio",
    "key": "",
    "kind": "group",
    "title": "Audio",
    "line1": "Global output level controls.",
    "line2": "Applies after per-instrument voice shaping."
  },
  {
    "id": "master_vol",
    "path": "*",
    "key": "key:masterVolume",
    "kind": "number",
    "title": "Master Volume",
    "line1": "Sets overall output volume scaling.",
    "line2": "Use this for final level trim without changing patch balance."
  },
  {
    "id": "presets_group",
    "path": "Menu > System > Presets",
    "key": "",
    "kind": "group",
    "title": "Presets",
    "line1": "Save, load, and manage configuration snapshots.",
    "line2": "Use defaults for boot state and library for named variants."
  },
  {
    "id": "default_save",
    "path": "System > Presets > Default > Save Default",
    "key": "action:default_save",
    "kind": "action",
    "title": "Save Default",
    "line1": "Stores current state as startup default payload.",
    "line2": "Use with Auto Save when you want edits to persist automatically."
  },
  {
    "id": "default_load",
    "path": "System > Presets > Default > Load Default",
    "key": "action:default_load",
    "kind": "action",
    "title": "Load Default",
    "line1": "Loads the saved default payload into current state.",
    "line2": "Replaces current runtime settings immediately."
  },
  {
    "id": "autosave_default",
    "path": "*",
    "key": "key:autoSaveDefault",
    "kind": "bool",
    "title": "Auto Save Default",
    "line1": "When enabled, config edits also update default storage.",
    "line2": "Use this for always-remember-last-state behavior."
  },
  {
    "id": "sound_group",
    "path": "Menu > System > Sound",
    "key": "",
    "kind": "group",
    "title": "Sound",
    "line1": "Global note shaping applied to generated note_on events.",
    "line2": "Useful when you want broad behavior without touching each instrument."
  },
  {
    "id": "note_length",
    "path": "*",
    "key": "key:sound.noteLengthMs",
    "kind": "number",
    "title": "Note Length",
    "line1": "Default note duration when note_on has no explicit length.",
    "line2": "Hold-mode notes may bypass duration and wait for note_off."
  },
  {
    "id": "velocity_scale",
    "path": "*",
    "key": "key:sound.velocityScalePct",
    "kind": "number",
    "title": "Velocity Scale",
    "line1": "Scales velocity values globally after mapping.",
    "line2": "Use to tame or boost overall dynamic output."
  },
  {
    "id": "velocity_curve",
    "path": "*",
    "key": "key:sound.velocityCurve",
    "kind": "enum",
    "title": "Velocity Curve",
    "line1": "Applies response curve to velocity scaling.",
    "line2": "Soft raises low velocities; hard emphasizes stronger hits."
  },
  {
    "id": "ui_group",
    "path": "Menu > System > UI Settings",
    "key": "",
    "kind": "group",
    "title": "UI Settings",
    "line1": "Display and lighting behavior for the device/simulator UI.",
    "line2": "These do not change musical generation."
  },
  {
    "id": "screen_sleep",
    "path": "*",
    "key": "key:screenSleepSeconds",
    "kind": "number",
    "title": "Screen Sleep",
    "line1": "Sets idle timeout before OLED sleep.",
    "line2": "Set 0 to keep display always on."
  },
  {
    "id": "display_bright",
    "path": "*",
    "key": "key:displayBrightness",
    "kind": "number",
    "title": "Display Brightness",
    "line1": "Sets OLED brightness level.",
    "line2": "Higher values improve visibility at cost of brightness."
  },
  {
    "id": "grid_bright",
    "path": "*",
    "key": "key:gridBrightness",
    "kind": "number",
    "title": "Grid Brightness",
    "line1": "Sets grid LED brightness scaling.",
    "line2": "Lower values are useful for dark environments."
  },
  {
    "id": "button_bright",
    "path": "*",
    "key": "key:buttonBrightness",
    "kind": "number",
    "title": "Button Brightness",
    "line1": "Sets NeoKey/button LED brightness scaling.",
    "line2": "Helps match hardware feel to ambient light."
  },
  {
    "id": "sense_x_axis_group",
    "path": "Menu > L2: Sense > X Axis",
    "key": "",
    "kind": "group",
    "title": "X Axis Modulation",
    "line1": "Maps X position into pitch/velocity/filter modulation lanes.",
    "line2": "Use offsets and ranges to reshape horizontal influence."
  },
  {
    "id": "sense_x_pitch_group",
    "path": "Menu > L2: Sense > X Axis > Pitch Steps",
    "key": "",
    "kind": "group",
    "title": "X Pitch Steps",
    "line1": "Controls pitch stepping derived from X position.",
    "line2": "Disable to remove X-axis pitch influence."
  },
  {
    "id": "sense_x_velocity_group",
    "path": "Menu > L2: Sense > X Axis > Velocity",
    "key": "",
    "kind": "group",
    "title": "X Velocity Lane",
    "line1": "Maps X position to velocity output range.",
    "line2": "Use this for left-right dynamic shaping."
  },
  {
    "id": "sense_x_cutoff_group",
    "path": "Menu > L2: Sense > X Axis > Filter Cutoff",
    "key": "",
    "kind": "group",
    "title": "X Cutoff Lane",
    "line1": "Maps X position to CC74 cutoff modulation range.",
    "line2": "Works when filter cutoff lane is enabled."
  },
  {
    "id": "sense_x_res_group",
    "path": "Menu > L2: Sense > X Axis > Filter Resonance",
    "key": "",
    "kind": "group",
    "title": "X Resonance Lane",
    "line1": "Maps X position to CC71 resonance modulation range.",
    "line2": "Use carefully to avoid excessive resonance peaks."
  },
  {
    "id": "sense_y_axis_group",
    "path": "Menu > L2: Sense > Y Axis",
    "key": "",
    "kind": "group",
    "title": "Y Axis Modulation",
    "line1": "Maps Y position into pitch/velocity/filter modulation lanes.",
    "line2": "Use alongside X axis for two-dimensional mapping."
  },
  {
    "id": "sense_y_pitch_group",
    "path": "Menu > L2: Sense > Y Axis > Pitch Steps",
    "key": "",
    "kind": "group",
    "title": "Y Pitch Steps",
    "line1": "Controls pitch stepping derived from Y position.",
    "line2": "Disable to remove Y-axis pitch influence."
  },
  {
    "id": "sense_y_velocity_group",
    "path": "Menu > L2: Sense > Y Axis > Velocity",
    "key": "",
    "kind": "group",
    "title": "Y Velocity Lane",
    "line1": "Maps Y position to velocity output range.",
    "line2": "Useful for top-bottom accent patterns."
  },
  {
    "id": "sense_y_cutoff_group",
    "path": "Menu > L2: Sense > Y Axis > Filter Cutoff",
    "key": "",
    "kind": "group",
    "title": "Y Cutoff Lane",
    "line1": "Maps Y position to CC74 cutoff modulation range.",
    "line2": "Combine with X lane for richer filter motion."
  },
  {
    "id": "sense_y_res_group",
    "path": "Menu > L2: Sense > Y Axis > Filter Resonance",
    "key": "",
    "kind": "group",
    "title": "Y Resonance Lane",
    "line1": "Maps Y position to CC71 resonance modulation range.",
    "line2": "Lower ranges are usually easier to control musically."
  },
  {
    "id": "voice_x_axis_group",
    "path": "Menu > L3: Voice > X Axis",
    "key": "",
    "kind": "group",
    "title": "Voice X Axis",
    "line1": "Alternate X-axis modulation settings at Voice layer.",
    "line2": "Use this when you want different mapping emphasis in Voice context."
  },
  {
    "id": "voice_x_pitch_group",
    "path": "Menu > L3: Voice > X Axis > Pitch Steps",
    "key": "",
    "kind": "group",
    "title": "Voice X Pitch Steps",
    "line1": "Controls X-based pitch stepping in Voice layer.",
    "line2": "Can diverge from Sense defaults for performance tuning."
  },
  {
    "id": "voice_x_velocity_group",
    "path": "Menu > L3: Voice > X Axis > Velocity",
    "key": "",
    "kind": "group",
    "title": "Voice X Velocity Lane",
    "line1": "Controls X-based velocity modulation in Voice layer.",
    "line2": "Use to rebalance loudness response per performance profile."
  },
  {
    "id": "voice_x_cutoff_group",
    "path": "Menu > L3: Voice > X Axis > Filter Cutoff",
    "key": "",
    "kind": "group",
    "title": "Voice X Cutoff Lane",
    "line1": "Controls X-based cutoff modulation in Voice layer.",
    "line2": "Affects generated CC74 values."
  },
  {
    "id": "voice_x_res_group",
    "path": "Menu > L3: Voice > X Axis > Filter Resonance",
    "key": "",
    "kind": "group",
    "title": "Voice X Resonance Lane",
    "line1": "Controls X-based resonance modulation in Voice layer.",
    "line2": "Affects generated CC71 values."
  },
  {
    "id": "voice_y_axis_group",
    "path": "Menu > L3: Voice > Y Axis",
    "key": "",
    "kind": "group",
    "title": "Voice Y Axis",
    "line1": "Alternate Y-axis modulation settings at Voice layer.",
    "line2": "Use for per-context modulation tuning."
  },
  {
    "id": "voice_y_pitch_group",
    "path": "Menu > L3: Voice > Y Axis > Pitch Steps",
    "key": "",
    "kind": "group",
    "title": "Voice Y Pitch Steps",
    "line1": "Controls Y-based pitch stepping in Voice layer.",
    "line2": "Higher steps create larger vertical interval jumps."
  },
  {
    "id": "voice_y_velocity_group",
    "path": "Menu > L3: Voice > Y Axis > Velocity",
    "key": "",
    "kind": "group",
    "title": "Voice Y Velocity Lane",
    "line1": "Controls Y-based velocity modulation in Voice layer.",
    "line2": "Use to weight top/bottom cell dynamics."
  },
  {
    "id": "voice_y_cutoff_group",
    "path": "Menu > L3: Voice > Y Axis > Filter Cutoff",
    "key": "",
    "kind": "group",
    "title": "Voice Y Cutoff Lane",
    "line1": "Controls Y-based cutoff modulation in Voice layer.",
    "line2": "Affects generated CC74 values."
  },
  {
    "id": "voice_y_res_group",
    "path": "Menu > L3: Voice > Y Axis > Filter Resonance",
    "key": "",
    "kind": "group",
    "title": "Voice Y Resonance Lane",
    "line1": "Controls Y-based resonance modulation in Voice layer.",
    "line2": "Affects generated CC71 values."
  },
  {
    "id": "system_group",
    "path": "Menu > System",
    "key": "",
    "kind": "group",
    "title": "System",
    "line1": "Global configuration area for audio, presets, MIDI, and UI.",
    "line2": "Use this for environment and persistence behavior."
  },
  {
    "id": "presets_library_group",
    "path": "Menu > System > Presets > Library",
    "key": "",
    "kind": "group",
    "title": "Preset Library",
    "line1": "Named save/load/rename/delete workflow for patch states.",
    "line2": "Use Refresh if external files were changed."
  },
  {
    "id": "save_as_group",
    "path": "Menu > System > Presets > Library > Save As",
    "key": "",
    "kind": "group",
    "title": "Save As",
    "line1": "Creates a preset from the current runtime state.",
    "line2": "Enter a name then run Save to write it."
  },
  {
    "id": "load_group",
    "path": "Menu > System > Presets > Library > Load",
    "key": "",
    "kind": "group",
    "title": "Load Preset",
    "line1": "Lists available presets to load into current state.",
    "line2": "Loading replaces current runtime config."
  },
  {
    "id": "rename_group",
    "path": "Menu > System > Presets > Library > Rename",
    "key": "",
    "kind": "group",
    "title": "Rename Preset",
    "line1": "Select a preset then edit new name before applying.",
    "line2": "Useful for versioning variants."
  },
  {
    "id": "delete_group",
    "path": "Menu > System > Presets > Library > Delete",
    "key": "",
    "kind": "group",
    "title": "Delete Preset",
    "line1": "Select a preset to delete from storage.",
    "line2": "Deletion requires confirmation."
  },
  {
    "id": "default_group_specific",
    "path": "Menu > System > Presets > Default",
    "key": "",
    "kind": "group",
    "title": "Default Preset",
    "line1": "Controls boot/default payload save and load behavior.",
    "line2": "Auto Save can keep default synced with edits."
  },
  {
    "id": "factory_group",
    "path": "Menu > System > Presets > Factory",
    "key": "",
    "kind": "group",
    "title": "Factory Preset",
    "line1": "Loads built-in factory baseline configuration.",
    "line2": "Use this as a safe recovery starting point."
  },
  {
    "id": "midi_group",
    "path": "Menu > System > MIDI",
    "key": "",
    "kind": "group",
    "title": "MIDI",
    "line1": "Global MIDI routing, ports, and clock behavior.",
    "line2": "Per-instrument MIDI enable/channel are in Voice > Instruments."
  },
  {
    "id": "midi_out_group",
    "path": "Menu > System > MIDI > MIDI Out",
    "key": "",
    "kind": "group",
    "title": "MIDI Output",
    "line1": "Selects target output device for outgoing MIDI events.",
    "line2": "Disconnect clears the selected output."
  },
  {
    "id": "midi_in_group",
    "path": "Menu > System > MIDI > MIDI In",
    "key": "",
    "kind": "group",
    "title": "MIDI Input",
    "line1": "Selects input device for incoming clock/start/stop.",
    "line2": "Disconnect disables input source selection."
  },
  {
    "id": "midi_sync_group",
    "path": "Menu > System > MIDI > Sync & Clock",
    "key": "",
    "kind": "group",
    "title": "Sync & Clock",
    "line1": "Configures transport clock source and clock I/O behavior.",
    "line2": "Set external mode to follow incoming MIDI clock."
  },
  {
    "id": "life_spawn_count",
    "path": "*",
    "key": "key:behaviorConfig.life.randomCellsPerTick",
    "kind": "number",
    "title": "Spawn Count",
    "line1": "Sets how many random cells are injected per spawn event.",
    "line2": "Higher values create denser, more chaotic growth bursts."
  },
  {
    "id": "life_spawn_interval",
    "path": "*",
    "key": "key:behaviorConfig.life.randomTickInterval",
    "kind": "number",
    "title": "Spawn Interval",
    "line1": "Sets tick interval between automatic random spawn bursts.",
    "line2": "Lower values spawn more frequently."
  },
  {
    "id": "axis_pitch_enabled",
    "path": "*",
    "key": "key:x.pitch.enabled",
    "kind": "bool",
    "title": "X Pitch Enabled",
    "line1": "Enables pitch stepping derived from X position.",
    "line2": "Disable to remove horizontal pitch influence."
  },
  {
    "id": "axis_pitch_steps_x",
    "path": "*",
    "key": "key:x.pitch.steps",
    "kind": "number",
    "title": "X Pitch Steps",
    "line1": "Sets semitone-step influence per X grid step.",
    "line2": "Larger values create wider horizontal intervals."
  },
  {
    "id": "axis_vel_enabled_x",
    "path": "*",
    "key": "key:x.velocity.enabled",
    "kind": "bool",
    "title": "X Velocity Enabled",
    "line1": "Enables velocity modulation from X position.",
    "line2": "Disable for fixed mapped velocity from trigger target."
  },
  {
    "id": "axis_cut_enabled_x",
    "path": "*",
    "key": "key:x.filterCutoff.enabled",
    "kind": "bool",
    "title": "X Cutoff Enabled",
    "line1": "Enables cutoff CC modulation from X position.",
    "line2": "Outputs CC74 when enabled."
  },
  {
    "id": "axis_res_enabled_x",
    "path": "*",
    "key": "key:x.filterResonance.enabled",
    "kind": "bool",
    "title": "X Resonance Enabled",
    "line1": "Enables resonance CC modulation from X position.",
    "line2": "Outputs CC71 when enabled."
  },
  {
    "id": "axis_pitch_enabled_y",
    "path": "*",
    "key": "key:y.pitch.enabled",
    "kind": "bool",
    "title": "Y Pitch Enabled",
    "line1": "Enables pitch stepping derived from Y position.",
    "line2": "Disable to remove vertical pitch influence."
  },
  {
    "id": "axis_pitch_steps_y",
    "path": "*",
    "key": "key:y.pitch.steps",
    "kind": "number",
    "title": "Y Pitch Steps",
    "line1": "Sets semitone-step influence per Y grid step.",
    "line2": "Larger values create wider vertical intervals."
  },
  {
    "id": "axis_vel_enabled_y",
    "path": "*",
    "key": "key:y.velocity.enabled",
    "kind": "bool",
    "title": "Y Velocity Enabled",
    "line1": "Enables velocity modulation from Y position.",
    "line2": "Disable for fixed mapped velocity from trigger target."
  },
  {
    "id": "axis_cut_enabled_y",
    "path": "*",
    "key": "key:y.filterCutoff.enabled",
    "kind": "bool",
    "title": "Y Cutoff Enabled",
    "line1": "Enables cutoff CC modulation from Y position.",
    "line2": "Outputs CC74 when enabled."
  },
  {
    "id": "axis_res_enabled_y",
    "path": "*",
    "key": "key:y.filterResonance.enabled",
    "kind": "bool",
    "title": "Y Resonance Enabled",
    "line1": "Enables resonance CC modulation from Y position.",
    "line2": "Outputs CC71 when enabled."
  },
  {
    "id": "draft_name_field",
    "path": "*",
    "key": "key:system.draftName",
    "kind": "text",
    "title": "Preset Name Field",
    "line1": "Text field used for Save As and Rename preset flows.",
    "line2": "Save/Apply actions consume this value as the target preset name."
  },
  {
    "id": "preset_rename_apply",
    "path": "Menu > System > Presets > Library > Rename > Apply",
    "key": "action:preset_rename_apply",
    "kind": "action",
    "title": "Apply Rename",
    "line1": "Runs rename from selected preset to entered New Name.",
    "line2": "Requires a valid selected source preset."
  },
  {
    "id": "factory_load_action",
    "path": "Menu > System > Presets > Factory > Load Fact. Default",
    "key": "action:factory_load",
    "kind": "action",
    "title": "Load Factory Default",
    "line1": "Loads built-in factory default configuration.",
    "line2": "Use this to quickly recover a known baseline state."
  }
];
