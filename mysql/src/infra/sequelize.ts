import { Sequelize } from "sequelize";
import config from "../config/config";


export class ConnectDB {
    private static instance: Sequelize
    public static initialize(): Sequelize {
        return new Sequelize(config.SEQUELIZE.MYSQL_DATABASE, config.SEQUELIZE.USERNAME, config.SEQUELIZE.PASSWORD,
            config.SEQUELIZEOPTIONS
        );
    }

    public static getInstance(): Sequelize {
        if(ConnectDB.instance) {
            return this.instance;
        }
        this.instance = ConnectDB.initialize();
        // Uncomment the line below if you want to sync the database on initialization
        // this.instance.sync();
        console.log(`Database synchronized and connected.`);
        return this.instance;
    }
}

const newSequelize = (): Sequelize => {
    return ConnectDB.getInstance();
};

export default newSequelize;