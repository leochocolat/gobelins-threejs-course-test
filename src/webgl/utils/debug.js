/**
 * Build Tweakpane list options from the keys of a { name: value } map,
 * so settings store readable names instead of three.js constants.
 */
export function keysAsOptions(map) {
    return Object.fromEntries(Object.keys(map).map((key) => [key, key]));
}
