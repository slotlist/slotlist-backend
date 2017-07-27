import { DataTypes } from 'sequelize';

/**
 * Creates table for MissionSlot model
 */
module.exports = {
    up: async (queryInterface: any): Promise<void> => {
        await queryInterface.createTable('missionSlots', {
            uid: {
                type: DataTypes.UUID,
                allowNull: false,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            difficulty: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: {
                    min: 0,
                    max: 4
                }
            },
            shortDescription: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: null,
                validate: {
                    notEmpty: true
                }
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            },
            restricted: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            reserve: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            assigneeUid: {
                type: DataTypes.UUID,
                allowNull: true,
                defaultValue: null,
                references: {
                    model: 'users',
                    key: 'uid'
                },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            },
            missionUid: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'missions',
                    key: 'uid'
                },
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        });

        await queryInterface.addIndex('missionSlots', ['missionUid', 'assigneeUid'], {
            indexName: 'missionSlots_unique_missionUid_assigneeUid',
            indicesType: 'UNIQUE',
            indexType: 'BTREE'
        });
    },
    down: async (queryInterface: any): Promise<void> => {
        await queryInterface.dropTable('missionSlots');
    }
};
