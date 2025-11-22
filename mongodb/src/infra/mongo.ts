import { DBInterface } from "./db";
import { MongoClient, Db, Sort, Document } from "mongodb";


export class MongoDB implements DBInterface {
    db: Db;
    dbClient: MongoClient;

    constructor(mongoClient: MongoClient, dbName: string) {
        this.dbClient = mongoClient;
        this.db = mongoClient.db(dbName);
    }

    public async findOne(collectionName: string, predicate: Record<string, any>): Promise<any> {
        const row = await this.db.collection(collectionName).findOne(predicate);
        if (row) {
            return { ...row, id: row._id };
        }
        return null;
    }

    public async find(collectionName: string, predicate: Record<string, any>,
        options: { skip?: number; limit?: number; sort?: Sort } = {}, selectOptions: Record<string, unknown> = {}): Promise<any> {
   
        const rows: any = [];
        const cursor = this.db.collection(collectionName).find(predicate, options).project(selectOptions);

        for await (const document of cursor) {
            rows.push({ ...document, id: document._id });
        }
        return rows;
    }

    public async create<T extends Document>(collectionName: string, model: T): Promise<T> {
        const result = await this.db.collection(collectionName).insertOne(model);
        if (!result.acknowledged) {
            throw new Error("Failed to insert");
        }
        return { ...model, id: result.insertedId };
    }

    public async update(collectionName: string, predicate: object, toUpdate: object): Promise<any> {
        return this.db.collection(collectionName).updateOne(predicate, { $set: toUpdate });
    }

	public async updateMany(collectionName: string, predicate: object, toUpdate: object): Promise<any> {
        return this.db.collection(collectionName).updateMany(predicate, { $set: toUpdate });
    }

    public async deleteMany(collectionName: string, predicate: object, ): Promise<any> {
        return this.db.collection(collectionName).deleteMany(predicate);
    }

    public async delete(collectionName: string, predicate: object, ): Promise<any> {
        return this.db.collection(collectionName).deleteOne(predicate);
    }

    public async count(collectionName: string, predicate: Record<string, any>, ): Promise<number> {
        return this.db.collection(collectionName).countDocuments(predicate);
    }

    public async insertMany(collectionName: string, models: any[], options: object): Promise<any> {
        return this.db.collection(collectionName).insertMany(models, options);
    }
}

export const newMongoDB = async (mongoClient: MongoClient, dbName: string): Promise<DBInterface> => {
    return new MongoDB(mongoClient, dbName);
};


export const initializeDBConnection = async (dbURI: string, dbName: string): Promise<DBInterface> => {
    const client = new MongoClient(dbURI);

    try {
        await client.connect();
        console.log("Connected successfully to the database server");
    } catch (err) {
        console.log("failed to connect the database server");
        if (err instanceof Error) {
            console.log(err.stack);
        } else {
            console.log(err);
        }
        process.exit(1);
    }

    return newMongoDB(client, dbName);
};

export default MongoDB;