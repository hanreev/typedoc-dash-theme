import * as fs from 'fs-extra';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { ensureDirectoriesExist, writeFile } from 'typedoc/dist/lib/utils';
import { Renderer } from 'typedoc';
import { ContextAwareRendererComponent } from 'typedoc/dist/lib/output/components';
import { RendererEvent } from 'typedoc/dist/lib/output/events';

export class InfoPlistPlugin extends ContextAwareRendererComponent {

  constructor(owner: Renderer) {
    super(owner);
    Handlebars.registerHelper('relativeURL', (url: string) => url ? this.getRelativeUrl(url) : url);
    owner.on(RendererEvent.BEGIN, this.onRendererBegin, this);
  }

  private onRendererBegin(event: RendererEvent) {
    const name = event.settings.name;

    const dir = path.join(event.outputDirectory, 'Contents');
    ensureDirectoriesExist(dir);

    const file = path.join(dir, 'Info.plist');
    const templateFile = fs.readFileSync(path.join(this.owner.theme.basePath, 'templates', 'Info.plist.hsb'), 'utf-8');
    writeFile(file, Handlebars.compile(templateFile)({
      bundle: name.toLowerCase(),
      name,
    }), false);
  }
}
