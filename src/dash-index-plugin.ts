import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import { DeclarationReflection, Reflection, ReflectionKind, Renderer } from 'typedoc';
import { RendererComponent } from 'typedoc/dist/lib/output/components';
import { PageEvent, RendererEvent } from 'typedoc/dist/lib/output/events';
import { ensureDirectoriesExist } from 'typedoc/dist/lib/utils';
import { DashTypeKind } from './dash-type-kind';

export class DashIndexPlugin extends RendererComponent {

  documentsPath: string;
  db: sqlite3.Database;

  constructor(owner: Renderer) {
    super(owner);
    owner.on(RendererEvent.BEGIN, this.onRendererBegin, this);
    owner.on(RendererEvent.END, this.onRendererEnd, this);
    owner.on(PageEvent.BEGIN, this.onRendererBeginPage, this);
  }

  private onRendererBegin(event: RendererEvent) {
    this.documentsPath = path.join(event.outputDirectory, 'Contents', 'Resources', 'Documents');
    ensureDirectoriesExist(this.documentsPath);

    const dbPath = path.join(event.outputDirectory, 'Contents', 'Resources', 'docSet.dsidx');
    const sqlite3v = sqlite3.verbose();

    this.db = new sqlite3v.Database(dbPath);

    this.db.serialize();
    this.db.run('CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT)');
    this.db.run('CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path)');
  }

  private onRendererEnd(event: RendererEvent) {
    this.db.close();
  }

  private onRendererBeginPage(page: PageEvent) {
    // redirect page to the documents folder
    page.filename = path.join(this.documentsPath, page.url);

    const model = page.model as DeclarationReflection;
    const dashTypeKind = DashTypeKind[model.kind];

    if (model.name && dashTypeKind && page.url) {
      this._addIndex(model.name, dashTypeKind, page.url);

      if (Array.isArray(model.children))
        model.children.forEach(child => {
          if (!child.kindOf([ReflectionKind.Function, ReflectionKind.Method, ReflectionKind.Property]))
            return;

          const childDashTypeKind = DashTypeKind[child.kind];
          if (child.name && childDashTypeKind && child.url) {
            const name = child.kindOf(ReflectionKind.Function) ? child.name : `${model.name}.${child.name}`;
            this._addIndex(name, childDashTypeKind, child.url);
          }
        });
    }
  }

  private _addIndex(name: string, type: string, url: string) {
    this.db.run(
      'INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)',
      [name, type, url],
      (_: sqlite3.RunResult, err: Error) => err && console.log(err),
    );
  }
}
