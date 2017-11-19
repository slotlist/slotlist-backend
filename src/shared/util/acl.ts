import * as _ from 'lodash';

/**
 * Recursive check for permission in permission tree
 *
 * @export
 * @param {*} permissions Permission tree to recurse through
 * @param {(string | string[])} permission Permission to check for (either as string or array of string split by `.`)
 * @returns {boolean} Indicates whether the permission was found
 */
export function findPermission(permissions: any, permission: string | string[]): boolean {
    if (_.isNil(permissions) || !_.isObject(permissions) || _.keys(permissions).length <= 0) {
        return false;
    }

    if (_.has(permissions, permission)) {
        return true;
    }

    return _.some(permissions, (next: any, current: string) => {
        const permParts = _.isString(permission) ? permission.toLowerCase().split('.') : permission;

        const permPart = permParts.shift();
        if (current === '*' || current === permPart) {
            if (permParts.length <= 0) {
                return true;
            }

            return findPermission(next, _.clone(permParts));
        }

        return false;
    });
}

/**
 * Parses an array of (dotted) permissions into a permission tree
 *
 * @export
 * @param {string[]} permissions Array of permission to parse
 * @returns {*} Parsed permission tree
 */
export function parsePermissions(permissions: string[]): any {
    const parsedPermissions: any = {};

    _.each(permissions, (perm: string) => {
        const permissionParts = perm.toLowerCase().split('.');

        let previous = parsedPermissions;
        let part = permissionParts.shift();
        while (!_.isNil(part)) {
            if (_.isNil(previous[part])) {
                previous[part] = {};
            }

            previous = previous[part];
            part = permissionParts.shift();
        }
    });

    return parsedPermissions;
}

/**
 * Parses the provided permission array and checks if the user has the requested target permission.
 * Also checks for `*` and `admin.superadmin` permissions since those implicitly grant every other permission
 *
 * @export
 * @param {string[]} permissions Array of permission to parse
 * @param {(string | string[])} targetPermissions Permissions to search for
 * @returns {boolean} Indicates whether one of the permissions was found
 */
export function hasPermission(permissions: string[], targetPermissions: string | string[]): boolean {
    const parsedPermissions = parsePermissions(permissions);

    if (_.has(parsedPermissions, '*') || findPermission(parsedPermissions, 'admin.superadmin')) {
        return true;
    }

    if (_.isArray(targetPermissions)) {
        return _.some(targetPermissions, (targetPermission: string) => findPermission(parsedPermissions, targetPermission));
    } else {
        return findPermission(parsedPermissions, targetPermissions);
    }
}
