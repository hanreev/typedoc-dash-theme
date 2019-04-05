import * as fs from 'fs-extra';
import * as path from 'path';
import { NavigationItem, UrlMapping } from 'typedoc';
import {
  ContainerReflection,
  DeclarationReflection,
  ProjectReflection,
  Reflection,
  ReflectionKind
} from 'typedoc/dist/lib/models';
import { ReflectionGroup } from 'typedoc/dist/lib/models/ReflectionGroup';
import { RendererEvent } from 'typedoc/dist/lib/output/events';
import { Renderer } from 'typedoc/dist/lib/output/renderer';
import { Theme } from 'typedoc/dist/lib/output/theme';
import { ParameterType } from 'typedoc/dist/lib/utils/options/declaration';
import { DashAssetsPlugin } from './dash-assets-plugin';
import { DashIndexPlugin } from './dash-index-plugin';
import { DashTypeKind } from './dash-type-kind';
import { InfoPlistPlugin } from './info-plist-plugin';

export class DashDocsetTheme extends Theme {

  static MAPPINGS = [
    {
      kind: [ReflectionKind.Class],
      isLeaf: false,
      directory: 'classes',
      template: 'reflection.hbs',
    }, {
      kind: [ReflectionKind.Interface],
      isLeaf: false,
      directory: 'interfaces',
      template: 'reflection.hbs',
    }, {
      kind: [ReflectionKind.Enum],
      isLeaf: false,
      directory: 'enums',
      template: 'reflection.hbs',
    }, {
      kind: [ReflectionKind.Module, ReflectionKind.ExternalModule],
      isLeaf: false,
      directory: 'modules',
      template: 'reflection.hbs',
    }
  ];

  static getUrl(reflection: Reflection, relative?: Reflection, separator = '.') {
    let url = reflection.getAlias();
    if (reflection.parent && reflection.parent !== relative &&
      !(reflection.parent instanceof ProjectReflection))
      url = DashDocsetTheme.getUrl(reflection.parent, relative, separator) + separator + url;
    return url;
  }

  static getMapping(reflection: Reflection) {
    for (let i = 0, c = DashDocsetTheme.MAPPINGS.length; i < c; i++) {
      const mapping = DashDocsetTheme.MAPPINGS[i];
      if (reflection.kindOf(mapping.kind))
        return mapping;
    }
    return null;
  }

  static buildUrls(reflection: DeclarationReflection, urls: UrlMapping[]) {
    const mapping = DashDocsetTheme.getMapping(reflection);
    if (mapping) {
      const url = [mapping.directory, DashDocsetTheme.getUrl(reflection) + '.html'].join('/');
      urls.push(new UrlMapping(url, reflection, mapping.template));
      reflection.url = url;
      reflection.hasOwnDocument = true;
      for (const key in reflection.children) {
        const child = reflection.children[key];
        if (mapping.isLeaf)
          DashDocsetTheme.applyAnchorUrl(child, reflection);
        else
          DashDocsetTheme.buildUrls(child, urls);
      }
    } else
      DashDocsetTheme.applyAnchorUrl(reflection, reflection.parent);
    return urls;
  }

  static applyAnchorUrl(reflection: DeclarationReflection, container: Reflection) {
    let anchor = DashDocsetTheme.getUrl(reflection, container, '.');
    if (reflection['isStatic'])
      anchor = 'static-' + anchor;

    reflection.url = container.url + '#' + anchor;
    reflection.anchor = anchor;
    reflection.hasOwnDocument = false;
    reflection.traverse(child => {
      if (child instanceof DeclarationReflection)
        DashDocsetTheme.applyAnchorUrl(child, container);
    });
  }

  static applyReflectionDashKind(reflection: DeclarationReflection) {
    const dashTypeKind = DashTypeKind[reflection.kind];
    if (dashTypeKind)
      reflection['dashTypeKind'] = dashTypeKind;
  }

  static applyReflectionClasses(reflection: DeclarationReflection) {
    const classes: string[] = [];
    let kind: string;

    if (reflection.kind === ReflectionKind.Accessor)
      if (!reflection.getSignature)
        classes.push('tsd-kind-set-signature');
      else if (!reflection.setSignature)
        classes.push('tsd-kind-get-signature');
      else
        classes.push('tsd-kind-accessor');
    else {
      kind = ReflectionKind[reflection.kind];
      classes.push(DashDocsetTheme.toStyleClass('tsd-kind-' + kind));
    }

    if (reflection.parent && reflection.parent instanceof DeclarationReflection) {
      kind = ReflectionKind[reflection.parent.kind];
      classes.push(DashDocsetTheme.toStyleClass('tsd-parent-kind-' + kind));
    }

    let hasTypeParameters = !!reflection.typeParameters;
    reflection.getAllSignatures().forEach(signature => {
      hasTypeParameters = hasTypeParameters || !!signature.typeParameters;
    });

    if (hasTypeParameters)
      classes.push('tsd-has-type-parameter');

    if (reflection.overwrites)
      classes.push('tsd-is-overwrite');

    if (reflection.inheritedFrom)
      classes.push('tsd-is-inherited');

    if (reflection.flags.isPrivate)
      classes.push('tsd-is-private');

    if (reflection.flags.isProtected)
      classes.push('tsd-is-protected');

    if (reflection.flags.isStatic)
      classes.push('tsd-is-static');

    if (reflection.flags.isExternal)
      classes.push('tsd-is-external');

    if (!reflection.flags.isExported)
      classes.push('tsd-is-not-exported');

    reflection.cssClasses = classes.join(' ');
  }

  static applyGroupClasses(group: ReflectionGroup) {
    const classes: string[] = [];

    if (group.allChildrenAreInherited)
      classes.push('tsd-is-inherited');

    if (group.allChildrenArePrivate)
      classes.push('tsd-is-private');

    if (group.allChildrenAreProtectedOrPrivate)
      classes.push('tsd-is-private-protected');

    if (group.allChildrenAreExternal)
      classes.push('tsd-is-external');

    if (!group.someChildrenAreExported)
      classes.push('tsd-is-not-exported');

    group.cssClasses = classes.join(' ');
  }

  static toStyleClass(str: string) {
    return str.replace(/(\w)([A-Z])/g, (m, m1, m2) => m1 + '-' + m2).toLowerCase();
  }

  dashIndexPlugin: DashIndexPlugin;
  dashAssetsPlugin: DashAssetsPlugin;
  infoPlistPlugin: InfoPlistPlugin;

  constructor(renderer: Renderer, basePath: string) {
    super(renderer, basePath);
    this.dashIndexPlugin = new DashIndexPlugin(renderer);
    this.dashAssetsPlugin = new DashAssetsPlugin(renderer);
    this.infoPlistPlugin = new InfoPlistPlugin(renderer);
    renderer.on(RendererEvent.BEGIN, this.onRendererBegin, this, 1024);
  }

  isOutputDirectory(outPath: string) {
    if (!fs.existsSync(path.join(outPath, 'index.html')))
      return false;
    if (!fs.existsSync(path.join(outPath, 'assets')))
      return false;
    if (!fs.existsSync(path.join(outPath, 'assets', 'js', 'main.js')))
      return false;
    if (!fs.existsSync(path.join(outPath, 'assets', 'images', 'icons.png')))
      return false;
    return true;
  }

  getParameters() {
    return [{
      name: 'gaID',
      help: 'Set the Google Analytics tracking ID and activate tracking code.'
    }, {
      name: 'gaSite',
      help: 'Set the site name for Google Analytics. Defaults to `auto`.',
      defaultValue: 'auto',
    }, {
      name: 'hideGenerator',
      help: 'Do not print the TypeDoc link at the end of the page.',
      type: ParameterType.Boolean,
    }, {
      name: 'entryPoint',
      help: 'Specifies the fully qualified name of the root symbol. Defaults to global namespace.',
      type: ParameterType.String,
    }];
  }

  getUrls(project: ProjectReflection) {
    const urls: UrlMapping[] = [];
    const entryPoint = this.getEntryPoint(project);

    entryPoint.url = 'index.html';
    urls.push(new UrlMapping('index.html', entryPoint, 'reflection.hbs'));

    if (entryPoint.children)
      entryPoint.children.forEach(child => {
        DashDocsetTheme.buildUrls(child, urls);
      });
    return urls;
  }

  getEntryPoint(project: ProjectReflection) {
    const entryPoint = this.owner.application.options.getValue('entryPoint');
    if (entryPoint) {
      const reflection = project.getChildByName(entryPoint);
      if (reflection)
        if (reflection instanceof ContainerReflection)
          return reflection;
        else
          this.owner.application.logger.warn('The given entry point `%s` is not a container.', entryPoint);
      else
        this.owner.application.logger.warn('The entry point `%s` could not be found.', entryPoint);
    }
    return project;
  }

  getNavigation(project: ProjectReflection) {
    function containsExternals(modules: DeclarationReflection[]) {
      for (let index = 0, length = modules.length; index < length; index++)
        if (modules[index].flags.isExternal)
          return true;
      return false;
    }

    function sortReflections(modules: DeclarationReflection[]) {
      modules.sort((a, b) => {
        if (a.flags.isExternal && !b.flags.isExternal)
          return 1;
        if (!a.flags.isExternal && b.flags.isExternal)
          return -1;
        return a.getFullName() < b.getFullName() ? -1 : 1;
      });
    }

    function includeDedicatedUrls(reflection: DeclarationReflection, item: NavigationItem) {
      (function walk(refl) {
        for (const key in refl.children) {
          const child = refl.children[key];
          if (child.hasOwnDocument && !child.kindOf(ReflectionKind.SomeModule)) {
            if (!item.dedicatedUrls)
              item.dedicatedUrls = [];
            item.dedicatedUrls.push(child.url);
            walk(child);
          }
        }
      })(reflection);
    }

    function buildChildren(reflection: DeclarationReflection, parent: NavigationItem) {
      const modules = reflection.getChildrenByKind(ReflectionKind.SomeModule);
      modules.sort((a, b) => a.getFullName() < b.getFullName() ? -1 : 1);
      modules.forEach(refl => {
        const item = NavigationItem.create(refl, parent);
        includeDedicatedUrls(refl, item);
        buildChildren(refl, item);
      });
    }

    function buildGroups(
      reflections: DeclarationReflection[],
      parent: NavigationItem,
      callback?: (reflection?: DeclarationReflection, item?: NavigationItem) => void) {
      let state = -1;
      const hasExternals = containsExternals(reflections);
      sortReflections(reflections);
      reflections.forEach(reflection => {
        if (hasExternals && !reflection.flags.isExternal && state !== 1) {
          new NavigationItem('Internals', null, parent, 'tsd-is-external');
          state = 1;
        } else if (hasExternals && reflection.flags.isExternal && state !== 2) {
          new NavigationItem('Externals', null, parent, 'tsd-is-external');
          state = 2;
        }
        const item = NavigationItem.create(reflection, parent);
        includeDedicatedUrls(reflection, item);
        if (callback)
          callback(reflection, item);
      });
    }

    function build(hasSeparateGlobals: boolean) {
      const root = new NavigationItem('Index', 'index.html');
      if (entryPoint === project) {
        const globals = new NavigationItem('Globals', hasSeparateGlobals ? 'globals.html' : 'index.html', root);
        globals.isGlobals = true;
      }
      const modules = [];
      project.getReflectionsByKind(ReflectionKind.SomeModule).forEach(someModule => {
        let target = someModule.parent;
        let inScope = (someModule === entryPoint);
        while (target) {
          if (target.kindOf(ReflectionKind.ExternalModule))
            return;
          if (entryPoint === target)
            inScope = true;
          target = target.parent;
        }
        if (inScope)
          modules.push(someModule);
      });
      if (modules.length < 10)
        buildGroups(modules, root);
      else
        buildGroups(entryPoint.getChildrenByKind(ReflectionKind.SomeModule), root, buildChildren);
      return root;
    }
    const entryPoint = this.getEntryPoint(project);
    return build(this.owner.application.options.getValue('readme') !== 'none');
  }

  private onRendererBegin(event: RendererEvent) {
    if (event.project.groups)
      event.project.groups.forEach(DashDocsetTheme.applyGroupClasses);

    for (const id in event.project.reflections) {
      const reflection = event.project.reflections[id];

      if (reflection instanceof DeclarationReflection) {
        DashDocsetTheme.applyReflectionClasses(reflection);
        DashDocsetTheme.applyReflectionDashKind(reflection);
      }

      if (reflection instanceof ContainerReflection && reflection.groups)
        reflection.groups.forEach(DashDocsetTheme.applyGroupClasses);
    }
  }
}

export default DashDocsetTheme;
