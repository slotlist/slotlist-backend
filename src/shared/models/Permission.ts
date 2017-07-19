import { DataTypes, Model } from 'sequelize';
import { Attribute, Options } from 'sequelize-decorators';

import sequelize from '../util/sequelize';

/**
 * Permission
 *
 * @export
 * @class Permission
 * @extends {Model}
 */
@Options({
    sequelize,
    tableName: 'communities',
    paranoid: true
})
export class Permission extends Model {
    @Attribute({
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    public uid: string;

    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    public nickname: string;

    @Attribute({
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    })
    public steamId: string;

}
