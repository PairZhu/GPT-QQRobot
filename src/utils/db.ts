import { Low, JSONFile } from 'lowdb';

export class DB {
    private db: Low;

    constructor(fileName: string) {
        if(!fileName.endsWith('.json')) {
            fileName += '.json';
        }
        const adapter = new JSONFile('config/'+fileName);
        this.db = new Low(adapter);
    }

    async init() {
        await this.db.read();
        this.db.data ||= {};
    }

    get(name: string, defaultValue: any = undefined) {
        return this.db.data[name] === undefined ? defaultValue : this.db.data[name];
    }

    async set(name: string, value: any) {
        this.db.data[name] = value;
        await this.db.write();
    }

    origin() {
        return this.db.data;
    }

    async save() {
        await this.db.write();
    }

    async delete(name: string) {
        delete this.db.data[name];
        await this.db.write();
    }
    
}