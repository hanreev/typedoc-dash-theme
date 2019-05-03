"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const typedoc_1 = require("typedoc");
const models_1 = require("typedoc/dist/lib/models");
const events_1 = require("typedoc/dist/lib/output/events");
const theme_1 = require("typedoc/dist/lib/output/theme");
const declaration_1 = require("typedoc/dist/lib/utils/options/declaration");
const dash_assets_plugin_1 = require("./dash-assets-plugin");
const dash_index_plugin_1 = require("./dash-index-plugin");
const dash_type_kind_1 = require("./dash-type-kind");
const info_plist_plugin_1 = require("./info-plist-plugin");
class DashDocsetTheme extends theme_1.Theme {
    constructor(renderer, basePath) {
        super(renderer, basePath);
        this.dashIndexPlugin = new dash_index_plugin_1.DashIndexPlugin(renderer);
        this.dashAssetsPlugin = new dash_assets_plugin_1.DashAssetsPlugin(renderer);
        this.infoPlistPlugin = new info_plist_plugin_1.InfoPlistPlugin(renderer);
        renderer.on(events_1.RendererEvent.BEGIN, this.onRendererBegin, this, 1024);
    }
    static getUrl(reflection, relative, separator = '.') {
        let url = reflection.getAlias();
        if (reflection.parent && reflection.parent !== relative &&
            !(reflection.parent instanceof models_1.ProjectReflection))
            url = DashDocsetTheme.getUrl(reflection.parent, relative, separator) + separator + url;
        return url;
    }
    static getMapping(reflection) {
        for (let i = 0, c = DashDocsetTheme.MAPPINGS.length; i < c; i++) {
            const mapping = DashDocsetTheme.MAPPINGS[i];
            if (reflection.kindOf(mapping.kind))
                return mapping;
        }
        return null;
    }
    static buildUrls(reflection, urls) {
        const mapping = DashDocsetTheme.getMapping(reflection);
        if (mapping) {
            const url = [mapping.directory, DashDocsetTheme.getUrl(reflection) + '.html'].join('/');
            urls.push(new typedoc_1.UrlMapping(url, reflection, mapping.template));
            reflection.url = url;
            reflection.hasOwnDocument = true;
            for (const key in reflection.children) {
                const child = reflection.children[key];
                if (mapping.isLeaf)
                    DashDocsetTheme.applyAnchorUrl(child, reflection);
                else
                    DashDocsetTheme.buildUrls(child, urls);
            }
        }
        else
            DashDocsetTheme.applyAnchorUrl(reflection, reflection.parent);
        return urls;
    }
    static applyAnchorUrl(reflection, container) {
        let anchor = DashDocsetTheme.getUrl(reflection, container, '.');
        if (reflection['isStatic'])
            anchor = 'static-' + anchor;
        reflection.url = container.url + '#' + anchor;
        reflection.anchor = anchor;
        reflection.hasOwnDocument = false;
        reflection.traverse(child => {
            if (child instanceof models_1.DeclarationReflection)
                DashDocsetTheme.applyAnchorUrl(child, container);
        });
    }
    static applyReflectionDashKind(reflection) {
        const dashTypeKind = dash_type_kind_1.DashTypeKind[reflection.kind];
        if (dashTypeKind)
            reflection['dashTypeKind'] = dashTypeKind;
    }
    static applyReflectionClasses(reflection) {
        const classes = [];
        let kind;
        if (reflection.kind === models_1.ReflectionKind.Accessor)
            if (!reflection.getSignature)
                classes.push('tsd-kind-set-signature');
            else if (!reflection.setSignature)
                classes.push('tsd-kind-get-signature');
            else
                classes.push('tsd-kind-accessor');
        else {
            kind = models_1.ReflectionKind[reflection.kind];
            classes.push(DashDocsetTheme.toStyleClass('tsd-kind-' + kind));
        }
        if (reflection.parent && reflection.parent instanceof models_1.DeclarationReflection) {
            kind = models_1.ReflectionKind[reflection.parent.kind];
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
    static applyGroupClasses(group) {
        const classes = [];
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
    static toStyleClass(str) {
        return str.replace(/(\w)([A-Z])/g, (m, m1, m2) => m1 + '-' + m2).toLowerCase();
    }
    isOutputDirectory(outPath) {
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
                type: declaration_1.ParameterType.Boolean,
            }, {
                name: 'entryPoint',
                help: 'Specifies the fully qualified name of the root symbol. Defaults to global namespace.',
                type: declaration_1.ParameterType.String,
            }];
    }
    getUrls(project) {
        const urls = [];
        const entryPoint = this.getEntryPoint(project);
        entryPoint.url = 'index.html';
        urls.push(new typedoc_1.UrlMapping('index.html', entryPoint, 'reflection.hbs'));
        if (entryPoint.children)
            entryPoint.children.forEach(child => {
                DashDocsetTheme.buildUrls(child, urls);
            });
        return urls;
    }
    getEntryPoint(project) {
        const entryPoint = this.owner.application.options.getValue('entryPoint');
        if (entryPoint) {
            const reflection = project.getChildByName(entryPoint);
            if (reflection)
                if (reflection instanceof models_1.ContainerReflection)
                    return reflection;
                else
                    this.owner.application.logger.warn('The given entry point `%s` is not a container.', entryPoint);
            else
                this.owner.application.logger.warn('The entry point `%s` could not be found.', entryPoint);
        }
        return project;
    }
    getNavigation(project) {
        function containsExternals(modules) {
            for (let index = 0, length = modules.length; index < length; index++)
                if (modules[index].flags.isExternal)
                    return true;
            return false;
        }
        function sortReflections(modules) {
            modules.sort((a, b) => {
                if (a.flags.isExternal && !b.flags.isExternal)
                    return 1;
                if (!a.flags.isExternal && b.flags.isExternal)
                    return -1;
                return a.getFullName() < b.getFullName() ? -1 : 1;
            });
        }
        function includeDedicatedUrls(reflection, item) {
            (function walk(refl) {
                for (const key in refl.children) {
                    const child = refl.children[key];
                    if (child.hasOwnDocument && !child.kindOf(models_1.ReflectionKind.SomeModule)) {
                        if (!item.dedicatedUrls)
                            item.dedicatedUrls = [];
                        item.dedicatedUrls.push(child.url);
                        walk(child);
                    }
                }
            })(reflection);
        }
        function buildChildren(reflection, parent) {
            const modules = reflection.getChildrenByKind(models_1.ReflectionKind.SomeModule);
            modules.sort((a, b) => a.getFullName() < b.getFullName() ? -1 : 1);
            modules.forEach(refl => {
                const item = typedoc_1.NavigationItem.create(refl, parent);
                includeDedicatedUrls(refl, item);
                buildChildren(refl, item);
            });
        }
        function buildGroups(reflections, parent, callback) {
            let state = -1;
            const hasExternals = containsExternals(reflections);
            sortReflections(reflections);
            reflections.forEach(reflection => {
                if (hasExternals && !reflection.flags.isExternal && state !== 1) {
                    new typedoc_1.NavigationItem('Internals', null, parent, 'tsd-is-external');
                    state = 1;
                }
                else if (hasExternals && reflection.flags.isExternal && state !== 2) {
                    new typedoc_1.NavigationItem('Externals', null, parent, 'tsd-is-external');
                    state = 2;
                }
                const item = typedoc_1.NavigationItem.create(reflection, parent);
                includeDedicatedUrls(reflection, item);
                if (callback)
                    callback(reflection, item);
            });
        }
        function build(hasSeparateGlobals) {
            const root = new typedoc_1.NavigationItem('Index', 'index.html');
            if (entryPoint === project) {
                const globals = new typedoc_1.NavigationItem('Globals', hasSeparateGlobals ? 'globals.html' : 'index.html', root);
                globals.isGlobals = true;
            }
            const modules = [];
            project.getReflectionsByKind(models_1.ReflectionKind.SomeModule).forEach(someModule => {
                let target = someModule.parent;
                let inScope = (someModule === entryPoint);
                while (target) {
                    if (target.kindOf(models_1.ReflectionKind.ExternalModule))
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
                buildGroups(entryPoint.getChildrenByKind(models_1.ReflectionKind.SomeModule), root, buildChildren);
            return root;
        }
        const entryPoint = this.getEntryPoint(project);
        return build(this.owner.application.options.getValue('readme') !== 'none');
    }
    onRendererBegin(event) {
        if (event.project.groups)
            event.project.groups.forEach(DashDocsetTheme.applyGroupClasses);
        for (const id in event.project.reflections) {
            const reflection = event.project.reflections[id];
            if (reflection.constructor.name === 'DeclarationReflection') {
                DashDocsetTheme.applyReflectionClasses(reflection);
                DashDocsetTheme.applyReflectionDashKind(reflection);
            }
            if (reflection instanceof models_1.ContainerReflection && reflection.groups)
                reflection.groups.forEach(DashDocsetTheme.applyGroupClasses);
        }
    }
}
DashDocsetTheme.MAPPINGS = [
    {
        kind: [models_1.ReflectionKind.Class],
        isLeaf: false,
        directory: 'classes',
        template: 'reflection.hbs',
    }, {
        kind: [models_1.ReflectionKind.Interface],
        isLeaf: false,
        directory: 'interfaces',
        template: 'reflection.hbs',
    }, {
        kind: [models_1.ReflectionKind.Enum],
        isLeaf: false,
        directory: 'enums',
        template: 'reflection.hbs',
    }, {
        kind: [models_1.ReflectionKind.Module, models_1.ReflectionKind.ExternalModule],
        isLeaf: false,
        directory: 'modules',
        template: 'reflection.hbs',
    }
];
exports.DashDocsetTheme = DashDocsetTheme;
exports.default = DashDocsetTheme;
