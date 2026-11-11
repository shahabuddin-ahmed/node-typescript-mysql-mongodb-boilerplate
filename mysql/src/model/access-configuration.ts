import { Model, DataTypes } from "sequelize";
import newSequelize from "../infra/sequelize";

export enum AccessConfigurationTargetType {
    USER = "USER",
    IP = "IP",
    DEFAULT = "DEFAULT",
}

export interface RateLimitWindowConfig {
    limit: number;
    throttlingInSec: number;
}

export interface RateLimitPolicyConfig {
    sort: RateLimitWindowConfig;
    daily?: RateLimitWindowConfig;
    weekly?: RateLimitWindowConfig;
}

export interface AccessConfigurationRateLimitMap {
    [endpoint: string]: RateLimitPolicyConfig;
}

export interface AccessConfigurationInterface {
    id?: number;
    targetValue?: string | null;
    targetType: AccessConfigurationTargetType;
    rateLimits: AccessConfigurationRateLimitMap[];
    createdBy: number;
    updatedBy?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
}

class AccessConfiguration
    extends Model<AccessConfigurationInterface>
    implements AccessConfigurationInterface
{
    public id?: number;
    public targetValue?: string | null;
    public targetType!: AccessConfigurationTargetType;
    public rateLimits!: AccessConfigurationRateLimitMap[];
    public createdBy!: number;
    public updatedBy?: number | null;
    public readonly createdAt?: Date;
    public readonly updatedAt?: Date;
}

AccessConfiguration.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        targetValue: {
            type: new DataTypes.STRING(50),
            allowNull: true,
            defaultValue: null,
        },
        targetType: {
            type: new DataTypes.ENUM(
                ...Object.values(AccessConfigurationTargetType),
            ),
            allowNull: false,
            defaultValue: AccessConfigurationTargetType.DEFAULT,
        },
        rateLimits: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        updatedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    },
    {
        tableName: "access_configurations",
        freezeTableName: true,
        timestamps: true,
        underscored: false,
        sequelize: newSequelize(),
        modelName: "AccessConfiguration",
        indexes: [{
            name: "access_configurations_target_unique",
            unique: true,
            fields: ["targetType", "targetValue"],
        }],
    },
);

export default AccessConfiguration;
