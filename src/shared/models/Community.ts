import {
    DataTypes,
    HasMany,
    HasManyGetAssociationsMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';
import slug from '../util/slug';

/**
 * Represents a community in database
 * Provides database access and utility functionality for community instances
 *
 * @export
 * @class Community
 * @extends {Model}
 */
@Options({
    sequelize,
    tableName: 'communities',
    paranoid: true
})
export class Community extends Model {
    /**
     * Associations of the community model
     *
     * @static
     * @type {{
     *         members: HasMany,
     *         missions: HasMany
     *     }}
     * @memberof Community
     */
    public static associations: {
        members: HasMany,
        missions: HasMany
    };

    /**
     * UUID uniquely identifying the community in the database
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    /**
     * Name of the community
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public name: string;

    /**
     * Tag of the community
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false
    })
    public tag: string;

    /**
     * Website URL of the community
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: true
    })
    public website: string;

    /**
     * Slug used for identifying a community in the frontend
     * More user-friendly version of a UID, makes for prettier URLs
     *
     * @type {string}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    get slug(): string {
        return this.getDataValue('slug');
    }
    set slug(val: string) {
        this.setDataValue('slug', slug(val));
    }

    /**
     * Eager-loaded list of members/users associated with the community
     * Only included if the community has users associated and it has been eager-loaded via sequelize
     *
     * @type {User[]|undefined}
     * @memberof Community
     */
    public members?: Permission[];
    /**
     * Retrieves the community's members/associated users
     * Returns an empty array if the community has no users assigned
     *
     * @type {HasManyGetAssociationsMixin<User>}
     * @returns {Promise<User[]>}
     * @memberof Community
     */
    public getMembers: HasManyGetAssociationsMixin<User>;
}

/**
 * Model associations
 *
 * ATTENTION: absolutely **HAS** to be at the very end of the file and **AFTER** complete model definition, causes cyclic dependency hell otherwise
 * Imports of associated models **MUST NOT** be at the top of the file, but rather **HAVE TO BE** down here
 */

import { Permission } from './Permission';
import { User } from './User';

Community.associations.members = Community.hasMany(User, { as: 'members', foreignKey: 'communityUid' });
