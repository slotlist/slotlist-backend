import * as slug from 'slug';

/**
 * Sets defaults for slug replacements
 */
slug.charmap['.'] = '-';

(<any>slug.defaults.modes).custom = {
    replacement: '-',
    symbols: true,
    remove: /[%]/g, // remove `%` from slugs to avoid issues with permission removal using `iLike`
    lower: true,
    charmap: slug.charmap,
    multicharmap: slug.multicharmap
};

slug.defaults.mode = 'custom';

export default slug;
