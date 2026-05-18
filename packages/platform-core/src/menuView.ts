import { abbreviatePath, formatMenuItemLines, getSectionColor, getSectionColorFromPath } from "./menuPresentation";
import { clamp } from "./coreUtils";
import type { ConfirmState, MenuNode, MenuState, PlatformState } from "./platformTypes";

export function visibleChildren<TState>(node: MenuNode, state: PlatformState<TState>): MenuNode[] {
  if (node.kind !== "group") return [];
  const kids = typeof node.children === "function" ? node.children(state) : node.children;
  return kids.filter((n) => ("visible" in n && typeof (n as any).visible === "function" ? (n as any).visible(state.runtimeConfig) : true));
}

export function locate<TState>(root: MenuNode, state: PlatformState<TState>, menu: MenuState): { node: MenuNode; siblings: MenuNode[]; path: string } {
  let node = root;
  const labels: string[] = [];
  for (const idx of menu.stack) {
    const kids = visibleChildren(node, state);
    const next = kids[idx] ?? kids[0];
    if (!next || next.kind !== "group") break;
    labels.push(next.label);
    node = next;
  }
  return { node, siblings: visibleChildren(node, state), path: labels.join("/") || "Menu" };
}

type CurrentMenuViewDeps<TState> = {
  state: PlatformState<TState>;
  menuTree: (state: PlatformState<TState>) => MenuNode;
  fitOledText: (text: string) => string;
  readAnyValue: (state: PlatformState<TState>, key: string) => unknown;
  formatDisplayValue: (key: string, value: unknown) => string;
  oledTextLines: number;
};

export function currentMenuView<TState>(deps: CurrentMenuViewDeps<TState>): { path: string; lines: string[]; colors: number[] } {
  const { state, menuTree, fitOledText, readAnyValue, formatDisplayValue, oledTextLines } = deps;
  if (state.system.confirm) {
    const view = confirmView(state.system.confirm, fitOledText, oledTextLines);
    return { ...view, colors: Array(view.lines.length).fill(0xffff) };
  }
  const { menu } = state;
  const { siblings, path } = locate(menuTree(state), state, menu);
  const shortPath = abbreviatePath(path);
  if (!siblings.length) return { path: shortPath, lines: [], colors: [] };

  const cursor = clamp(menu.cursor, 0, siblings.length - 1);
  const bodyBudget = Math.max(1, oledTextLines - 1);
  let start = cursor;
  let end = cursor + 1;
  let rowCount = formatMenuItemLines(siblings[cursor], state, true, menu.editing, fitOledText, readAnyValue, formatDisplayValue).length;

  while (rowCount < bodyBudget && (start > 0 || end < siblings.length)) {
    let grew = false;
    if (start > 0) {
      const prevRows = formatMenuItemLines(siblings[start - 1], state, false, false, fitOledText, readAnyValue, formatDisplayValue).length;
      if (rowCount + prevRows <= bodyBudget || end >= siblings.length) {
        start -= 1;
        rowCount += prevRows;
        grew = true;
      }
    }
    if (rowCount >= bodyBudget) break;
    if (end < siblings.length) {
      const nextRows = formatMenuItemLines(siblings[end], state, false, false, fitOledText, readAnyValue, formatDisplayValue).length;
      if (rowCount + nextRows <= bodyBudget || start === 0) {
        end += 1;
        rowCount += nextRows;
        grew = true;
      }
    }
    if (!grew) break;
  }

  const lines: string[] = [];
  const colors: number[] = [];
  const sectionColor = getSectionColorFromPath(path);

  for (let i = start; i < end; i += 1) {
    const item = siblings[i];
    const isSelected = i === cursor && menu.editing;
    const itemLines = formatMenuItemLines(item, state, i === cursor, isSelected, fitOledText, readAnyValue, formatDisplayValue);
    if (item.kind === "spacer") {
      lines.push(...itemLines);
      colors.push(...Array(itemLines.length).fill(0x0000));
      continue;
    }
    lines.push(...itemLines);
    let itemColor = sectionColor;
    if (path === "Menu" || path === "") {
      itemColor = getSectionColor(item.label);
    }
    colors.push(...Array(itemLines.length).fill(itemColor));
  }
  return { path: shortPath, lines: lines.slice(0, bodyBudget), colors: colors.slice(0, bodyBudget) };
}

function confirmView(confirm: ConfirmState, fitOledText: (text: string) => string, oledTextLines: number): { path: string; lines: string[] } {
  const title = confirm.kind === "text_dirty_exit" ? "TEXT" : confirm.kind === "help_info" ? "HELP" : "CONFIRM";
  if (confirm.kind === "help_info" && confirm.action.kind === "help_info") {
    const contentSlots = Math.max(1, oledTextLines - 2);
    const start = clamp(confirm.scroll, 0, Math.max(0, confirm.action.lines.length - contentSlots));
    const body = confirm.action.lines.slice(start, start + contentSlots).map((line) => fitOledText(line));
    return { path: title, lines: [...body, "@@> Close"].slice(0, oledTextLines - 1) };
  }
  const details = confirmDetails(confirm);
  const lines = [fitOledText(details)];
  for (let i = 0; i < confirm.options.length; i += 1) {
    const prefix = confirm.cursor === i ? "@@> " : "  ";
    lines.push(`${prefix}${confirm.options[i]}`);
  }
  return { path: title, lines: lines.slice(0, oledTextLines - 1) };
}

function confirmDetails(confirm: ConfirmState): string {
  const a = confirm.action;
  if (a.kind === "preset_save") return `Save ${a.name}?`;
  if (a.kind === "preset_delete") return `Delete? ${a.name}`;
  if (a.kind === "preset_load") return `Load? ${a.name}`;
  if (a.kind === "preset_rename") return `Rename? ${a.from}`;
  if (a.kind === "default_save") return "Save default?";
  if (a.kind === "default_load") return "Load default?";
  if (a.kind === "factory_load") return "Load factory?";
  if (a.kind === "text_dirty_exit") return "Save changes?";
  if (a.kind === "midi_panic") return "MIDI panic?";
  if (a.kind === "aux_unbind") return "Unbind encoder?";
  if (a.kind === "help_info") return "Help";
  return "Confirm";
}
