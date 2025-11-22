import { Sort, Document } from "mongodb/mongodb";

export interface DBInterface {
    create<T extends Document>(collectionName: string, model: T): Promise<T>;
    insertMany(collectionName: string, models: any[], options: object): Promise<any>;
    update(collectionName: string, predicate: object, toUpdate: object): Promise<any>;
    updateMany(collectionName: string, predicate: object, toUpdate: object): Promise<any>;
    deleteMany(collectionName: string, predicate: object): Promise<any>;
    delete(collectionName: string, predicate: object): Promise<any>;
    findOne(collectionName: string, predicate: Record<string, any>): Promise<any>;
    find(collectionName: string, predicate: Record<string, any>,
        options: { skip?: number; limit?: number; sort?: Sort }, selectOptions?: Record<string, unknown>): Promise<any>;   
    count(collectionName: string, predicate: Record<string, any>): Promise<number>;
}