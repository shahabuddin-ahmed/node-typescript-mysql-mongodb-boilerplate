import { Dialect } from "sequelize";

interface SequelizeConfig {
	USERNAME: string;
	PASSWORD: string;
	MYSQL_DATABASE: string;
}

interface SequelizeOptions {
	host: string;
	port: number;
	dialect: Dialect;
	pool: {
		max: number;
		min: number;
		idle: number;
	};
	define: {
		timestamps: boolean
	},
	charset: string;
	collate: string;
	logging: boolean;
	log: any;
}

interface Config {
	ADMIN_API_KEY: string;
	REDIS_HOST: string;
	REDIS_PORT: number;
	SEQUELIZE: SequelizeConfig;
	SEQUELIZEOPTIONS: SequelizeOptions;
	APPLICATION_SERVER_PORT: number;
	APP_FORCE_SHUTDOWN_SECOND: number;
}

const config: Config = {
	REDIS_HOST: process.env.REDIS_HOST || "0.0.0.0",
	REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
	ADMIN_API_KEY: process.env.ADMIN_API_KEY || "abcd1234",
	SEQUELIZE: {
		USERNAME: process.env.MYSQL_USER || "nirapod",
		PASSWORD: process.env.MYSQL_PASSWORD || "nirapod",
		MYSQL_DATABASE: process.env.MYSQL_DATABASE || "odin"
	},
	SEQUELIZEOPTIONS: {
		host: process.env.MYSQL_HOST || "0.0.0.0",
		port: Number(process.env.MYSQL_PORT) || 3307,
		dialect: "mysql",
		pool: {
			max: 20,
			min: 5,
			idle: 10000
		},
		define: {
			timestamps: false
		},
		charset: "utf8",
		collate: "utf8_general_ci",
		logging: false,
		log: console.log
	},
	APPLICATION_SERVER_PORT: Number(process.env.APPLICATION_SERVER_PORT) || 3000,
	APP_FORCE_SHUTDOWN_SECOND: Number(process.env.APP_FORCE_SHUTDOWN_SECOND) || 30
};

export default config;
