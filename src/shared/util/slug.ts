import * as slug from 'slug';

/**
 * Sets defaults for slug replacements
 */
slug.charmap['.'] = '-';

slug.defaults.modes.pretty = {
    replacement: '-',
    symbols: true,
    remove: null,
    lower: true,
    charmap: slug.charmap,
    multicharmap: slug.multicharmap
};

slug.defaults.mode = 'pretty';

export default slug;
