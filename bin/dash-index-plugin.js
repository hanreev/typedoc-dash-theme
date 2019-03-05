"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite3 = require("sqlite3");
const path = require("path");
const components_1 = require("typedoc/dist/lib/output/components");
const typedoc_1 = require("typedoc");
const events_1 = require("typedoc/dist/lib/output/events");
const utils_1 = require("typedoc/dist/lib/utils");
const dash_type_kind_1 = require("./dash-type-kind");
class DashIndexPlugin extends components_1.RendererComponent {
    constructor(owner) {
        super(owner);
        owner.on(events_1.RendererEvent.BEGIN, this.onRendererBegin, this);
        owner.on(events_1.RendererEvent.END, this.onRendererEnd, this);
        owner.on(events_1.PageEvent.BEGIN, this.onRendererBeginPage, this);
    }
    onRendererBegin(event) {
        this.documentsPath = path.join(event.outputDirectory, 'Contents', 'Resources', 'Documents');
        utils_1.ensureDirectoriesExist(this.documentsPath);
        const dbPath = path.join(event.outputDirectory, 'Contents', 'Resources', 'docSet.dsidx');
        const sqlite3v = sqlite3.verbose();
        this.db = new sqlite3v.Database(dbPath);
        this.db.serialize();
        this.db.run('CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT)');
        this.db.run('CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path)');
    }
    onRendererEnd(event) {
        this.db.close();
    }
    onRendererBeginPage(page) {
        // redirect page to the documents folder
        page.filename = path.join(this.documentsPath, page.url);
        const model = page.model instanceof typedoc_1.Reflection;
        const dashTypeKind = dash_type_kind_1.DashTypeKind[page.model.kind];
        if (!(page.model.name && dashTypeKind && page.url))
            return;
        this.db.run('INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)', [page.model.name, dashTypeKind, page.url], (res, err) => err && console.log(err));
    }
}
exports.DashIndexPlugin = DashIndexPlugin;
