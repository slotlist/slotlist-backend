import * as _ from 'lodash';
import {
    BelongsTo,
    BelongsToGetAssociationMixin,
    DataTypes,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

/**
 * Represents a mission in database
 * Provides database access and utility functionality for mission instances
 *
 * @export
 * @class Mission
 * @extends {Model}
 */
@Options({
    sequelize,
    tableName: 'missions',
    paranoid: true
})
export class Mission extends Model {
    /**
     * Associations of the mission model
     *
     * @static
     * @type {{
     *         community: BelongsTo,
     *         initiator: BelongsTo
     *     }}
     * @memberof Mission
     */
    public static associations: {
        community: BelongsTo,
        initiator: BelongsTo
    };

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the mission in the database
     *
     * @type {string}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * UUID of the community the mission is associated with
     * Can be `undefined|null` if the initiating user has no community assigned
     *
     * @type {string|undefined|null}
     * @memberof Mission
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'communities',
            key: 'uid'
        },
        onDelete: 'SET NULL'
    })
    public communityUid?: string;

    /**
     * Eager-loaded community instance
     * Only included if the mission is associated with a community and it has been eager-loaded via sequelize
     *
     * @type {Community|undefined}
     * @memberof Mission
     */
    public community?: Community;

    ////////////////////////////
    // Sequelize model mixins //
    ////////////////////////////

    /**
     * Creates a new permission for the user
     * The new permission automatically gets associated with the user (userUid does not have to be provided)
     *
     * @type {HasManyCreateAssociationMixin<Permission>}
     * @returns {Promise<Permission>}
     * @memberof Mission
     */
    public createPermission: HasManyCreateAssociationMixin<Permission>;

    /**
     * Retrieves the user's community instance
     * Only returns a result if the user has been associated with a community
     *
     * @type {BelongsToGetAssociationMixin<Community>}
     * @returns {Promise<Community>}
     * @memberof Mission
     */
    public getCommunity: BelongsToGetAssociationMixin<Community>;

    /**
     * Retrieves the user's permissions
     * Returns an empty array if the user has no permissions assigned
     *
     * @type {HasManyGetAssociationsMixin<Permission>}
     * @returns {Promise<Permission[]>}
     * @memberof Mission
     */
    public getPermissions: HasManyGetAssociationsMixin<Permission>;

    /////////////////////////
    // Model class methods //
    /////////////////////////

    ////////////////////////////
    // Model instance methods //
    ////////////////////////////

    public async toPublicObject(): Promise<IPublicMission> {
        return {
            uid: this.uid
        };
    }

    ////////////////////////////////////
    // Private model instance methods //
    ////////////////////////////////////

    private findPermission(permissions: any, permission: string | string[]): boolean {
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

                return this.findPermission(next, _.clone(permParts));
            }

            return false;
        });
    }
}

export interface IPublicMission {
    uid: string;
}

/**
 * Model associations
 *
 * ATTENTION: absolutely **HAS** to be at the very end of the file and **AFTER** complete model definition, causes cyclic dependency hell otherwise
 * Imports of associated models **MUST NOT** be at the top of the file, but rather **HAVE TO BE** down here
 */

import { Community } from './Community';
import { User } from './User';

Mission.associations.community = Mission.belongsTo(Community, { as: 'community', foreignKey: 'communityUid' });
Mission.associations.initiator = Mission.belongsTo(User, { as: 'initiator', foreignKey: 'initiatorUid' });
