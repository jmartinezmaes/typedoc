/* eslint-disable no-console */

const ExitCodes = {
    Ok: 0,
    OptionError: 1,
    CompileError: 3,
    ValidationError: 4,
    OutputError: 5,
    ExceptionThrown: 6,
    Watching: 7,
};

import * as td from "typedoc";

void main();

async function main() {
    let app: td.Application | undefined;

    try {
        const start = Date.now();

        app = await td.Application.bootstrapWithPlugins({}, [
            new td.ArgumentsReader(0),
            new td.TypeDocReader(),
            new td.PackageJsonReader(),
            new td.TSConfigReader(),
            new td.ArgumentsReader(300),
        ]);

        const exitCode = await run(app);
        if (exitCode !== ExitCodes.Watching) {
            app.logger.verbose(`Full run took ${Date.now() - start}ms`);
            process.exit(exitCode);
        }
    } catch (error) {
        console.error("TypeDoc exiting with unexpected error:");
        console.error(error);
        if (app?.options.getValue("skipErrorChecking")) {
            console.error(
                "Try turning off --skipErrorChecking. If TypeDoc still crashes, please report a bug.",
            );
        }
        process.exit(ExitCodes.ExceptionThrown);
    }
}

async function run(app: td.Application) {
    if (app.options.getValue("version")) {
        console.log(`TypeDoc ${td.Application.VERSION}`);
        console.log(
            `Using TypeScript ${app.getTypeScriptVersion()} from ${app.getTypeScriptPath()}`,
        );
        return ExitCodes.Ok;
    }

    if (app.options.getValue("help")) {
        console.log(app.options.getHelp());
        return ExitCodes.Ok;
    }

    if (app.options.getValue("showConfig")) {
        console.log(app.options.getRawValues());
        return ExitCodes.Ok;
    }

    if (app.logger.hasErrors()) {
        return ExitCodes.OptionError;
    }
    if (
        app.options.getValue("treatWarningsAsErrors") &&
        app.logger.hasWarnings()
    ) {
        return ExitCodes.OptionError;
    }

    if (app.options.getValue("watch")) {
        app.convertAndWatch(async (project) => {
            await app.generateOutputs(project);
        });
        return ExitCodes.Watching;
    }

    const project = await app.convert();
    if (!project) {
        return ExitCodes.CompileError;
    }
    if (
        app.options.getValue("treatWarningsAsErrors") &&
        app.logger.hasWarnings()
    ) {
        return ExitCodes.CompileError;
    }

    const preValidationWarnCount = app.logger.warningCount;
    app.validate(project);
    const hadValidationWarnings =
        app.logger.warningCount !== preValidationWarnCount;
    if (app.logger.hasErrors()) {
        return ExitCodes.ValidationError;
    }
    if (
        hadValidationWarnings &&
        (app.options.getValue("treatWarningsAsErrors") ||
            app.options.getValue("treatValidationWarningsAsErrors"))
    ) {
        return ExitCodes.ValidationError;
    }

    if (app.options.getValue("emit") !== "none") {
        await app.generateOutputs(project);

        if (app.logger.hasErrors()) {
            return ExitCodes.OutputError;
        }
        if (
            app.options.getValue("treatWarningsAsErrors") &&
            app.logger.hasWarnings()
        ) {
            return ExitCodes.OutputError;
        }
    }

    return ExitCodes.Ok;
}
