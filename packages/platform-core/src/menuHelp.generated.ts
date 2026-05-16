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
    "id": "group_any",
    "path": "Menu > *",
    "key": "",
    "kind": "group",
    "title": "Section",
    "line1": "Opens this submenu and shows related settings.",
    "line2": "Use Enter to open and Back to return."
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
  }
];
