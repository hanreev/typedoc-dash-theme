"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const sqlite3 = require("sqlite3");
const typedoc_1 = require("typedoc");
const components_1 = require("typedoc/dist/lib/output/components");
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
        const model = page.model;
        const dashTypeKind = dash_type_kind_1.DashTypeKind[model.kind];
        if (model.name && dashTypeKind && page.url) {
            this._addIndex(model.name, dashTypeKind, page.url);
            if (Array.isArray(model.children))
                model.children.forEach(child => {
                    if (!child.kindOf([typedoc_1.ReflectionKind.Function, typedoc_1.ReflectionKind.Method, typedoc_1.ReflectionKind.Property]))
                        return;
                    const childDashTypeKind = dash_type_kind_1.DashTypeKind[child.kind];
                    if (child.name && childDashTypeKind && child.url) {
                        const name = child.kindOf(typedoc_1.ReflectionKind.Function) ? child.name : `${model.name}.${child.name}`;
                        this._addIndex(name, childDashTypeKind, child.url);
                    }
                });
        }
    }
    _addIndex(name, type, url) {
        this.db.run('INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)', [name, type, url], (_, err) => err && console.log(err));
    }
}
exports.DashIndexPlugin = DashIndexPlugin;
