import { Sequelize } from "sequelize";
import newSequelize from "./sequelize";

export const initializeDBConnection = async (): Promise<Sequelize> => {
    const sequelize = newSequelize();
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log("Connected successfully to the database server");
    } catch (err) {
        console.log("Failed to connect the database server");
        if (err instanceof Error) {
            console.log(err.stack);
        } else {
            console.log(err);
        }
        process.exit(1);
    }

    return sequelize;
};

export default initializeDBConnection;
