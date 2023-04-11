// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationChangeEvent, ConfigurationTarget, Uri, WorkspaceConfiguration, WorkspaceFolder } from 'vscode';
import { getInterpreterDetails } from './python';
import { getConfiguration, getWorkspaceFolder, getWorkspaceFolders } from './vscodeapi';
import { isUnitTestExecution } from './constants';
import { traceLog } from './log/logging';

const DEFAULT_SEVERITY: Record<string, string> = {
    convention: 'Information',
    error: 'Error',
    fatal: 'Error',
    refactor: 'Hint',
    warning: 'Warning',
    info: 'Information',
};

export interface ISettings {
    cwd: string;
    workspace: string;
    args: string[];
    severity: Record<string, string>;
    path: string[];
    interpreter: string[];
    importStrategy: string;
    showNotifications: string;
    extraPaths: string[];
}

export async function getExtensionSettings(namespace: string, includeInterpreter?: boolean): Promise<ISettings[]> {
    const settings: ISettings[] = [];
    const workspaces = getWorkspaceFolders();

    for (const workspace of workspaces) {
        const workspaceSetting = await getWorkspaceSettings(namespace, workspace, includeInterpreter);
        settings.push(workspaceSetting);
    }

    return settings;
}

function resolveWorkspace(workspace: WorkspaceFolder, value: string): string {
    return value.replace('${workspaceFolder}', workspace.uri.fsPath);
}

function getArgs(namespace: string, workspace: WorkspaceFolder): string[] {
    const config = getConfiguration(namespace, workspace.uri);
    const args = config.get<string[]>('args', []);

    if (args.length > 0) {
        return args;
    }
    return [];
}

export function getEnvFile(namespace: string, resource: Uri): string {
    const config = getConfiguration(namespace, resource);
    const envFile = config.get<string>('envFile', '');
    return envFile;
}

function getPath(namespace: string, workspace: WorkspaceFolder): string[] {
    const config = getConfiguration(namespace, workspace.uri);
    const path = config.get<string[]>('path', []);

    if (path.length > 0) {
        return path;
    }

    const legacyConfig = getConfiguration('debugpy', workspace.uri);
    const legacyPath = legacyConfig.get<string>('formatting.blackPath', '');
    if (legacyPath.length > 0 && legacyPath !== 'black') {
        return [legacyPath];
    }
    return [];
}

function getCwd(_namespace: string, workspace: WorkspaceFolder): string {
    const legacyConfig = getConfiguration('python', workspace.uri);
    const legacyCwd = legacyConfig.get<string>('linting.cwd');

    if (legacyCwd) {
        traceLog('Using cwd from `python.linting.cwd`.');
        return resolveWorkspace(workspace, legacyCwd);
    }

    return workspace.uri.fsPath;
}

function getExtraPaths(_namespace: string, workspace: WorkspaceFolder): string[] {
    const legacyConfig = getConfiguration('python', workspace.uri);
    const legacyExtraPaths = legacyConfig.get<string[]>('analysis.extraPaths', []);

    if (legacyExtraPaths.length > 0) {
        traceLog('Using cwd from `python.analysis.extraPaths`.');
    }
    return legacyExtraPaths;
}

export function getInterpreterFromSetting(namespace: string) {
    const config = getConfiguration(namespace);
    return config.get<string[]>('interpreter');
}

export async function getWorkspaceSettings(
    namespace: string,
    workspace: WorkspaceFolder,
    includeInterpreter?: boolean,
): Promise<ISettings> {
    const config = getConfiguration(namespace, workspace.uri);

    let interpreter: string[] | undefined = [];
    if (includeInterpreter) {
        interpreter = getInterpreterFromSetting(namespace);
        if (interpreter === undefined || interpreter.length === 0) {
            interpreter = (await getInterpreterDetails(workspace.uri)).path;
        }
    }

    const args = getArgs(namespace, workspace).map((s) => resolveWorkspace(workspace, s));
    const path = getPath(namespace, workspace).map((s) => resolveWorkspace(workspace, s));
    const extraPaths = getExtraPaths(namespace, workspace);
    const workspaceSetting = {
        cwd: getCwd(namespace, workspace),
        workspace: workspace.uri.toString(),
        args,
        severity: config.get<Record<string, string>>('severity', DEFAULT_SEVERITY),
        path,
        interpreter: (interpreter ?? []).map((s) => resolveWorkspace(workspace, s)),
        importStrategy: config.get<string>('importStrategy', 'fromEnvironment'),
        showNotifications: config.get<string>('showNotifications', 'off'),
        extraPaths: extraPaths.map((s) => resolveWorkspace(workspace, s)),
    };
    return workspaceSetting;
}

export function checkIfConfigurationChanged(e: ConfigurationChangeEvent, namespace: string): boolean {
    const settings = [
        `${namespace}.trace`,
        `${namespace}.args`,
        `${namespace}.path`,
        `${namespace}.interpreter`,
        `${namespace}.importStrategy`,
        `${namespace}.showNotifications`,
    ];
    const changed = settings.map((s) => e.affectsConfiguration(s));
    return changed.includes(true);
}

function getSettingsUriAndTarget(resource: Uri | undefined): { uri: Uri | undefined; target: ConfigurationTarget } {
    const workspaceFolder = resource ? getWorkspaceFolder(resource) : undefined;
    let workspaceFolderUri: Uri | undefined = workspaceFolder ? workspaceFolder.uri : undefined;
    const workspaceFolders = getWorkspaceFolders();
    if (!workspaceFolderUri && Array.isArray(workspaceFolders) && workspaceFolders.length > 0) {
        workspaceFolderUri = workspaceFolders[0].uri;
    }

    const target = workspaceFolderUri ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Global;
    return { uri: workspaceFolderUri, target };
}

export async function updateSetting(
    section: string = 'debugpy',
    setting: string,
    value?: unknown,
    resource?: Uri,
    configTarget?: ConfigurationTarget,
) {
    const defaultSetting = {
        uri: resource,
        target: configTarget || ConfigurationTarget.WorkspaceFolder,
    };
    let settingsInfo = defaultSetting;
    if (section === 'debugpy' && configTarget !== ConfigurationTarget.Global) {
        settingsInfo = getSettingsUriAndTarget(resource);
    }

    configTarget = configTarget || settingsInfo.target;

    const configSection = getConfiguration(section, settingsInfo.uri);
    const currentValue = configSection.inspect(setting);
    if (
        currentValue !== undefined &&
        ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
            (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
            (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))
    ) {
        return;
    }
    await configSection.update(setting, value, configTarget);
    await verifySetting(configSection, configTarget, setting, value);
}

export function isTestExecution(): boolean {
    return process.env.VSC_PYTHON_CI_TEST === '1';
}

export async function verifySetting(
    configSection: WorkspaceConfiguration,
    target: ConfigurationTarget,
    settingName: string,
    value?: unknown,
): Promise<void> {
    if (isTestExecution() && !isUnitTestExecution()) {
        let retries = 0;
        do {
            const setting = configSection.inspect(settingName);
            if (!setting && value === undefined) {
                break; // Both are unset
            }
            if (setting && value !== undefined) {
                // Both specified
                let actual;
                if (target === ConfigurationTarget.Global) {
                    actual = setting.globalValue;
                } else if (target === ConfigurationTarget.Workspace) {
                    actual = setting.workspaceValue;
                } else {
                    actual = setting.workspaceFolderValue;
                }
                if (actual === value) {
                    break;
                }
            }
            // Wait for settings to get refreshed.
            await new Promise((resolve) => setTimeout(resolve, 250));
            retries += 1;
        } while (retries < 20);
    }
}
