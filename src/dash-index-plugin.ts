import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import { RendererComponent } from 'typedoc/dist/lib/output/components';
import { Renderer, Reflection } from 'typedoc';
import { RendererEvent, PageEvent } from 'typedoc/dist/lib/output/events';
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

    const model = page.model instanceof Reflection;
    const dashTypeKind = DashTypeKind[page.model.kind];

    if (!(page.model.name && dashTypeKind && page.url))
      return;

    this.db.run(
      'INSERT OR IGNORE INTO searchIndex(name, type, path) VALUES (?, ?, ?)',
      [page.model.name, dashTypeKind, page.url],
      (res: sqlite3.RunResult, err: Error) => err && console.log(err),
    );
  }
}
