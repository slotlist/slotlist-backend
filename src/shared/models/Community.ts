import {
    DataTypes,
    HasMany,
    HasManyGetAssociationsMixin,
    HasManyHasAssociationMixin,
    Model
} from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';
import slug from '../util/slug';

/**
 * Represents a community in database.
 * Provides database access and utility functionality for community instances
 *
 * @export
 * @class Community
 * @extends {Sequelize.Model}
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

    //////////////////////
    // Model attributes //
    //////////////////////

    /**
     * UID uniquely identifying the community in the database
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
     * Can be `undefined|null` if no website URL was provided
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
    public members?: User[];

    /**
     * Eager-loaded list missions associated with the community
     * Only included if the community has missions associated and it has been eager-loaded via sequelize
     *
     * @type {Mission[]|undefined}
     * @memberof Community
     */
    public missions?: Mission[];

    /**
     * Time (and date) the community instance was created
     *
     * @type {Date}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public createdAt: Date;

    /**
     * Time (and date) the community instance was last updated
     *
     * @type {Date}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    })
    public updatedAt: Date;

    /**
     * Time (and date) the community instance was deleted
     * Will only be set once the community has been deleted, caused by paranoid table settings
     * Can be `undefined|null` until the community instance deletion
     *
     * @type {Date|undefined|null}
     * @memberof Community
     */
    @Attribute({
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    })
    public deletedAt?: Date;

    ////////////////////////////
    // Sequelize model mixins //
    ////////////////////////////

    /**
     * Retrieves the community's member instances.
     * Returns an empty array if the community has no users assigned
     *
     * @type {HasManyGetAssociationsMixin<User>}
     * @returns {Promise<User[]>} List of community members
     * @memberof Community
     */
    public getMembers: HasManyGetAssociationsMixin<User>;

    /**
     * Retrieves the community's mission instances.
     * Returns an empty array if the community has no missions assigned
     *
     * @type {HasManyGetAssociationsMixin<Mission>}
     * @returns {Promise<Mission[]>} List of missions
     * @memberof Community
     */
    public getMissions: HasManyGetAssociationsMixin<Mission>;

    /**
     * Checks whether the community has a member with the provided UID
     *
     * @type {HasManyHasAssociationMixin<User, string>}
     * @returns {Promise<boolean>} Indicates whether the user was found
     * @memberof Community
     */
    public hasMember: HasManyHasAssociationMixin<User, string>;

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
}

export interface IPublicMission {
    uid: string;
}

/**
 * Model associations
 *
 * ATTENTION: absolutely **HAS** to be at the very end of the file and **AFTER** complete model definition, causes cyclic dependency hell otherwise.
 * Imports of associated models **MUST NOT** be at the top of the file, but rather **HAVE TO BE** down here
 */

import { Mission } from './Mission';
import { User } from './User';

Community.associations.members = Mission.hasMany(User, { as: 'members', foreignKey: 'communityUid' });
Community.associations.missions = Mission.hasMany(User, { as: 'missions', foreignKey: 'communityUid' });
