const { rgPath } = require('vscode-ripgrep');
const child_process = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const util = require('util');
const stat = util.promisify(fs.stat);
const rename = util.promisify(fs.rename);
const watch = require('node-watch');

const METASYNTACTIC_VARIABLES = ['💫'];
const OPEN_REGEXP = new RegExp(`(\\s*).+(${METASYNTACTIC_VARIABLES.join('|')})\\s+(\\w+)`);
const CLOSE_REGEXP = new RegExp(`(${METASYNTACTIC_VARIABLES.join('|')})(\\s+\\W|\\S|$)`);
const SWAP_FILE_EXTENSION = '.entangle.swp';

exports.Entangle = class Entangle {
    constructor(path) {
        this.path = path;
    }

    async run() {
        await this.findFilenames();
        await this.readHunks();
        await this.writeHunks();
        await this.swapFiles();
    }

    async watch() {
        await this.run();

        let running = false;

        watch(this.path, { recursive: true, delay: 200 }, (evt, name) => {
            if (running) {
                return;
            }

            running = true;

            this.run().then(() => {
                running = false;
            });
        });
    }

    async findFilenames() {
        return new Promise((resolve, reject) => {

            const proc = child_process.spawn(rgPath, ['--files-with-matches', OPEN_REGEXP.source, this.path]);

            this.filenames = [];

            readline.createInterface({
                input: proc.stdout,
                terminal: false,
            }).on('line', filename => {
                this.filenames.push(filename);
            })

            proc.on('close', code => {
                resolve();
            })

            proc.on('error', reject);
        });
    }

    async readHunks() {
        this.hunks = {};

        for (const filename of this.filenames) {
            await this.readHunksFromFile(filename);
        }
    }

    async readHunksFromFile(filename) {
        const { mtime } = await stat(filename);

        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filename);
            let hunk = null;
            let indent = '';

            readline.createInterface({
                input: stream,
            }).on('line', line => {
                const open = OPEN_REGEXP.exec(line);
                const close = CLOSE_REGEXP.exec(line);

                if (open) {
                    if (hunk) {
                        if (!this.hunks[hunk.name] || this.hunks[hunk.name].mtime < hunk.mtime) {
                            this.hunks[hunk.name] = hunk;
                        }
                    }

                    hunk = {
                        type: open[2],
                        name: open[3],
                        mtime: mtime,
                        lines: [],
                    }

                    indent = open[1];
                }

                if (hunk) {
                    hunk.lines.push(line.replace(new RegExp(`^${indent}`), ''));
                }

                if (close) {
                    if (!this.hunks[hunk.name] || this.hunks[hunk.name].mtime < hunk.mtime) {
                        this.hunks[hunk.name] = hunk;
                    }
                    hunk = null;
                }
            });

            stream.on('close', code => {
                resolve();
            });

            stream.on('error', reject);
        });
    }

    async writeHunks() {
        for (const filename of this.filenames) {
            await this.writeHunksToFile(filename);
        }
    }

    async writeHunksToFile(filename) {
        return new Promise((resolve, reject) => {
            const inStream = fs.createReadStream(filename);
            const outStream = fs.createWriteStream(filename + SWAP_FILE_EXTENSION);

            let hunk = null;

            readline.createInterface({
                input: inStream,
            }).on('line', line => {
                const open = OPEN_REGEXP.exec(line);
                const close = CLOSE_REGEXP.exec(line);
                let indent = '';

                if (open) {
                    indent = open[1];
                    hunk = this.hunks[open[3]];

                    if (!hunk) {
                        throw new Error(`Unable to find hunk named ${open[3]}`);
                    }

                    for (const hunkLine of hunk.lines) {
                        outStream.write(`${indent}${hunkLine}\n`);
                    }
                } else {
                    if (!hunk) {
                        outStream.write(line + '\n');
                    }

                    if (close) {
                        hunk = null;
                    }
                }
            });

            inStream.on('close', () => {
                outStream.end();
            });

            outStream.on('close', () => {
                resolve();
            });

            inStream.on('error', reject);
            outStream.on('error', reject);
        });
    }

    async swapFiles() {
        for (const filename of this.filenames) {
            await rename(filename + SWAP_FILE_EXTENSION, filename);
        }
    }
}
