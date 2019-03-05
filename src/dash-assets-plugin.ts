import * as fs from 'fs-extra';
import * as path from 'path';
import { Renderer } from 'typedoc';
import { RendererComponent } from 'typedoc/dist/lib/output/components';
import { RendererEvent } from 'typedoc/dist/lib/output/events';
import { ensureDirectoriesExist } from 'typedoc/dist/lib/utils';

export class DashAssetsPlugin extends RendererComponent {

  constructor(owner: Renderer) {
    super(owner);
    owner.on(RendererEvent.BEGIN, this.onRendererBegin, this);
    owner.on(RendererEvent.END, this.onRendererEnd, this);
  }

  private onRendererBegin(event: RendererEvent) {
    const from = path.join(this.owner.theme.basePath, 'assets');
    const to = path.join(event.outputDirectory, 'Contents', 'Resources', 'Documents', 'assets');
    ensureDirectoriesExist(to);

    if (fs.existsSync(from))
      fs.copySync(from, to);

    this._copyIcons(event.outputDirectory);
  }

  private onRendererEnd(event: RendererEvent) {
    const assetsDirectory = path.join(event.outputDirectory, 'assets');
    fs.removeSync(assetsDirectory);
  }

  private _copyIcons(dstIconsPath: string) {
    const srcIconsPath = process.env.TYPEDOC_DASH_ICONS_PATH;

    if (!srcIconsPath) {
      console.log('\nNOTE: Docset icons are not specified!');
      console.log('      You can specify the directory where icon.png and icon@2x.png reside with');
      console.log('      TYPEDOC_DASH_ICONS_PATH environment variable. They will be copied into the docset.\n');

      return;
    }

    this._copyIcon(srcIconsPath, dstIconsPath, 'icon.png');
    this._copyIcon(srcIconsPath, dstIconsPath, 'icon@2x.png');
  }

  private _copyIcon(srcIconsPath: string, dstIconsPath: string, name: string) {
    const srcIconPath = path.join(srcIconsPath, name);
    const dstIconPath = path.join(dstIconsPath, name);
    if (fs.existsSync(srcIconPath))
      fs.copyFileSync(srcIconPath, dstIconPath);
  }
}
